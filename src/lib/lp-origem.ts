// DE QUAL LANDING VEIO (11/11/2026). As duas páginas de anúncio (`/presente` e
// `/tendencia`) mandam a pessoa pro mesmo `/criar`, e sem um carimbo o lead e a
// venda não sabem por qual delas passaram. O dono pediu os botões medidos por
// página e os cartões no painel (`admin-lps.ts`).
//
// O carimbo mora na atribuição (`mp_attribution`), como o braço dos testes e o
// tema: viaja em todo `funnel_event` e é copiado pra `quiz_responses.attribution`
// quando o lead nasce. Três campos:
//
//   lp        a landing ("presente" | "tendencia")
//   lp_botao  a posição do botão que levou ao /criar (barra, presente, final, menu)
//   lp_em     quando
//
// REGRA: a VISITA carimba só se ainda não há landing (quem passeia pelas duas
// fica na primeira); o CLIQUE no botão decide (é ele que manda a pessoa pro
// quiz, então a landing do botão clicado ganha).
//
// Não atrapalha o primeiro toque: `captureFirstTouchAttribution` junta as UTMs
// por cima de um toco que não tenha clique nem UTM, e o `lp` sobrevive.

export const LPS = [
  { id: "presente", caminho: "/presente", nome: "Landing /presente", eventoCta: "lp_presente_cta" },
  { id: "tendencia", caminho: "/tendencia", nome: "Matéria /tendencia", eventoCta: "materia_cta" },
] as const;

export type LpId = (typeof LPS)[number]["id"];

/** A landing gravada na atribuição, ou `null` (inclusive pra valor que não é landing). */
export function lpDe(attribution: unknown): LpId | null {
  const v = (attribution as { lp?: unknown } | null)?.lp;
  return LPS.some((l) => l.id === v) ? (v as LpId) : null;
}

/**
 * A atribuição com o carimbo, ou `null` se não há o que regravar. Pura.
 * `botao` vazio = só a visita; com `botao` = o clique que leva ao /criar.
 */
export function comLp(
  atual: Record<string, unknown> | null,
  lp: LpId,
  botao: string | undefined,
  agora: string,
): Record<string, unknown> | null {
  const base = atual ?? { captured_at: agora };
  if (!botao) {
    if (base.lp) return null;
    return { ...base, lp, lp_em: agora };
  }
  if (base.lp === lp && base.lp_botao === botao) return null;
  return { ...base, lp, lp_em: base.lp === lp && base.lp_em ? base.lp_em : agora, lp_botao: botao };
}

/** Grava o carimbo no navegador. Chamar ANTES do `trackEvent` do clique. */
export function carimbarLp(lp: LpId, botao?: string): void {
  if (typeof window === "undefined") return;
  try {
    const cru = localStorage.getItem("mp_attribution");
    const novo = comLp(cru ? (JSON.parse(cru) as Record<string, unknown>) : null, lp, botao, new Date().toISOString());
    if (novo) localStorage.setItem("mp_attribution", JSON.stringify(novo));
  } catch {
    // Modo anônimo: a página funciona, só não é medida.
  }
}
