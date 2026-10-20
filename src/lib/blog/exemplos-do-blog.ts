import { audioDoExemploEsUs, exemploEsUs } from "@/lib/exemplos-es-us";
import { AUDIO_EXEMPLOS, capaDoExemplo, exemploPorSlug } from "@/lib/exemplos-pt";
import type { ExemploBlog, SiteBlog } from "./site";

// Fora do site.ts de propósito: o `head` das rotas importa o site, e o head vai
// no chunk de entrada. Os catálogos só entram com o componente do artigo.
export function exemploDoBlog(site: SiteBlog, slug: string): ExemploBlog | undefined {
  if (site.chave === "ballad-es") {
    const e = exemploEsUs(slug);
    return e ? { slug: e.slug, titulo: e.titulo, para: e.para, genero: e.genero, capa: e.capa, audio: audioDoExemploEsUs(e.slug) } : undefined;
  }
  const e = exemploPorSlug(slug);
  return e
    ? { slug: e.slug, titulo: e.titulo, para: e.para, genero: e.genero, capa: capaDoExemplo(e), audio: `${AUDIO_EXEMPLOS}/${e.slug}.mp3` }
    : undefined;
}
