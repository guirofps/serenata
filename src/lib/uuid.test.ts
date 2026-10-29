import { describe, expect, it } from "vitest";
import { uuidV4 } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidV4", () => {
  it("usa o randomUUID quando existe", () => {
    expect(uuidV4({ randomUUID: () => "x-y" })).toBe("x-y");
  });
  it("sem randomUUID, monta um v4 válido pelo getRandomValues", () => {
    const id = uuidV4({ getRandomValues: (a) => globalThis.crypto.getRandomValues(a) });
    expect(id).toMatch(V4);
  });
  it("randomUUID que lança (contexto inseguro) também cai no fallback", () => {
    const id = uuidV4({
      randomUUID: () => {
        throw new Error("insecure");
      },
      getRandomValues: (a) => globalThis.crypto.getRandomValues(a),
    });
    expect(id).toMatch(V4);
  });
  it("sem crypto nenhum, ainda sai no formato", () => {
    expect(uuidV4({})).toMatch(V4);
  });
});
