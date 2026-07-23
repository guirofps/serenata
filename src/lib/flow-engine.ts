// Motor FLOW declarativo do quiz — extraído e generalizado do quiz-b.tsx do
// exact-screenshot-match (o funil angelical), corrigindo os bugs herdados:
//   - passo na URL (?step=<id>), não em useState solto → reload não zera
//   - skip condicional por ID, nunca por offset numérico
//   - captura parcial de lead a cada avanço via RPC SECURITY DEFINER
//
// O motor é AGNÓSTICO ao conteúdo: os passos concretos do nosso quiz vivem em
// `quiz-flow.ts`. Aqui ficam só os tipos, os type guards e o hook de navegação.

// ─── Tipos de passo ──────────────────────────────────────────────
// Cada passo do funil é um destes. `id` é único e estável (vai na URL).

export type ChipOption = {
  value: string;
  label: string;
  emoji?: string;
};

// Pergunta de escolha única (chips com emoji) ou campo de texto/história.
export type QuestionStep = {
  id: string;
  kind: "question";
  block: string; // rótulo do bloco, ex. "Sobre quem"
  text: string; // enunciado
  subtext?: string;
  field: string; // chave em que a resposta é gravada (respostas[field])
} & (
  | { input: "chips"; options: ChipOption[]; multi?: boolean }
  | { input: "text"; placeholder?: string; maxLength?: number }
  | {
      // Campo de história: textarea com validação anti-lixo + opção de áudio.
      input: "story";
      placeholder?: string;
      minChars: number; // mínimo real (LoveTune usa 150)
      triggers?: string[]; // chips-gatilho de detalhe concreto
      allowAudio?: boolean;
    }
);

// Interlúdio de prova social / expectativa (mockup do presente nascendo).
export type SocialProofStep = {
  id: string;
  kind: "social-proof";
  eyebrow?: string;
  testimonial?: string;
  audioSample?: string; // trecho de exemplo do mesmo tipo de relação
};

// Captura de contato (só e-mail no lançamento — decisão do CLAUDE.md).
export type ContactStep = {
  id: string;
  kind: "contact";
  text: string;
  subtext?: string;
};

// Revisão editável — dispara a geração da letra em background ao montar.
export type ReviewStep = {
  id: string;
  kind: "review";
};

// Reveal: gera a letra, revela progressivamente dentro do mockup da página
// presente, e termina no fake door.
export type RevealStep = {
  id: string;
  kind: "reveal";
};

export type FlowStep = QuestionStep | SocialProofStep | ContactStep | ReviewStep | RevealStep;

// ─── Type guards ─────────────────────────────────────────────────
export const isQuestion = (s: FlowStep): s is QuestionStep => s.kind === "question";
export const isSocialProof = (s: FlowStep): s is SocialProofStep => s.kind === "social-proof";
export const isContact = (s: FlowStep): s is ContactStep => s.kind === "contact";
export const isReview = (s: FlowStep): s is ReviewStep => s.kind === "review";
export const isReveal = (s: FlowStep): s is RevealStep => s.kind === "reveal";

// ─── Predicado de skip por ID ────────────────────────────────────
// Um passo pode ser pulado com base nas respostas até aqui. A chave é o ID do
// passo (nunca a posição): inserir uma pergunta no meio não quebra o pulo.
export type SkipPredicate = (respostas: Record<string, unknown>) => boolean;
export type SkipMap = Record<string, SkipPredicate>;

// Índice do próximo passo VISÍVEL a partir de `from` (exclusivo), respeitando o
// mapa de skip. Retorna -1 se não há próximo (fim do quiz).
export function nextVisibleIndex(
  flow: FlowStep[],
  from: number,
  respostas: Record<string, unknown>,
  skip: SkipMap = {},
): number {
  for (let i = from + 1; i < flow.length; i++) {
    const pred = skip[flow[i].id];
    if (!pred || !pred(respostas)) return i;
  }
  return -1;
}

export function prevVisibleIndex(
  flow: FlowStep[],
  from: number,
  respostas: Record<string, unknown>,
  skip: SkipMap = {},
): number {
  for (let i = from - 1; i >= 0; i--) {
    const pred = skip[flow[i].id];
    if (!pred || !pred(respostas)) return i;
  }
  return -1;
}

// Índice de um passo pelo ID (para hidratar a partir da URL).
export function indexOfId(flow: FlowStep[], id: string | null | undefined): number {
  if (!id) return 0;
  const i = flow.findIndex((s) => s.id === id);
  return i >= 0 ? i : 0;
}

// Número da pergunta (1-based) até `idx`, contando só QuestionStep — para a
// barra de progresso. Passos de prova social / revisão não contam.
export function questionNumber(flow: FlowStep[], idx: number): number {
  let n = 0;
  for (let i = 0; i <= idx && i < flow.length; i++) {
    if (isQuestion(flow[i])) n++;
  }
  return n;
}

export function totalQuestions(flow: FlowStep[]): number {
  return flow.filter(isQuestion).length;
}
