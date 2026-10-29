import type { Locale } from "@/lib/i18n";
import { ehBallad } from "./marca-identidade.js";
import { valorUsdNoPais } from "./mercados.js";
import { paisAtual } from "./mercado-es.js";

/**
 * O país que o servidor carimbou no `<html>` (`pais-acesso.ts`). Desde a fusão
 * com `mercados-es` é o `paisAtual()` de `mercado-es.ts`: no navegador, o mesmo
 * `data-pais`; no servidor, o cabeçalho da requisição (antes, nenhum).
 */
export function paisDaTela(): string | null {
  return paisAtual();
}

/**
 * O valor do plano em dólar da Ballad, no país do acesso (29/10): o caixa
 * cobra na moeda do país e o pedido grava o equivalente (`mercados.ts`). No
 * México é o mesmo número de antes. A Serenata (real) e o espanhol da
 * Serenata (Perfect Pay) não mudam.
 */
export function noPaisDoAcesso(valor: number, locale: Locale, pais: string | null | undefined): number {
  if (!ehBallad() || locale === "pt") return valor;
  return valorUsdNoPais(valor, pais);
}

// O VALOR QUE VAI PROS ANÚNCIOS (08/10).
//
// Google, GA4 e TikTok otimizam pelo valor que recebem. Até 08/10 a /obrigado
// reportava `meuPlano`, que é o braço que a TELA mostra, e não o que foi
// COBRADO. Três casos em que os dois divergem:
//
//   1. braço com peso 0 (o E de R$ 54,90, zerado em 28/08) é cobrado como o
//      controle (`bracoCobravel`): quem ficou grudado nele pagava R$ 38 e o
//      Google aprendia R$ 54,90;
//   2. MUSICA10 tira R$ 10 do braço da pessoa;
//   3. SRN27 vira R$ 28.
//
// O número certo mora em `pedidos.valor_centavos`, que o webhook grava com o
// que o gateway confirmou. Esta função decide quando dá pra usar ele.

/**
 * Gateways cujo `valor_centavos` está na moeda que a conversão reporta
 * (BRL no português, USD no inglês). A Perfect Pay do funil espanhol cobra em
 * dólar mas o webhook grava em REAIS (`sale_amount`): ali o banco não serve e
 * fica o plano.
 */
function moedaBate(locale: Locale, gateway: string | null | undefined): boolean {
  const g = String(gateway ?? "");
  // Na Ballad o espanhol paga pelo MESMO Stripe do inglês, em dólar.
  // O OXXO do México (dLocal Go, 23/10) também grava o pedido em dólar.
  if (locale === "en" || (locale === "es" && ehBallad())) return g === "stripe" || g === "dlocalgo";
  if (locale === "pt") return g === "asaas" || g === "woovi" || g === "perfectpay" || g === "cakto";
  return false;
}

/** O valor da compra paga: o do banco quando ele vale, senão a `reserva`. */
export function valorDaCompra(args: {
  locale: Locale;
  pedido?: { valorCentavos?: number | null; gateway?: string | null } | null;
  /** O que a tela calcula (plano cobrável com cupom). Só pra quando o banco não serve. */
  reserva: number;
  /** `paisDaTela()`: no México a reserva vira o equivalente do peso (29/10). */
  pais?: string | null;
}): number {
  const c = Number(args.pedido?.valorCentavos);
  if (Number.isFinite(c) && c > 0 && moedaBate(args.locale, args.pedido?.gateway)) {
    // O banco já grava o equivalente em dólar do que se cobrou em peso.
    return Math.round(c) / 100;
  }
  return noPaisDoAcesso(args.reserva, args.locale, args.pais);
}

/**
 * O valor do `begin_checkout` / `InitiateCheckout`: o que ESTA pessoa vai
 * pagar se terminar, não o catálogo.
 *
 * No português e no inglês quem cobra é o servidor, pelo braço COBRÁVEL e com
 * o cupom aplicado lá (`criar-pix.ts`, `stripe-checkout.ts`). No espanhol quem
 * cobra é o link da Perfect Pay do braço que a tela mostrou, então vale o
 * plano da tela. Na BALLAD o espanhol é o caso do inglês (Stripe, braço
 * cobrável): o link da Perfect Pay não existe lá.
 */
export function valorDoCheckout(args: {
  locale: Locale;
  /** `meuPlano(locale, { temCupom })`: o braço da tela. */
  valorDaTela: number;
  /** `meuPlanoCobravel(locale)`: o braço que o servidor cobra. */
  valorCobravel: number;
  /** `descontoNaTela(...).porCentavos`, quando há cupom valendo. */
  comCupomCentavos?: number | null;
  /** O preço final com o desconto do convite, quando há. */
  comConviteCentavos?: number | null;
  /** `paisDaTela()`: no México, o equivalente em dólar do preço em peso (29/10). */
  pais?: string | null;
}): number {
  if (args.locale === "es" && !ehBallad()) return args.valorDaTela;
  const valor =
    args.comCupomCentavos && args.comCupomCentavos > 0
      ? args.comCupomCentavos / 100
      : args.comConviteCentavos && args.comConviteCentavos > 0
        ? args.comConviteCentavos / 100
        : args.valorCobravel;
  return noPaisDoAcesso(valor, args.locale, args.pais);
}
