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
  /** Selo opcional no chip, ex. "em alta" (sazonalidade, Dia dos Pais). */
  tag?: string;
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
  | {
      input: "text";
      placeholder?: string;
      maxLength?: number;
      /**
       * Mostra AO VIVO como o valor vai ser usado no produto final.
       * No campo do nome isso não é enfeite: 14% escrevem nome e sobrenome
       * (medido em 73 respostas) e o Suno canta exatamente o que recebe —
       * saiu "Carlos Henrique, meu presente de Deus" numa música entregue.
       */
      eco?: string;
      /**
       * A frase do eco, com `{v}` no lugar do que a pessoa digitou. O trecho
       * fora do `{v}` sai apagado, então o olho cai no valor.
       * Padrão: `“{v}, essa música é pra você…”`.
       */
      ecoModelo?: string;
      /** Oferece cortar pro primeiro nome quando a pessoa escreve mais de um. */
      cortarComposto?: boolean;
      /**
       * Chips-gatilho, iguais aos do campo de história: tocar escreve o começo
       * da frase e a pessoa só completa.
       *
       * No recado isso não é conforto, é qualidade do produto. "Uma frase sua
       * no refrão" com o campo em branco produz "meu amor pra toda a vida" —
       * genérico, e o refrão é a parte que a pessoa vai reler.
       */
      triggers?: Array<{ rotulo: string; inicio: string }>;
      /**
       * Um SEGUNDO campo na mesma tela, gravado em outro `field`.
       *
       * Existe pros filhos, e já mudou de lugar duas vezes. Primeiro foi um
       * passo próprio: caro demais, porque pergunta opcional que só serve em
       * parte das relações não paga um degrau. Depois foi pro passo do nome,
       * recolhida atrás de um "+": aí sumiu, virou um link cinza disputando a
       * tela com o campo do nome, que é o principal.
       *
       * Agora mora no passo do recado, que faz a mesma pergunta de fundo (o
       * que mais entra na música) e é uma tela quase vazia — e aparece SEMPRE,
       * como cartão, sem toque pra revelar.
       */
      extra?: {
        field: string;
        /** A pergunta, em tamanho de pergunta. */
        pergunta: string;
        subtexto?: string;
        placeholder?: string;
        maxLength?: number;
        eco?: string;
        ecoModelo?: string;
        /** Sem isto, aparece sempre. */
        mostrarSe?: (respostas: Record<string, unknown>) => boolean;
      };
      /**
       * Deixa avançar com o campo vazio.
       *
       * Era um `if (step.id === "recado")` cravado na rota: cada campo novo
       * opcional exigia mexer no motor. Agora quem decide é o passo.
       */
      opcional?: boolean;
    }
  | {
      // Campo de história: textarea com validação anti-lixo + opção de áudio.
      input: "story";
      placeholder?: string;
      minChars: number; // mínimo real (LoveTune usa 150)
      /**
       * Chips-gatilho de detalhe concreto. Cada um DESTRAVA o campo: tocar
       * insere o começo da frase no textarea, e a pessoa só completa.
       *
       * Eram `string[]` e viravam <span> decorativo: dava pra tocar e nada
       * acontecia. Num passo onde 14 de 49 pessoas desistem (medido 01/08),
       * enfeite que parece botão é pior que nada.
       */
      triggers?: Array<{ rotulo: string; inicio: string }>;
      allowAudio?: boolean;
      /**
       * Oferece uma saída pra quem trava. O link só aparece depois de a
       * pessoa ficar um tempo na tela sem escrever quase nada — quem já está
       * digitando nunca o vê, então não é atalho, é rede.
       *
       * Existe porque este passo perde 11 de 40 pessoas: quem dá branco hoje
       * some pra sempre, e uma letra feita só com a primeira história é
       * infinitamente melhor que nenhuma letra.
       */
      permitePular?: boolean;
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

// A OFERTA, entre o reveal e o checkout.
//
// Existe por dois motivos, e o segundo é o que decide:
//
// 1. É a última superfície NOSSA. Depois dela a pessoa cai numa página da
//    Perfect Pay que é um formulário, e todo o argumento construído no funil
//    fica pra trás. Aqui ele sobrevive ao pulo.
// 2. SEPARA dois degraus que hoje estão colados. Com "clicou em comprar" indo
//    direto pro gateway, não dá pra saber se a pessoa desiste ao ver o preço
//    ou ao encarar o formulário de cartão — problemas diferentes, soluções
//    diferentes. Com este passo no meio, o painel passa a distinguir.
//
// É passo de FLOW (com URL) e não modal: passo fora da URL é erro herdado dos
// repos antigos, reload volta pro começo e o "voltar" do celular quebra.
export type OfertaStep = {
  id: string;
  kind: "oferta";
};

export type FlowStep =
  | QuestionStep
  | SocialProofStep
  | ContactStep
  | ReviewStep
  | RevealStep
  | OfertaStep;

// ─── Type guards ─────────────────────────────────────────────────
export const isQuestion = (s: FlowStep): s is QuestionStep => s.kind === "question";
export const isSocialProof = (s: FlowStep): s is SocialProofStep => s.kind === "social-proof";
export const isContact = (s: FlowStep): s is ContactStep => s.kind === "contact";
export const isReview = (s: FlowStep): s is ReviewStep => s.kind === "review";
export const isReveal = (s: FlowStep): s is RevealStep => s.kind === "reveal";
export const isOferta = (s: FlowStep): s is OfertaStep => s.kind === "oferta";

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
