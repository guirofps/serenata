// As três músicas tocáveis das pré-landings da Ballad, do jeito que a página
// desenha (capa, título, para quem, gênero, áudio). Só exemplo GERADO pelo
// funil da Ballad (`exemplos-es-us.ts`, `exemplos-en.ts`): o que não tiver
// token some da lista em vez de tocar a música de outra marca.

import { SLUGS_LP_BALLAD } from "@/lib/lp-ballad";
import { audioDoExemploEsUs, exemploEsUs, exemplosEsUsProntos } from "@/lib/exemplos-es-us";
import { audioDoExemplo, exemploEn } from "@/lib/exemplos-en";

export type ExemploLp = {
  slug: string;
  titulo: string;
  para: string;
  genero: string;
  capa: string;
  audio: string;
};

export function exemplosDaLpBallad(idioma: "es" | "en"): ExemploLp[] {
  if (idioma === "es") {
    return SLUGS_LP_BALLAD.es.flatMap((s) => {
      const e = exemploEsUs(s);
      return e?.token
        ? [
            {
              slug: e.slug,
              titulo: e.titulo,
              para: e.para,
              genero: e.genero,
              capa: e.capa,
              audio: audioDoExemploEsUs(e.slug),
            },
          ]
        : [];
    });
  }
  return SLUGS_LP_BALLAD.en.flatMap((s) => {
    const e = exemploEn(s);
    return e?.token
      ? [
          {
            slug: e.slug,
            titulo: e.titulo,
            para: e.para,
            genero: e.genero,
            capa: e.capa,
            audio: audioDoExemplo(e.slug),
          },
        ]
      : [];
  });
}

/** O presente de exemplo que o "abrir um exemplo" abre: o mesmo das homes de cada idioma. */
export function tokenExemploBallad(idioma: "es" | "en"): string | undefined {
  return (
    (idioma === "es" ? exemplosEsUsProntos()[0]?.token : exemploEn("en-dad")?.token) || undefined
  );
}
