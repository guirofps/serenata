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
  // Origem canônica, COM www: é o host que o site serve de verdade e o que
  // sai nos links enviados. Precisa ser absoluta porque o robô de prévia do
  // WhatsApp não resolve caminho relativo em og:image.
  url: "https://www.serenatagift.com",
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

// ── Cores de destaque da página-presente ──────────────────────────
// O comprador escolhe a cor dos elementos (play, letra que acende, barra).
// Presets, não seletor livre: todas afinadas pra BRILHAR sobre a noite
// (#0d0a08) e manter contraste com o texto escuro que fica em cima do botão
// de play. Luminância alta (0.78–0.86) de propósito.
// `nomeEs` porque o editor é usado pelo comprador mexicano, e "Âmbar" e "Céu"
// não são palavras em espanhol. As outras quatro se escrevem igual nos dois.
export const CORES_PRESENTE = [
  { chave: "ambar", nome: "Âmbar", nomeEs: "Ámbar", oklch: "oklch(0.84 0.13 78)" }, // padrão
  { chave: "rose", nome: "Rosé", nomeEs: "Rosé", oklch: "oklch(0.80 0.12 8)" },
  { chave: "coral", nome: "Coral", nomeEs: "Coral", oklch: "oklch(0.78 0.16 40)" },
  { chave: "lavanda", nome: "Lavanda", nomeEs: "Lavanda", oklch: "oklch(0.80 0.10 300)" },
  { chave: "ceu", nome: "Céu", nomeEs: "Cielo", oklch: "oklch(0.80 0.11 235)" },
  { chave: "menta", nome: "Menta", nomeEs: "Menta", oklch: "oklch(0.84 0.12 165)" },
] as const;

/** O nome da cor no idioma do presente. */
export function nomeCor(c: (typeof CORES_PRESENTE)[number], locale: string) {
  return locale === "es" ? c.nomeEs : c.nome;
}

export const COR_PRESENTE_PADRAO = CORES_PRESENTE[0].oklch;

// ── Tipografia ────────────────────────────────────────────────────
// Fraunces no DISPLAY: serifada com "wonk", tem calor e imperfeição, parece
// escrita por gente e não gerada. É ela que dá o ar de presente, não de app.
//
// Poppins no CORPO (decisão do dono, 02/08, trocando a Manrope): geométrica,
// redonda e muito legível em tela pequena, que é onde 99% do tráfego está. A
// dupla serifada+geométrica é clássica e as duas se distinguem bem, o que
// evita o texto corrido competir com o título.
export const FONTES = {
  display: "'Fraunces', ui-serif, Georgia, serif",
  texto: "'Poppins', ui-sans-serif, system-ui, sans-serif",
  googleFonts:
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Poppins:wght@400;500;600;700&display=swap",
} as const;

// ── Escala tipográfica fluida ─────────────────────────────────────
// clamp() em vez de 15 breakpoints (playbook Movify §3.2).
// Entrelinha: 1.1–1.2 em display, 1.5–1.65 em corpo.
export const TEXTO = {
  xs: "clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem)",
  sm: "clamp(0.875rem, 0.85rem + 0.15vw, 0.9375rem)",
  base: "clamp(1rem, 0.95rem + 0.25vw, 1.125rem)",
  lg: "clamp(1.125rem, 1.05rem + 0.35vw, 1.3125rem)",
  xl: "clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)",
  "2xl": "clamp(1.5rem, 1.3rem + 1vw, 2rem)",
  "3xl": "clamp(1.875rem, 1.5rem + 1.6vw, 2.75rem)",
  hero: "clamp(2.5rem, 1.8rem + 3.5vw, 5rem)",
} as const;

// ── Espaçamento entre seções ──────────────────────────────────────
// Ar é o que faz parecer caro, MAS no celular ar demais vira página
// interminável (a home estava com 10.000px de rolagem). Piso baixado de 3,5
// para 2,5rem: no mobile as seções encostam mais, no desktop nada muda.
export const SECAO = "clamp(2.5rem, 1.2rem + 6vw, 8rem)";

// ── Raio, sombra e tempo ──────────────────────────────────────────
// Medido no Lovepanda (24/07), que é a referência de acabamento: eles NÃO
// usam biblioteca de animação nenhuma — nem GSAP, nem Framer, nem AOS, e
// zero @keyframes ativo. O que faz parecer caro é sistema fechado:
//   um raio dominante (12px), sombras suaves em camadas,
//   transições CURTAS (0,15–0,3s) com a mesma curva em tudo.
//
// Ou seja: acabamento não vem de motion, vem de repetição disciplinada.
// Três valores de cada, e nada fora disso.
export const RAIO = {
  sm: "0.5rem", // 8px  — chips, tags
  md: "0.75rem", // 12px — o dominante: cartões, campos, caixas
  lg: "1.5rem", // 24px — blocos grandes
  pilula: "9999px", // botões e seletores
} as const;

// Sombras em CAMADAS (uma perto e dura, uma longe e suave). Sombra de uma
// camada só é o que dá aquela cara de caixa colada na página.
export const SOMBRA = {
  sutil: "0 1px 2px rgba(42,21,24,0.06)",
  media: "0 4px 6px -1px rgba(42,21,24,0.08), 0 2px 4px -2px rgba(42,21,24,0.06)",
  alta: "0 10px 15px -3px rgba(42,21,24,0.10), 0 4px 6px -4px rgba(42,21,24,0.08)",
  flutuante: "0 28px 50px -18px rgba(42,21,24,0.45)",
} as const;

// UMA curva pra tudo. Misturar easing é o que faz a interface parecer
// remendada.
export const CURVA = "cubic-bezier(0.4, 0, 0.2, 1)";
export const TEMPO = {
  toque: `0.15s ${CURVA}`, // hover, foco — tem que ser quase instantâneo
  troca: `0.3s ${CURVA}`, // troca de estado, entrada de elemento
  cena: `0.7s ${CURVA}`, // mudança grande de layout
} as const;

// Tokens de texto e espaço como variáveis CSS, pra usar em qualquer tema.
const ESCALA: React.CSSProperties = {
  ["--t-xs" as string]: TEXTO.xs,
  ["--t-sm" as string]: TEXTO.sm,
  ["--t-base" as string]: TEXTO.base,
  ["--t-lg" as string]: TEXTO.lg,
  ["--t-xl" as string]: TEXTO.xl,
  ["--t-2xl" as string]: TEXTO["2xl"],
  ["--t-3xl" as string]: TEXTO["3xl"],
  ["--t-hero" as string]: TEXTO.hero,
  ["--secao" as string]: SECAO,
  ["--raio-sm" as string]: RAIO.sm,
  ["--raio" as string]: RAIO.md,
  ["--raio-lg" as string]: RAIO.lg,
  ["--sombra-sutil" as string]: SOMBRA.sutil,
  ["--sombra" as string]: SOMBRA.media,
  ["--sombra-alta" as string]: SOMBRA.alta,
  ["--sombra-flutuante" as string]: SOMBRA.flutuante,
  ["--curva" as string]: CURVA,
  ["--t-toque" as string]: TEMPO.toque,
  ["--t-troca" as string]: TEMPO.troca,
  ["--t-cena" as string]: TEMPO.cena,
};

// Variáveis do mundo CLARO (landing, quiz) — o papel.
export const TEMA_CLARO: React.CSSProperties = {
  ...ESCALA,
  ["--papel" as string]: CORES.papel,
  ["--papel-fundo" as string]: CORES.papelFundo,
  ["--tinta" as string]: CORES.tinta,
  ["--tinta-suave" as string]: CORES.tintaSuave,
  ["--tinta-fraca" as string]: CORES.tintaFraca,
  // UMA cor de destaque só (playbook §3.4): o vinho é do CTA e de mais nada.
  ["--acento" as string]: CORES.vinho,
  ["--acento-hover" as string]: CORES.vinhoClaro,
  // O ouro NÃO entra em botão — só fio, moldura e o mundo escuro.
  ["--ouro" as string]: CORES.ouro,
  fontFamily: FONTES.texto,
};

// Variáveis do mundo ESCURO (página-presente, reveal) — a noite.
export const TEMA_ESCURO: React.CSSProperties = {
  ...ESCALA,
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
