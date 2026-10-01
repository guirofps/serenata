import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELO_LETRA, registrarCustoLetra } from "@/lib/custos";
import { dispararGeracaoMusica } from "@/lib/gerar-letra";
import { chamarClaude } from "@/lib/recuperacao-letra";
import { cobrarUso, TETO_REFACAO } from "@/lib/limite-uso.server";
import { acharGenero } from "@/lib/generos";

// A REFAÇÃO DO CLIENTE: "não ficou do meu jeito, refaz".
//
// ── O QUE A PAYWALL PROMETE ──────────────────────────────────────
//
// "Depois de comprar, você pede um ajuste na sua conta: trocar um trecho da
// letra, mudar o estilo ou a voz. A gente regrava e te manda a nova versão."
// Este arquivo é essa frase.
//
// ── QUEM PODE, E POR QUE NÃO É O LOGIN ───────────────────────────
//
// A credencial é o `token_edicao`, o mesmo link que vai no e-mail de entrega.
// NÃO é a sessão do Supabase, e isso é medido: 248 dos 294 compradores nunca
// entraram na conta. Exigir login aqui seria prometer na paywall uma coisa que
// 84% dos compradores não conseguiriam usar.
//
// É a mesma credencial do editor do presente, e a mesma regra: quem tem o
// link é o dono.
//
// ── AS TRÊS TRAVAS, NESTA ORDEM ──────────────────────────────────
//
// 1. PAGOU? Refação é promessa da compra. Sem pedido pago, não existe.
// 2. TEM DIREITO? `refacoes_incluidas - refacoes_usadas`. Uma vem com a
//    compra; vender mais é somar em `incluidas`.
// 3. NÃO ESTÁ GRAVANDO? Pedir de novo no meio de uma gravação criaria duas
//    versões concorrentes pro mesmo pedido.
//
// ── AS VERSÕES SOMAM ─────────────────────────────────────────────
//
// Antes de reescrever, a gravação atual inteira (letra, títulos, áudios e
// timestamps) é arquivada em `versoes_musica`. O custo dela já foi pago e não
// volta: apagar não devolve nada, guardar transforma o mesmo gasto em mais
// produto, e cobre o arrependimento de quem ouve o ajuste e prefere o
// original.

export type PedidoRefacao = {
  tokenEdicao: string;
  /** O que ela não gostou e o que quer no lugar, em texto livre. */
  pedido: string;
  /** Opcionais: quando vazios, mantém o que já estava. */
  estilo?: string;
  voz?: string;
};

export type ResultadoRefacao =
  | { ok: true; restantes: number }
  | {
      ok: false;
      /**
       * `nao-encontrada` — token inválido.
       * `nao-pago`       — não há compra para esta música.
       * `sem-direito`    — já usou o ajuste que vinha incluído.
       * `gravando`       — já existe uma regravação em curso.
       * `curto`          — o pedido não diz o que mudar.
       * `vago`           — o pedido não dá para aplicar sem inventar fato.
       * `falhou`         — erro nosso.
       */
      erro:
        "nao-encontrada" | "nao-pago" | "sem-direito" | "gravando" | "curto" | "vago" | "falhou";
      /**
       * Só em `vago`: o que faltou no pedido para conseguir aplicar.
       *
       * Vem do campo `aviso` do JSON, que o `SYSTEM_AJUSTE` manda preencher
       * exatamente nesse caso. O direito de refação NÃO é gasto aqui.
       */
      falta?: string;
    };

export const pedirRefacao = createServerFn({ method: "POST" })
  .validator((data: PedidoRefacao) => data)
  .handler(async ({ data }): Promise<ResultadoRefacao> => {
    const pedido = (data.pedido ?? "").trim();
    // VOZ E ESTILO SÃO PEDIDO COMPLETO SOZINHOS (30/09). Quem só quer voz
    // masculina não tem o que escrever sobre a letra, e era barrado aqui ou
    // como "vago" mais abaixo. Estilo vale só se for um gênero do catálogo:
    // é ele que a gravação lê (`musicas.genero`), e texto solto não chegava lá.
    const novoGenero = acharGenero(data.estilo)?.value ?? null;
    const novaVoz = data.voz === "feminina" || data.voz === "masculina" ? data.voz : null;
    const mudaSom = Boolean(novoGenero || novaVoz);
    // Teto de tamanho: o campo é livre e vai pro Claude. Uma ordem de grandeza
    // acima do uso real, então só aparece pra quem está tentando outra coisa.
    if (pedido.length > 2000 || (pedido.length < 3 && !mudaSom))
      return { ok: false, erro: "curto" };

    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select(
        "id, letra, titulo, estilo_suno, audio_path, audio_path_v2, timestamps, timestamps_v2, status, quiz_response_id, refacoes_incluidas, refacoes_usadas",
      )
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.id || !m.letra) return { ok: false, erro: "nao-encontrada" };

    // ── 1. PAGOU? ────────────────────────────────────────────
    const { data: pago } = await db
      .from("pedidos")
      .select("id")
      .eq("quiz_response_id", m.quiz_response_id)
      .eq("status", "pago")
      .limit(1)
      .maybeSingle();
    if (!pago?.id) return { ok: false, erro: "nao-pago" };

    // ── 2. TEM DIREITO? ──────────────────────────────────────
    const restantes = (m.refacoes_incluidas ?? 1) - (m.refacoes_usadas ?? 0);
    if (restantes < 1) return { ok: false, erro: "sem-direito" };

    // ── 3. JÁ ESTÁ GRAVANDO? ─────────────────────────────────
    if (m.status === "gerando") return { ok: false, erro: "gravando" };

    // Teto de uso, como nas outras rotas que gastam dinheiro. Falha ABERTO:
    // banco fora do ar não pode barrar quem já pagou.
    try {
      await cobrarUso(TETO_REFACAO, m.id);
    } catch {
      // Ver comentário acima.
    }

    try {
      // ── ARQUIVA O QUE EXISTE ───────────────────────────────
      // Antes de qualquer escrita: se o Claude falhar depois, a pessoa
      // continua com a música dela intacta e o direito ainda não gasto.
      const ordem = (m.refacoes_usadas ?? 0) + 1;
      // O ARQUIVO, não só o caminho (01/10): a gravação nova sai no mesmo
      // `<id>/v1.mp3` com upsert, então guardar o caminho era guardar um
      // ponteiro pro que ia ser sobrescrito (258 de 259 versões perdidas).
      // Copia pra `<id>/versoes/<ordem>/`; se a cópia falhar, fica o caminho
      // antigo, que é o comportamento de antes.
      const guardarCopia = async (caminho: string | null, nome: string) => {
        if (!caminho) return caminho;
        const destino = `${m.id}/versoes/${ordem}/${nome}`;
        const { error } = await db.storage.from("musicas").copy(caminho, destino);
        if (error && !/exists/i.test(error.message)) {
          console.error("[refacao] cópia da versão falhou:", caminho, error.message);
          return caminho;
        }
        return destino;
      };
      const audioV1 = await guardarCopia(m.audio_path, "v1.mp3");
      const audioV2 = await guardarCopia(m.audio_path_v2, "v2.mp3");
      await db.from("versoes_musica").insert({
        musica_id: m.id,
        ordem,
        letra: m.letra,
        titulo: m.titulo,
        estilo_suno: m.estilo_suno,
        audio_path: audioV1,
        audio_path_v2: audioV2,
        timestamps: m.timestamps,
        timestamps_v2: m.timestamps_v2,
        pedido,
      });

      // ── REESCREVE (só se houver pedido sobre a letra) ──────
      let nova = (m.letra ?? "").trim();
      let tituloNovo: string = m.titulo;
      if (pedido.length >= 3) {
        const extras: string[] = [];
        if (data.estilo?.trim()) extras.push(`Novo estilo pedido: ${data.estilo.trim()}`);
        if (data.voz?.trim()) extras.push(`Nova voz pedida: ${data.voz.trim()}`);
        const { texto, uso } = await chamarClaude(
          `LETRA ATUAL:\n${m.letra}\n\nPEDIDO DO CLIENTE:\n${pedido}` +
            (extras.length ? `\n\n${extras.join("\n")}` : ""),
        );
        const j = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1)) as {
          letra?: string;
          titulo?: string;
          mudou?: string[];
          aviso?: string;
        };
        const reescrita = (j.letra ?? "").trim();
        if (!reescrita) throw new Error("modelo não devolveu letra");

        // ── O PEDIDO FOI VAGO DEMAIS? ────────────────────────────
        //
        // O `SYSTEM_AJUSTE` tem uma saída de emergência: "se o pedido for vago
        // demais para aplicar sem inventar, devolva a letra intacta e diga o que
        // falta". Ele cumpre isso preenchendo `aviso` e deixando `mudou` vazio.
        //
        // Até 01/09 este código lia só `letra` e `titulo`, e a saída de
        // emergência ia pro lixo: a letra IDÊNTICA era salva como se fosse nova,
        // a refação era marcada como usada e a música era regravada igual.
        //
        // O custo disso tem nome. Hudson, 31/08: pediu "não gostei do trecho que
        // fala sobre o bolo de fubá" sem dizer o que queria no lugar. Trocar
        // exigia inventar, o modelo avisou, o aviso foi ignorado, e ele ouviu a
        // mesma música com o mesmo fubá e sem direito a outro ajuste. Refez o
        // quiz inteiro e pagou R$ 38 de novo. Na segunda vez ele escreveu o que
        // queria no lugar, e funcionou de primeira.
        //
        // Todo pedido no formato "não gostei de X", sem dizer o substituto, caía
        // aqui e queimava a refação em silêncio.
        //
        // Letra IDÊNTICA também conta como falha, mesmo sem aviso: se nada mudou,
        // não há o que regravar, e gastar o direito seria cobrar por nada.
        const aviso = (j.aviso ?? "").trim();
        const mudou = Array.isArray(j.mudou) ? j.mudou.filter((x) => String(x).trim()) : [];
        const igual = reescrita === (m.letra ?? "").trim();
        await registrarCustoLetra({
          quizResponseId: m.quiz_response_id,
          modelo: MODELO_LETRA,
          uso,
        });
        // O pedido FALA DA LETRA (incluir, nome, verso, frase...)? "mudar" e "trocar"
        // ficam de fora: "quero mudar a voz" é pedido de SOM, não de letra.
        // Aí letra intacta não pode virar "regrava só a voz": em 01/10 o Ronaldo
        // pediu "incluir o nome dos filhos Samuel e João" junto com voz nova, a
        // letra voltou igual, a voz mudou e o ajuste foi gasto calado.
        const pedeLetra =
          /\b(inclu|coloc|acrescent|adicion|remov|substitu|corrig|nome|verso|frase|letra|refr|trecho|palavra)/i.test(
            pedido,
          );
        if (!(aviso || !mudou.length || igual)) {
          nova = reescrita;
          tituloNovo = j.titulo?.trim() || m.titulo;
        } else if (!mudaSom || pedeLetra || aviso) {
          // Desfaz o arquivamento, que aconteceu ANTES da chamada. Sem isto
          // sobraria uma versão órfã ocupando esta `ordem`: a próxima tentativa
          // esbarraria nela e o histórico contaria um ajuste que não houve.
          await db.from("versoes_musica").delete().eq("musica_id", m.id).eq("ordem", ordem);
          console.warn("[refacao] pedido vago, direito preservado", {
            musica: m.id,
            temAviso: Boolean(aviso),
            mudou: mudou.length,
            igual,
          });
          return {
            ok: false,
            erro: "vago",
            falta: aviso || "Me diz também o que você quer no lugar desse trecho.",
          };
        }
        // Letra vaga MAS com voz/estilo novos: regrava só o som, letra intacta.
        // Era aqui que "quero voz masculina" morria como "vago" (202 recusas
        // desde 01/09) e virava regravação à mão pelo suporte.
      }

      // ── VOZ E ESTILO NO LUGAR QUE A GRAVAÇÃO LÊ ─────────────
      // A voz sai de `quiz_responses.respostas.voz` e o gênero de
      // `musicas.genero` (ver `gerarMusica`). Até 30/09 a refação gravava o
      // estilo em `estilo_suno`, que o `estiloParaSuno` descarta, e a voz em
      // lugar nenhum: a música voltava com a mesma voz e o mesmo ritmo.
      if (novaVoz) {
        const { data: q } = await db
          .from("quiz_responses")
          .select("respostas")
          .eq("id", m.quiz_response_id)
          .maybeSingle();
        await db
          .from("quiz_responses")
          .update({
            respostas: { ...((q?.respostas as Record<string, unknown>) ?? {}), voz: novaVoz },
          })
          .eq("id", m.quiz_response_id);
      }

      // ── GRAVA E MANDA REGRAVAR ─────────────────────────────
      // Os áudios antigos são LIMPOS da linha principal (já estão arquivados),
      // senão a página presente tocaria a gravação velha com a letra nova, que
      // é pior que não ter mudado nada.
      await db
        .from("musicas")
        .update({
          letra: nova,
          titulo: tituloNovo,
          ...(novoGenero ? { genero: novoGenero } : {}),
          audio_path: null,
          audio_path_v2: null,
          timestamps: null,
          timestamps_v2: null,
          status: "gerando",
          erro: null,
          refacoes_usadas: ordem,
        })
        .eq("id", m.id);

      await dispararGeracaoMusica(m.id);
      return { ok: true, restantes: restantes - 1 };
    } catch (err) {
      console.error("[refacao] falhou:", err);
      return { ok: false, erro: "falhou" };
    }
  });

/** O que a tela precisa saber pra decidir se mostra o botão. */
export const estadoRefacao = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ pago: boolean; restantes: number; gravando: boolean; versoes: number }> => {
      const vazio = { pago: false, restantes: 0, gravando: false, versoes: 0 };
      const db = supabaseAdmin();
      const { data: m } = await db
        .from("musicas")
        .select("id, status, quiz_response_id, refacoes_incluidas, refacoes_usadas")
        .eq("token_edicao", data.tokenEdicao)
        .maybeSingle();
      if (!m?.id) return vazio;

      const [{ data: pago }, { count }] = await Promise.all([
        db
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", m.quiz_response_id)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle(),
        db
          .from("versoes_musica")
          .select("id", { count: "exact", head: true })
          .eq("musica_id", m.id),
      ]);

      return {
        pago: Boolean(pago?.id),
        restantes: Math.max(0, (m.refacoes_incluidas ?? 1) - (m.refacoes_usadas ?? 0)),
        gravando: m.status === "gerando",
        versoes: count ?? 0,
      };
    },
  );
