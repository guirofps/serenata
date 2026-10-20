import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAUTA_ES } from "@/conteudo/blog-es/pauta";
import { RESPONSAVEL, cnpjFormatado } from "@/lib/empresa";
import { rodapeBallad, type LinkRodape } from "./rodape-ballad";

const ROTAS = new Set(["/", "/criar", "/termos", "/privacidade", "/es", "/es/criar", "/es/blog"]);
// Onde mora cada âncora que o rodapé usa.
const ANCORAS: Record<string, string> = {
  "/#como-funciona": "src/components/landing/HomeEn.tsx",
  "/#exemplo": "src/components/landing/ExemplosEn.tsx",
  "/es#como-funciona": "src/routes/es.index.tsx",
  "/es#ejemplo": "src/components/landing/ExemplosEs.tsx",
};

const linksDe = (r: ReturnType<typeof rodapeBallad>): LinkRodape[] => [
  r.chamada.link,
  ...r.colunas.flatMap((c) => c.links),
  ...r.idiomas.map((i) => i.link),
];

describe.each(["en", "es"] as const)("rodapé da Ballad (%s)", (idioma) => {
  const r = rodapeBallad(idioma);

  it("todo link vai pra rota que existe, artigo publicado ou e-mail", () => {
    for (const l of linksDe(r)) {
      if (l.tipo === "rota") expect(ROTAS.has(l.to), l.to).toBe(true);
      if (l.tipo === "artigo") expect(PAUTA_ES, l.slug).toContain(l.slug);
      if (l.tipo === "email") expect(l.href).toMatch(/^mailto:\S+@\S+$/);
    }
  });

  it("toda âncora existe na página de destino", () => {
    for (const l of linksDe(r)) {
      if (l.tipo !== "rota" || !l.hash) continue;
      const arquivo = ANCORAS[`${l.to}#${l.hash}`];
      expect(arquivo, `${l.to}#${l.hash}`).toBeTruthy();
      expect(readFileSync(arquivo, "utf8")).toContain(`id="${l.hash}"`);
    }
  });

  it("três colunas, chamada pro quiz do idioma e os dois idiomas", () => {
    expect(r.colunas).toHaveLength(3);
    expect(r.chamada.link).toMatchObject({
      tipo: "rota",
      to: idioma === "es" ? "/es/criar" : "/criar",
    });
    expect(r.idiomas.map((i) => i.locale)).toEqual(["en", "es"]);
    expect(r.idiomas.find((i) => i.atual)?.locale).toBe(idioma);
  });

  it("selos sem promessa de devolução nem garantia (regra da casa)", () => {
    expect(JSON.stringify(r)).not.toMatch(
      /refund|money.back|guarant|reembolso|devoluci|garant[ií]a/i,
    );
    expect(r.selos.length).toBeGreaterThanOrEqual(2);
  });

  it("quem vende é o EMPRESA (o RESPONSAVEL é só da Serenata)", () => {
    expect(r.empresa).toContain(cnpjFormatado());
    expect(JSON.stringify(r)).not.toContain(RESPONSAVEL.razaoSocial);
    expect(JSON.stringify(r)).not.toContain(cnpjFormatado(RESPONSAVEL.cnpj));
  });
});

it("textos no idioma certo", () => {
  expect(rodapeBallad("en").chamada.botao).toBe("Create your song");
  expect(rodapeBallad("es").chamada.botao).toBe("Crea tu canción");
});
