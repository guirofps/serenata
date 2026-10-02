import { describe, it, expect } from "vitest";
import { ehExemplo } from "../../inngest/functions/limparAudioAntigo";

// Em 18/09 e 26/09 a limpeza apagou o áudio de 7 páginas de exemplo da home
// (músicas nossas, sem pedido). Exemplo nunca entra na limpeza.
describe("a limpeza de áudio nunca toca exemplo", () => {
  it("reconhece os tokens de exemplo das três marcas", () => {
    for (const t of ["expai51378356a9", "exesmama651ba4fe", "exenwife3b4f983682"]) expect(ehExemplo(t)).toBe(true);
  });
  it("token de cliente (hexadecimal) nunca é exemplo", () => {
    for (const t of ["7c29a95dd1684ed6b2f5db", "e8bf334a96044b469d6cbc", "", null, undefined]) expect(ehExemplo(t)).toBe(false);
  });
});
