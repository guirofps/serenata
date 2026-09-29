// OS EXEMPLOS DA BALLAD GIFT (EUA), num lugar só.
//
// Mesma regra dos exemplos da Serenata: NADA aqui é escrito pra ilustrar. Cada
// exemplo é uma música gerada pelo PRÓPRIO funil da Ballad (quiz sintético com
// história americana → letra pelo prompt em inglês → job real do Inngest da
// Ballad → Suno), e os versos, o título e o token são copiados do que saiu.
// É o que o cliente vai receber, não uma peça de vitrine.
//
// As capas são retratos gerados (pessoas que não existem), não fotos de
// cliente: a Ballad ainda não tem cliente, e usar rosto de gente real pra
// sugerir que ela comprou seria alegação falsa. Os exemplos são apresentados
// como EXEMPLOS, nunca como depoimento.
//
// As respostas do quiz ficam aqui junto pra que regerar um exemplo seja
// rodar o mesmo script (`scratch/ballad-exemplos.mjs`) e colar o resultado.

export type ExemploEn = {
  slug: string;
  relacao: string;
  /** Como é chamado na música (o que o quiz canta). */
  nome: string;
  /** Título da música, como saiu da geração. Vazio até gerar. */
  titulo: string;
  /** "for his wife", visto por quem compra. */
  para: string;
  genero: string;
  /** Token da página-presente de exemplo no banco da Ballad. Vazio até gerar. */
  token: string;
  /** Retrato de capa em `public/ballad/exemplos/`. */
  capa: string;
  /** Primeiros versos da letra gerada, literais. Vazio até gerar. */
  versos: string[];
  respostas: Record<string, string>;
};

export const EXEMPLOS_EN: ExemploEn[] = [
  {
    slug: "en-wife",
    relacao: "esposa",
    nome: "Emily",
    titulo: "Yellow Dress, Every Time",
    para: "for his wife",
    genero: "Love ballad",
    token: "exenwife3b4f983682",
    capa: "/ballad/exemplos/en-wife.webp",
    versos: [
      "Iowa State Fair, corn dog line, summer heat,",
      "you dropped your ticket right there at my feet.",
      "I picked it up, didn't want to let it go,",
      "we rode the Ferris wheel twice, taking it slow.",
    ],
    respostas: {
      relacao: "esposa", nome: "Emily", ocasiao: "declaracao", estilo: "love_ballad_en",
      voz: "masculina", tom: "romantica", recado: "I'd pick you in every lifetime",
      historia1: "Emily and I met at the Iowa State Fair eleven years ago. She was in line for a corn dog wearing a yellow sundress and she dropped her ticket, I picked it up and we ended up riding the Ferris wheel twice. We have two kids now and she still hums when she cooks.",
      historia2: "Every Sunday morning she makes pancakes shaped like the first letter of each of our names, and she always burns the first one and eats it herself so nobody else has to. She calls me Bear. When I work nights she leaves sticky notes on the coffee maker.",
    },
  },
  {
    slug: "en-mom",
    relacao: "mae",
    nome: "Mom",
    titulo: "Bless My Heart, Mom",
    para: "for her mom",
    genero: "Country",
    token: "exenmom6368d900c7",
    capa: "/ballad/exemplos/en-mom.webp",
    versos: [
      "Little house outside Tulsa, three kids and a screen door,",
      "You worked the morning shift, came home smelling like the diner's flour.",
      "Still made it to every softball game before the second inning,",
      "Sat on the bleachers in your apron, pencil holding up your hair.",
    ],
    respostas: {
      relacao: "mae", nome: "Mom", ocasiao: "homenagem", estilo: "country_en",
      voz: "feminina", tom: "emocionante", recado: "Everything good in me started with you",
      historia1: "My mom raised me and my two brothers on her own in a little house outside Tulsa. She worked the morning shift at the diner and still made it to every softball game, sitting on the bleachers in her apron with her hair up in a pencil.",
      historia2: "She keeps a jar of buttons on the kitchen windowsill and sews them back on everything, even on my husband's shirts now. She says 'well, bless your heart' when she's mad and 'I'm proud of you, kiddo' every single time I call.",
    },
  },
  {
    slug: "en-husband",
    relacao: "marido",
    nome: "Jake",
    titulo: "Still Hold the Door",
    para: "for her husband",
    genero: "Acoustic",
    token: "exenhusband7f6b88fcab",
    capa: "/ballad/exemplos/en-husband.webp",
    versos: [
      "Grandma's backyard, string lights strung low,",
      "Asheville sky couldn't decide to let go,",
      "rain fell for five minutes right before I do,",
      "nobody moved, nobody cared, we just stood there with you.",
    ],
    respostas: {
      relacao: "marido", nome: "Jake", ocasiao: "casamento", estilo: "acoustic_en",
      voz: "feminina", tom: "romantica", recado: "Ten years and you still hold the door",
      historia1: "Jake and I are celebrating ten years of marriage. We got married in my grandma's backyard in Asheville under string lights, and it rained for five minutes right before the vows and nobody cared. He cried before I did.",
      historia2: "He still warms up my side of the car in winter and leaves the heated seat on for me. He can't cook anything except grilled cheese but he makes it with the crusts cut off because he knows I hate them. He sings off key to every song in the truck.",
    },
  },
  {
    slug: "en-grandpa",
    relacao: "avo_m",
    nome: "Grandpa Joe",
    titulo: "Still Calls Me Sport",
    para: "for his grandpa",
    genero: "Folk",
    token: "exengrandpa9d0fc16238",
    capa: "/ballad/exemplos/en-grandpa.webp",
    versos: [
      "Forty years at the lumber mill, Oregon dust in your palms,",
      "You built that cabin by the lake with nothing but your calloused hands.",
      "I was six years old the day you handed me that old bamboo rod,",
      "And never once got mad when my line tangled like a knot.",
    ],
    respostas: {
      relacao: "avo_m", nome: "Grandpa Joe", ocasiao: "homenagem", estilo: "folk_en",
      voz: "masculina", tom: "emocionante", recado: "Thank you for teaching me to be patient",
      historia1: "My Grandpa Joe is turning 85. He worked forty years at the lumber mill in Oregon and built the cabin by the lake with his own hands. He taught me to fish off the dock when I was six and never once got mad when I tangled the line.",
      historia2: "He whistles the same old tune while he makes his famous chili every Fourth of July, and he still calls everyone 'sport'. He keeps a coffee can full of lures and tells the story of the one that got away a little bigger every year.",
    },
  },
  {
    slug: "en-daughter",
    relacao: "filha",
    nome: "Lily",
    titulo: "Flashlight Bugs",
    para: "for her daughter",
    genero: "Pop",
    token: "exendaughterd6b7b01994",
    capa: "/ballad/exemplos/en-daughter.webp",
    versos: [
      "You came in a snowstorm, screaming Denver awake",
      "Unstoppable since, that's just how you're made",
      "Cleats on the porch, soccer ball in the hall",
      "Sneakers covered in doodles, you draw on them all",
    ],
    respostas: {
      relacao: "filha", nome: "Lily", ocasiao: "aniversario", estilo: "pop_en",
      voz: "feminina", tom: "animada", recado: "Go chase every dream, I'll always be your home",
      historia1: "My daughter Lily is turning sixteen. She was born during a snowstorm in Denver and has been unstoppable ever since. She plays soccer, draws on her sneakers and dances in the kitchen while she does her homework.",
      historia2: "When she was little she called fireflies 'flashlight bugs' and we still call them that. She sings in the car with the windows down no matter the weather and she steals my hoodies. Her laugh is the loudest thing in our house.",
    },
  },
  {
    slug: "en-dad",
    relacao: "pai",
    nome: "Dad",
    titulo: "Measure Twice, Buddy",
    para: "for his dad",
    genero: "Country",
    token: "exendad12eda8ea77",
    capa: "/ballad/exemplos/en-dad.webp",
    versos: [
      "You taught me the clutch on the dirt road out back,",
      "bench seat cracked, paint gone from blue to gray.",
      "Double shifts done and you'd still show up late,",
      "take your seat by the fence at the Friday game.",
    ],
    respostas: {
      relacao: "pai", nome: "Dad", ocasiao: "aniversario", estilo: "country_en",
      voz: "masculina", tom: "emocionante", recado: "Everything I know about being a man, I learned watching you",
      historia1: "My dad is turning sixty. He drove the same old blue Ford pickup my whole childhood and taught me to drive it on the dirt road behind the farm in Tennessee. He never missed a Friday night football game even after double shifts.",
      historia2: "He fixes everything with duct tape and a pocket knife and he always says 'measure twice, cut once'. Every Saturday he makes biscuits and gravy and plays old records on the porch. He still calls me 'buddy' and pretends he isn't proud.",
    },
  },
];

export function exemploEn(slug: string): ExemploEn | undefined {
  return EXEMPLOS_EN.find((e) => e.slug === slug);
}

/** A URL do trecho de 45s no bucket público `exemplos` do banco DESTE deploy. */
export function audioDoExemplo(slug: string): string {
  const base = (
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL ??
    (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL : "") ??
    ""
  ).replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/exemplos/${slug}.mp3`;
}
