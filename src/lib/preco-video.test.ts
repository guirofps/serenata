import { describe, expect, it } from "vitest";
import { bracoPrecoVideo, centavosDoVideo, textoPrecoVideo } from "@/lib/preco-video";

describe("preço do vídeo por token", () => {
  it("teste encerrado: todo token paga R$ 24,90", () => {
    expect(bracoPrecoVideo("75933f320c3b0d669dd8d6e0e9eb963e")).toBe("A");
    expect(centavosDoVideo("75933f320c3b0d669dd8d6e0e9eb963e")).toBe(2490);
    expect(bracoPrecoVideo("a2ab89a24bad322daff9455190b74949")).toBe("A");
    expect(centavosDoVideo("a2ab89a24bad322daff9455190b74949")).toBe(2490);
    expect(textoPrecoVideo("a2ab89a24bad322daff9455190b74949")).toBe("R$ 24,90");
  });
  it("sem token é o preço de sempre", () => {
    expect(centavosDoVideo(null)).toBe(2490);
    expect(centavosDoVideo("")).toBe(2490);
  });
});
