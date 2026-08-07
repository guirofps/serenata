import type { FlowStep } from "@/lib/flow-engine";
import { generos } from "@/lib/generos";

// O QUIZ EM ESPANHOL.
//
// Os `value` são IDÊNTICOS aos do português de propósito: é o que fica gravado
// no banco, o que o prompt da letra lê e o que o painel agrupa. Se `mae`
// virasse `mama` aqui, uma venda mexicana não apareceria em nenhum relatório
// junto com as brasileiras, e o mapa do prompt teria que ganhar chaves novas.
// Só o RÓTULO muda de idioma.
//
// A exceção honesta são os gêneros: lá o `value` muda mesmo (`mariachi`,
// `banda`), porque não existe equivalente. Ver `generos.ts`.
//
// Espanhol neutro-mexicano: `tú`, nunca `vos`; `ustedes`, nunca `vosotros`.

export const QUIZ_FLOW_ES: FlowStep[] = [
  {
    id: "relacao",
    kind: "question",
    block: "Para quién",
    text: "¿Para quién es este regalo?",
    field: "relacao",
    input: "chips",
    options: [
      { value: "mae", label: "Mamá", emoji: "👩" },
      { value: "pai", label: "Papá", emoji: "👨" },
      { value: "esposa", label: "Esposa", emoji: "💍" },
      { value: "marido", label: "Esposo", emoji: "💍" },
      { value: "namorada", label: "Novia", emoji: "❤️" },
      { value: "namorado", label: "Novio", emoji: "❤️" },
      { value: "filha", label: "Hija", emoji: "👧" },
      { value: "filho", label: "Hijo", emoji: "👦" },
      { value: "avo_f", label: "Abuela", emoji: "👵" },
      { value: "avo_m", label: "Abuelo", emoji: "👴" },
      { value: "irma", label: "Hermana", emoji: "🤝" },
      { value: "irmao", label: "Hermano", emoji: "🤝" },
      { value: "neta", label: "Nieta", emoji: "🧒" },
      { value: "neto", label: "Nieto", emoji: "🧒" },
      { value: "familia", label: "Familia", emoji: "🏡" },
      { value: "amiga", label: "Amiga", emoji: "🫂" },
      { value: "amigo", label: "Amigo", emoji: "🫂" },
      { value: "pet", label: "Mascota", emoji: "🐾" },
      { value: "outro", label: "Otro", emoji: "✨" },
    ],
  },
  {
    id: "nome",
    kind: "question",
    block: "Para quién",
    text: "¿Cómo le dices a esa persona?",
    // O exemplo de pronúncia é MEXICANO (Xóchitl), não a tradução do Thaís:
    // um nome que ninguém tem por perto não ensina nada.
    subtext:
      "Escríbelo como le dices todos los días, un apodo también vale. Si la pronunciación no es obvia, escríbelo como suena (ej.: Xóchitl → so-chil).",
    field: "nome",
    input: "text",
    placeholder: "Mamá, mi Lupita, abuelo Chuy...",
    maxLength: 40,
    eco: "Así es como se va a cantar",
    ecoModelo: "“{v}, esta canción es para ti…”",
    cortarComposto: true,
  },
  {
    id: "ocasiao",
    kind: "question",
    block: "La ocasión",
    text: "¿Cuál es la ocasión?",
    field: "ocasiao",
    input: "chips",
    options: [
      { value: "aniversario", label: "Cumpleaños", emoji: "🎂" },
      { value: "casamento", label: "Boda o aniversario", emoji: "💒" },
      { value: "declaracao", label: "Declaración de amor", emoji: "❤️" },
      { value: "homenagem", label: "Homenaje", emoji: "🌟" },
      { value: "memorial", label: "Para quien ya partió", emoji: "🕊️" },
      { value: "formatura", label: "Graduación", emoji: "🎓" },
      { value: "soporque", label: "Solo porque sí", emoji: "✨" },
      { value: "outro", label: "Otro momento", emoji: "🎁" },
    ],
  },
  {
    id: "prova1",
    kind: "social-proof",
    eyebrow: "reacciones reales",
    testimonial: "La cara de quien la escucha por primera vez.",
  },
  {
    id: "estilo",
    kind: "question",
    block: "El estilo",
    text: "¿Qué estilo va con {nome}?",
    subtext: "Es el ambiente de la canción. Se puede cambiar después.",
    field: "estilo",
    input: "chips",
    // Do catálogo, não copiado: mariachi, banda e corrido tumbado não têm
    // equivalente brasileiro, e sertanejo e forró não existem no México.
    options: generos("es").map((g) => ({ value: g.value, label: g.label, emoji: g.emoji })),
  },
  {
    id: "voz",
    kind: "question",
    block: "El estilo",
    text: "¿Quién canta esta canción?",
    field: "voz",
    input: "chips",
    options: [
      { value: "feminina", label: "Voz femenina", emoji: "👩" },
      { value: "masculina", label: "Voz masculina", emoji: "👨" },
      { value: "surpresa", label: "Sorpréndeme", emoji: "🎲" },
    ],
  },
  {
    id: "historia1",
    kind: "question",
    block: "La historia",
    text: "¿Qué es {nome} para ti?",
    subtext: "Escribe a tu manera. Mientras más real, más única queda la letra.",
    field: "historia1",
    input: "story",
    placeholder:
      "Ej: mi mamá nos crió a mis hermanos y a mí ella sola, siempre con una sonrisa...",
    minChars: 60,
    allowAudio: true,
    triggers: [
      { rotulo: "cómo se conocieron", inicio: "Nos conocimos " },
      { rotulo: "lo que admiro", inicio: "Lo que más admiro de {nome} es " },
      { rotulo: "lo que hace por mí", inicio: "Lo que {nome} hace por mí y casi nadie ve es " },
      { rotulo: "lo que aprendí", inicio: "Lo que aprendí de {nome} fue " },
      { rotulo: "nunca se lo dije", inicio: "Algo que nunca le dije a {nome} es que " },
      { rotulo: "cómo me siento", inicio: "A lado de {nome} me siento " },
    ],
  },
  {
    id: "historia2",
    kind: "question",
    block: "La historia",
    // Mesma correção do português: pedir RECALL de um episódio dá branco.
    // Aqui se pede uma bobagem, que qualquer um tem na ponta da língua.
    text: "Cuéntame una tontería de {nome}",
    subtext:
      "Una manía, un apodo, una comida. No tiene que ser bonito, tiene que ser verdad.",
    field: "historia2",
    input: "story",
    placeholder: "Hace unos frijoles que...",
    minChars: 60,
    allowAudio: true,
    permitePular: true,
    triggers: [
      { rotulo: "un apodo", inicio: "El apodo que le digo a {nome} es " },
      { rotulo: "una comida", inicio: "La comida que me recuerda a {nome} es " },
      { rotulo: "un lugar", inicio: "Hay un lugar que es muy nuestro: " },
      { rotulo: "una manía", inicio: "Una manía que solo {nome} tiene: " },
      { rotulo: "una frase", inicio: "Una frase que {nome} siempre dice es " },
      { rotulo: "una canción", inicio: "Hay una canción que me recuerda a {nome}: " },
    ],
  },
  {
    id: "recado",
    kind: "question",
    block: "La historia",
    text: "Si {nome} pudiera escuchar UNA frase tuya en el coro, ¿cuál sería?",
    subtext: "Opcional, pero suele volverse la parte más fuerte.",
    field: "recado",
    input: "text",
    placeholder: "La frase que quisieras que quedara para siempre",
    maxLength: 120,
    opcional: true,
    triggers: [
      { rotulo: "gracias por…", inicio: "Gracias por " },
      { rotulo: "nunca te dije", inicio: "Nunca te lo dije, pero " },
      { rotulo: "me enseñaste", inicio: "Me enseñaste a " },
      { rotulo: "mientras yo viva", inicio: "Mientras yo viva, " },
      { rotulo: "nadie sabe", inicio: "Nadie lo sabe, pero tú " },
      { rotulo: "si yo pudiera", inicio: "Si yo pudiera, " },
    ],
    extra: {
      field: "filhos",
      pergunta: "¿Quieres que la canción mencione a los hijos?",
      subtexto:
        "Escribe los nombres como les dicen en casa, así es como se van a cantar. Si prefieres no mencionar a nadie, solo continúa.",
      placeholder: "Ej.: Pedrito, Ana y el Chino",
      maxLength: 80,
      eco: "Así se van a cantar",
      ecoModelo: "“…y {v}, el amor que quedó”",
      mostrarSe: (r) =>
        !["filha", "filho", "neta", "neto", "pet", "amiga", "amigo"].includes(
          String(r.relacao),
        ),
    },
  },
  {
    id: "contato",
    kind: "contact",
    text: "¿A dónde te mando tu letra?",
    subtext: "La letra queda lista en la siguiente pantalla. El correo es solo para que no la pierdas.",
  },
  { id: "revisao", kind: "review" },
  { id: "reveal", kind: "reveal" },
  { id: "oferta", kind: "oferta" },
];
