// OS EXEMPLOS EM ESPANHOL DA BALLAD GIFT (hispanos dos EUA, `/es`).
//
// A mesma regra de `exemplos-en.ts`: NADA aqui é escrito pra ilustrar. Cada
// exemplo é uma música gerada pelo PRÓPRIO funil da Ballad em espanhol (quiz
// sintético → `systemDaLetra("es")`, que na Ballad é o prompt dos hispanos dos
// EUA → job real do Inngest da Ballad → Suno), e título, versos e token são
// copiados do que saiu. O script é `scratch/ballad-exemplos-es.mts`: ele roda
// a geração e IMPRIME os objetos prontos pra colar aqui.
//
// ── POR QUE A LISTA NASCE VAZIA ──────────────────────────────────
//
// Os exemplos espanhóis que existem são da SERENATA: áudio no bucket do banco
// dela, página `/p/<token>` que só resolve no banco dela. Na Ballad (outro
// banco) o token dá 404 e o áudio aponta pra outro projeto. Até o script rodar,
// toda seção que mostra exemplo em espanhol na Ballad SOME em vez de quebrar:
// a espera (`OuvirEnquantoEspera`), a vitrine da home (`ExemplosEs`) e os links
// "abrir um regalo de exemplo" (`ProQuemE`, `Entregavel`).
//
// As capas, quando existirem, vão em `public/ballad/exemplos/<slug>.webp`
// (retratos gerados, pessoas que não existem), como as do inglês.

import { audioDoExemplo as audioDoBucket } from "./exemplos-en.js";

export type ExemploEsUs = {
  slug: string;
  relacao: string;
  /** Como é chamado na música (o que o quiz canta). */
  nome: string;
  /** Título da música, como saiu da geração. */
  titulo: string;
  /** "para su esposa", visto por quem compra. */
  para: string;
  /** O rótulo do gênero, como o seletor mostra. */
  genero: string;
  /** Token da página-presente de exemplo no banco DA BALLAD. */
  token: string;
  /** Retrato de capa em `public/ballad/exemplos/`. */
  capa: string;
  /** Primeiros versos da letra gerada, literais. */
  versos: string[];
};

// Gerados em 09/10 pelo funil da Ballad (`scratch/ballad-exemplos-es.mts`), capas
// geradas (pessoas que não existem) em `public/ballad/exemplos/`.
export const EXEMPLOS_ES_US: ExemploEsUs[] = [
  {
    slug: "es-us-esposa",
    relacao: "esposa",
    nome: "Marisol",
    titulo: "Cara de Hambre",
    para: "para su esposa",
    genero: "Mariachi",
    token: "exesusesposa48529d9652",
    capa: "/ballad/exemplos/es-us-esposa.webp",
    versos: [
      "Marisol, esto es para ti.",
      "En la kermés de Boyle Heights te vi primero,",
      "detrás del comal, vendiendo con tu tía,",
      "me diste un tamal de rajas de más,"
    ]
  },
  {
    slug: "es-us-mama",
    relacao: "mae",
    nome: "Mamá",
    titulo: "La Lata de Galletas Danesas",
    para: "para su mamá",
    genero: "Bolero",
    token: "exesusmama128c082fd7",
    capa: "/ballad/exemplos/es-us-mama.webp",
    versos: [
      "Mamá, esto es para ti,",
      "antes de que cuelgues el teléfono.",
      "Dos maletas y tres hijos,",
      "cruzaste el norte sin mirar atrás."
    ]
  },
  {
    slug: "es-us-esposo",
    relacao: "marido",
    nome: "Beto",
    titulo: "Quince Años y Me Abres la Puerta",
    para: "para su esposo",
    genero: "Norteño",
    token: "exesusesposo3f223f1d91",
    capa: "/ballad/exemplos/es-us-esposo.webp",
    versos: [
      "Beto, quince años cumplidos,",
      "y sigo aquí, agradecida.",
      "En un baile en Houston te vi por primera vez,",
      "no sabías nada de cumbia pero no te diste por vencido,"
    ]
  },
  {
    slug: "es-us-hija",
    relacao: "filha",
    nome: "Valeria",
    titulo: "Vale, Mis Lucecitas",
    para: "para su hija",
    genero: "Pop latino",
    token: "exesushija73f1d8e8cf",
    capa: "/ballad/exemplos/es-us-hija.webp",
    versos: [
      "Vale, hoy es tu fiesta, mi niña,",
      "quince años de puro vuelo.",
      "Naciste en San Antonio, en medio de una tormenta,",
      "el cielo se encendió, llegaste tan contenta."
    ]
  },
  {
    slug: "es-us-novia",
    relacao: "namorada",
    nome: "Yesenia",
    titulo: "En Cada Vuelta Te Escojo",
    para: "para su novia",
    genero: "Bachata",
    token: "exesusnoviab3f70a601b",
    capa: "/ballad/exemplos/es-us-novia.webp",
    versos: [
      "Yesenia, esta es para ti,",
      "cinco años después del tren 1.",
      "Fue en el tren 1, rumbo al Bronx una mañana,",
      "se te cayó el café encima de mis tenis nuevos,"
    ]
  },
  {
    slug: "es-us-abuela",
    relacao: "avo_f",
    nome: "Abuelita Chela",
    titulo: "La Cruz Que Me Dejaste",
    para: "para su abuela",
    genero: "Música cristiana",
    token: "exesusabuela127759a5b8",
    capa: "/ballad/exemplos/es-us-abuela.webp",
    versos: [
      "Chela, hoy te canto bajito,",
      "como tú me enseñaste a rezar.",
      "Llegaste a Phoenix en los años setenta,",
      "con siete hijos y un nombre por cuidar."
    ]
  }
];

/** Só os exemplos que já foram gerados de verdade (com título e token). */
export function exemplosEsUsProntos(): ExemploEsUs[] {
  return EXEMPLOS_ES_US.filter((e) => e.titulo && e.token);
}

export function exemploEsUs(slug: string): ExemploEsUs | undefined {
  return exemplosEsUsProntos().find((e) => e.slug === slug);
}

/** O trecho de 45s no bucket público `exemplos` do banco DESTE deploy. */
export function audioDoExemploEsUs(slug: string): string {
  return audioDoBucket(slug);
}
