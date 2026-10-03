// OS EXEMPLOS PÚBLICOS (as músicas reais que a home toca).
//
// Saíram de `ExemplosReais.tsx` (03/10/2026) pra o blog ler a mesma lista, e
// pra o teste de conteúdo (que roda em node, sem React) conseguir importar.
// O render da home não mudou.
//
// Trechos de 45s num bucket PÚBLICO (scratch/publicar-exemplos.mjs): 704 KB
// cada em vez dos ~5 MB da faixa cheia, e coerente com o paywall — o trecho é
// exatamente o que se ouve de graça.

export type ExemploPt = {
  slug: string;
  titulo: string;
  para: string;
  genero: string;
  token: string;
  capa: string;
};

export const ABAS_EXEMPLOS: AbaExemplos[] = [
  {
    chave: "pai",
    rotulo: "Pai",
    emoji: "👨",
    itens: [
      { slug: "antonio", titulo: "Seu Antônio", para: "para o pai", genero: "Sertanejo", token: "expai51378356a9", capa: "pai" },
    ],
  },
  {
    chave: "mae",
    rotulo: "Mãe",
    emoji: "👩",
    itens: [
      { slug: "eva", titulo: "Domingo na Casa da Eva", para: "para a mãe", genero: "Sertanejo", token: "533db522753f423e8b2227", capa: "mae" },
      { slug: "denise", titulo: "Mulher de Palavra", para: "para a mãe", genero: "Gospel", token: "2459f4b76e1b49c58be203", capa: "denise" },
    ],
  },
  {
    chave: "avos",
    rotulo: "Avós",
    emoji: "👵",
    itens: [
      // "Domingo de Rose" é uma homenagem real de uma neta à avó dela.
      { slug: "rose", titulo: "Domingo de Rose", para: "para a avó", genero: "MPB", token: "9296e7e9b5c2460faadd64", capa: "avo" },
      { slug: "joaquim", titulo: "Meu Rei da Sanfona", para: "para o avô", genero: "Forró", token: "exavo306216da", capa: "avoo" },
    ],
  },
  {
    chave: "filhos",
    rotulo: "Filhos",
    emoji: "👶",
    itens: [
      { slug: "theo", titulo: "Cinco Anos de Espera", para: "para o filho", genero: "Pop romântico", token: "exfilho2686eb8d", capa: "filho" },
    ],
  },
  {
    chave: "namorados",
    rotulo: "Namorados",
    emoji: "❤️",
    itens: [
      { slug: "bianca", titulo: "Café Ruim, Amor Certo", para: "para a namorada", genero: "Sertanejo", token: "exnamorada00ec1ec6", capa: "namorada" },
    ],
  },
  {
    chave: "esposa",
    rotulo: "Esposa",
    emoji: "💍",
    itens: [
      { slug: "isabela", titulo: "Desde a Escola, Isabela", para: "para a esposa", genero: "Sertanejo", token: "e406f9b4356f4a5a9e7d8e", capa: "isabela" },
    ],
  },
  {
    chave: "marido",
    rotulo: "Marido",
    emoji: "💍",
    itens: [
      { slug: "camburi", titulo: "Camburi", para: "para o marido", genero: "MPB", token: "7b89d2ed634646c4b1ee95", capa: "camburi" },
      { slug: "garga", titulo: "Gargamel", para: "para o marido", genero: "Pagode", token: "5c980fdd76344b0c81e4e1", capa: "garga" },
    ],
  },
  {
    chave: "amiga",
    rotulo: "Amiga",
    emoji: "🫂",
    itens: [
      { slug: "li", titulo: "Li, 53", para: "para a amiga", genero: "MPB", token: "7efe7bb4304d4790954603", capa: "amigas" },
    ],
  },
];

export const AUDIO_EXEMPLOS =
  "https://ouwijepgctgtfzrrwpvt.supabase.co/storage/v1/object/public/exemplos";

// As capas ficam em /public com cache de 30 dias. Quando uma é TROCADA (mesmo
// nome, conteúdo novo), o navegador de quem já visitou continua servindo a
// antiga — foi o que aconteceu quando `filho.webp` deixou de ser cópia da capa
// da mãe. Subir este número invalida o cache de todas de uma vez.
export const VERSAO_CAPAS = 2;

export type AbaExemplos = { chave: string; rotulo: string; emoji: string; itens: ExemploPt[] };

export const EXEMPLOS_PT: ExemploPt[] = ABAS_EXEMPLOS.flatMap((a) => a.itens);

export function exemploPorSlug(slug: string): ExemploPt | undefined {
  return EXEMPLOS_PT.find((e) => e.slug === slug);
}

export function capaDoExemplo(e: ExemploPt): string {
  return `/img/exemplos/${e.capa}.webp?v=${VERSAO_CAPAS}`;
}
