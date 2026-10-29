// EM QUE MOEDA ESTA PESSOA COMPRA? (Ballad, 28/10/2026; generalizado em 29/10)
//
// Os e-mails pós-compra que mostram preço (o do vídeo) não têm o cabeçalho de
// país que decide a moeda no site (`mercados.ts`). O que eles têm é o QUIZ e
// a COMPRA:
//   1. o país gravado no quiz (`quiz_responses.pais`, desde 29/10), que é o
//      mesmo país que escolheu o espanhol e o preço da página;
//   2. sem ele (quiz antigo), a compra: pela dLocal Go só paga quem está no
//      México, e no Stripe a sessão diz a moeda em que cobrou.
// O pedido em si fica em dólar (`valor_centavos`), então a moeda só existe aí.
//
// Na dúvida (sem chave, Stripe fora, formato desconhecido), dólar: é o preço
// que a tela mostra fora dos mercados locais, e o caixa cobra pelo país do
// acesso de qualquer jeito.

import type { SupabaseClient } from "@supabase/supabase-js";
import { mercadoDaMoeda, mercadoDoPais, type Moeda } from "../../src/lib/mercados.js";
import { paisDoQuiz } from "../../src/lib/pais-quiz.js";

type Pedido = { gateway?: string | null; payment_id?: string | null; quiz_response_id?: string | null };

/** A moeda em que o gateway cobrou esta compra. Desconhecida = `usd`. */
async function moedaDoGateway(pedido: Pedido): Promise<Moeda> {
  const gateway = String(pedido.gateway ?? "").toLowerCase();
  const ref = String(pedido.payment_id ?? "");
  // A dLocal Go só está ligada no México (`temDlocal`).
  if (gateway === "dlocalgo" || ref.startsWith("dlocalgo:")) return "mxn";
  const sessao = /^stripe:(cs_(?:test|live)_[A-Za-z0-9]+)$/.exec(ref)?.[1];
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!sessao || !chave) return "usd";
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessao}`, {
      headers: { Authorization: `Bearer ${chave}` },
    });
    if (!r.ok) return "usd";
    const s = (await r.json()) as { currency?: string | null };
    return mercadoDaMoeda(s.currency)?.moeda ?? "usd";
  } catch {
    return "usd";
  }
}

/** A moeda desta compra: o país do quiz, se gravado; senão, a moeda que o gateway cobrou. */
export async function moedaDaCompra(sb: SupabaseClient | null, pedido: Pedido): Promise<Moeda> {
  if (sb && pedido.quiz_response_id) {
    const pais = await paisDoQuiz(sb, { id: pedido.quiz_response_id });
    if (pais) return mercadoDoPais(pais).moeda;
  }
  return moedaDoGateway(pedido);
}

/** A música foi paga em peso? Mantido pra quem já perguntava só isso. */
export async function compraEmPeso(pedido: Pedido): Promise<boolean> {
  return (await moedaDoGateway(pedido)) === "mxn";
}
