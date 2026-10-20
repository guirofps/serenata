// OS ARTIGOS PUBLICADOS do blog da Ballad em espanhol, na ordem da pauta
// (`pauta.ts`). Artigo novo: criar o arquivo, importar aqui e pôr o <url> no
// sitemap da Ballad (`public/ballad/sitemap.xml`). O teste cobra o resto.

import type { Artigo } from "@/lib/blog/tipos";
import { artigo as cancionPersonalizadaParaMiEsposa } from "./cancion-personalizada-para-mi-esposa";
import { artigo as cancionParaMiMama } from "./cancion-para-mi-mama";
import { artigo as cancionParaMiPapa } from "./cancion-para-mi-papa";
import { artigo as cancionParaMiNovia } from "./cancion-para-mi-novia";
import { artigo as cancionDeAniversarioDeBodas } from "./cancion-de-aniversario-de-bodas";

export const ARTIGOS_ES: Artigo[] = [
  cancionPersonalizadaParaMiEsposa,
  cancionParaMiMama,
  cancionParaMiPapa,
  cancionParaMiNovia,
  cancionDeAniversarioDeBodas,
];

export function artigoEsPorSlug(slug: string): Artigo | undefined {
  return ARTIGOS_ES.find((a) => a.slug === slug);
}
