import { expect, it, vi } from "vitest";
import { tentar } from "./tentar";

it("devolve o resultado quando dá certo", async () => {
  expect(await tentar("x", async () => ({ n: 1 }))).toEqual({ n: 1 });
});

it("erro vira { erro } e não sobe: o passo seguinte do job continua", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await tentar("anuncios", async () => { throw new Error("Unrecognized field"); })).toEqual({
    erro: "Unrecognized field",
  });
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
