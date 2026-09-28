// A ESCADA DE RECUPERAÇÃO PAROU? (28/09)
//
// Duas vezes ela parou sem ninguém ver, e nas duas nada deu erro:
//   - 31/08 a 25/09: o laço travava nos mesmos 60 candidatos e caiu de 480
//     envios/dia pra ~3 (consertado em 25/09);
//   - 10 a 26/09, medido na auditoria de 28/09: 4.475 pessoas com a música
//     pronta, sem compra, não receberam NENHUM e-mail depois da letra.
//
// Com ~14 mil pessoas aptas na fila e o cron a cada 30 min, 6h sem um envio
// não é "fila vazia": é a escada muda. Mesma doutrina do `orquestrador-mudo`:
// olhar o RELÓGIO do último envio, não a ausência de erro.
//
// Pura, sem banco, pra o vigia externo e o teste usarem a mesma regra.

/** Horas sem nenhum envio da escada que já contam como parada. */
export const ESCADA_MUDA_H = 6;
/**
 * Letras enviadas nas últimas 48h abaixo disso = pouco tráfego pra exigir
 * escada (madrugada de feriado, campanha pausada). Aí ela dorme, igual aos
 * outros sinais.
 */
export const ESCADA_MIN_LETRAS_48H = 100;

export function escadaMuda(x: { enviosNasUltimasHoras: number; letras48h: number }): {
  avisar: boolean;
  motivo: string | null;
} {
  if (x.letras48h < ESCADA_MIN_LETRAS_48H) return { avisar: false, motivo: null };
  if (x.enviosNasUltimasHoras > 0) return { avisar: false, motivo: null };
  return {
    avisar: true,
    motivo: `escada de recuperação sem nenhum envio há ${ESCADA_MUDA_H}h, com ${x.letras48h} letras enviadas em 48h`,
  };
}
