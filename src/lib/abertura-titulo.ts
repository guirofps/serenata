import type { Locale } from "@/lib/i18n";
import { FAMILIAS } from "@/lib/prova-numeros";
import type { Tema } from "@/lib/tema";

// O TESTE `abertura_titulo` (Serenata, 23/10/2026).
//
// O título da primeira tela do /criar em seis versões. Só a frase muda: o
// subtítulo, o botão e o cartão da Isabela ficam iguais, pra que um braço que
// ganhe tenha ganhado pela frase. Cada braço é um ÂNGULO, não uma troca de
// palavra (com seis braços o tráfego se divide por seis, e só diferença grande
// aparece):
//
//   A  controle: "Uma música feita da história de quem você ama"
//   B  a reação: continua o anúncio, que mostra gente chorando
//   C  a exclusividade: o nome, que o cartão logo abaixo confirma ("Isabela")
//   D  a dor do presente comum (perfume, flor, bolsa que somem)
//   E  a visualização: a pessoa pensa na própria história
//   F  a prova social: o número REAL de `prova-numeros.ts`, o mesmo do bloco
//      de prova logo abaixo do botão
//
// ── O QUE MEDIR ──────────────────────────────────────────────────
//
// RECEITA POR SESSÃO, por braço (`attribution.exp.abertura_titulo`), entre as
// sessões pt sem tema que montaram a abertura (`quiz_step` step_id=abertura).
// Quem respondeu a 1ª pergunta é só sinal de saúde: o `abertura_pergunta`
// (08-11/10) subiu esse número 18% e empatou em lead e venda.
//
// ── SÓ PT, SÓ SEM TEMA, E POR CSS PRÓPRIO ────────────────────────
//
// O mesmo desenho do `abertura_pergunta`: as seis frases vêm no HTML, o A
// visível e as outras escondidas, e só o carimbo do braço no <html> troca qual
// aparece. Sem a linha no banco, sem teste ligado, `fora` ou sem JavaScript: A.

export const EXP_ABERTURA_TITULO = "abertura_titulo";

export const BRACOS_TITULO = ["A", "B", "C", "D", "E", "F"] as const;
export type BracoTitulo = (typeof BRACOS_TITULO)[number];

/** O título em três pedaços: o do meio é a palavra dourada (`texto-ouro`). */
export type Titulo = { antes: string; ouro: string; depois: string };

export const TITULOS: Record<BracoTitulo, Titulo> = {
  A: { antes: "Uma música feita da ", ouro: "história", depois: " de quem você ama" },
  B: { antes: "O presente que vai fazer quem você ama ", ouro: "chorar", depois: "" },
  C: { antes: "A única música do mundo com o ", ouro: "nome", depois: " dela" },
  D: { antes: "O presente que não vai parar no fundo da ", ouro: "gaveta", depois: "" },
  E: { antes: "Imagine a ", ouro: "história", depois: " de vocês virando música" },
  F: { antes: "Mais de ", ouro: `${FAMILIAS.replace("+", "")} famílias`, depois: " já deram esse presente" },
};

/** Pt, fora do gospel. Os outros funis não recebem nada. */
export function aberturaTituloVale(locale: Locale, tema: Tema | null | undefined): boolean {
  return locale === "pt" && !tema;
}

/**
 * O CSS dos braços. Sem aspas, `<` nem `&` de propósito: entra num `<style>`
 * inline, e o valor do atributo sem aspas é seletor válido.
 */
export function cssAberturaTitulo(): string {
  const regras = BRACOS_TITULO.slice(1).map((b) => {
    const sel = `html[data-exp-${EXP_ABERTURA_TITULO}=${b}]`;
    return `${sel} .abt-A{display:none}${sel} .abt-${b}{display:inline}`;
  });
  return `.abt-v{display:none}${regras.join("")}`;
}
