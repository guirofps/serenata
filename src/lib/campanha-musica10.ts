// AS REGRAS DA CAMPANHA MUSICA10, puras: o job do Inngest e os testes leem
// daqui. Sem imports com `@` (o Inngest roda como ESM puro).

import { emailPlausivel } from "./email-limpo.js";

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

/**
 * Tira do lote o que NUNCA é endereço válido (`x@hotmail.com.`, `y@gmail`,
 * espaço no meio). Um desses, num `batch` estrito, derruba os 100; aqui ele
 * sai antes e vira `pulado = 'invalido'` na fila.
 */
export function separarPorValidade<T extends { email: string }>(lote: T[]): { validos: T[]; invalidos: T[] } {
  const validos: T[] = [];
  const invalidos: T[] = [];
  for (const l of lote) (emailPlausivel(l.email) ? validos : invalidos).push(l);
  return { validos, invalidos };
}

/**
 * O id de cada e-mail do lote, na ordem do lote, com `null` nos que o Resend
 * recusou. No modo `permissive` só os aceitos vêm em `data`, na ordem, e
 * `errors` traz o índice dos recusados; se vier um por posição, vale a posição.
 */
export function idsDoLote(
  n: number,
  data: Array<{ id: string }>,
  erros: Array<{ index: number }>,
): Array<string | null> {
  if (data.length === n) return data.map((d) => d.id ?? null);
  const recusado = new Set(erros.map((e) => e.index));
  const out: Array<string | null> = [];
  let k = 0;
  for (let i = 0; i < n; i++) out.push(recusado.has(i) ? null : (data[k++]?.id ?? null));
  return out;
}
