// AS DECISÕES DO `pixNaoPago`, SEM BANCO E SEM REDE.
//
// ── O QUE A AUDITORIA DE 08/10 ACHOU ─────────────────────────────
//
// O job olha TODO pedido `pendente` da janela, e desde 26/09 isso inclui o
// cartão do Asaas (`criar-cartao.ts` grava `pendente` quando a cobrança fica
// em análise ou esperando confirmação). Cartão não tem `pix_url`, então caía
// no "caminho de reserva": um link pro checkout da PERFECT PAY, com o texto
// "você chegou até o PIX". Três defeitos de uma vez:
//
//   1. mandava venda brasileira pra Perfect Pay, a 11,39%, contra a decisão
//      de 26/09 ("Venda brasileira sai SÓ pelo Asaas");
//   2. o link levava `src=<id do quiz>`, e o webhook da Perfect Pay casa por
//      `session_id`: sem casar, ele cai no e-mail, que é o caminho que pode
//      entregar a música ERRADA pra quem tem dois quizzes;
//   3. o texto falava de PIX pra quem tentou no cartão.
//
// Agora: só o PIX que ela gerou vai direto pro PIX. Todo o resto volta pra
// música dela pelo `/retomar` (`caminhoDeVolta`), onde ela paga no Asaas do
// jeito que preferir. Sem sessão pra voltar, não manda: `/criar` faria a
// pessoa começar do zero e separaria ela da música já gravada.

import { caminhoDeVolta } from "./volta-ao-funil.js";

/** Como a pessoa tentou pagar, pelo que o pedido guardou. */
export type MeioDoPendente = "pix" | "cartao" | "sem-codigo";

export type PedidoPendente = {
  gateway?: string | null;
  payment_id?: string | null;
  pix_url?: string | null;
  pix_codigo?: string | null;
};

/**
 * PIX com tela guardada, cartão do Asaas, ou pedido sem código (antigo, de
 * outro gateway, ou sem URL).
 *
 * O cartão do Asaas é o pedido `asaas:` sem nada de PIX: `criar-pix.ts`
 * sempre grava `pix_url` e `pix_codigo`, e `criar-cartao.ts` nunca grava.
 * Upsell (`asaas:up:`) não é cartão de música, fica no genérico.
 */
export function meioDoPendente(p: PedidoPendente): MeioDoPendente {
  if (p.pix_url) return "pix";
  const id = String(p.payment_id ?? "");
  if (p.gateway === "asaas" && !p.pix_codigo && id.startsWith("asaas:") && !id.startsWith("asaas:up:")) {
    return "cartao";
  }
  return "sem-codigo";
}

/**
 * O link do botão. `null` = não mandar.
 *
 * O PIX dela primeiro (o mesmo código, um toque e paga). Com o interruptor
 * `RECUPERACAO_SEM_PIX` (11/09, código que não pode ser pago), com cartão ou
 * sem URL guardada, volta pra música dela pelo `/retomar`, nunca pra
 * checkout hospedado.
 */
export function linkDoLembrete(args: {
  meio: MeioDoPendente;
  pixUrl: string | null | undefined;
  semPix: boolean;
  site: string;
  sessao: string | null | undefined;
  cupom?: string | null;
}): string | null {
  if (args.meio === "pix" && !args.semPix && args.pixUrl) return args.pixUrl;
  const volta = caminhoDeVolta(args.sessao, args.cupom);
  if (!volta.startsWith("/retomar")) return null;
  return `${args.site.replace(/\/+$/, "")}${volta}`;
}

/**
 * O copia-e-cola só vai junto do PIX DELE. Código de um pedido com link de
 * outro lugar é a receita do "paguei e não caiu".
 */
export function codigoDoLembrete(
  link: string,
  pixUrl: string | null | undefined,
  pixCodigo: string | null | undefined,
): string | null {
  return pixUrl && link === pixUrl ? (pixCodigo ?? null) : null;
}

/**
 * O que perguntar ao gateway antes de dizer "o pagamento não entrou".
 *
 * Até 08/10 só a Woovi era reconsultada, e desde 11/09 o PIX é do Asaas: a
 * trava de 06/09 (cliente que pagou e continuou recebendo este e-mail) tinha
 * voltado a não valer pra quase ninguém. O Asaas guarda `asaas:<pay_id>` na
 * música (PIX e cartão) e `asaas:up:<...>` no upsell, que só se acha pela
 * NOSSA referência (`consultarPorReferencia`).
 */
export function reconsultaDoPedido(
  paymentId: string | null | undefined,
): { gateway: "woovi" | "asaas"; id: string; porReferencia: boolean } | null {
  const m = String(paymentId ?? "").match(/^(woovi|asaas):(.+)$/);
  if (!m) return null;
  const gateway = m[1] as "woovi" | "asaas";
  return { gateway, id: m[2], porReferencia: gateway === "asaas" && m[2].startsWith("up:") };
}

/**
 * Pelo que o gateway respondeu, pode mandar?
 *
 * Pago: não (o vigia de pagamento conserta o banco). Cartão em análise de
 * risco no Asaas: também não, porque ele ainda pode ser aprovado sozinho, e
 * "a compra não foi concluída" seria falso pra quem só está esperando.
 */
export function reconsultaPermiteEnvio(st: { pago?: boolean; statusCru?: string | null } | null): boolean {
  if (!st) return true;
  if (st.pago) return false;
  return String(st.statusCru ?? "").toUpperCase() !== "AWAITING_RISK_ANALYSIS";
}
