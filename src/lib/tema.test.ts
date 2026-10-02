import { describe, expect, it } from "vitest";
import { comTema, temaDoParametro, temaEfetivo } from "./tema";

describe("tema", () => {
  it("aceita só gospel, sem diferenciar maiúscula", () => {
    expect(temaDoParametro("gospel")).toBe("gospel");
    expect(temaDoParametro("GOSPEL")).toBe("gospel");
    expect(temaDoParametro("Gospel ")).toBe("gospel");
    expect(temaDoParametro("louvor")).toBeNull();
    expect(temaDoParametro("")).toBeNull();
    expect(temaDoParametro(undefined)).toBeNull();
  });

  it("URL vence, depois as respostas, depois nada", () => {
    expect(temaEfetivo("gospel", {}, "pt")).toBe("gospel");
    expect(temaEfetivo(null, { tema: "gospel" }, "pt")).toBe("gospel");
    expect(temaEfetivo(null, {}, "pt")).toBeNull();
  });

  it("valor forjado nas respostas não ativa", () => {
    expect(temaEfetivo(null, { tema: "Gospel" }, "pt")).toBeNull();
    expect(temaEfetivo(null, { tema: ["gospel"] }, "pt")).toBeNull();
  });

  it("só o funil português tem tema", () => {
    expect(temaEfetivo("gospel", { tema: "gospel" }, "es")).toBeNull();
    expect(temaEfetivo("gospel", { tema: "gospel" }, "en")).toBeNull();
  });

  it("comTema preserva o resto da atribuição", () => {
    const attr = { utm_source: "google", exp: { preco: "A" }, captured_at: "x" };
    expect(comTema(attr, "gospel")).toEqual({ ...attr, tema: "gospel" });
  });
});
