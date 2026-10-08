// TETO DE FREQUÊNCIA DE E-MAIL — a conta, sem banco (teste `limite_frequencia`,
// 08/10).
//
// SEM IMPORTS: lido pelo Inngest (ESM puro na Vercel).
//
// No braço B, cada ENDEREÇO recebe no máximo 2 e-mails que não são
// transacionais em 24 horas corridas. O A segue como sempre foi. O que se quer
// saber: menos e-mail por pessoa derruba venda, ou só derruba descadastro e
// reclamação (e com eles a reputação que segura a ENTREGA na caixa de entrada)?
//
// ── O QUE É TRANSACIONAL, E POR ISSO NÃO CONTA ───────────────────
//
// O que a pessoa pediu ou pagou pra receber: a entrega (e o aviso de que ela
// está em produção), a música do crédito, o vídeo pronto, o magic link e o
// código PIX que ela mesma gerou (esses dois nem passam por `emails_enviados`).
//
// A letra (`letra_pronta`) e o primeiro lembrete do PIX (`pix_nao_pago`) são
// meio-termo: o PRIMEIRO é o que a pessoa pediu (a letra que ela digitou o
// e-mail pra receber, o código que ela gerou), e não conta; um segundo do
// mesmo tipo dentro da janela já é insistência, e conta.

/** Quantos e-mails de marketing por endereço, em 24h, no braço B. */
export const TETO_MARKETING_24H = 2;

export const JANELA_FREQUENCIA_MS = 24 * 3600 * 1000;

/** Nunca contam. */
export const TRANSACIONAIS: ReadonlySet<string> = new Set([
  "entrega",
  "entrega_em_producao",
  "entrega_credito",
  "video_pronto",
  "acesso",
  "magic_link",
  "pix_codigo",
]);

/** O primeiro de cada um na janela não conta; do segundo em diante, conta. */
export const TRANSACIONAL_SO_O_PRIMEIRO: ReadonlySet<string> = new Set(["letra_pronta", "pix_nao_pago"]);

export type EnvioRecente = { template: string | null; created_at: string };

/** Quantos e-mails de marketing estas linhas somam dentro da janela. */
export function contarMarketing(linhas: EnvioRecente[], agora: number): number {
  const desde = agora - JANELA_FREQUENCIA_MS;
  const primeiroVisto = new Set<string>();
  let n = 0;
  // Do mais antigo pro mais novo: "o primeiro" é o primeiro no tempo.
  const ordenadas = [...linhas].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const l of ordenadas) {
    const quando = Date.parse(l.created_at);
    if (!Number.isFinite(quando) || quando < desde) continue;
    const t = String(l.template ?? "");
    if (TRANSACIONAIS.has(t)) continue;
    if (TRANSACIONAL_SO_O_PRIMEIRO.has(t) && !primeiroVisto.has(t)) {
      primeiroVisto.add(t);
      continue;
    }
    n += 1;
  }
  return n;
}

/** Cabe mais um e-mail de marketing pra este endereço agora? */
export function cabeMaisUmMarketing(linhas: EnvioRecente[], agora: number, teto = TETO_MARKETING_24H): boolean {
  return contarMarketing(linhas, agora) < teto;
}
