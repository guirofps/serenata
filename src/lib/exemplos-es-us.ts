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

export const EXEMPLOS_ES_US: ExemploEsUs[] = [];

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
