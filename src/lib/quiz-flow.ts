import type { FlowStep, SkipMap } from "@/lib/flow-engine";

// Conteúdo do nosso quiz (Fase 1), conforme docs/quiz-fase1.md.
// Enquadramento: é um PRESENTE/homenagem, não "uma música".
// Mistura o melhor dos 4 concorrentes:
//   - micro-compromissos e história guiada em 3 telas (ForeverSongs/LoveTune)
//   - tom conversacional (Lovepanda)
//   - validação anti-lixo dura, mín. 150 chars (LoveTune)
//   - lead parcial desde o passo 1 (nenhum concorrente tem)

export const QUIZ_FLOW: FlowStep[] = [
  {
    id: "relacao",
    kind: "question",
    block: "Pra quem",
    text: "Pra quem é esse presente?",
    field: "relacao",
    input: "chips",
    options: [
      { value: "mae", label: "Mãe", emoji: "👩" },
      { value: "pai", label: "Pai", emoji: "👨" },
      { value: "esposa", label: "Esposa", emoji: "💍" },
      { value: "marido", label: "Marido", emoji: "💍" },
      { value: "namorada", label: "Namorada", emoji: "❤️" },
      { value: "namorado", label: "Namorado", emoji: "❤️" },
      { value: "filha", label: "Filha", emoji: "👧" },
      { value: "filho", label: "Filho", emoji: "👦" },
      { value: "avo_f", label: "Avó", emoji: "👵" },
      { value: "avo_m", label: "Avô", emoji: "👴" },
      { value: "irma", label: "Irmã", emoji: "🤝" },
      { value: "irmao", label: "Irmão", emoji: "🤝" },
      { value: "amiga", label: "Amiga", emoji: "🫂" },
      { value: "amigo", label: "Amigo", emoji: "🫂" },
      { value: "pet", label: "Pet", emoji: "🐾" },
      { value: "outro", label: "Outro", emoji: "✨" },
    ],
  },
  {
    id: "nome",
    kind: "question",
    block: "Pra quem",
    text: "Me conta o nome dela ou dele",
    subtext:
      "É esse nome que vai ser cantado. Se a pronúncia não for óbvia, escreva como se fala (ex.: Thaís → ta-ís).",
    field: "nome",
    input: "text",
    placeholder: "O primeiro nome já basta",
    maxLength: 40,
  },
  {
    id: "ocasiao",
    kind: "question",
    block: "A ocasião",
    text: "Qual é a ocasião?",
    field: "ocasiao",
    input: "chips",
    options: [
      { value: "aniversario", label: "Aniversário", emoji: "🎂" },
      { value: "casamento", label: "Casamento ou bodas", emoji: "💒" },
      { value: "declaracao", label: "Declaração de amor", emoji: "❤️" },
      { value: "homenagem", label: "Homenagem", emoji: "🌟" },
      { value: "memorial", label: "Saudade de quem partiu", emoji: "🕊️" },
      { value: "formatura", label: "Formatura", emoji: "🎓" },
      { value: "soporque", label: "Só porque sim", emoji: "✨" },
      { value: "outro", label: "Outro momento", emoji: "🎁" },
    ],
  },
  {
    id: "prova1",
    kind: "social-proof",
    eyebrow: "Fernanda · pra mãe dela",
    testimonial:
      "Ela ouviu, começou a chorar e não parava de apertar o play. Ver o nome dela na página foi o que me pegou.",
  },
  {
    id: "estilo",
    kind: "question",
    block: "O estilo",
    text: "Que estilo combina com {nome}?",
    subtext: "É o clima da música. Dá pra mudar depois.",
    field: "estilo",
    input: "chips",
    // Sem "Outro": num seletor de GÊNERO, "outro" virava "à escolha do
    // compositor" e saía qualquer coisa — a IA escolhia sem direção, e o
    // Suno precisa de um estilo concreto. A saída é cobrir bem os gêneros
    // reais do presente brasileiro. Ordenados por quanto se pede.
    options: [
      { value: "sertanejo", label: "Sertanejo", emoji: "🤠" },
      { value: "sertanejo_univ", label: "Sertanejo universitário", emoji: "🎸" },
      { value: "piseiro", label: "Piseiro / arrocha", emoji: "🎹" },
      { value: "pagode", label: "Pagode / samba", emoji: "🥁" },
      { value: "forro", label: "Forró", emoji: "🪗" },
      { value: "pop_romantico", label: "Pop romântico", emoji: "💕" },
      { value: "mpb", label: "MPB / voz e violão", emoji: "🎙️" },
      { value: "bossa", label: "Bossa nova", emoji: "🌙" },
      { value: "rock", label: "Rock", emoji: "🤘" },
      { value: "reggae", label: "Reggae", emoji: "🌴" },
      { value: "gospel", label: "Gospel", emoji: "📖" },
      { value: "rap", label: "Rap / hip-hop", emoji: "🎤" },
      { value: "infantil", label: "Infantil", emoji: "⭐" },
    ],
  },
  {
    id: "voz",
    kind: "question",
    block: "O estilo",
    text: "Quem canta essa música?",
    field: "voz",
    input: "chips",
    options: [
      { value: "feminina", label: "Voz feminina", emoji: "👩" },
      { value: "masculina", label: "Voz masculina", emoji: "👨" },
      { value: "surpresa", label: "Surpreenda-me", emoji: "🎲" },
    ],
  },
  {
    id: "historia1",
    kind: "question",
    block: "A história",
    text: "O que {nome} é pra você?",
    subtext: "Escreva do seu jeito. Quanto mais real, mais única fica a letra.",
    field: "historia1",
    input: "story",
    placeholder:
      "Ex: minha mãe criou eu e meus irmãos sozinha, sempre com um sorriso...",
    minChars: 120,
    allowAudio: true,
  },
  {
    id: "historia2",
    kind: "question",
    block: "A história",
    text: "Uma memória que só vocês têm",
    subtext: "Um detalhe pequeno vale mais que um sentimento grande.",
    field: "historia2",
    input: "story",
    placeholder: "Aquele momento, lugar ou mania que é a cara de vocês...",
    minChars: 120,
    allowAudio: true,
    triggers: [
      "um apelido",
      "uma comida",
      "um lugar",
      "uma mania",
      "uma frase que ela vive falando",
      "uma música",
    ],
  },
  {
    id: "recado",
    kind: "question",
    block: "A história",
    text: "Se {nome} pudesse ouvir UMA frase sua no refrão, qual seria?",
    subtext: "Opcional, mas costuma virar a parte mais forte.",
    field: "recado",
    input: "text",
    placeholder: "A frase que você queria que ficasse pra sempre",
    maxLength: 120,
  },
  {
    id: "contato",
    kind: "contact",
    text: "Pra onde eu mando a sua letra?",
    subtext: "A letra fica pronta na próxima tela. O e-mail é só pra você não perder.",
  },
  {
    id: "revisao",
    kind: "review",
  },
  {
    id: "reveal",
    kind: "reveal",
  },
];

// Skip por ID (nunca por offset). Vazio por ora; exemplo de uso quando precisar:
// { recado: (r) => r.ocasiao === "memorial" }  // pula o recado em memorial
export const QUIZ_SKIP: SkipMap = {};
