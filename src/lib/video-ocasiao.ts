// TESTE `video_fotos_ja` (08/10): a frase do bloco do vídeo, pela OCASIÃO.
//
// O vídeo vende 16,5% entre quem fez música de aniversário e 8,7% entre quem
// fez pra filho (produção, 30 dias). A diferença não é o vídeo, é o USO que a
// pessoa enxerga pra ele: no aniversário o status do WhatsApp é o lugar óbvio.
// O braço B diz esse uso em voz alta, com as fotos dela já tocando embaixo.
//
// Sem ocasião conhecida (ou numa que pede cuidado) volta `null`, e o bloco
// fica com a frase de sempre. MEMORIAL NUNCA ganha frase de status: a regra de
// `ocasioes.ts` vale aqui também, oferta alegre pra quem perdeu alguém é falta
// de leitura. Louvor a Deus (`relacao = "deus"`) também fica com a de sempre.
//
// Sem travessão em nenhuma frase: é copy do funil (memória do dono).

/** O id do teste. Constante porque id digitado errado devolve o controle em silêncio. */
export const EXP_VIDEO_FOTOS_JA = "video_fotos_ja";

const POR_OCASIAO: Record<string, string> = {
  aniversario: "Imagina isso no status do WhatsApp no dia do aniversário",
  casamento: "Imagina isso no telão da festa ou no status do WhatsApp no grande dia",
  declaracao: "Imagina a reação quando isso chegar no WhatsApp",
  homenagem: "Imagina isso passando na tela no dia da homenagem",
  formatura: "Imagina isso no status do WhatsApp no dia da formatura",
  soporque: "Imagina receber isso no WhatsApp num dia qualquer",
};

/**
 * A frase do título do bloco do vídeo no braço B, ou `null` pra manter a de
 * sempre. Pura: recebe só as duas respostas do quiz que importam.
 */
export function linhaDoVideoPorOcasiao(respostas: {
  ocasiao?: string | null;
  relacao?: string | null;
}): string | null {
  const relacao = String(respostas.relacao ?? "").trim().toLowerCase();
  if (relacao === "deus") return null;
  const ocasiao = String(respostas.ocasiao ?? "").trim().toLowerCase();
  if (!ocasiao || ocasiao === "memorial") return null;
  return Object.prototype.hasOwnProperty.call(POR_OCASIAO, ocasiao) ? POR_OCASIAO[ocasiao] : null;
}
