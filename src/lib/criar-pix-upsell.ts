import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { literalLike } from "@/lib/sql-like";
import { gatewayPix } from "@/lib/criar-pix";
import { ErroGateway } from "@/lib/gateway";
import { OFERTAS, type Oferta } from "@/lib/creditos";

// O PIX DOS UPSELLS: música extra, três músicas e quadro.
//
// ── POR QUE ELE É OUTRO ARQUIVO, E NÃO O MESMO `criar-pix` ───────
//
// O do funil e este respondem a perguntas diferentes em quase tudo:
//
//                    funil                        upsell
//   quem é           sessão anônima do quiz       conta logada (Supabase Auth)
//   preço            braço do experimento         catálogo fixo (`OFERTAS`)
//   o que entrega    a música daquele quiz        crédito ou direito ao quadro
//   quantas vezes    uma                          quantas ela quiser
//
// Essa última linha é a que mais separa os dois. No funil a referência PODE
// ser o id do quiz, e isso é uma virtude: duplo-clique devolve a mesma
// cobrança. Aqui não pode — a pessoa tem direito de comprar dois créditos
// extras, e uma referência derivada do e-mail colidiria com a compra
// anterior, que já está COMPLETED. A `criar` da Woovi recusaria, e a segunda
// venda simplesmente não aconteceria.
//
// ── ENTÃO A IDEMPOTÊNCIA MUDA DE LUGAR ───────────────────────────
//
// A referência carrega um uuid novo por COMPRA (`up:<oferta>:<uuid>`), e o
// que protege contra duplo-clique é outra coisa: antes de criar, procura um
// pedido pendente DA MESMA oferta, DA MESMA pessoa, da última hora. Achou,
// devolve o PIX dele. É a mesma garantia, movida pro nosso lado.
//
// Uma hora não é chute: é o tempo que o código PIX da Woovi vale (`expiresIn`
// 3600 em `woovi.ts`). Reaproveitar um mais velho seria entregar um QR morto.
//
// ── E O PREÇO NUNCA VEM DO CLIENTE ───────────────────────────────
//
// Mesma regra do funil, e aqui é ainda mais direta: o valor sai de `OFERTAS`,
// pelo id. O navegador escolhe QUAL oferta, nunca QUANTO ela custa.

/** O domínio do site, pro link que vai no e-mail de PIX abandonado. */
function urlDoSite(): string {
  const u = process.env.VITE_APP_URL;
  return u?.startsWith("http") ? u : "https://www.serenatagift.com";
}

/**
 * A oferta, pelo id, vinda do catálogo e não do cliente.
 *
 * Recusa as ocultas: `tres` está escondida desde 25/08 por não vender, e uma
 * oferta escondida na tela mas comprável pela rota é exatamente o tipo de
 * porta que ninguém lembra que existe.
 */
function ofertaValida(id: string): Oferta | null {
  return OFERTAS.find((o) => o.id === id && !o.oculta) ?? null;
}

export type ResultadoPixUpsell =
  | {
      ok: true;
      copiaECola: string;
      valorCentavos: number;
      referencia: string;
      reaproveitado: boolean;
    }
  | { ok: false; erro: "sem-sessao" | "oferta-invalida" | "gateway" };

/**
 * O MIOLO, compartilhado pelas DUAS portas de entrada.
 *
 * Quem chama aqui já provou quem é — por sessão do Supabase (painel) ou por
 * `token_edicao` (editor). Daqui pra frente o caminho é idêntico, e é
 * idêntico de propósito: duas cópias disto divergiriam na primeira correção,
 * e o que elas guardam é a regra de o cliente nunca escolher o preço.
 */
async function gerarCobranca(email: string, ofertaId: string): Promise<ResultadoPixUpsell> {
  {
    const oferta = ofertaValida(ofertaId);
    if (!oferta) return { ok: false, erro: "oferta-invalida" };

    const db = supabaseAdmin();
    const valorCentavos = Math.round(oferta.precoBrl * 100);

    // ── O GATEWAY DA CONTA, E NAO A WOOVI CRAVADA ────────────────
    //
    // Ate 11/09/2026 este arquivo chamava `woovi.criar` direto. Passou
    // despercebido enquanto so existia um gateway de PIX; o dia em que isso
    // deixou de ser verdade foi o dia em que a chave da Woovi parou de
    // resolver no DICT, e este caminho seguiu gerando cobranca impagavel
    // DEPOIS da compra, que e o pior lugar possivel pra isso.
    const gw = gatewayPix();

    // O ASAAS EXIGE CPF E ESTA TELA NAO TEM ONDE PEDIR: ela gera a cobranca
    // no `useEffect` de montagem, sem passo de resumo. Recusar limpo e melhor
    // que criar um QR que ninguem consegue pagar — a folha ja tem tela de
    // erro. O conserto de verdade e dar um passo de resumo a ela, igual ao do
    // checkout principal.
    if (gw.exigeCpf) {
      console.warn(`[pix-upsell] ${gw.nome} exige CPF e esta tela nao pede. Recusando.`);
      return { ok: false, erro: "gateway" };
    }

    // ── DUPLO-CLIQUE: reaproveita o PIX ainda vivo ───────────────
    //
    // OS DOIS PREFIXOS: durante uma troca de gateway convivem cobrancas dos
    // dois lados, e procurar so por um deixaria a pessoa gerar outra em cima
    // de uma que ja existe.
    const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
    const { data: vivo } = await db
      .from("pedidos")
      .select("payment_id, pix_codigo")
      .eq("gateway", gw.nome)
      .eq("status", "pendente")
      .eq("valor_centavos", valorCentavos)
      .ilike("email", literalLike(email))
      .gte("created_at", umaHoraAtras)
      .like("payment_id", `${gw.nome}:up:${oferta.id}:%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vivo?.pix_codigo) {
      return {
        ok: true,
        copiaECola: vivo.pix_codigo as string,
        valorCentavos,
        referencia: (vivo.payment_id as string).slice(`${gw.nome}:`.length),
        reaproveitado: true,
      };
    }

    // `crypto.randomUUID` roda no servidor (Node 19+), e é o que dá à segunda
    // compra da MESMA oferta uma referência própria.
    const referencia = `up:${oferta.id}:${crypto.randomUUID()}`;

    let cobranca;
    try {
      cobranca = await gw.criar({
        referencia,
        valorCentavos,
        descricao: `Serenata · ${oferta.id === "quadro" ? "Quadro para imprimir" : "Música extra"}`,
        nome: null,
        email,
      });
    } catch (err) {
      const g = err instanceof ErroGateway ? err : null;
      console.error(`[pix-upsell] ${gw.nome} falhou:`, g?.message ?? err);
      return { ok: false, erro: "gateway" };
    }

    const { error } = await db.from("pedidos").upsert(
      {
        // O prefixo sai do gateway QUE RESPONDEU: e por ele que o webhook
        // acha o pedido. Cravar "woovi" faria o pagamento pelo Asaas chegar e
        // nao casar com linha nenhuma.
        payment_id: `${cobranca.gateway}:${referencia}`,
        gateway: cobranca.gateway,
        status: "pendente",
        email,
        valor_centavos: valorCentavos,
        taxa_centavos: cobranca.taxaCentavos,
        pix_codigo: cobranca.copiaECola,
        pix_expira: cobranca.expiraEm,
        pix_url: `${urlDoSite()}/pix/${referencia}`,
      },
      { onConflict: "payment_id" },
    );
    if (error) {
      // A cobrança JÁ EXISTE no gateway; sumir com o QR seria pior. Entrega e
      // grita no log — mesma decisão do `criar-pix` do funil.
      console.error("[pix-upsell] pedido pendente não gravou:", error.message);
    }

    return { ok: true, copiaECola: cobranca.copiaECola, valorCentavos, referencia, reaproveitado: false };
  }
}

/**
 * PORTA 1: quem está LOGADO no painel.
 *
 * O TOKEN, não o e-mail. Server function é rota HTTP: aceitar o e-mail
 * deixaria qualquer um gerar cobrança (e crédito) no nome de outro. Mesma
 * regra de `meusCreditos`.
 */
export const criarPixUpsell = createServerFn({ method: "POST" })
  .validator((data: { token: string; ofertaId: string }) => data)
  .handler(async ({ data }): Promise<ResultadoPixUpsell> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { ok: false, erro: "sem-sessao" };
    return gerarCobranca(email, data.ofertaId);
  });

/**
 * PORTA 2: quem chegou pelo LINK, não pelo login.
 *
 * O quadro é vendido em quatro lugares, e só dois ficam atrás de conta: o
 * painel de créditos e a aba do quadro. Os outros dois — o editor do presente
 * (`/editar/<token_edicao>`) e `/meu-quadro` — abrem por TOKEN. E foi por ali
 * que saiu a primeira venda de quadro depois da migração, ainda pela Perfect
 * Pay: R$ 24,90 pagando 11,4% de taxa onde pagaria R$ 0,50.
 *
 * ── O TOKEN DE EDIÇÃO É PROVA SUFICIENTE ─────────────────────────
 *
 * Ele já autoriza baixar o MP3, editar o presente e publicar a página: quem
 * tem o token é dono daquela música. Exigir login aqui seria inventar, no
 * meio de uma compra, uma barreira que o resto do editor não tem.
 *
 * E o e-mail NÃO vem do cliente: sai do quiz daquela música. É o mesmo
 * endereço que já recebeu a entrega, e é ele que o webhook vai creditar.
 */
export const criarPixUpsellPorToken = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; ofertaId: string }) => data)
  .handler(async ({ data }): Promise<ResultadoPixUpsell> => {
    if (!data.tokenEdicao) return { ok: false, erro: "sem-sessao" };
    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select("quiz_response_id")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.quiz_response_id) return { ok: false, erro: "sem-sessao" };

    const { data: q } = await db
      .from("quiz_responses")
      .select("email")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    const email = (q?.email as string | null)?.trim().toLowerCase();
    if (!email) return { ok: false, erro: "sem-sessao" };

    return gerarCobranca(email, data.ofertaId);
  });
