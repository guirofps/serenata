// O BLOG É UM MOTOR, O SITE É CONFIGURAÇÃO (20/10/2026).
//
// O mesmo código serve o blog da Serenata (`/blog`, português) e o da Ballad em
// espanhol (`/es/blog`, spec docs/superpowers/specs/2026-10-20-blog-ballad-es-design.md).
// Tudo o que muda de um pro outro (endereço, marca, idioma, o que o texto não
// pode dizer, as músicas tocáveis, os textos da tela) mora aqui, e o validador,
// o <head>, os componentes e as rotas recebem o site. Cópia irmã é o que a home
// espanhola já mostrou: melhoria numa não chega na outra.

import { AUDIO_EXEMPLOS, capaDoExemplo, exemploPorSlug } from "@/lib/exemplos-pt";
import type { GrupoArtigo } from "./tipos";

/** O que o cartão de música precisa, de qualquer catálogo de exemplos. */
export type ExemploBlog = { slug: string; titulo: string; para: string; genero: string; capa: string; audio: string };

/** As rotas que os links do blog podem usar (as do TanStack, tipadas). */
export type RotaBlog = "/" | "/blog" | "/criar" | "/termos" | "/privacidade" | "/es" | "/es/criar";

export type TextosBlog = {
  layout: {
    criarCompacto: string;
    inicio: RotaBlog;
    inicioAria: (marca: string) => string;
    rodape: { to: RotaBlog; rotulo: string }[];
  };
  cta: {
    botao: string;
    botaoGospel: string;
    tituloFinal: string;
    tituloFinalGospel: string;
    nota: string;
  };
  musica: { legenda: string; capa: (titulo: string) => string; tocar: (t: string) => string; pausar: (t: string) => string };
  artigo: {
    caminho: string;
    inicio: string;
    blog: string;
    atualizadoEm: string;
    minLeitura: string;
    faq: string;
    leiaTambem: string;
  };
  indice: {
    titulo: string;
    descricao: string;
    h1: string;
    sub: string;
    grupos: { grupo: GrupoArtigo; titulo: string }[];
  };
};

export type SiteBlog = {
  chave: "serenata" | "ballad-es";
  origem: string;
  prefixo: "/blog" | "/es/blog";
  marca: string;
  sufixo: string;
  ogLocale: string;
  inLanguage: string;
  logo: string;
  rotas: Set<string>;
  preco: RegExp;
  proibidas: RegExp;
  destinoCriar: "/criar" | "/es/criar";
  data: (iso: string) => string;
  exemplo: (slug: string) => ExemploBlog | undefined;
  textos: TextosBlog;
};

/** "2026-10-02" → "02/10/2026". Sem `Date`: servidor e navegador escrevem igual. */
export function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export const BLOG_SERENATA: SiteBlog = {
  chave: "serenata",
  origem: "https://www.serenatagift.com",
  prefixo: "/blog",
  marca: "Serenata",
  sufixo: " | Serenata",
  ogLocale: "pt_BR",
  inLanguage: "pt-BR",
  logo: "/img/logo-serenata.png",
  rotas: new Set(["/", "/criar", "/blog", "/musica-personalizada-para-esposa"]),
  preco: /R\$\s*\d/,
  proibidas: /60 segundos|entrega expressa/i,
  destinoCriar: "/criar",
  data: dataBr,
  exemplo: (slug) => {
    const e = exemploPorSlug(slug);
    return e
      ? { slug: e.slug, titulo: e.titulo, para: e.para, genero: e.genero, capa: capaDoExemplo(e), audio: `${AUDIO_EXEMPLOS}/${e.slug}.mp3` }
      : undefined;
  },
  textos: {
    layout: {
      criarCompacto: "Criar minha música",
      inicio: "/",
      inicioAria: (m) => `${m}, página inicial`,
      rodape: [
        { to: "/blog", rotulo: "Blog" },
        { to: "/criar", rotulo: "Criar música" },
        { to: "/termos", rotulo: "Termos" },
        { to: "/privacidade", rotulo: "Privacidade" },
      ],
    },
    cta: {
      botao: "Criar a música agora",
      botaoGospel: "Criar meu louvor",
      tituloFinal: "Conte a história de quem você ama",
      tituloFinalGospel: "Conte o que Deus fez na sua vida",
      nota: "A letra fica pronta na hora e é de graça. Você só paga se quiser a música completa.",
    },
    musica: {
      legenda: "Música real, feita neste site. Trecho de 45 segundos.",
      capa: (t) => `Capa da música ${t}`,
      tocar: (t) => `Tocar ${t}`,
      pausar: (t) => `Pausar ${t}`,
    },
    artigo: {
      caminho: "Caminho",
      inicio: "Início",
      blog: "Blog",
      atualizadoEm: "Atualizado em",
      minLeitura: "min de leitura",
      faq: "Perguntas frequentes",
      leiaTambem: "Leia também",
    },
    indice: {
      titulo: "Blog: ideias de presente com música | Serenata",
      descricao:
        "Ideias de presente que emocionam: como fazer uma música personalizada pra mãe, pai, namorada, avós, bodas, Natal e louvor, com exemplos reais pra ouvir.",
      h1: "Blog da Serenata",
      sub: "Ideias de presente que emocionam, com músicas de verdade pra ouvir.",
      grupos: [
        { grupo: "pessoa", titulo: "Para quem" },
        { grupo: "ocasiao", titulo: "Datas e ocasiões" },
        { grupo: "guia", titulo: "Como fazer" },
        // Por último: com a leva de 03/10 são 21 artigos, e no meio escondiam os outros.
        { grupo: "gospel", titulo: "Gospel" },
      ],
    },
  },
};
