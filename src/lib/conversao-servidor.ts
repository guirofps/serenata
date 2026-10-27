// A VENDA, NO FORMATO QUE A DATA MANAGER API DO GOOGLE RECEBE (27/10).
//
// ── O BURACO ─────────────────────────────────────────────────────
//
// A conversão principal da Serenata é a lista de `api/conversoes.ts`, que o
// Google busca UMA vez por dia (~0h40). Uma venda das 9h chegava ao lance uns
// 16h depois, e numa conta nova (477-958-6821, desde 17/10) o lance aprende
// em cima do que recebe. A Ballad nem isso: contava só pela tag da /obrigado,
// e quem paga OXXO ou fecha a aba antes de voltar sumia (23 × 29 em 08-14/10).
//
// O envio pela API (`uploadClickConversions`) é RECUSADO pra conta nova:
// `CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE`, "use a Data Manager API". Ela
// pede o escopo `datamanager`, autorizado pelo dono em 27/10
// (`GOOGLE_DM_REFRESH_TOKEN`).
//
// ── O QUE SOBE ───────────────────────────────────────────────────
//
// As MESMAS vendas da lista: pagas, com dinheiro novo, com clique do Google.
// O `transactionId` é o id do pedido, o mesmo `Order ID` da lista: o Google
// deduplica por ele, então a lista da madrugada vira reserva sem contar duas
// vezes.
//
// De quebra, o que a lista nunca mandou: `gbraid`/`wbraid`, o clique do
// iPhone que chega sem `gclid` (a coluna "Google Click ID" do CSV só aceita
// `gclid`).
//
// Puro (sem rede, sem crypto): o hash do e-mail vem pronto de quem chama.

import { gclidParaConversao, ultimoCliqueDe, VALIDADE_GCLID_DIAS } from "./clique-recente.js";

type Atrib = Record<string, unknown> | null | undefined;

export type IdDoClique = { gclid: string } | { gbraid: string } | { wbraid: string };

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * O clique que vai pro Google, UM só (a API recusa dois): o `gclid` pela régua
 * da lista (`gclidParaConversao`); sem ele, o `gbraid`/`wbraid` do último
 * clique se estiver na validade, senão o do primeiro toque.
 */
export function idDoClique(attr: Atrib, agoraMs: number = Date.now()): IdDoClique | null {
  const gclid = gclidParaConversao(attr, agoraMs);
  if (gclid) return { gclid };
  const limite = agoraMs - VALIDADE_GCLID_DIAS * 86400000;
  const u = ultimoCliqueDe(attr);
  if (u && Date.parse(u.em) >= limite) {
    if (u.gbraid) return { gbraid: u.gbraid };
    if (u.wbraid) return { wbraid: u.wbraid };
  }
  const quando = Date.parse(texto(attr?.captured_at) ?? "");
  if (Number.isFinite(quando) && quando < limite) return null;
  const gbraid = texto(attr?.gbraid);
  if (gbraid) return { gbraid };
  const wbraid = texto(attr?.wbraid);
  if (wbraid) return { wbraid };
  return null;
}

/**
 * A moeda é do GATEWAY, a mesma régua da lista (`api/conversoes.ts`): Stripe e
 * dLocal gravam o pedido em dólar; o resto (inclusive a Perfect Pay do
 * espanhol, que grava em reais) em real.
 */
export function moedaDoPedido(gateway: string | null | undefined): "USD" | "BRL" {
  return gateway === "stripe" || gateway === "dlocalgo" ? "USD" : "BRL";
}

export type PedidoParaGoogle = {
  id: string;
  paid_at: string | null;
  valor_centavos: number | null;
  gateway: string | null;
  attribution: Atrib;
};

export type EventoGoogle = {
  adIdentifiers: IdDoClique;
  conversionValue: number;
  currency: "USD" | "BRL";
  eventTimestamp: string;
  transactionId: string;
  eventSource: "WEB";
  userData?: { userIdentifiers: Array<{ emailAddress: string }> };
};

/** O evento da venda, ou o motivo de ela não subir. */
export function eventoDoPedido(
  p: PedidoParaGoogle,
  agoraMs: number = Date.now(),
  emailHash?: string | null,
): { evento: EventoGoogle } | { pula: "sem_clique" | "sem_valor" } {
  if (!p.paid_at || !p.valor_centavos || p.valor_centavos <= 0) return { pula: "sem_valor" };
  const clique = idDoClique(p.attribution, agoraMs);
  if (!clique) return { pula: "sem_clique" };
  return {
    evento: {
      adIdentifiers: clique,
      conversionValue: Math.round(p.valor_centavos) / 100,
      currency: moedaDoPedido(p.gateway),
      eventTimestamp: new Date(p.paid_at).toISOString(),
      transactionId: p.id,
      eventSource: "WEB",
      // O e-mail ajuda o Google a casar a venda com o clique; vai só o hash.
      ...(emailHash ? { userData: { userIdentifiers: [{ emailAddress: emailHash }] } } : {}),
    },
  };
}

/** Normalização do Google antes do hash: minúsculo e sem espaço nas pontas. */
export function emailNormalizado(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}
