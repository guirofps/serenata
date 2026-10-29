// A MÚSICA FOI PAGA EM PESO? (Ballad, 28/10/2026)
//
// Os e-mails pós-compra que mostram preço (o do vídeo) não têm o cabeçalho de
// país que decide a moeda no site (`preco-mxn.ts`). O que eles têm é a compra:
// pela dLocal Go (OXXO/transferência) só paga quem está no México, e no Stripe
// a sessão diz a moeda em que cobrou. O pedido em si fica em dólar, então a
// moeda só existe no gateway.
//
// Na dúvida (sem chave, Stripe fora, formato desconhecido), dólar: é o preço
// que a tela mostra fora do México, e o caixa cobra pelo país do acesso de
// qualquer jeito.

export async function compraEmPeso(pedido: { gateway?: string | null; payment_id?: string | null }): Promise<boolean> {
  const gateway = String(pedido.gateway ?? "").toLowerCase();
  const ref = String(pedido.payment_id ?? "");
  if (gateway === "dlocalgo" || ref.startsWith("dlocalgo:")) return true;
  const sessao = /^stripe:(cs_(?:test|live)_[A-Za-z0-9]+)$/.exec(ref)?.[1];
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!sessao || !chave) return false;
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessao}`, {
      headers: { Authorization: `Bearer ${chave}` },
    });
    if (!r.ok) return false;
    const s = (await r.json()) as { currency?: string | null };
    return String(s.currency ?? "").toLowerCase() === "mxn";
  } catch {
    return false;
  }
}
