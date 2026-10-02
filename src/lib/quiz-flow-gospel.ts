import { isQuestion, questionNumber, type FlowStep, type SkipMap } from "@/lib/flow-engine";
import { generosGospel } from "@/lib/generos";

// O QUIZ GOSPEL (`/criar?t=gospel`, 02/10/2026).
//
// Camada sobre o `QUIZ_FLOW_PT`, no padrão do `quiz-flow-ar.ts`: o que é
// estrutura (ordem, `value` gravado no banco, contato, revisão, oferta) é
// compartilhado; aqui mora só o que o gospel muda. Melhoria no quiz principal
// aparece neste sozinha.
//
// Três mudanças:
//   1. Um passo novo, `tipo`, logo depois da abertura: louvor pra Deus ou
//      presente pra alguém, com fé.
//   2. Passos próprios do louvor (`*_louvor`), com o MESMO `field` dos
//      originais. Cada par é exclusivo pelo `SKIP_GOSPEL`.
//   3. Redação nova em estilo, tom e exemplos das histórias.
//
// Desenho: `docs/superpowers/specs/2026-10-02-criar-gospel-design.md`.

export const OCASIOES_LOUVOR = ["gratidao", "testemunho", "clamor", "adoracao", "igreja"] as const;

const TIPO: FlowStep = {
  id: "tipo",
  kind: "question",
  block: "Pra quem",
  text: "O que você quer criar?",
  field: "tipo",
  input: "chips",
  options: [
    { value: "louvor", label: "Um louvor pra Deus", emoji: "🙏" },
    { value: "presente", label: "Um presente pra alguém, com fé", emoji: "🎁" },
  ],
};

/** Os passos do louvor, entrando logo depois do original de mesmo `field`. */
const DO_LOUVOR: Record<string, FlowStep> = {
  ocasiao: {
    id: "ocasiao_louvor",
    kind: "question",
    block: "A ocasião",
    text: "Qual é o motivo do seu louvor?",
    field: "ocasiao",
    input: "chips",
    options: [
      { value: "gratidao", label: "Gratidão", emoji: "🙌" },
      { value: "testemunho", label: "Testemunho de uma vitória", emoji: "🏆" },
      { value: "clamor", label: "Um momento difícil", emoji: "🕊️" },
      { value: "adoracao", label: "Adoração", emoji: "🎶" },
      { value: "igreja", label: "Pra minha igreja", emoji: "⛪" },
    ],
  },
  historia1: {
    id: "historia1_louvor",
    kind: "question",
    block: "A história",
    text: "O que Deus fez na sua vida?",
    subtext: "Escreva do seu jeito. Quanto mais real, mais seu fica o louvor.",
    field: "historia1",
    input: "story",
    placeholder: "Ex: eu estava desempregado havia oito meses quando...",
    minChars: 60,
    allowAudio: true,
    triggers: [
      { rotulo: "quando eu…", inicio: "Quando eu " },
      { rotulo: "o que Ele fez", inicio: "O que Deus fez por mim foi " },
      { rotulo: "minha família", inicio: "Na minha família, Deus " },
      { rotulo: "uma oração respondida", inicio: "Eu orei por " },
      { rotulo: "como eu era antes", inicio: "Antes de conhecer Jesus, eu " },
    ],
  },
  historia2: {
    id: "historia2_louvor",
    kind: "question",
    block: "A história",
    text: "Me conta um momento em que você sentiu Deus perto",
    subtext: "Um lugar, um dia, uma frase. Não precisa ser bonito, precisa ser verdade.",
    field: "historia2",
    input: "story",
    placeholder: "Foi na madrugada do hospital, quando...",
    minChars: 60,
    allowAudio: true,
    permitePular: true,
    triggers: [
      { rotulo: "um lugar", inicio: "Foi em " },
      { rotulo: "um versículo", inicio: "O versículo que me sustentou foi " },
      { rotulo: "um louvor", inicio: "Tem um louvor que me lembra esse dia: " },
      { rotulo: "uma pessoa", inicio: "Deus usou " },
    ],
  },
  recado: {
    id: "recado_louvor",
    kind: "question",
    block: "A história",
    text: "Se você pudesse dizer UMA frase a Deus no refrão, qual seria?",
    subtext: "Opcional, mas costuma virar a parte mais forte.",
    field: "recado",
    input: "text",
    placeholder: "A frase que você quer cantar pra Deus",
    maxLength: 120,
    opcional: true,
    triggers: [
      { rotulo: "obrigado, Senhor", inicio: "Obrigado, Senhor, por " },
      { rotulo: "eu te entrego", inicio: "Eu te entrego " },
      { rotulo: "Tu és", inicio: "Tu és " },
      { rotulo: "nunca me deixou", inicio: "Mesmo quando eu " },
    ],
  },
};

/** Redação gospel por cima dos passos comuns. Sobreposição rasa, por `id`. */
const GOSPEL: Record<string, Record<string, unknown>> = {
  estilo: {
    text: "Qual o estilo da música?",
    subtext: "É o clima da música. Dá pra mudar depois.",
    options: generosGospel().map((g) => ({ value: g.value, label: g.label, emoji: g.emoji })),
  },
  voz: {
    extraChips: {
      field: "tom",
      pergunta: "E o tom? (opcional)",
      options: [
        { value: "reverente", label: "Reverente", emoji: "🙏" },
        { value: "emocionante", label: "Emocionante", emoji: "🥹" },
        { value: "animada", label: "Celebração", emoji: "🎉" },
      ],
    },
  },
  historia1: { placeholder: "Ex: minha mãe sempre orou por cada um de nós, de joelhos, toda noite..." },
  historia2: { placeholder: "Ela canta hino lavando a louça e..." },
};

export function comGospel(flow: FlowStep[]): FlowStep[] {
  const out: FlowStep[] = [];
  for (const passo of flow) {
    const troca = GOSPEL[passo.id];
    out.push(troca ? ({ ...passo, ...troca } as FlowStep) : passo);
    if (passo.id === "abertura") out.push(TIPO);
    const louvor = DO_LOUVOR[passo.id];
    if (louvor) out.push(louvor);
  }
  return out;
}

const ehLouvor = (r: Record<string, unknown>) => r.tipo === "louvor";
const naoLouvor = (r: Record<string, unknown>) => !ehLouvor(r);

export const SKIP_GOSPEL: SkipMap = {
  relacao: ehLouvor,
  nome: ehLouvor,
  ocasiao: ehLouvor,
  historia1: ehLouvor,
  historia2: ehLouvor,
  recado: ehLouvor,
  ocasiao_louvor: naoLouvor,
  historia1_louvor: naoLouvor,
  historia2_louvor: naoLouvor,
  recado_louvor: naoLouvor,
};

/**
 * O que escolher o tipo faz nas respostas.
 *
 * Louvor: a música é pra Deus, então `relacao` e `nome` já ficam preenchidos
 * (são esses campos que a página presente e os e-mails leem) e os filhos
 * saem. Presente: só desfaz o que o louvor tinha posto. Nos dois, uma
 * ocasião que não existe no tipo novo sai — senão ela contaria como
 * respondida num passo cujos chips nem a mostram.
 */
export function aplicarTipo(
  respostas: Record<string, unknown>,
  tipo: string,
): Record<string, string | string[]> {
  const out = { ...respostas, tipo } as Record<string, string | string[]>;
  const ocasiaoDoLouvor = (OCASIOES_LOUVOR as readonly string[]).includes(String(out.ocasiao ?? ""));
  if (tipo === "louvor") {
    out.relacao = "deus";
    out.nome = "Deus";
    delete out.filhos;
    if (out.ocasiao !== undefined && !ocasiaoDoLouvor) delete out.ocasiao;
  } else {
    if (out.relacao === "deus") {
      delete out.relacao;
      delete out.nome;
    }
    if (ocasiaoDoLouvor) delete out.ocasiao;
  }
  return out;
}

/**
 * O número do passo na escala do funil NORMAL, que é a que o banco guarda
 * (`furthest_step`) e o painel lê. Passo gospel vale o do passo normal de
 * mesmo campo; `tipo` não existe lá e vale 0, como a abertura.
 */
export function numeroCanonico(canon: FlowStep[], step: FlowStep): number {
  const i = isQuestion(step)
    ? canon.findIndex((s) => isQuestion(s) && s.field === step.field)
    : canon.findIndex((s) => s.id === step.id);
  return i < 0 ? 0 : questionNumber(canon, i);
}
