import { expect, it } from "vitest";
import { lotesPorTamanho } from "./lotes";

it("lotes de gclid cabem na URL do Supabase e não perdem ninguém", () => {
  const gclids = Array.from({ length: 300 }, (_, i) => `Cj0KCQjw${String(i).padStart(4, "0")}`.padEnd(100, "x"));
  const lotes = lotesPorTamanho(gclids);
  for (const l of lotes) expect(encodeURIComponent(l.join(",")).length).toBeLessThanOrEqual(6000);
  expect(lotes.flat()).toEqual(gclids);
});

it("um id maior que o limite vai sozinho, sem travar", () => {
  expect(lotesPorTamanho(["a".repeat(7000), "b"], 6000)).toEqual([["a".repeat(7000)], ["b"]]);
});
