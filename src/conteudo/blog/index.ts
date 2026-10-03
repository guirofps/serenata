// OS ARTIGOS PUBLICADOS, na ordem da pauta (`pauta.ts`). Artigo novo: criar o
// arquivo, importar aqui, pôr no sitemap. O teste de conteúdo cobra o resto.

import type { Artigo } from "@/lib/blog/tipos";
import { artigo as mae } from "./musica-personalizada-para-mae";
import { artigo as pai } from "./musica-personalizada-para-pai";
import { artigo as namorada } from "./musica-personalizada-para-namorada";
import { artigo as avo } from "./homenagem-para-avo";
import { artigo as namoro } from "./presente-aniversario-de-namoro";
import { artigo as bodas } from "./presente-bodas-aniversario-de-casamento";
import { artigo as natal } from "./presente-de-natal-emocionante";

export const ARTIGOS: Artigo[] = [mae, pai, namorada, avo, namoro, bodas, natal];

export function artigoPorSlug(slug: string): Artigo | undefined {
  return ARTIGOS.find((a) => a.slug === slug);
}
