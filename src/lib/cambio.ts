import { PRECOS } from "@/lib/custos";

// A COTAÇÃO DO DÓLAR QUE O PAINEL USA PRA SOMAR VENDA EM REAL (29/09).
//
// Nasceu com a Ballad: a venda entra em dólar (Stripe) e o gasto do Google
// sai em real (a conta de anúncios é em BRL). Pra custo por venda e ROAS
// saírem direto, a venda vira real — e aí a cotação importa: com a fixa de
// `PRECOS.cambioUsdBrl`, um dólar a 5,70 faria a Ballad parecer 5% mais pobre
// do que é, e a decisão de cortar campanha sai desse número.
//
// Só LEITURA de painel. Custo de produção continua gravado com o câmbio fixo
// no momento em que acontece (`custos.ts`), e isso é de propósito: registro
// não se reescreve com a cotação de hoje.
//
// Falha pra fixa, nunca pra zero: sem cotação, o painel mostra um número um
// pouco errado em vez de uma receita zerada, que pareceria venda perdida.

const FONTE = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const VALIDADE_MS = 6 * 3600 * 1000;

let guardado: { valor: number; em: number } | null = null;

export async function cambioDoDia(): Promise<number> {
  if (guardado && Date.now() - guardado.em < VALIDADE_MS) return guardado.valor;
  try {
    const r = await fetch(FONTE, { signal: AbortSignal.timeout(3000) });
    const j = (await r.json()) as { USDBRL?: { bid?: string } };
    const v = Number(j.USDBRL?.bid);
    // Faixa de sanidade: cotação fora disso é resposta quebrada, não mercado.
    if (Number.isFinite(v) && v > 3 && v < 10) {
      guardado = { valor: v, em: Date.now() };
      return v;
    }
  } catch {
    // cai na fixa abaixo
  }
  return PRECOS.cambioUsdBrl;
}
