// OS ARTIGOS PUBLICADOS do blog da Ballad em espanhol, na ordem da pauta
// (`pauta.ts`). Artigo novo: criar o arquivo, importar aqui e pôr o <url> no
// sitemap da Ballad (`public/ballad/sitemap.xml`). O teste cobra o resto.

import type { Artigo } from "@/lib/blog/tipos";

export const ARTIGOS_ES: Artigo[] = [];

export function artigoEsPorSlug(slug: string): Artigo | undefined {
  return ARTIGOS_ES.find((a) => a.slug === slug);
}
