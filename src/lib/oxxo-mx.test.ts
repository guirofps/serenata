import { describe, expect, it } from "vitest";
import { oxxoLigado } from "./oxxo-mx";

describe("oxxoLigado", () => {
  it("só no braço B, no México e em espanhol", () => {
    expect(oxxoLigado("B", "MX", "es")).toBe(true);
    expect(oxxoLigado("A", "MX", "es")).toBe(false);
    expect(oxxoLigado("B", "US", "es")).toBe(false);
    expect(oxxoLigado("B", "MX", "en")).toBe(false);
    expect(oxxoLigado("B", null, "es")).toBe(false);
  });
});
