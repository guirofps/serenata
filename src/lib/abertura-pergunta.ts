import {
  isQuestion,
  nextVisibleIndex,
  questionNumber,
  type FlowStep,
  type QuestionStep,
  type SkipMap,
} from "@/lib/flow-engine";
import type { Locale } from "@/lib/i18n";
import type { Tema } from "@/lib/tema";

// O TESTE `abertura_pergunta` (Serenata, 08/10/2026).
//
// ── O DADO ───────────────────────────────────────────────────────
//
// No celular, 61.066 sessões montaram a abertura do /criar e só 56,5%
// responderam a primeira pergunta ("pra quem"). É a maior queda antes do
// lead, maior que qualquer pergunta do quiz.
//
// ── A HIPÓTESE ───────────────────────────────────────────────────
//
// Hoje o primeiro toque é "começar", que não responde nada: ele só abre a
// pergunta. No B a pergunta já está na abertura, logo abaixo do cartão, com os
// MESMOS chips do passo `relacao`. O primeiro toque passa a ser uma resposta.
//
//   A  a abertura de hoje (controle)
//   B  a abertura com "Pra quem é a música?" e os chips da relação embaixo do
//      cartão; o cartão encolhe pra os chips subirem na tela. O botão de
//      começar continua lá embaixo, pra quem preferir.
//
// Tocar num chip faz o que o passo `relacao` faria (mesma resposta na store,
// mesmo `quiz_step` q=1, mesmo `quiz_respondeu`, mesma captura de lead) e vai
// pro passo SEGUINTE pela navegação do quiz (`?step=`), achado pelo motor
// (`nextVisibleIndex`), nunca por posição. Voltar e recarregar funcionam como
// em qualquer passo.
//
// NÃO é o `abertura_en` B da Ballad (que pulava a abertura e perdeu): aqui a
// abertura fica inteira, com o exemplo tocando, e a pergunta entra nela.
//
// ── SÓ PT, SÓ SEM TEMA ───────────────────────────────────────────
//
// O espanhol, o inglês (Ballad) e a porta gospel (`?t=gospel`, que começa
// pelo `tipo`, não pela relação) ficam exatamente como estão. O sorteio
// carimba o <html> de todo visitante, então a LEITURA filtra `locale = pt` e
// sem `tema`.
//
// ── POR QUE CSS PRÓPRIO E NÃO `<Variante>` ───────────────────────
//
// `<Variante>` depende da regra que `cssExperimentos` gera a partir da linha
// do banco. Sem a linha (deploy antes de alguém criar o experimento no
// painel), não existe regra nenhuma e o conteúdo do B aparece pra TODO MUNDO.
// Aqui o B nasce escondido e só aparece com o carimbo `B` no <html>, que só
// existe com o experimento ativo e a pessoa sorteada nele. Sem linha, sem
// teste ligado, `fora` ou sem JavaScript: controle.
//
// ── O QUE MEDIR ──────────────────────────────────────────────────
//
// Por braço (`attribution.exp.abertura_pergunta`), entre as sessões pt sem
// tema que montaram a abertura (`quiz_step` step_id=abertura): quem RESPONDEU
// a primeira pergunta (`quiz_step` q>=2), depois letra, oferta e venda, e
// receita por lead. `abertura_comecar` × `abertura_relacao` diz por qual
// porta o B entrou.

export const EXP_ABERTURA_PERGUNTA = "abertura_pergunta";

/** O passo cuja pergunta sobe pra abertura. */
export const PASSO_DA_ABERTURA = "relacao";

/** O enunciado na abertura: lá o título já fala de "uma música". */
export const PERGUNTA_NA_ABERTURA = "Pra quem é a música?";
export const SUBTEXTO_NA_ABERTURA = "Toque numa opção pra começar. É de graça.";

/** Pt, fora do gospel. Os outros funis não recebem nada. */
export function aberturaPerguntaVale(locale: Locale, tema: Tema | null | undefined): boolean {
  return locale === "pt" && !tema;
}

export type PassoDeChips = Extract<QuestionStep, { input: "chips" }>;

/** O passo `relacao` do fluxo, ou null se o fluxo não o tiver como chips. */
export function perguntaDaAbertura(flow: FlowStep[]): PassoDeChips | null {
  const p = flow.find((s) => s.id === PASSO_DA_ABERTURA);
  return p && isQuestion(p) && p.input === "chips" ? p : null;
}

/**
 * O que o toque num chip da abertura precisa saber: o número da pergunta (a
 * escala do `furthest_step`) e o id do passo seguinte, pelo motor do quiz.
 * `null` quando o fluxo não tem o passo, e aí a abertura não mostra os chips.
 */
export function depoisDaRelacao(
  flow: FlowStep[],
  respostas: Record<string, unknown>,
  skip: SkipMap,
): { q: number; proximo: string } | null {
  const i = flow.findIndex((s) => s.id === PASSO_DA_ABERTURA);
  if (i < 0) return null;
  const n = nextVisibleIndex(flow, i, respostas, skip);
  if (n < 0) return null;
  return { q: questionNumber(flow, i), proximo: flow[n].id };
}

/**
 * O CSS do braço. Sem aspas, `<` nem `&` de propósito: entra num `<style>`
 * inline, e o valor do atributo sem aspas é seletor válido.
 *
 * O cartão vai pra 172px (o degrau que já roda em Android pequeno) nas telas
 * com mais de 660px de altura: a 390x844 isso põe os 19 chips inteiros na
 * primeira tela. Abaixo disso os degraus de hoje (172 e 132) já são menores
 * e ficam. Regra fora de `@layer`, então vence os degraus do Tailwind sem
 * `!important`.
 */
export function cssAberturaPergunta(): string {
  const b = `html[data-exp-${EXP_ABERTURA_PERGUNTA}=B]`;
  return `.abp-b{display:none}${b} .abp-b{display:block}@media (min-height:661px){${b} .abp-cartao{max-width:172px}}`;
}
