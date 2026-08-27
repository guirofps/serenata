import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { woovi } from "@/lib/woovi";
import { ErroGateway } from "@/lib/gateway";

// GERA O PIX DO CHECKOUT TRANSPARENTE.
//
// ── O PREÇO NÃO VEM DO CLIENTE ───────────────────────────────────
//
// É a regra mais importante deste arquivo. Se o navegador mandasse o valor,
// bastaria abrir o DevTools e pedir uma cobrança de R$ 1 pra levar um produto
// de R$ 54,90. O valor sai daqui, do braço de preço que aquela pessoa
// sorteou, lido da `attribution` que o servidor gravou.
//
// ── E A MÚSICA PRECISA EXISTIR ───────────────────────────────────
//
// Mesma trava do checkout atual, pela mesma razão de sempre: nunca cobrar por
// algo que ainda não foi produzido. Aqui ela vale ainda mais, porque no
// transparente a cobrança nasce do nosso lado.

// ── O WEBHOOK NÃO SE ESCOLHE AQUI ────────────────────────────────
//
// Na MillionsPay a URL do postback ia no corpo de cada cobrança, e por isso
// dava pra apontar um teste pro preview sem tocar em produção. Na Woovi não:
// o webhook é UM, registrado na conta, e vale pra todas as cobranças.
//
// Consequência prática pra testar: ou o webhook da conta aponta pro preview
// (e aí produção fica sem receber), ou aponta pra produção. Não dá os dois ao
// mesmo tempo com uma conta só.

/** O domínio do site, pro link que a pessoa recebe por e-mail. */
function urlDoSite(): string {
  const u = process.env.VITE_APP_URL;
  return u?.startsWith("http") ? u : "https://www.serenatagift.com";
}

/**
 * O preço DAQUELA pessoa, do jeito que ela viu na tela.
 *
 * Lê o braço sorteado em `attribution.exp.preco` e o valor na config viva de
 * `experimentos`. Mandar outro valor seria trocar o preço depois de a pessoa
 * ter decidido, que é o jeito mais rápido de transformar uma venda numa
 * reclamação.
 */
async function valorCentavosDaSessao(
  db: ReturnType<typeof supabaseAdmin>,
  attribution: unknown,
): Promise<number | null> {
  const braco =
    (attribution as { exp?: Record<string, string> } | null)?.exp?.preco ?? "A";
  const { data } = await db.from("experimentos").select("variantes").eq("id", "preco").maybeSingle();
  const variantes = (data?.variantes ?? []) as Array<{
    nome?: string;
    plano?: { valor?: number | string };
  }>;
  const achado = variantes.find((v) => v.nome === braco) ?? variantes.find((v) => v.nome === "A");
  const valor = Number(achado?.plano?.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 100);
}

export type ResultadoPix =
  | {
      ok: true;
      copiaECola: string;
      valorCentavos: number;
      expiraEm: string | null;
      referencia: string;
    }
  | { ok: false; erro: "sem-sessao" | "sem-musica" | "sem-preco" | "gateway" };

export const criarPix = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }): Promise<ResultadoPix> => {
    const db = supabaseAdmin();

    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, email, respostas, attribution")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!quiz?.id) return { ok: false, erro: "sem-sessao" };

    // A MÚSICA TEM QUE EXISTIR. Mesma pergunta que `temMusicaDaSessao` faz no
    // checkout de hoje, e pelo mesmo motivo.
    const { data: musica } = await db
      .from("musicas")
      .select("id, titulo")
      .eq("quiz_response_id", quiz.id)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!musica?.id) return { ok: false, erro: "sem-musica" };

    const valorCentavos = await valorCentavosDaSessao(db, quiz.attribution);
    if (!valorCentavos) return { ok: false, erro: "sem-preco" };

    // A REFERÊNCIA É A CHAVE DE IDEMPOTÊNCIA, e por isso é o id do quiz e não
    // um aleatório: duplo-clique, reload e voltar-e-avançar devolvem A MESMA
    // cobrança, com o mesmo QR. Sem isso a pessoa acumularia PIX abertos e
    // poderia pagar dois.
    const referencia = `serenata:${quiz.id}`;
    const nome = ((quiz.respostas ?? {}) as Record<string, string>).nome?.trim();

    let cobranca;
    try {
      cobranca = await woovi.criar({
        referencia,
        valorCentavos,
        descricao: `Serenata · ${musica.titulo ?? "sua música"}`,
        nome: nome || null,
        email: (quiz.email as string | null) ?? null,
      });
    } catch (err) {
      // Aqui entra o failover quando houver segundo gateway de PIX. Por ora,
      // falha limpa e a tela oferece o checkout antigo.
      const g = err instanceof ErroGateway ? err : null;
      console.error("[criar-pix] gateway falhou:", g?.message ?? err);
      return { ok: false, erro: "gateway" };
    }

    // ── O PEDIDO PENDENTE NASCE AQUI ─────────────────────────────
    //
    // Não é burocracia: é o que faz o `pixNaoPago` existir (recuperação em 10
    // minutos), o que dá o valor esperado pro webhook conferir contra, e o
    // que faz o painel enxergar a etapa. Sem ele, PIX gerado e não pago seria
    // invisível, como era na Perfect Pay até 10/08.
    const { error } = await db.from("pedidos").upsert(
      {
        payment_id: `woovi:${referencia}`,
        gateway: "woovi",
        status: "pendente",
        email: (quiz.email as string | null) ?? null,
        nome_pagador: nome || null,
        valor_centavos: valorCentavos,
        taxa_centavos: cobranca.taxaCentavos,
        quiz_response_id: quiz.id,
        musica_id: musica.id,
        pix_codigo: cobranca.copiaECola,
        pix_expira: cobranca.expiraEm,
        // ── A URL PRA VOLTAR ─────────────────────────────────
        //
        // É o que o e-mail de PIX abandonado usa (39 pessoas por dia). Ele
        // promete "o seu código continua valendo, é o mesmo que você gerou",
        // e sem isto aqui o `pixNaoPago` cai no fallback e manda a pessoa pro
        // checkout gerar um código NOVO — a frase vira mentira e a venda
        // volta a custar 11,39% em vez de R$ 0,50.
        //
        // Serve pro caso mais comum também: quem abriu o PIX, foi no
        // aplicativo do banco, e voltou pra aba fechada.
        pix_url: `${urlDoSite()}/pix/${referencia}`,
      },
      { onConflict: "payment_id" },
    );
    if (error) {
      // A cobrança JÁ EXISTE no gateway. Não dá pra desfazer, e sumir com o
      // QR seria pior: a pessoa pagaria por outro caminho e ninguém saberia.
      // Segue entregando o PIX e grita no log.
      console.error("[criar-pix] pedido pendente não gravou:", error.message);
    }

    return {
      ok: true,
      copiaECola: cobranca.copiaECola,
      valorCentavos,
      expiraEm: cobranca.expiraEm,
      referencia,
    };
  });

/** A tela pergunta isto de tempos em tempos enquanto o QR está aberto. */
export const pixFoiPago = createServerFn({ method: "POST" })
  .validator((data: { referencia: string }) => data)
  .handler(async ({ data }): Promise<{ pago: boolean }> => {
    // Lê do NOSSO banco, não do gateway. Quem escreve ali é o webhook, que já
    // conferiu assinatura e valor. Bater na Woovi a cada 5 segundos, por
    // pessoa, seria gastar a API deles pra saber o que a gente já sabe.
    const { data: pedido } = await supabaseAdmin()
      .from("pedidos")
      .select("status")
      .eq("payment_id", `woovi:${data.referencia}`)
      .maybeSingle();
    return { pago: pedido?.status === "pago" };
  });
