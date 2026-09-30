import { describe, expect, it } from "vitest";
import { emailPlausivel } from "./email-limpo";

describe("emailPlausivel", () => {
  it("aceita endereços reais", () => {
    for (const e of ["ana@gmail.com", "a.b+c@empresa.com.br", " x@y.io ", "joão@exemplo.xn--p1ai"]) expect(emailPlausivel(e)).toBe(true);
  });
  it("barra o que nunca entrega (casos reais de 27 e 28/09)", () => {
    for (const e of ["ricrdo313fs@gmail.com66996534277", "a@gmail..com", "a@gmail", "a b@gmail.com", "@gmail.com", "a@.com"]) expect(emailPlausivel(e)).toBe(false);
  });
});
