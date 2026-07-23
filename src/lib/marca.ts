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
// PALETA ESCOLHIDA: "papel e vinho" (23/07).
// Carta antiga, lacre de cera, coisa que se guarda numa gaveta. Romântico
// clássico sem ser piegas. O vinho é o acento; o dourado entra só como
// detalhe fino (fio, moldura), nunca como superfície.
export const CORES = {
  // claro — o site é papel
  papel: "#faf5ee", // creme quente, nunca branco puro
  papelFundo: "#f2e9dc", // seções alternadas, superfícies
  tinta: "#2a1518", // texto principal (quase preto, puxado pro vinho)
  tintaSuave: "rgba(42,21,24,0.62)",
  tintaFraca: "rgba(42,21,24,0.24)",

  // escuro — o presente é a noite da serenata
  noite: "#1a0f12", // preto avinhado, não neutro
  noiteSuave: "#251519",
  creme: "#f7f0e8",
  bruma: "rgba(247,240,232,0.5)",
  sussurro: "rgba(247,240,232,0.22)",

  // acentos
  vinho: "oklch(0.55 0.16 18)", // acento principal (botões, links, destaque)
  vinhoClaro: "oklch(0.63 0.15 18)", // hover
  vinhoFundo: "oklch(0.42 0.13 18)", // pressionado / bordas fortes
  ouro: "oklch(0.78 0.10 82)", // fio dourado: detalhe, nunca superfície
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

// Variáveis do mundo CLARO (landing, quiz) — o papel.
export const TEMA_CLARO: React.CSSProperties = {
  ["--papel" as string]: CORES.papel,
  ["--papel-fundo" as string]: CORES.papelFundo,
  ["--tinta" as string]: CORES.tinta,
  ["--tinta-suave" as string]: CORES.tintaSuave,
  ["--tinta-fraca" as string]: CORES.tintaFraca,
  ["--acento" as string]: CORES.vinho,
  ["--acento-hover" as string]: CORES.vinhoClaro,
  ["--ouro" as string]: CORES.ouro,
  fontFamily: FONTES.texto,
};

// Variáveis do mundo ESCURO (página-presente, reveal) — a noite.
export const TEMA_ESCURO: React.CSSProperties = {
  ["--noite" as string]: CORES.noite,
  ["--noite-suave" as string]: CORES.noiteSuave,
  ["--creme" as string]: CORES.creme,
  ["--bruma" as string]: CORES.bruma,
  ["--sussurro" as string]: CORES.sussurro,
  // No escuro o vinho some; o ouro assume como luz (é o que brilha na noite).
  ["--acento" as string]: CORES.ouro,
  ["--vinho" as string]: CORES.vinhoClaro,
  fontFamily: FONTES.texto,
};
