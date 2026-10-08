import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELO_LETRA, registrarCustoLetra } from "@/lib/custos";
import { dispararGeracaoMusica } from "@/lib/gerar-letra";
import { chamarClaude } from "@/lib/recuperacao-letra";
import { cobrarUso, LimiteEstourado, TETO_REFACAO } from "@/lib/limite-uso.server";
import { acharGenero } from "@/lib/generos";
import { extrairJsonTolerante } from "@/lib/json-tolerante";
import {
  decidirAjuste,
  pareceLetraInteira,
  PEDIDO_MAX,
  vozDoPedido,
  type RespostaAjuste,
} from "@/lib/refacao-decisao";

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
// Antes de regravar, a gravação atual inteira (letra, títulos, áudios e
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
       * `longo`          — o pedido passa de `PEDIDO_MAX`.
       * `vago`           — o pedido não dá para aplicar sem inventar fato.
       * `limite`         — tentativas demais na última hora (`TETO_REFACAO`).
       * `falhou`         — erro nosso.
       */
      erro:
        | "nao-encontrada"
        | "nao-pago"
        | "sem-direito"
        | "gravando"
        | "curto"
        | "longo"
        | "vago"
        | "limite"
        | "falhou";
      /**
       * Só em `vago`: o que faltou no pedido para conseguir aplicar.
       *
       * Vem do campo `falta` do JSON (ou do `aviso`, se o modelo usou só ele),
       * que o `SYSTEM_AJUSTE` manda escrever falando com o cliente. O direito
       * de refação NÃO é gasto aqui.
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
    let novaVoz: "feminina" | "masculina" | null =
      data.voz === "feminina" || data.voz === "masculina" ? data.voz : null;
    // Teto de tamanho: o campo é livre e vai pro Claude (ver `PEDIDO_MAX`).
    // Até 07/10 o excesso voltava como `curto` ("escreva um pouquinho mais"),
    // que é a frase errada pra quem colou texto demais.
    if (pedido.length > PEDIDO_MAX) return { ok: false, erro: "longo" };
    if (pedido.length < 3 && !novoGenero && !novaVoz) return { ok: false, erro: "curto" };

    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select(
        "id, letra, titulo, estilo_suno, genero, audio_path, audio_path_v2, timestamps, timestamps_v2, status, quiz_response_id, refacoes_incluidas, refacoes_usadas",
      )
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.id || !m.letra) return { ok: false, erro: "nao-encontrada" };

    // ── VOZ OU ESTILO IGUAIS AOS DE AGORA NÃO SÃO PEDIDO (04/10) ──
    //
    // O formulário manda a voz e o estilo escolhidos mesmo quando a pessoa só
    // reabriu o seletor e deixou o que já estava. Com o pedido de letra vazio,
    // isso contava como "pedido de som" e regravava a música IGUAL, gastando o
    // ajuste: a Fabiana (03/10) mandou o ajuste vazio, recebeu a mesma letra
    // com o mesmo verso que queria tirar, e ficou sem direito. Só conta como
    // mudança de som o que difere do que a música já tem.
    if (pedido.length < 3) {
      const { data: q } = await db
        .from("quiz_responses")
        .select("respostas")
        .eq("id", m.quiz_response_id)
        .maybeSingle();
      const vozAtual = String((q?.respostas as Record<string, unknown> | null)?.voz ?? "");
      const generoMuda = Boolean(novoGenero && novoGenero !== m.genero);
      const vozMuda = Boolean(novaVoz && novaVoz !== vozAtual);
      if (!generoMuda && !vozMuda) return { ok: false, erro: "curto" };
    }

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
    const usadasAntes = m.refacoes_usadas ?? 0;
    const restantes = (m.refacoes_incluidas ?? 1) - usadasAntes;
    if (restantes < 1) return { ok: false, erro: "sem-direito" };

    // ── 3. JÁ ESTÁ GRAVANDO? ─────────────────────────────────
    if (m.status === "gerando") return { ok: false, erro: "gravando" };

    // Teto de uso, como nas outras rotas que gastam dinheiro. Falha ABERTO só
    // quando o BANCO falha (`cobrarUso` já devolve "cabe" nesse caso): quem já
    // pagou não pode ser barrado por banco fora do ar. Até 07/10 este `catch`
    // engolia também o `LimiteEstourado`, e o teto não barrava ninguém.
    try {
      await cobrarUso(TETO_REFACAO, m.id);
    } catch (err) {
      if (err instanceof LimiteEstourado) return { ok: false, erro: "limite" };
    }

    const ordem = usadasAntes + 1;
    // Só verdadeiro depois que ESTA chamada gravou a versão arquivada: é o
    // que o `catch` lá embaixo precisa saber pra não deixar órfã.
    let arquivou = false;
    try {
      // ── REESCREVE (só se houver pedido sobre a letra) ──────
      //
      // ANTES de qualquer escrita no banco (07/10). Até aqui o arquivamento
      // vinha primeiro e o modelo depois: quando o modelo falhava, a versão
      // arquivada ficava órfã (13 em 15 dias, a da Carmelina entre elas) e a
      // próxima tentativa esbarrava no índice único de `(musica_id, ordem)`.
      // O modelo não escreve nada, então chamá-lo primeiro deixa a música
      // intacta em qualquer desfecho.
      let nova = (m.letra ?? "").trim();
      let tituloNovo: string = m.titulo;
      if (pedido.length >= 3) {
        const extras: string[] = [];
        if (data.estilo?.trim()) extras.push(`Novo estilo pedido: ${data.estilo.trim()}`);
        if (data.voz?.trim()) extras.push(`Nova voz pedida: ${data.voz.trim()}`);
        // Letra colada inteira: o aviso explícito evita o modelo tratar os
        // versos dela como "sugestão" e mexer o mínimo na letra antiga.
        if (pareceLetraInteira(pedido))
          extras.push(
            "O pedido parece ser uma letra inteira escrita pelo cliente. Se for, ela é a letra nova: use os versos dele.",
          );
        const { texto, uso, stopReason } = await chamarClaude(
          `LETRA ATUAL:\n${m.letra}\n\nPEDIDO DO CLIENTE:\n${pedido}` +
            (extras.length ? `\n\n${extras.join("\n")}` : ""),
        );
        await registrarCustoLetra({
          quizResponseId: m.quiz_response_id,
          modelo: MODELO_LETRA,
          uso,
        });
        if (stopReason === "max_tokens") throw new Error("resposta cortada no max_tokens");
        // Tolerante (07/10): aspa sem escape dentro da letra derrubava o
        // `JSON.parse` estrito e virava "falhou". Ver `json-tolerante.ts`.
        const j = extrairJsonTolerante<RespostaAjuste>(texto);

        // Voz pedida por escrito ("quero voz masculina") vale como o botão.
        novaVoz = novaVoz ?? vozDoPedido(j);

        // ── O PEDIDO FOI VAGO DEMAIS? ────────────────────────────
        //
        // Hudson, 31/08: pediu "não gostei do trecho do bolo de fubá", a letra
        // voltou IDÊNTICA, foi salva como nova, o direito foi gasto e ele
        // ouviu a mesma música. Daí a regra: letra igual nunca gasta o ajuste.
        //
        // Mas a régua antiga (qualquer `aviso` recusa) barrava pedido aplicado:
        // 81 recusas "vago" em 7 dias, 36 compradores pagos sem conseguir. A
        // decisão agora olha a LETRA, ver `refacao-decisao.ts`.
        const decisao = decidirAjuste({
          letraAtual: m.letra ?? "",
          resposta: j,
          pedido,
          mudaSom: Boolean(novoGenero || novaVoz),
        });
        if (decisao.tipo === "vago") {
          // O pedido vai pro log (só servidor): é a única forma de ler depois
          // o que foi recusado, e o evento do funil não leva texto do cliente.
          console.warn("[refacao] pedido vago, direito preservado", {
            musica: m.id,
            pedido: pedido.slice(0, 300),
            falta: decisao.falta,
          });
          return { ok: false, erro: "vago", falta: decisao.falta };
        }
        if (decisao.tipo === "letra") {
          nova = decisao.letra;
          tituloNovo = decisao.titulo ?? m.titulo;
        }
        // `so-som`: letra intacta, regrava com voz/estilo novos. Era aqui que
        // "quero voz masculina" morria como "vago" (202 recusas desde 01/09).
      }

      // ── ARQUIVA O QUE EXISTE ───────────────────────────────
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
      // UPSERT, não insert: uma órfã desta mesma `ordem`, deixada pelo código
      // antigo, fazia o insert falhar CALADO (o supabase-js devolve o erro em
      // vez de lançar) e a música seguia sem arquivo da versão anterior.
      const { error: erroArquivo } = await db.from("versoes_musica").upsert(
        {
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
          arquivada_em: new Date().toISOString(),
        },
        { onConflict: "musica_id,ordem" },
      );
      // Sem arquivo, não regrava: o `restaurarSeAjusteFalhou` depende dele
      // pra devolver a música se o provedor falhar depois.
      if (erroArquivo) throw new Error(`arquivo da versão: ${erroArquivo.message}`);
      arquivou = true;

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
      //
      // Só grava se ninguém gastou o ajuste no meio do caminho (dois toques no
      // botão, duas abas): a condição em `refacoes_usadas` e no status faz a
      // segunda chamada não achar linha nenhuma, em vez de regravar duas vezes.
      let atualizar = db
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
        .eq("id", m.id)
        .neq("status", "gerando");
      atualizar =
        m.refacoes_usadas == null
          ? atualizar.is("refacoes_usadas", null)
          : atualizar.eq("refacoes_usadas", m.refacoes_usadas);
      const { data: gravou, error: erroGravar } = await atualizar.select("id");
      if (erroGravar) throw new Error(`gravar ajuste: ${erroGravar.message}`);
      if (!gravou?.length) {
        // A outra chamada venceu e é dona da versão arquivada desta `ordem`:
        // não apaga nada, só avisa que já está gravando.
        arquivou = false;
        return { ok: false, erro: "gravando" };
      }

      await dispararGeracaoMusica(m.id);
      return { ok: true, restantes: restantes - 1 };
    } catch (err) {
      console.error("[refacao] falhou:", err);
      // Desfaz o arquivamento desta chamada: a música não mudou, o direito
      // não foi gasto, e a próxima tentativa precisa da `ordem` livre.
      if (arquivou) {
        await db
          .from("versoes_musica")
          .delete()
          .eq("musica_id", m.id)
          .eq("ordem", ordem)
          .then(
            () => undefined,
            () => undefined,
          );
      }
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
