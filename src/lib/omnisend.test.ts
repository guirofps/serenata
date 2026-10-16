import { describe, expect, it } from "vitest";
import { omnisendDaMarca, scriptOmnisend } from "@/lib/omnisend";

/** Roda o script num navegador de mentira; `carregar` diz se a porta executa. */
function rodar(carregar: boolean) {
  const inseridos: string[] = [];
  const win: Record<string, unknown> = {
    __depoisDaPagina: (f: () => void) => {
      if (carregar) f();
    },
  };
  const doc = {
    createElement: () => ({}) as { src?: string },
    getElementsByTagName: () => [
      { parentNode: { insertBefore: (e: { src: string }) => inseridos.push(e.src) } },
    ],
  };
  new Function("window", "document", scriptOmnisend("marca123", false))(win, doc);
  return { win, inseridos };
}

describe("scriptOmnisend", () => {
  it("a fila nasce na hora com a marca e a visita, antes do arquivo remoto", () => {
    const { win, inseridos } = rodar(false);
    expect(win.omnisend).toEqual([
      ["brandID", "marca123"],
      ["track", "$pageViewed"],
    ]);
    expect(inseridos).toEqual([]);
  });

  it("o arquivo remoto entra pela porta de depois da página", () => {
    const { inseridos } = rodar(true);
    expect(inseridos).toEqual(["https://omnisnippet1.com/inshop/launcher-v2.js"]);
  });
});

describe("omnisendDaMarca", () => {
  it("só a Serenata tem Omnisend", () => {
    expect(omnisendDaMarca("serenata")).toBe("6ad0e987160c976a2a289ea1");
    expect(omnisendDaMarca("ballad")).toBeNull();
  });
});
