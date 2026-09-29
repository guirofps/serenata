import type { FlowStep } from "@/lib/flow-engine";
import { generos } from "@/lib/generos";

// O QUIZ EM INGLÊS, pra Ballad Gift (EUA).
//
// É o quiz PORTUGUÊS adaptado, não o espanhol traduzido: o brasileiro é o
// funil validado. Mesmos passos, mesma ordem, mesmos mínimos (60 caracteres
// nas duas histórias), mesmo gatilho de começo de frase, mesma pergunta do
// refrão. O que muda é o que não se traduz:
//
//   - Os `value` são IDÊNTICOS aos do português (esposa, marido, declaracao…):
//     é o que vai pro banco e o que o prompt da letra lê. Só o rótulo é inglês.
//   - "Esposa" continua em primeiro, com o selo: 71% das compras da Serenata
//     são pra esposa ou namorada, e é o único dado que existe até a Ballad ter
//     o dela. Nos EUA "Wife" e "Girlfriend" ficam lado a lado.
//   - Exemplos americanos (Grandma Rose, mac and cheese, a road trip), não
//     bolo de fubá.
//   - Sem travessão, como no funil brasileiro.

export const QUIZ_FLOW_EN: FlowStep[] = [
  { id: "abertura", kind: "intro" },
  {
    id: "relacao",
    kind: "question",
    block: "Who it's for",
    text: "Who is this gift for?",
    field: "relacao",
    input: "chips",
    options: [
      { value: "esposa", label: "Wife", emoji: "💍", tag: "popular" },
      { value: "namorada", label: "Girlfriend", emoji: "❤️" },
      { value: "filha", label: "Daughter", emoji: "👧" },
      { value: "filho", label: "Son", emoji: "👦" },
      { value: "marido", label: "Husband", emoji: "💍" },
      { value: "mae", label: "Mom", emoji: "👩" },
      { value: "pai", label: "Dad", emoji: "👨" },
      { value: "namorado", label: "Boyfriend", emoji: "❤️" },
      { value: "avo_f", label: "Grandma", emoji: "👵" },
      { value: "avo_m", label: "Grandpa", emoji: "👴" },
      { value: "irma", label: "Sister", emoji: "🤝" },
      { value: "irmao", label: "Brother", emoji: "🤝" },
      { value: "neta", label: "Granddaughter", emoji: "🧒" },
      { value: "neto", label: "Grandson", emoji: "🧒" },
      { value: "familia", label: "Family", emoji: "🏡" },
      { value: "amiga", label: "Friend (her)", emoji: "🫂" },
      { value: "amigo", label: "Friend (him)", emoji: "🫂" },
      { value: "pet", label: "Pet", emoji: "🐾" },
      { value: "outro", label: "Someone else", emoji: "✨" },
    ],
  },
  {
    id: "nome",
    kind: "question",
    block: "Who it's for",
    text: "What do you call them?",
    subtext: "Write it the way you say it every day. A sweet nickname works too.",
    field: "nome",
    input: "text",
    placeholder: "Babe, Mom, Grandma Rose...",
    maxLength: 40,
    eco: "This is how it will be sung",
    cortarComposto: true,
  },
  {
    id: "ocasiao",
    kind: "question",
    block: "The occasion",
    text: "What's the occasion?",
    field: "ocasiao",
    input: "chips",
    options: [
      { value: "declaracao", label: "To say I love you", emoji: "❤️" },
      { value: "aniversario", label: "Birthday", emoji: "🎂" },
      { value: "homenagem", label: "To honor them", emoji: "🌟" },
      { value: "soporque", label: "Just because", emoji: "✨" },
      { value: "casamento", label: "Wedding or anniversary", emoji: "💒" },
      { value: "memorial", label: "In loving memory", emoji: "🕊️" },
      { value: "formatura", label: "Graduation", emoji: "🎓" },
      { value: "outro", label: "Something else", emoji: "🎁" },
    ],
  },
  {
    id: "prova1",
    kind: "social-proof",
    eyebrow: "real reactions",
    testimonial: "The look on their face the first time they hear it.",
  },
  {
    id: "estilo",
    kind: "question",
    block: "The style",
    text: "What style fits {nome}?",
    subtext: "It sets the mood of the song. You can change it later.",
    field: "estilo",
    input: "chips",
    options: generos("en").map((g) => ({ value: g.value, label: g.label, emoji: g.emoji })),
  },
  {
    id: "voz",
    kind: "question",
    block: "The style",
    text: "Who sings this song?",
    field: "voz",
    input: "chips",
    options: [
      { value: "feminina", label: "Female voice", emoji: "👩" },
      { value: "masculina", label: "Male voice", emoji: "👨" },
      { value: "surpresa", label: "Surprise me", emoji: "🎲" },
    ],
    extraChips: {
      field: "tom",
      pergunta: "And the mood? (optional)",
      options: [
        { value: "romantica", label: "Romantic", emoji: "💗" },
        { value: "divertida", label: "Fun", emoji: "😄" },
        { value: "emocionante", label: "Tearjerker", emoji: "🥹" },
        { value: "animada", label: "Upbeat", emoji: "🎉" },
      ],
    },
  },
  {
    id: "historia1",
    kind: "question",
    block: "The story",
    text: "What does {nome} mean to you?",
    subtext: "Write it your way. The more real it is, the more unique the lyrics.",
    field: "historia1",
    input: "story",
    placeholder: "E.g. my mom raised me and my brothers on her own, always with a smile...",
    minChars: 60,
    allowAudio: true,
    triggers: [
      { rotulo: "how we met", inicio: "We met " },
      { rotulo: "what I admire", inicio: "What I admire most about {nome} is " },
      { rotulo: "what they do for me", inicio: "What {nome} does for me that almost nobody sees is " },
      { rotulo: "what I learned", inicio: "What I learned from {nome} is " },
      { rotulo: "never said this", inicio: "Something I've never told {nome} is that " },
      { rotulo: "how I feel with them", inicio: "Next to {nome} I feel " },
    ],
  },
  {
    id: "historia2",
    kind: "question",
    block: "The story",
    text: "Tell me something silly about {nome}",
    subtext:
      "A habit, a nickname, a favorite food. It doesn't have to be a beautiful story, it has to be true.",
    field: "historia2",
    input: "story",
    placeholder: "She makes this mac and cheese that...",
    minChars: 60,
    allowAudio: true,
    permitePular: true,
    triggers: [
      { rotulo: "a nickname", inicio: "The nickname I have for {nome} is " },
      { rotulo: "a food", inicio: "The food that reminds me of {nome} is " },
      { rotulo: "a place", inicio: "There's a place that's so us: " },
      { rotulo: "a habit", inicio: "A habit only {nome} has: " },
      { rotulo: "a saying", inicio: "Something {nome} always says is " },
      { rotulo: "a song", inicio: "There's a song that reminds me of {nome}: " },
    ],
  },
  {
    id: "recado",
    kind: "question",
    block: "The story",
    text: "If {nome} could hear ONE line from you in the chorus, what would it be?",
    subtext: "Optional, but it usually becomes the strongest part.",
    field: "recado",
    input: "text",
    placeholder: "The line you want them to keep forever",
    maxLength: 120,
    opcional: true,
    triggers: [
      { rotulo: "thank you for…", inicio: "Thank you for " },
      { rotulo: "I never told you", inicio: "I never told you, but " },
      { rotulo: "you taught me", inicio: "You taught me to " },
      { rotulo: "as long as I live", inicio: "As long as I live, " },
      { rotulo: "nobody knows", inicio: "Nobody knows, but you " },
      { rotulo: "if I could", inicio: "If I could, I'd " },
    ],
    extra: {
      field: "filhos",
      pergunta: "Want the song to mention your kids?",
      subtexto:
        "Write their names the way you say them at home, that's how they'll be sung. If you'd rather not mention anyone, just continue.",
      placeholder: "E.g. Jake, Lily and little Max",
      maxLength: 80,
      eco: "They'll be sung like this",
      ecoModelo: "“…and {v}, the love that stayed”",
      mostrarSe: (r) =>
        !["filha", "filho", "neta", "neto", "pet", "amiga", "amigo"].includes(
          String(r.relacao),
        ),
    },
  },
  {
    id: "contato",
    kind: "contact",
    text: "Where should I send your lyrics?",
    subtext: "Your lyrics are ready on the next screen. The email is just so you don't lose them.",
  },
  { id: "revisao", kind: "review" },
  { id: "reveal", kind: "reveal" },
  { id: "oferta", kind: "oferta" },
];
