// O TEMA DO FUNIL (02/10/2026). Hoje só existe um: "gospel".
//
// Entra pela URL (`/criar?t=gospel`, a porta dos anúncios gospel) e fica em
// dois lugares: `respostas.tema` (o quiz troca a URL a cada passo e o `t`
// some; nas respostas ele chega também ao prompt da letra) e
// `attribution.tema` (é de onde o painel lê). Desenho em
// `docs/superpowers/specs/2026-10-02-criar-gospel-design.md`.

export type Tema = "gospel";

export function temaDoParametro(valor: string | null | undefined): Tema | null {
  return String(valor ?? "").trim().toLowerCase() === "gospel" ? "gospel" : null;
}

/**
 * Os idiomas que têm tema. O português (Serenata) desde 02/10; o inglês (a
 * porta cristã da Ballad, `balladgift.com/criar?t=gospel`) desde 03/10. O
 * espanhol não tem: lá o `?t=` é ignorado.
 */
export function idiomaTemTema(locale: string): boolean {
  return locale === "pt" || locale === "en";
}

/** URL > respostas salvas > nada. Só os idiomas de `idiomaTemTema` têm tema. */
export function temaEfetivo(
  daUrl: Tema | null,
  respostas: Record<string, unknown>,
  locale: string,
): Tema | null {
  if (!idiomaTemTema(locale)) return null;
  if (daUrl) return daUrl;
  return respostas.tema === "gospel" ? "gospel" : null;
}

export function comTema(attr: Record<string, unknown>, tema: Tema): Record<string, unknown> {
  return { ...attr, tema };
}

/**
 * Grava o tema na atribuição guardada. Mesmo formato de `carimbarExperimentos`:
 * um stub sem toque capturado é mesclado por `captureFirstTouchAttribution`,
 * então o tema sobrevive à captura do first-touch.
 */
export function carimbarTema(tema: Tema): void {
  if (typeof window === "undefined") return;
  try {
    const cru = localStorage.getItem("mp_attribution");
    const atual = cru ? (JSON.parse(cru) as Record<string, unknown>) : {};
    if (atual.tema === tema) return;
    localStorage.setItem(
      "mp_attribution",
      JSON.stringify(
        comTema({ ...atual, captured_at: atual.captured_at ?? new Date().toISOString() }, tema),
      ),
    );
  } catch {
    // Modo anônimo: o tema ainda vale na tela, só não é medido.
  }
}
