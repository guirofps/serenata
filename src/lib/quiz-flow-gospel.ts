import { isQuestion, questionNumber, type FlowStep, type SkipMap } from "@/lib/flow-engine";
import { generosGospel } from "@/lib/generos";

// O QUIZ GOSPEL (`/criar?t=gospel`, 02/10/2026; em inglês na Ballad, 03/10).
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

// ── A PORTA CRISTÃ DA BALLAD (`balladgift.com/criar?t=gospel`, 03/10) ──
//
// A mesma camada, redigida em inglês do jeito que um cristão americano fala:
// "worship song", "what God has done", "a season", "a verse that carried
// me". Os `value` são os MESMOS do português (o banco, o prompt e o
// `aplicarTipo` leem o valor, nunca o rótulo), então o resto do sistema não
// sabe a diferença.
const TIPO_EN: FlowStep = {
  ...TIPO,
  block: "For whom",
  text: "What would you like to create?",
  options: [
    { value: "louvor", label: "A worship song to God", emoji: "🙏" },
    { value: "presente", label: "A faith-filled song for someone I love", emoji: "🎁" },
  ],
} as FlowStep;

const DO_LOUVOR_EN: Record<string, FlowStep> = {
  ocasiao: {
    ...DO_LOUVOR.ocasiao,
    block: "The occasion",
    text: "What is your song about?",
    options: [
      { value: "gratidao", label: "Gratitude", emoji: "🙌" },
      { value: "testemunho", label: "A testimony of what God did", emoji: "🏆" },
      { value: "clamor", label: "A hard season", emoji: "🕊️" },
      { value: "adoracao", label: "Worship", emoji: "🎶" },
      { value: "igreja", label: "For my church", emoji: "⛪" },
    ],
  } as FlowStep,
  historia1: {
    ...DO_LOUVOR.historia1,
    block: "The story",
    text: "What has God done in your life?",
    subtext: "Write it your way. The more real it is, the more it becomes your song.",
    placeholder: "e.g. I'd been out of work for eight months when...",
    triggers: [
      { rotulo: "when I…", inicio: "When I " },
      { rotulo: "what He did", inicio: "What God did for me was " },
      { rotulo: "my family", inicio: "In my family, God " },
      { rotulo: "an answered prayer", inicio: "I prayed for " },
      { rotulo: "who I used to be", inicio: "Before I knew Jesus, I " },
    ],
  } as FlowStep,
  historia2: {
    ...DO_LOUVOR.historia2,
    block: "The story",
    text: "Tell me about a moment you felt God close",
    subtext: "A place, a day, a sentence. It doesn't have to be pretty, it has to be true.",
    placeholder: "It was 3 a.m. in the hospital waiting room when...",
    triggers: [
      { rotulo: "a place", inicio: "It was at " },
      { rotulo: "a verse", inicio: "The verse that carried me was " },
      { rotulo: "a song", inicio: "There's a worship song that takes me back to that day: " },
      { rotulo: "a person", inicio: "God used " },
    ],
  } as FlowStep,
  recado: {
    ...DO_LOUVOR.recado,
    block: "The story",
    text: "If you could sing ONE line to God in the chorus, what would it be?",
    subtext: "Optional, but it usually becomes the strongest part.",
    placeholder: "The line you want to sing to God",
    triggers: [
      { rotulo: "thank You, Lord", inicio: "Thank You, Lord, for " },
      { rotulo: "I surrender", inicio: "I surrender " },
      { rotulo: "You are", inicio: "You are " },
      { rotulo: "You never left", inicio: "Even when I " },
    ],
  } as FlowStep,
};

const GOSPEL_EN: Record<string, Record<string, unknown>> = {
  estilo: {
    text: "What style should it be?",
    subtext: "It's the feel of the song. You can change it later.",
    options: generosGospel("en").map((g) => ({ value: g.value, label: g.label, emoji: g.emoji })),
  },
  voz: {
    extraChips: {
      field: "tom",
      pergunta: "And the mood? (optional)",
      options: [
        { value: "reverente", label: "Reverent", emoji: "🙏" },
        { value: "emocionante", label: "Moving", emoji: "🥹" },
        { value: "animada", label: "Celebration", emoji: "🎉" },
      ],
    },
  },
  historia1: { placeholder: "e.g. my mom prayed over every one of us, on her knees, every night..." },
  historia2: { placeholder: "She hums old hymns while she does the dishes and..." },
};

const POR_IDIOMA = {
  pt: { tipo: TIPO, louvor: DO_LOUVOR, redacao: GOSPEL },
  en: { tipo: TIPO_EN, louvor: DO_LOUVOR_EN, redacao: GOSPEL_EN },
} as const;

export function comGospel(flow: FlowStep[], locale: "pt" | "en" = "pt"): FlowStep[] {
  const L = POR_IDIOMA[locale];
  const out: FlowStep[] = [];
  for (const passo of flow) {
    const troca = L.redacao[passo.id];
    out.push(troca ? ({ ...passo, ...troca } as FlowStep) : passo);
    if (passo.id === "abertura") out.push(L.tipo);
    const louvor = L.louvor[passo.id];
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
  locale: string = "pt",
): Record<string, string | string[]> {
  // O nome é o que a página presente, os e-mails e o topo do quiz mostram:
  // no inglês é "God" (a relação continua `deus`, que é valor de banco).
  const nomeDeDeus = locale === "en" ? "God" : "Deus";
  const out = { ...respostas, tipo } as Record<string, string | string[]>;
  const ocasiaoDoLouvor = (OCASIOES_LOUVOR as readonly string[]).includes(String(out.ocasiao ?? ""));
  if (tipo === "louvor") {
    out.relacao = "deus";
    out.nome = nomeDeDeus;
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
