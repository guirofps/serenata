// Identidade da SERENATA.
//
// Conceito: uma serenata é uma música cantada debaixo da janela de quem se
// ama — de noite, à mão, sem palco. Tudo na marca sai daí:
//   noite (fundo escuro e quente), luz de janela (âmbar), feito à mão
//   (serifada com contraste), intimidade (silêncio em volta do conteúdo).
//
// Não é "app de música" (frio, neon, techy). É presente afetivo.

export const MARCA = {
  nome: "Serenata",
  dominio: "serenatagift.com",
  // O que a marca promete, em uma linha.
  promessa: "Uma música feita da história de quem você ama",
} as const;

// ── Paleta ────────────────────────────────────────────────────────
// DOIS mundos, de propósito — e a passagem de um pro outro é a narrativa:
//
//   CLARO (landing, quiz): papel quente. É onde a pessoa decide, compara,
//   entende. Escuro no site inteiro dava cara de app de balada, não de
//   presente afetivo.
//
//   ESCURO (página-presente, reveal): a noite da serenata. É o momento
//   íntimo, o "abrir do presente". O contraste faz ele parecer outro lugar.
//
// O âmbar atravessa os dois — é a luz da janela, o único acento.
export const CORES = {
  // claro
  papel: "#fbf7f0", // fundo principal claro (creme quente, não branco)
  papelFundo: "#f3ece1", // superfícies e seções alternadas
  tinta: "#20180f", // texto principal sobre claro
  tintaSuave: "rgba(32,24,15,0.62)", // texto secundário
  tintaFraca: "rgba(32,24,15,0.28)", // linhas, terciário

  // escuro (presente)
  noite: "#0d0a08", // preto quente, não puro
  noiteSuave: "#161110",
  creme: "#f5efe6",
  bruma: "rgba(245,239,230,0.55)",
  sussurro: "rgba(245,239,230,0.25)",

  // acento comum aos dois
  ambar: "oklch(0.72 0.14 62)", // no claro precisa de mais peso pra contrastar
  ambarLuz: "oklch(0.84 0.13 78)", // no escuro, mais luminoso
} as const;

// ── Tipografia ────────────────────────────────────────────────────
// Fraunces: serifada com "wonk", tem calor e imperfeição — parece escrita
// por gente, não gerada. Inter para interface, que some e deixa ler.
export const FONTES = {
  display: "'Fraunces', ui-serif, Georgia, serif",
  texto: "'Inter', ui-sans-serif, system-ui, sans-serif",
  googleFonts:
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap",
} as const;

// Variáveis do mundo CLARO (landing, quiz).
export const TEMA_CLARO: React.CSSProperties = {
  ["--papel" as string]: CORES.papel,
  ["--papel-fundo" as string]: CORES.papelFundo,
  ["--tinta" as string]: CORES.tinta,
  ["--tinta-suave" as string]: CORES.tintaSuave,
  ["--tinta-fraca" as string]: CORES.tintaFraca,
  ["--ambar" as string]: CORES.ambar,
  fontFamily: FONTES.texto,
};

// Variáveis do mundo ESCURO (página-presente, reveal).
export const TEMA_ESCURO: React.CSSProperties = {
  ["--noite" as string]: CORES.noite,
  ["--noite-suave" as string]: CORES.noiteSuave,
  ["--creme" as string]: CORES.creme,
  ["--bruma" as string]: CORES.bruma,
  ["--sussurro" as string]: CORES.sussurro,
  ["--ambar" as string]: CORES.ambarLuz,
  fontFamily: FONTES.texto,
};
