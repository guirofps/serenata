// Envia a venda pra UTMIFY (atribuição de anúncio).
//
// Por que pela API e não pela integração de painel: assim a gente controla o
// que é enviado e não depende de o gateway ter (ou manter) uma integração
// nativa. E, principalmente, os UTMs saem do NOSSO banco — de
// `quiz_responses.attribution`, capturada no first-touch — em vez de depender
// do que o checkout ecoa de volta.
//
// Nunca derruba o webhook: se a Utmify falhar, o presente já foi entregue e o
// que se perde é um dado de relatório. Erro vira log, não exceção.

type Attribution = Record<string, string | undefined> | null;

export type VendaUtmify = {
  orderId: string;
  status: "paid" | "refunded" | "waiting_payment" | "refused" | "chargedback";
  valorCentavos: number;
  email: string | null;
  nome: string | null;
  /** `metadata.src` do checkout = session_id do nosso funil. */
  src: string | null;
  attribution: Attribution;
  criadoEm?: Date;
  aprovadoEm?: Date | null;
  reembolsadoEm?: Date | null;
  /** Método real quando conhecido; a Perfect Pay manda PIX/cartão. */
  metodo?: "pix" | "credit_card" | "boleto" | "paypal" | "free_price";
};

// A API exige "YYYY-MM-DD HH:MM:SS" em UTC (não ISO com T/Z).
function dataUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function enviarVendaUtmify(v: VendaUtmify): Promise<void> {
  const token = process.env.UTMIFY_API_TOKEN;
  if (!token) {
    console.warn("[utmify] UTMIFY_API_TOKEN ausente — venda não reportada");
    return;
  }

  const a = v.attribution ?? {};
  const criado = v.criadoEm ?? new Date();

  const corpo = {
    orderId: v.orderId,
    platform: "PerfectPay",
    paymentMethod: v.metodo ?? "pix",
    status: v.status,
    createdAt: dataUtc(criado),
    approvedDate: v.aprovadoEm ? dataUtc(v.aprovadoEm) : v.status === "paid" ? dataUtc(criado) : null,
    refundedAt: v.reembolsadoEm ? dataUtc(v.reembolsadoEm) : null,
    customer: {
      name: v.nome ?? "Comprador",
      email: v.email ?? "",
      phone: null,
      document: null,
      country: "BR",
      ip: "",
    },
    products: [
      {
        id: "serenata-musica",
        name: "Música Personalizada Completa",
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: v.valorCentavos,
      },
    ],
    trackingParameters: {
      // `src` é o nosso session_id; é ele que amarra a venda à visita.
      src: v.src,
      sck: null,
      utm_source: a.utm_source ?? null,
      utm_campaign: a.utm_campaign ?? null,
      utm_medium: a.utm_medium ?? null,
      utm_content: a.utm_content ?? null,
      utm_term: a.utm_term ?? null,
    },
    commission: {
      totalPriceInCents: v.valorCentavos,
      // Taxa real do gateway não vem no webhook; deixar 0 é mais honesto que
      // inventar um número que bagunçaria o relatório de lucro.
      gatewayFeeInCents: 0,
      userCommissionInCents: v.valorCentavos,
      currency: "BRL",
    },
  };

  try {
    const r = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": token },
      body: JSON.stringify(corpo),
    });
    if (!r.ok) {
      console.error("[utmify] recusou:", r.status, (await r.text()).slice(0, 300));
      return;
    }
    console.log("[utmify] venda reportada:", v.orderId, v.status);
  } catch (err) {
    console.error("[utmify] falhou:", err);
  }
}
