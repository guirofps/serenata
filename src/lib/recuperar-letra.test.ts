import { describe, expect, it } from "vitest";
import { recuperarLetra, campoDoModelo } from "./coautoria";

const LETRA = "[Verse 1]\n" + "Linha da estrofe que conta a história de vocês\n".repeat(6) + "[Chorus]\nRefrão";

describe("recuperarLetra", () => {
  it("recupera de JSON torto (vírgula faltando entre campos)", () => {
    const bruto = `{"titulo": "Meu Amor" "letra": ${JSON.stringify(LETRA)}, "estilo_suno": "sertanejo"}`;
    const r = recuperarLetra(bruto, "Sua música");
    expect(r?.titulo).toBe("Meu Amor");
    expect(r?.letra).toContain("[Chorus]");
    expect(r?.estilo_suno).toBe("sertanejo");
  });
  it("aceita letra em texto puro quando tem marcações", () => {
    expect(recuperarLetra(LETRA, "Sua música")?.letra).toContain("[Verse 1]");
  });
  it("não aceita letra cortada (sem aspa final) nem texto sem cara de letra", () => {
    expect(recuperarLetra(`{"letra": "${"a".repeat(300)}`, "x")).toBeNull();
    expect(recuperarLetra("Desculpe, não posso ajudar com isso.", "x")).toBeNull();
  });
  it("lê campo com aspas escapadas", () => {
    expect(campoDoModelo('{"titulo": "O \\"nosso\\" lugar"}', "titulo")).toEqual({ texto: 'O "nosso" lugar', fechado: true });
  });
});
