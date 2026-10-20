// OS ARTIGOS PUBLICADOS do blog da Ballad em espanhol, na ordem da pauta
// (`pauta.ts`). Artigo novo: criar o arquivo, importar aqui e pôr o <url> no
// sitemap da Ballad (`public/ballad/sitemap.xml`). O teste cobra o resto.

import type { Artigo } from "@/lib/blog/tipos";
import { artigo as cancionPersonalizadaParaMiEsposa } from "./cancion-personalizada-para-mi-esposa";
import { artigo as cancionParaMiMama } from "./cancion-para-mi-mama";
import { artigo as cancionParaMiPapa } from "./cancion-para-mi-papa";
import { artigo as cancionParaMiNovia } from "./cancion-para-mi-novia";
import { artigo as cancionDeAniversarioDeBodas } from "./cancion-de-aniversario-de-bodas";
import { artigo as cancionDeCumpleanosPersonalizada } from "./cancion-de-cumpleanos-personalizada";
import { artigo as cancionParaQuinceanera } from "./cancion-para-quinceanera";
import { artigo as regaloDeNavidadEmotivo } from "./regalo-de-navidad-emotivo";
import { artigo as homenajeALaAbuela } from "./homenaje-a-la-abuela";
import { artigo as comoHacerUnaCancionParaAlguien } from "./como-hacer-una-cancion-para-alguien";
import { artigo as cancionCristianaPersonalizada } from "./cancion-cristiana-personalizada";
import { artigo as alabanzaPersonalizada } from "./alabanza-personalizada";
import { artigo as cancionDeTestimonio } from "./cancion-de-testimonio";
import { artigo as regaloParaMamaCristiana } from "./regalo-para-mama-cristiana";
import { artigo as regaloParaPapaCristiano } from "./regalo-para-papa-cristiano";

export const ARTIGOS_ES: Artigo[] = [
  cancionPersonalizadaParaMiEsposa,
  cancionParaMiMama,
  cancionParaMiPapa,
  cancionParaMiNovia,
  cancionDeAniversarioDeBodas,
  cancionDeCumpleanosPersonalizada,
  cancionParaQuinceanera,
  regaloDeNavidadEmotivo,
  homenajeALaAbuela,
  comoHacerUnaCancionParaAlguien,
  cancionCristianaPersonalizada,
  alabanzaPersonalizada,
  cancionDeTestimonio,
  regaloParaMamaCristiana,
  regaloParaPapaCristiano,
];

export function artigoEsPorSlug(slug: string): Artigo | undefined {
  return ARTIGOS_ES.find((a) => a.slug === slug);
}
