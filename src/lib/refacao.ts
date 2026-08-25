import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELO_LETRA, registrarCustoLetra } from "@/lib/custos";
import { dispararGeracaoMusica } from "@/lib/gerar-letra";
import { chamarClaude } from "@/lib/recuperacao-letra";
import { cobrarUso, TETO_REFACAO } from "@/lib/limite-uso.server";

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
       * `falhou`         — erro nosso.
       */
      erro: "nao-encontrada" | "nao-pago" | "sem-direito" | "gravando" | "curto" | "falhou";
    };

export const pedirRefacao = createServerFn({ method: "POST" })
  .validator((data: PedidoRefacao) => data)
  .handler(async ({ data }): Promise<ResultadoRefacao> => {
    const pedido = (data.pedido ?? "").trim();
    // Teto de tamanho: o campo é livre e vai pro Claude. Uma ordem de grandeza
    // acima do uso real, então só aparece pra quem está tentando outra coisa.
    if (pedido.length < 3 || pedido.length > 2000) return { ok: false, erro: "curto" };

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
      await db.from("versoes_musica").insert({
        musica_id: m.id,
        ordem,
        letra: m.letra,
        titulo: m.titulo,
        estilo_suno: m.estilo_suno,
        audio_path: m.audio_path,
        audio_path_v2: m.audio_path_v2,
        timestamps: m.timestamps,
        timestamps_v2: m.timestamps_v2,
        pedido,
      });

      // ── REESCREVE ──────────────────────────────────────────
      const extras: string[] = [];
      if (data.estilo?.trim()) extras.push(`Novo estilo pedido: ${data.estilo.trim()}`);
      if (data.voz?.trim()) extras.push(`Nova voz pedida: ${data.voz.trim()}`);
      const { texto, uso } = await chamarClaude(
        `LETRA ATUAL:\n${m.letra}\n\nPEDIDO DO CLIENTE:\n${pedido}` +
          (extras.length ? `\n\n${extras.join("\n")}` : ""),
      );
      const j = JSON.parse(
        texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1),
      ) as { letra?: string; titulo?: string };
      const nova = (j.letra ?? "").trim();
      if (!nova) throw new Error("modelo não devolveu letra");

      await registrarCustoLetra({
        quizResponseId: m.quiz_response_id,
        modelo: MODELO_LETRA,
        uso,
      });

      // ── GRAVA E MANDA REGRAVAR ─────────────────────────────
      // Os áudios antigos são LIMPOS da linha principal (já estão arquivados),
      // senão a página presente tocaria a gravação velha com a letra nova, que
      // é pior que não ter mudado nada.
      await db
        .from("musicas")
        .update({
          letra: nova,
          titulo: j.titulo?.trim() || m.titulo,
          estilo_suno: data.estilo?.trim() || m.estilo_suno,
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
