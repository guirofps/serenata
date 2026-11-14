// AS PRÉ-LANDINGS DA BALLAD (14/11/2026): as irmãs da `/presente` e da
// `/tendencia` da Serenata, pra os anúncios da Ballad.
//
//   /es/regalo     e  /gift       a landing curta (vídeo, por que não flor, o
//                                 que a pessoa recebe, três músicas, como funciona)
//   /es/tendencia  e  /trending   a matéria em formato de notícia
//
// NÃO É TRADUÇÃO (regra "anúncio: adaptar, não traduzir"): o texto é escrito
// pra quem lê em espanhol latino (e em inglês americano), com os exemplos e os
// números DA BALLAD. O que fica igual à Serenata é o desenho, as regras e o
// motivo de cada bloco (ver `lp-presente.ts` e `materia-tendencia.ts`):
//   - sem botão no topo: o primeiro é a barra de baixo, depois do vídeo;
//   - sem preço e sem falar em pagar: a promessa é ouvir o adelanto de graça,
//     e o preço (que muda por país) só aparece na oferta, lido do caixa;
//   - a matéria diz de quem é: selo de publicidade no topo e, no rodapé, o
//     nome da marca e a empresa que opera, com o CNPJ. Sem endereço.
//
// POR QUE ELAS NÃO ABREM O QUIZ: anúncio com texto em espanhol apontando pra
// uma página que abre o quiz em espanhol caiu em CONSUMER_FINANCE em 09-10/10.
// Estas páginas são conteúdo, com um botão que leva ao quiz. Pode ser o que
// libera o anúncio em espanhol de ir direto a elas; NÃO está provado.
//
// O ESPANHOL DEPENDE DO PAÍS (`mercadoDoPais(paisAtual()).conteudo`), como a
// home `/es`: `tú` em todo lugar, `vos` só na Argentina, e "móvil" na Espanha.
// A matéria fala em terceira pessoa justamente pra quase não precisar disso:
// só as chamadas pro botão variam.
//
// OS NÚMEROS DA MATÉRIA são da Ballad e verdadeiros: músicas pagas no
// balladgift.com em 30 dias, até 13/11/2026 (`scratch/_ballad-relacao-vendas-14nov.mjs`):
// 952 vendas, esposa 519 (54,5%), namorada 151 (15,9%). As "6,600+ famílias"
// são o número da EMPRESA, o mesmo que a `ProvaSocial` mostra na Ballad
// (decisão do dono, 30/09: os clientes são da empresa, nas duas marcas).
// Atualizar os três números E o período quando alguém rodar de novo.

import type { VarianteConteudo } from "@/lib/mercados";

/** O número de famílias, escrito como se lê nos EUA e no México (o mesmo da `ProvaSocial` da Ballad). */
export const FAMILIAS_BALLAD = "6,600";

export const PARA_QUEM_BALLAD = { esposa: 55, namorada: 16, resto: 29 } as const;

/** A data que as duas matérias mostram (a da escrita). Sem hora: nada de relógio falso. */
export const DATA_MATERIA_BALLAD = { es: "14/11/2026", en: "Nov. 14, 2026" } as const;

/** O nome da publicação da matéria. Nosso, como o "Notícias da Família" da Serenata. */
export const PUBLICACAO_BALLAD = { es: "Notas de Familia", en: "Family Notes" } as const;

/** As três músicas tocáveis de cada idioma: esposa, namorada e mãe (as que mais vendem na Ballad). */
export const SLUGS_LP_BALLAD = {
  es: ["es-us-esposa", "es-us-novia", "es-us-mama"],
  en: ["en-wife", "en-mom", "en-dad"],
} as const;

// ── A LANDING CURTA (/es/regalo e /gift) ─────────────────────────

export type TextosRegalo = {
  titulo: string;
  descricao: string;
  olho: string;
  headline: { antes: string; ouro: string; depois: string };
  sub: string;
  legendaVideo: string;
  seloVideo: string;
  tituloComuns: string;
  comuns: { emoji: string; nome: string; fim: string }[];
  musica: { nome: string; fim: string };
  botao: string;
  depoisBotao: string;
  tituloOuvir: string;
  subOuvir: string;
  notaTrechos: string;
  tituloPassos: string;
  passos: string[];
  tituloFinal: string;
  subFinal: string;
  barra: { rotulo: string; titulo: string; sub: string };
  ouvir: (titulo: string) => string;
  pausar: (titulo: string) => string;
  termos: string;
  privacidade: string;
};

export function textosRegaloEs(v: VarianteConteudo): TextosRegalo {
  const ar = v === "argentina";
  const celular = v === "espanha" ? "móvil" : "celular";
  return {
    titulo: "Una canción de regalo, con el nombre de quien quieres | Ballad",
    descricao:
      "Las flores se marchitan y los chocolates se acaban. Una canción hecha con su historia se queda para siempre, en una página solo para esa persona. El adelanto se escucha gratis.",
    olho: "un regalo que nadie más tiene",
    headline: {
      antes: "Las flores se marchitan. Los chocolates se acaban. Una ",
      ouro: "canción",
      depois: " se queda para siempre.",
    },
    sub: ar
      ? "Su historia se convierte en una canción original, con su nombre, dentro de una página hecha solo para esa persona, con sus fotos y la letra iluminándose. El adelanto lo escuchás gratis."
      : "Su historia se convierte en una canción original, con su nombre, dentro de una página hecha solo para esa persona, con sus fotos y la letra iluminándose. El adelanto lo escuchas gratis.",
    legendaVideo: "Personas reales escuchando su canción por primera vez",
    seloVideo: "reacciones reales",
    tituloComuns: "Un regalo común dura poco",
    comuns: [
      { emoji: "🌹", nome: "Las flores", fim: "se marchitan en una semana" },
      { emoji: "🍫", nome: "Los chocolates", fim: "se acaban en cinco minutos" },
      { emoji: "🎁", nome: "El regalo de tienda", fim: "termina en un cajón" },
    ],
    musica: { nome: "Una canción", fim: "con su nombre suena para siempre" },
    botao: "Crear mi canción",
    depoisBotao: "El adelanto es gratis y queda listo en pocos minutos.",
    tituloOuvir: "Dale play",
    subOuvir: "Canciones hechas a partir de la historia que alguien contó.",
    notaTrechos: "Fragmentos de 45 segundos. La canción completa dura unos 4 minutos.",
    tituloPassos: "Queda lista hoy",
    passos: [
      ar
        ? "Contás su historia, escribiendo o con un audio."
        : "Cuentas su historia, escribiendo o con un audio.",
      ar
        ? "En pocos minutos se convierte en canción, con el nombre de quien la recibe. El adelanto lo escuchás gratis."
        : "En pocos minutos se convierte en canción, con el nombre de quien la recibe. El adelanto lo escuchas gratis.",
      `Esa persona recibe en el ${celular} una página solo suya: la canción, la letra iluminándose y sus fotos. Por link o código QR.`,
    ],
    tituloFinal: "Un regalo que se va a volver a escuchar en cada cumpleaños",
    subFinal: ar
      ? "Contá la historia ahora y escuchá el adelanto gratis."
      : "Cuenta la historia ahora y escucha el adelanto gratis.",
    barra: {
      rotulo: "Crear mi canción",
      titulo: ar
        ? "Una canción con el nombre de quien querés"
        : "Una canción con el nombre de quien tú quieres",
      sub: "El adelanto es gratis",
    },
    ouvir: (t) => `Escuchar ${t}`,
    pausar: (t) => `Pausar ${t}`,
    termos: "Términos",
    privacidade: "Privacidad",
  };
}

export const TEXTOS_GIFT: TextosRegalo = {
  titulo: "A song with their name in it, as a gift | Ballad",
  descricao:
    "Flowers wilt and chocolate disappears. A song made from your story stays forever, on a page made just for them. Hear the preview free.",
  olho: "a gift nobody else has",
  headline: {
    antes: "Flowers wilt. Chocolate disappears. A ",
    ouro: "song",
    depois: " is forever.",
  },
  sub: "Your story becomes an original song with their name in it, delivered on a page made just for them, with your photos and the lyrics lighting up. You hear the preview free.",
  legendaVideo: "Real people hearing their song for the first time",
  seloVideo: "real reactions",
  tituloComuns: "Most gifts don't last",
  comuns: [
    { emoji: "🌹", nome: "Flowers", fim: "wilt in a week" },
    { emoji: "🍫", nome: "Chocolate", fim: "is gone in five minutes" },
    { emoji: "🎁", nome: "Store-bought gifts", fim: "end up in a drawer" },
  ],
  musica: { nome: "A song", fim: "with their name plays forever" },
  botao: "Create my song",
  depoisBotao: "The preview is free and ready in minutes.",
  tituloOuvir: "Press play",
  subOuvir: "Songs made from a story someone told us.",
  notaTrechos: "45-second clips. The full song runs about 4 minutes.",
  tituloPassos: "Ready today",
  passos: [
    "Tell us your story, typed out or as a voice note.",
    "In a few minutes it becomes a song with their name in it. You hear the preview free.",
    "They get a page that's all theirs: the song, the lyrics lighting up and your photos. By link or QR code.",
  ],
  tituloFinal: "A gift they'll play again every birthday",
  subFinal: "Tell the story now and hear the preview free.",
  barra: {
    rotulo: "Create my song",
    titulo: "A song with their name in it",
    sub: "The preview is free",
  },
  ouvir: (t) => `Play ${t}`,
  pausar: (t) => `Pause ${t}`,
  termos: "Terms",
  privacidade: "Privacy",
};

// ── A MATÉRIA (/es/tendencia e /trending) ────────────────────────

export type TextosMateria = {
  publicacao: string;
  editoria: string;
  selo: string;
  manchete: string;
  linhaFina: string;
  por: string;
  data: string;
  legendaVideo: string;
  abertura: [string, string];
  tituloParaQuem: string;
  paraQuem: string;
  graficoTitulo: string;
  grafico: { rotulo: string; pct: number }[];
  fonte: string;
  tituloPorque: string;
  porque: string;
  tituloRecebe: string;
  recebe: string;
  abrirExemplo: string;
  tituloOuvir: string;
  notaTrechos: string;
  tituloComo: string;
  passos: string[];
  natal: string;
  caixaTitulo: string;
  caixaSub: string;
  botao: string;
  barra: { rotulo: string; titulo: string; sub: string };
  rodape: (empresa: string, cnpj: string) => string;
  menu: {
    inicio: string;
    como: string;
    blog: string;
    criar: string;
    abrir: string;
    fechar: string;
  };
  compartilhar: { facebook: string; whatsapp: string; x: string; copiar: string; copiado: string };
  inicio: string;
  termos: string;
  privacidade: string;
  ouvir: (titulo: string) => string;
  pausar: (titulo: string) => string;
};

export function textosMateriaEs(v: VarianteConteudo): TextosMateria {
  const ar = v === "argentina";
  const celular = v === "espanha" ? "móvil" : "celular";
  const pub = PUBLICACAO_BALLAD.es;
  return {
    publicacao: pub,
    editoria: "Regalos",
    selo: "Publicidad",
    manchete: `En lugar de flores, una canción con su historia: el regalo que ya dieron más de ${FAMILIAS_BALLAD} familias`,
    linhaFina: `Más de ${FAMILIAS_BALLAD} familias ya regalaron una canción con el nombre y la historia de alguien que quieren. El adelanto queda listo en minutos y se escucha gratis.`,
    por: `Por Redacción ${pub}`,
    data: DATA_MATERIA_BALLAD.es,
    legendaVideo:
      "El momento en que algunas familias escuchan por primera vez la canción hecha con su propia historia.",
    abertura: [
      `Flores, perfume y chocolates son los regalos de siempre. Pero hay un formato que gana espacio entre quienes buscan algo distinto: la canción hecha a la medida, con el nombre y la historia de quien la recibe. En Ballad Gift, el estudio que crea estas canciones, más de ${FAMILIAS_BALLAD} familias ya regalaron una.`,
      "La idea es simple. La persona cuenta la historia (cómo se conocieron, un apodo, una manía, un viaje) y esa historia se convierte en una canción original que habla exactamente de eso. Quien la recibe escucha su propio nombre en una canción que nadie más tiene.",
    ],
    tituloParaQuem: "Más de la mitad es para la esposa",
    paraQuem: `Un análisis de Ballad Gift con las canciones compradas en 30 días, hasta el 13 de noviembre de 2026, muestra para quién se hacen: el ${PARA_QUEM_BALLAD.esposa}% fue para la esposa y el ${PARA_QUEM_BALLAD.namorada}% para la novia. El resto se reparte entre hijos, mamás, papás, esposos, amigos y abuelos.`,
    graficoTitulo: "Para quién se hacen las canciones",
    grafico: [
      { rotulo: "Esposa", pct: PARA_QUEM_BALLAD.esposa },
      { rotulo: "Novia", pct: PARA_QUEM_BALLAD.namorada },
      { rotulo: "Hijos, mamá, papá, esposo, amigos y abuelos", pct: PARA_QUEM_BALLAD.resto },
    ],
    fonte: "Fuente: Ballad Gift, canciones compradas en 30 días, hasta el 13 de noviembre de 2026.",
    tituloPorque: "Lo que una canción tiene y una flor no",
    porque:
      "Las flores se marchitan en una semana. Los chocolates se acaban en minutos. Un regalo de tienda puede terminar al fondo de un cajón. La canción tiene algo que ninguno de ellos tiene: se hizo para una sola persona, con detalles que solo esa familia conoce, y sigue sonando en el siguiente cumpleaños.",
    tituloRecebe: "El regalo no llega como un archivo de audio",
    recebe: `Quien lo recibe abre un link en el ${celular} y encuentra una página con su propio nombre en la portada: la canción sonando, la letra iluminándose palabra por palabra y las fotos de la familia pasando. El link puede ir por mensaje o convertirse en un código QR pegado en una tarjeta o en una caja de chocolates.`,
    abrirExemplo: "Abrir un regalo de ejemplo",
    tituloOuvir: "Tres canciones hechas así",
    notaTrechos: "Fragmentos de 45 segundos. La canción completa dura unos 4 minutos.",
    tituloComo: "Cómo se hace una",
    passos: [
      "La persona cuenta la historia: cómo se conocieron, un apodo, una manía, un viaje. Escribiendo o con un audio.",
      "En pocos minutos la historia se convierte en canción, con el nombre de quien la va a recibir. El adelanto se escucha gratis.",
      "Quien la recibe abre la página con la canción, por link o código QR.",
    ],
    natal:
      "Para quien ya piensa en Navidad: la canción queda lista el mismo día, así que hay tiempo incluso para quien deja el regalo para la última semana.",
    caixaTitulo: ar
      ? "Escuchá gratis el adelanto de tu canción"
      : "Escucha gratis el adelanto de tu canción",
    caixaSub: ar
      ? "Contá la historia ahora. El adelanto queda listo en pocos minutos."
      : "Cuenta la historia ahora. El adelanto queda listo en pocos minutos.",
    botao: "Crear mi canción",
    barra: {
      rotulo: "Crear mi canción",
      titulo: ar
        ? "Una canción con el nombre de quien querés"
        : "Una canción con el nombre de quien tú quieres",
      sub: "El adelanto es gratis",
    },
    rodape: (empresa, cnpj) =>
      `${pub} es un espacio de contenido de Ballad Gift, operado por ${empresa}, CNPJ ${cnpj} (Brasil). Este contenido es publicidad, y las cifras citadas son de la propia empresa.`,
    menu: {
      inicio: "Inicio",
      como: "Cómo funciona",
      blog: "Blog",
      criar: "Crear mi canción",
      abrir: "Menú",
      fechar: "Cerrar",
    },
    compartilhar: {
      facebook: "Compartir en Facebook",
      whatsapp: "Compartir en WhatsApp",
      x: "Compartir en X",
      copiar: "Copiar el link",
      copiado: "Link copiado",
    },
    inicio: "Inicio",
    termos: "Términos",
    privacidade: "Privacidad",
    ouvir: (t) => `Escuchar ${t}`,
    pausar: (t) => `Pausar ${t}`,
  };
}

export const TEXTOS_TRENDING: TextosMateria = {
  publicacao: PUBLICACAO_BALLAD.en,
  editoria: "Gifts",
  selo: "Sponsored",
  manchete: `Instead of flowers, a song about their story: the gift ${FAMILIAS_BALLAD}+ families have already given`,
  linhaFina: `More than ${FAMILIAS_BALLAD} families have given a song with the name and story of someone they love. The preview is ready in minutes and free to hear.`,
  por: `By the ${PUBLICACAO_BALLAD.en} staff`,
  data: DATA_MATERIA_BALLAD.en,
  legendaVideo: "Families hearing, for the first time, a song made from their own story.",
  abertura: [
    `Flowers, perfume and chocolate are the usual gifts. But a different kind of present is catching on with people who want something that actually means something: a custom song with the name and story of the person getting it. At Ballad Gift, the studio that writes these songs, more than ${FAMILIAS_BALLAD} families have already given one.`,
    "It works like this. Someone shares the story (how they met, a nickname, an inside joke, a road trip) and it becomes an original song about exactly that. The person who gets it hears their own name in a song nobody else has.",
  ],
  tituloParaQuem: "More than half are for a wife",
  paraQuem: `A look at songs purchased on Ballad Gift over 30 days, through Nov. 13, 2026, shows who they're for: ${PARA_QUEM_BALLAD.esposa}% went to a wife and ${PARA_QUEM_BALLAD.namorada}% to a girlfriend. The rest went to kids, moms, dads, husbands, friends and grandparents.`,
  graficoTitulo: "Who the songs are for",
  grafico: [
    { rotulo: "Wife", pct: PARA_QUEM_BALLAD.esposa },
    { rotulo: "Girlfriend", pct: PARA_QUEM_BALLAD.namorada },
    { rotulo: "Kids, mom, dad, husband, friends and grandparents", pct: PARA_QUEM_BALLAD.resto },
  ],
  fonte: "Source: Ballad Gift, songs purchased over 30 days, through Nov. 13, 2026.",
  tituloPorque: "What a song has that flowers don't",
  porque:
    "Flowers wilt in a week. Chocolate is gone in minutes. A store-bought gift can end up in the back of a drawer. A song has something none of them do: it was made for one person, with details only that family knows, and it still plays on the next birthday.",
  tituloRecebe: "It doesn't arrive as an audio file",
  recebe:
    "The person opens a link on their phone and finds a page with their own name on the cover: the song playing, the lyrics lighting up word by word and the family's photos gliding by. The link can go by text, or become a QR code on a card or a box of chocolates.",
  abrirExemplo: "Open an example gift",
  tituloOuvir: "Three songs made this way",
  notaTrechos: "45-second clips. The full song runs about 4 minutes.",
  tituloComo: "How it works",
  passos: [
    "You share the story: how you met, a nickname, an inside joke, a trip. Typed out or as a voice note.",
    "In a few minutes the story becomes a song with their name in it. The preview is free to hear.",
    "They open the page with the song, by link or QR code.",
  ],
  natal:
    "Already thinking about Christmas? The song is ready the same day, so there's time even if you leave the gift for the last week.",
  caixaTitulo: "Hear the preview of your song free",
  caixaSub: "Tell the story now. The preview is ready in a few minutes.",
  botao: "Create my song",
  barra: {
    rotulo: "Create my song",
    titulo: "A song with their name in it",
    sub: "The preview is free",
  },
  rodape: (empresa, cnpj) =>
    `${PUBLICACAO_BALLAD.en} is a content space by Ballad Gift, operated by ${empresa}, CNPJ ${cnpj} (Brazil). This content is advertising, and the figures cited are the company's own.`,
  menu: {
    inicio: "Home",
    como: "How it works",
    blog: "Blog",
    criar: "Create my song",
    abrir: "Menu",
    fechar: "Close",
  },
  compartilhar: {
    facebook: "Share on Facebook",
    whatsapp: "Share on WhatsApp",
    x: "Share on X",
    copiar: "Copy the link",
    copiado: "Link copied",
  },
  inicio: "Home",
  termos: "Terms",
  privacidade: "Privacy",
  ouvir: (t) => `Play ${t}`,
  pausar: (t) => `Pause ${t}`,
};
