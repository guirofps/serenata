// LER O `?…` DA URL SEM O ZOD (16/10).
//
// O `validateSearch` das rotas mora no pacote de ENTRADA de toda página (o
// roteador precisa dele antes de saber qual página carregar), e com ele vinham
// ~14 KB gzip de zod só pra dizer "isto é texto, aquilo é número". No celular
// em 4G é tempo antes de o primeiro botão responder. Estas três funções fazem
// o mesmo trabalho e são mais tolerantes: o roteador entrega `?code=123` como
// NÚMERO, e o `z.string()` recusava a página inteira por isso.

/** Texto, ou `undefined`. Número vira texto (o roteador converte `?code=123`). */
export function texto(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

/** Número, ou `undefined` (o `z.coerce.number()` de antes). */
export function numero(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Um dos valores permitidos, ou `undefined`. */
export function umDe<T extends string>(v: unknown, permitidos: readonly T[]): T | undefined {
  return typeof v === "string" && (permitidos as readonly string[]).includes(v) ? (v as T) : undefined;
}
