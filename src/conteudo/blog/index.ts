// OS ARTIGOS PUBLICADOS, na ordem da pauta (`pauta.ts`). Artigo novo: criar o
// arquivo, importar aqui, pôr no sitemap. O teste de conteúdo cobra o resto.

import type { Artigo } from "@/lib/blog/tipos";
import { artigo as mae } from "./musica-personalizada-para-mae";
import { artigo as pai } from "./musica-personalizada-para-pai";
import { artigo as namorada } from "./musica-personalizada-para-namorada";
import { artigo as avo } from "./homenagem-para-avo";

export const ARTIGOS: Artigo[] = [mae, pai, namorada, avo];

export function artigoPorSlug(slug: string): Artigo | undefined {
  return ARTIGOS.find((a) => a.slug === slug);
}
