import { describe, expect, it } from "vitest";
import { bracoPrecoVideo, centavosDoVideo, textoPrecoVideo } from "@/lib/preco-video";

describe("preço do vídeo por token", () => {
  it("último caractere par = A (R$ 24,90), ímpar = B (R$ 19,90)", () => {
    expect(bracoPrecoVideo("75933f320c3b0d669dd8d6e0e9eb963e")).toBe("A");
    expect(centavosDoVideo("75933f320c3b0d669dd8d6e0e9eb963e")).toBe(2490);
    expect(bracoPrecoVideo("a2ab89a24bad322daff9455190b74949")).toBe("B");
    expect(centavosDoVideo("a2ab89a24bad322daff9455190b74949")).toBe(1990);
    expect(textoPrecoVideo("a2ab89a24bad322daff9455190b74949")).toBe("R$ 19,90");
  });
  it("sem token é o preço de sempre", () => {
    expect(centavosDoVideo(null)).toBe(2490);
    expect(centavosDoVideo("")).toBe(2490);
  });
  it("divide perto de meio a meio", () => {
    let b = 0;
    for (let i = 0; i < 4096; i++) if (bracoPrecoVideo(crypto.randomUUID().replace(/-/g, "")) === "B") b++;
    expect(b / 4096).toBeGreaterThan(0.45);
    expect(b / 4096).toBeLessThan(0.55);
  });
});
