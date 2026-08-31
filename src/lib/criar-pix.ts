import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OFERTAS } from "@/lib/creditos";
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

/**
 * O QUADRO COMPRADO JUNTO, no mesmo PIX.
 *
 * ── POR QUE ELE VEM PRA CA ───────────────────────────────────────
 *
 * O quadro (R$ 24,90) so era vendido DEPOIS da compra, no editor e no painel.
 * Medido de 17 a 31/08, PIX gerados contra pagos:
 *
 *   R$ 38,00 (base)     821 -> 462   56,3%
 *   R$ 29,00            311 -> 188   60,5%
 *   R$ 19,00            210 -> 143   68,1%
 *   R$ 24,90 (quadro)   117 ->  31   26,5%
 *
 * Todo preco do funil paga entre 56% e 70%; o quadro paga 26,5%, e sao 86
 * cobrancas mortas em 14 dias. A diferenca nao e o preco, e a INTENCAO: no
 * funil a pessoa ja decidiu pagar, e no painel ela abre a folha so pra ver
 * quanto custa (a cobranca nasce sozinha no `useEffect` de montagem).
 *
 * Aqui ele entra no MESMO pagamento: sem segunda decisao, sem segundo PIX,
 * sem cobranca morta na conta da Woovi.
 *
 * ── O CLIENTE MANDA UM SIM OU NAO, NUNCA UM VALOR ────────────────
 *
 * A invariante do CLAUDE.md continua de pe: o preco sai do braco sorteado,
 * lido no servidor. O navegador so diz SE quer o quadro; quanto custa e o
 * catalogo daqui que decide. Se o valor viesse de la, o DevTools levaria
 * musica e quadro por R$ 1.
 */
export const CENTAVOS_QUADRO = Math.round(
  (OFERTAS.find((o) => o.id === "quadro")?.precoBrl ?? 24.9) * 100,
);

/**
 * O valor final da cobranca. Exportado pra ter teste: e a unica conta deste
 * arquivo que, errada, cobra da pessoa um numero diferente do que ela viu.
 */
export function valorComBump(baseCentavos: number, quadro: boolean): number {
  return baseCentavos + (quadro ? CENTAVOS_QUADRO : 0);
}

/**
 * A referencia, que e a chave de idempotencia.
 *
 * O sufixo NAO e cosmetico: a Woovi recusa reaproveitar um correlationID com
 * outro valor, entao sem ele quem abrisse a folha sem o quadro e voltasse pra
 * marcar cairia num erro em cima de uma cobranca que existe.
 *
 * O webhook corta no primeiro dois-pontos depois do prefixo pra achar o quiz,
 * entao o sufixo tem que vir DEPOIS do id, nunca no meio.
 */
export function referenciaDoPix(quizId: string, quadro: boolean): string {
  return `serenata:${quizId}${quadro ? ":q" : ""}`;
}

export const criarPix = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; email?: string; quadro?: boolean }) => data)
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

    const base = await valorCentavosDaSessao(db, quiz.attribution);
    if (!base) return { ok: false, erro: "sem-preco" };
    const comQuadro = data.quadro === true;
    const valorCentavos = valorComBump(base, comQuadro);

    // A REFERÊNCIA É A CHAVE DE IDEMPOTÊNCIA, e por isso é o id do quiz e não
    // um aleatório: duplo-clique, reload e voltar-e-avançar devolvem A MESMA
    // cobrança, com o mesmo QR. Sem isso a pessoa acumularia PIX abertos e
    // poderia pagar dois.
    // ── A REFERENCIA CARREGA O BUMP ──────────────────────────────
    //
    // Ela e a chave de idempotencia, e o valor faz parte da identidade da
    // cobranca: a Woovi RECUSA reaproveitar um correlationID com outro valor
    // ("cobranca existente e de X, esperado Y", em `woovi.ts`). Sem o sufixo,
    // quem abrisse a folha sem o quadro e voltasse pra marcar cairia num erro
    // em cima de uma cobranca que existe.
    //
    // Consequencia aceita, e por isso a trava por quiz entrou no webhook
    // junto com isto: duas cobrancas VIVAS do mesmo quiz passam a ser
    // possiveis (R$ 38 e R$ 62,90). Pagar as duas exige pagar dois codigos
    // PIX de proposito, mas exige. O webhook agora recusa entregar de novo e
    // avisa o dono pra devolver, em vez de mandar dois presentes e a pessoa
    // descobrir a cobranca dobrada no extrato.
    const referencia = referenciaDoPix(String(quiz.id), comQuadro);
    const nome = ((quiz.respostas ?? {}) as Record<string, string>).nome?.trim();

    // ── O E-MAIL CONFERIDO NA TELA DE RESUMO ─────────────────────
    //
    // A pessoa acabou de ver pra onde a música vai, e pôde corrigir. Se ela
    // corrigiu, o endereço novo vale — e vale ANTES do pagamento, que é a
    // diferença entre um toque e uma conversa com o suporte.
    //
    // O suporte já mostrou qual é o gargalo desta operação: quase nunca é
    // defeito de produto, é comprador que não achou o caminho de volta. E a
    // origem mais comum disso é endereço digitado errado no quiz.
    //
    // Valida aqui também, e não só na tela: server function é rota HTTP, e o
    // que chega dela não é promessa de nada. Endereço inválido é ignorado em
    // silêncio — melhor manter o antigo que gravar lixo por cima.
    const emailNovo = data.email?.trim().toLowerCase();
    const emailVale =
      !!emailNovo &&
      emailNovo.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNovo) &&
      emailNovo !== (quiz.email as string | null);
    if (emailVale) {
      const { error } = await db
        .from("quiz_responses")
        .update({ email: emailNovo })
        .eq("id", quiz.id);
      if (error) console.error("[criar-pix] trocar e-mail falhou:", error.message);
    }
    const emailDaVenda = emailVale ? emailNovo! : ((quiz.email as string | null) ?? null);

    let cobranca;
    try {
      cobranca = await woovi.criar({
        referencia,
        valorCentavos,
        descricao: `Serenata · ${musica.titulo ?? "sua música"}`,
        nome: nome || null,
        email: emailDaVenda,
      });
    } catch (err) {
      // Aqui entra o failover quando houver segundo gateway de PIX. Por ora,
      // falha limpa e a tela oferece o checkout antigo.
      const g = err instanceof ErroGateway ? err : null;
      console.error("[criar-pix] gateway falhou:", g?.message ?? err);
      return { ok: false, erro: "gateway" };
    }

    // A REFERÊNCIA QUE VALE É A QUE VOLTOU, não a que mandamos: quando a
    // cobrança anterior daquele quiz venceu, a Woovi recusa reaproveitar o id
    // e `woovi.criar` gera outra com sufixo (`serenata:<id>:r2`). Gravar o
    // pedido com a original faria o webhook escrever numa linha e a tela
    // esperar em outra — a pessoa pagaria e a tela ficaria girando.
    const refFinal = cobranca.idExterno;

    // ── O PEDIDO PENDENTE NASCE AQUI ─────────────────────────────
    //
    // Não é burocracia: é o que faz o `pixNaoPago` existir (recuperação em 10
    // minutos), o que dá o valor esperado pro webhook conferir contra, e o
    // que faz o painel enxergar a etapa. Sem ele, PIX gerado e não pago seria
    // invisível, como era na Perfect Pay até 10/08.
    const { error } = await db.from("pedidos").upsert(
      {
        payment_id: `woovi:${refFinal}`,
        gateway: "woovi",
        status: "pendente",
        email: emailDaVenda,
        nome_pagador: nome || null,
        valor_centavos: valorCentavos,
        bump_quadro: comQuadro,
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
        pix_url: `${urlDoSite()}/pix/${refFinal}`,
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
      // `refFinal` também aqui: é por esta chave que a tela pergunta "já
      // caiu?", e ela tem que ser a mesma que o pedido gravou.
      copiaECola: cobranca.copiaECola,
      valorCentavos,
      expiraEm: cobranca.expiraEm,
      referencia: refFinal,
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
