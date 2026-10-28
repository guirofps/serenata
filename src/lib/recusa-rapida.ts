// TESTE `recusa_rapida` (Ballad, 28/10): o e-mail de cartão recusado sai 10 MINUTOS
// depois da recusa, dizendo o MOTIVO e a saída certa pra ele.
//
// ── O BURACO, MEDIDO EM 28/10 (Stripe da Ballad, 21-27/10) ───────
//
// 224 cobranças recusadas contra 178 aprovadas. 101 pessoas tiveram recusa e
// 49 delas nunca pagaram (~7 por dia). Motivos: `do_not_honor` 82, o Radar do
// próprio Stripe (`highest_risk_level`) 55, sem saldo 25, `try_again_later` 19.
// 67% débito, 18% pré-pago; 36 recusas em cartão do México.
//
// O teste de 18/10 (`quase_comprou` com texto de recusa, `aviso-recusa.ts`) não
// ajudou: 0 vendas em 22 no B × 3 em 26 no A. Ele chegava 30 a 90 minutos depois
// (rodava com o "quase comprou", de hora em hora), com o mesmo texto pra todo
// motivo, e falava de "bancos de EE. UU." até pro mexicano, sem oferecer o OXXO.
//
//   A = como é hoje (o "quase comprou" de hora em hora).
//   B = 10 minutos depois da ÚLTIMA recusa, se não pagou nem tentou de novo:
//       e-mail com o motivo e a saída (aprovar no banco, outro cartão, Apple
//       Pay; no México, o OXXO). Quem recebe este não recebe o "quase comprou".
//
// Braço pelo 7º caractere do fim do id do quiz; a trava grava o braço nos DOIS
// (`recusa_rapida` em `funnel_events`). Ler por venda em 72h entre quem teve
// recusa, por braço. Job `recusaRapida` (Ballad).

export type BracoRecusaRapida = "A" | "B";

/** O braço, pelo 7º caractere do fim do id do quiz (o 5º e o 6º já são de outros testes). */
export function bracoRecusaRapida(quizId: string): BracoRecusaRapida {
  const limpo = quizId.replace(/-/g, "");
  const c = limpo[limpo.length - 7] ?? "0";
  return parseInt(c, 16) % 2 === 0 ? "A" : "B";
}

export type GrupoRecusa = "banco" | "saldo" | "dados" | "cartao" | "risco";

const SALDO = new Set(["insufficient_funds", "card_velocity_exceeded", "withdrawal_count_limit_exceeded"]);
const DADOS = new Set([
  "incorrect_cvc", "invalid_cvc", "requested_block_on_incorrect_cvc", "incorrect_number", "invalid_number",
  "expired_card", "invalid_expiry_month", "invalid_expiry_year", "incorrect_zip", "incorrect_pin", "invalid_pin",
]);
const CARTAO = new Set(["card_not_supported", "transaction_not_allowed", "currency_not_supported", "not_permitted"]);
const RISCO = new Set(["highest_risk_level", "elevated_risk_level", "rule"]);
// Cartão roubado, perdido ou fraude declarada: não se ajuda a passar.
const NAO_AVISAR = new Set(["stolen_card", "lost_card", "pickup_card", "fraudulent", "merchant_blacklist", "restricted_card", "security_violation"]);

/**
 * O grupo do motivo da recusa (`charge.outcome.reason`, senão `failure_code`).
 * `null` = não avisar. O que não se reconhece é bloqueio do banco, o mais comum.
 */
export function grupoDoMotivo(motivo: string | null | undefined): GrupoRecusa | null {
  const m = String(motivo ?? "").trim().toLowerCase();
  if (NAO_AVISAR.has(m)) return null;
  if (SALDO.has(m)) return "saldo";
  if (DADOS.has(m)) return "dados";
  if (CARTAO.has(m)) return "cartao";
  if (RISCO.has(m)) return "risco";
  return "banco";
}

/** Espera depois da última recusa: dá tempo de ela tentar de novo sozinha. */
export const ESPERA_MIN = 10;
/** Recusa mais velha que isto fica pro "quase comprou" de sempre. */
export const JANELA_MIN = 120;

/** A última recusa está na hora de avisar? (entre 10 minutos e 2 horas atrás) */
export function naHoraDeAvisar(ultimaRecusaMs: number, agoraMs: number): boolean {
  const min = (agoraMs - ultimaRecusaMs) / 60000;
  return min >= ESPERA_MIN && min <= JANELA_MIN;
}

type Texto = { corpo: string; lembrete: string };

const ES: Record<GrupoRecusa, Texto> = {
  banco: {
    corpo: "Tu banco no autorizó el pago. Pasa mucho en la primera compra a una tienda en línea nueva, y no significa que tu tarjeta tenga algún problema.",
    lembrete: "Para que pase: abre la app de tu banco y aprueba el cobro (o responde el mensaje de tu banco), y vuelve a pagar en el botón de abajo. También puedes usar Apple Pay, Google Pay u otra tarjeta.",
  },
  saldo: {
    corpo: "Tu banco rechazó el pago por falta de saldo disponible en esa tarjeta.",
    lembrete: "Puedes pagar con otra tarjeta, Apple Pay o Google Pay en el botón de abajo.",
  },
  dados: {
    corpo: "El pago no pasó porque uno de los datos de la tarjeta no coincidió, casi siempre el código de seguridad de 3 dígitos o la fecha de vencimiento.",
    lembrete: "Revisa los datos con calma y vuelve a pagar en el botón de abajo. Si prefieres, usa Apple Pay o Google Pay, que llenan todo solos.",
  },
  cartao: {
    corpo: "Esa tarjeta no acepta este tipo de compra. Pasa mucho con tarjetas de débito y prepagadas en compras en línea.",
    lembrete: "Prueba con otra tarjeta (las de crédito suelen pasar sin problema), Apple Pay o Google Pay en el botón de abajo.",
  },
  risco: {
    corpo: "No pudimos procesar el pago con esa tarjeta.",
    lembrete: "Prueba con otra tarjeta, Apple Pay o Google Pay en el botón de abajo.",
  },
};

// O México tem saída sem cartão: o OXXO, dentro da mesma folha de pagamento
// (o rótulo é o de `CheckoutStripe.tsx`).
const OXXO_ES = " Y si prefieres pagar en efectivo, en la misma pantalla de pago toca \"¿Sin tarjeta? Paga en efectivo en OXXO\" y pagas en cualquier OXXO.";

const EN: Record<GrupoRecusa, Texto> = {
  banco: {
    corpo: "Your bank didn't approve the payment. It happens a lot on a first purchase from a new online store, and it doesn't mean anything is wrong with your card.",
    lembrete: "To get it through: open your bank's app and approve the charge (or reply YES to your bank's text), then tap the button below and pay again. Apple Pay, Google Pay or another card also work.",
  },
  saldo: {
    corpo: "Your bank declined the payment because of insufficient funds on that card.",
    lembrete: "You can pay with another card, Apple Pay or Google Pay with the button below.",
  },
  dados: {
    corpo: "The payment didn't go through because one of the card details didn't match, usually the 3-digit security code or the expiration date.",
    lembrete: "Double-check the details and pay again with the button below. Apple Pay or Google Pay fill everything in for you.",
  },
  cartao: {
    corpo: "That card doesn't accept this kind of purchase. It happens a lot with debit and prepaid cards on online purchases.",
    lembrete: "Try another card (credit cards usually go through), Apple Pay or Google Pay with the button below.",
  },
  risco: {
    corpo: "We couldn't process the payment with that card.",
    lembrete: "Try another card, Apple Pay or Google Pay with the button below.",
  },
};

/** O texto do motivo, no idioma da compra. O OXXO só pra quem pagaria em peso (México). */
export function textoDaRecusa(grupo: GrupoRecusa, locale: "es" | "en", mexico: boolean): Texto {
  if (locale === "es") {
    const t = ES[grupo];
    return mexico ? { corpo: t.corpo, lembrete: t.lembrete + OXXO_ES } : t;
  }
  return EN[grupo];
}
