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
// Escuro quente, não preto puro: preto absoluto é frio e "tech".
// O âmbar é a luz da janela — o único acento, usado com parcimônia.
export const CORES = {
  noite: "#0d0a08", // fundo principal (preto quente)
  noiteSuave: "#161110", // superfícies elevadas
  ambar: "oklch(0.84 0.13 78)", // acento único (luz)
  ambarProfundo: "oklch(0.72 0.14 62)", // hover/pressão
  creme: "#f5efe6", // texto principal sobre escuro
  bruma: "rgba(245,239,230,0.55)", // texto secundário
  sussurro: "rgba(245,239,230,0.25)", // texto terciário / linhas
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

// Variáveis CSS injetadas na raiz das páginas com a marca.
export const CSS_VARS: React.CSSProperties = {
  ["--noite" as string]: CORES.noite,
  ["--noite-suave" as string]: CORES.noiteSuave,
  ["--ambar" as string]: CORES.ambar,
  ["--ambar-profundo" as string]: CORES.ambarProfundo,
  ["--creme" as string]: CORES.creme,
  ["--bruma" as string]: CORES.bruma,
  ["--sussurro" as string]: CORES.sussurro,
  fontFamily: FONTES.texto,
};
