// TENTAR DE NOVO, COM ESPERA CRESCENTE (29/10).
//
// Nasceu da gravação do lead (`lead-capture.ts`): uma falha de rede no upsert
// de progresso só ia pro console, e quem estava num 4G ruim no passo do e-mail
// sumia da base sem deixar rastro. Também serve a `/retomar`, que confundia
// "sem rede" com "não achei a sua letra".
//
// Puro de propósito (o relógio entra por parâmetro): o teste não espera de
// verdade, e o mesmo laço vale pro navegador e pro servidor.

export type ResultadoRetentativa<T> =
  | { ok: true; valor: T; tentativas: number }
  | { ok: false; erro: unknown; tentativas: number; desistiu: boolean };

/**
 * Roda `fn`; se ela LANÇAR, espera `esperas[0]` e tenta de novo, depois
 * `esperas[1]`, e assim por diante. `esperas.length` é o número de
 * retentativas (a primeira tentativa não conta). `desistir` é consultado antes
 * de cada retentativa: quando outra chamada mais nova já levou o mesmo dado,
 * insistir na velha só serve pra sobrescrever o novo.
 */
export async function comRetentativas<T>(
  fn: () => Promise<T>,
  esperas: readonly number[],
  opcoes: { dormir?: (ms: number) => Promise<void>; desistir?: () => boolean } = {},
): Promise<ResultadoRetentativa<T>> {
  const dormir = opcoes.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let erro: unknown = null;
  for (let i = 0; i <= esperas.length; i++) {
    if (i > 0) {
      if (opcoes.desistir?.()) return { ok: false, erro, tentativas: i, desistiu: true };
      await dormir(esperas[i - 1]);
      if (opcoes.desistir?.()) return { ok: false, erro, tentativas: i, desistiu: true };
    }
    try {
      return { ok: true, valor: await fn(), tentativas: i + 1 };
    } catch (err) {
      erro = err;
    }
  }
  return { ok: false, erro, tentativas: esperas.length + 1, desistiu: false };
}
