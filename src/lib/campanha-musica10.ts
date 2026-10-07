// AS REGRAS DA CAMPANHA MUSICA10, puras: o job do Inngest e os testes leem
// daqui. Sem imports com `@` (o Inngest roda como ESM puro).

export const CAMPANHA = "musica10";

/** ~300 por hora, 12 rodadas por dia: uns 3.600/dia sem pico que assine lista comprada. */
export const POR_RODADA = 300;
/** O teto do `resend.batch`. */
export const LOTE = 100;

/** Abaixo disto, uma reclamação sozinha decidiria a campanha. */
export const AMOSTRA_MINIMA = 200;
export const BOUNCE_MAX = 0.04;
export const RECLAMACAO_MAX = 0.001;

export type VersaoEnvio = "comprador" | "lead";

/** Motivo da parada, ou null pra seguir. Olha as últimas 24h. */
export function freioAcionado(t: { enviados: number; bounces: number; reclamacoes: number }): string | null {
  if (t.enviados < AMOSTRA_MINIMA) return null;
  const b = t.bounces / t.enviados;
  if (b > BOUNCE_MAX) return `bounce de ${(b * 100).toFixed(1)}% nas últimas 24h (teto ${BOUNCE_MAX * 100}%)`;
  const r = t.reclamacoes / t.enviados;
  if (r > RECLAMACAO_MAX) return `reclamação de spam em ${(r * 100).toFixed(2)}% nas últimas 24h (teto ${RECLAMACAO_MAX * 100}%)`;
  return null;
}

export function emLotes<T>(xs: T[], n = LOTE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export function linkCriarCampanha(site: string, versao: VersaoEnvio): string {
  return `${site}/criar?cupom=MUSICA10&utm_source=email&utm_medium=campanha&utm_campaign=musica10&utm_content=${versao}`;
}

export function templateDoEnvio(versao: VersaoEnvio): string {
  return `campanha_musica10_${versao}`;
}
