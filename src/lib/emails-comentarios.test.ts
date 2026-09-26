import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Comentário HTML dentro de modelo de e-mail NÃO pode ter ">" nem "--" no
// meio. O Yahoo fechava o comentário no primeiro "->" e mostrava o resto pro
// cliente: de 10/08 a 26/09 o e-mail de entrega exibia "404 /p/783ef... (com
// ponto) -> 404 Como botão..." no meio do texto, e uma compradora leu golpe.
describe("comentários HTML nos e-mails", () => {
  const pasta = join(__dirname, "../../emails");
  for (const f of readdirSync(pasta).filter((x) => x.endsWith(".ts"))) {
    it(f, () => {
      const s = readFileSync(join(pasta, f), "utf8");
      const perigosos = [...s.matchAll(/<!--([\s\S]*?)-->/g)].filter((m) => /[<>]|--/.test(m[1]));
      expect(perigosos.map((m) => m[1].trim().slice(0, 60))).toEqual([]);
    });
  }
});
