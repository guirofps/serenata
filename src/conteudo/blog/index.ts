// OS ARTIGOS PUBLICADOS, na ordem da pauta (`pauta.ts`). Artigo novo: criar o
// arquivo, pôr o slug na pauta, importar aqui e pôr o <url> no sitemap. O
// teste de conteúdo cobra o resto (inclusive que a pauta inteira esteja aqui).

import type { Artigo } from "@/lib/blog/tipos";
import { artigo as musicaPersonalizadaParaMae } from "./musica-personalizada-para-mae";
import { artigo as musicaPersonalizadaParaPai } from "./musica-personalizada-para-pai";
import { artigo as musicaPersonalizadaParaNamorada } from "./musica-personalizada-para-namorada";
import { artigo as homenagemParaAvo } from "./homenagem-para-avo";
import { artigo as presenteAniversarioDeNamoro } from "./presente-aniversario-de-namoro";
import { artigo as presenteBodasAniversarioDeCasamento } from "./presente-bodas-aniversario-de-casamento";
import { artigo as presenteDeNatalEmocionante } from "./presente-de-natal-emocionante";
import { artigo as louvorPersonalizado } from "./louvor-personalizado";
import { artigo as comoFazerUmaMusicaParaAlguem } from "./como-fazer-uma-musica-para-alguem";
import { artigo as presenteCriativoDeUltimaHora } from "./presente-criativo-de-ultima-hora";
import { artigo as presenteParaMaeEvangelica } from "./presente-para-mae-evangelica";
import { artigo as presenteParaPaiEvangelico } from "./presente-para-pai-evangelico";
import { artigo as presenteParaPastor } from "./presente-para-pastor";
import { artigo as homenagemParaPastora } from "./homenagem-para-pastora";
import { artigo as musicaGospelParaCasamento } from "./musica-gospel-para-casamento";
import { artigo as louvorAniversarioDeCasamento } from "./louvor-aniversario-de-casamento";
import { artigo as louvorDeGratidao } from "./louvor-de-gratidao";
import { artigo as louvorDeTestemunho } from "./louvor-de-testemunho";
import { artigo as louvorParaMomentoDificil } from "./louvor-para-momento-dificil";
import { artigo as presenteDeBatismoEvangelico } from "./presente-de-batismo-evangelico";
import { artigo as musicaGospelDeAniversario } from "./musica-gospel-de-aniversario";
import { artigo as presenteParaAmigaEvangelica } from "./presente-para-amiga-evangelica";
import { artigo as presenteDeNatalCristao } from "./presente-de-natal-cristao";
import { artigo as presenteParaLiderDeLouvor } from "./presente-para-lider-de-louvor";
import { artigo as louvorParaFilho } from "./louvor-para-filho";
import { artigo as presenteParaNamoradaCrista } from "./presente-para-namorada-crista";
import { artigo as comoEscreverUmLouvor } from "./como-escrever-um-louvor";
import { artigo as hinoPersonalizado } from "./hino-personalizado";
import { artigo as homenagemDiaDasMaesIgreja } from "./homenagem-dia-das-maes-igreja";
import { artigo as louvorCultoDeAcaoDeGracas } from "./louvor-culto-de-acao-de-gracas";

export const ARTIGOS: Artigo[] = [
  musicaPersonalizadaParaMae,
  musicaPersonalizadaParaPai,
  musicaPersonalizadaParaNamorada,
  homenagemParaAvo,
  presenteAniversarioDeNamoro,
  presenteBodasAniversarioDeCasamento,
  presenteDeNatalEmocionante,
  louvorPersonalizado,
  comoFazerUmaMusicaParaAlguem,
  presenteCriativoDeUltimaHora,
  presenteParaMaeEvangelica,
  presenteParaPaiEvangelico,
  presenteParaPastor,
  homenagemParaPastora,
  musicaGospelParaCasamento,
  louvorAniversarioDeCasamento,
  louvorDeGratidao,
  louvorDeTestemunho,
  louvorParaMomentoDificil,
  presenteDeBatismoEvangelico,
  musicaGospelDeAniversario,
  presenteParaAmigaEvangelica,
  presenteDeNatalCristao,
  presenteParaLiderDeLouvor,
  louvorParaFilho,
  presenteParaNamoradaCrista,
  comoEscreverUmLouvor,
  hinoPersonalizado,
  homenagemDiaDasMaesIgreja,
  louvorCultoDeAcaoDeGracas,
];

export function artigoPorSlug(slug: string): Artigo | undefined {
  return ARTIGOS.find((a) => a.slug === slug);
}
