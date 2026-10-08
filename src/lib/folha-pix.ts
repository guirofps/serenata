// TESTE `folha_pix` (08/10/2026): a folha do PIX com o CPF dentro.
//
// ── O QUE O NÚMERO MOSTROU ───────────────────────────────────────
//
// Produção, 7 dias, celular: 6.368 pessoas abriram a folha do PIX, só 47%
// tocaram em "Gerar meu PIX", e TODAS essas caíram numa segunda tela pedindo
// o CPF (o Asaas exige). 22% desistiram ali, umas 96 por dia. E 44% de quem
// não tocou saiu em menos de 5s sem rolar: bateu num resumo comprido.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = a folha de hoje: resumo -> "Gerar meu PIX" -> tela do CPF -> QR.
//   B = o CPF no próprio resumo, colado no botão. Um toque gera o PIX.
//   C = B com o resumo enxuto: título, preço, CPF e um botão grande com o
//       valor. A lista do que vem fica atrás de "O que eu recebo?".
//
// ── POR QUE O BRAÇO É LIDO PELA LETRA INICIAL ────────────────────
//
// Mesma lição do `bump_quadro` (31/08): renomear a variante (`B` -> `B2`) é o
// único jeito de desgrudar quem já foi sorteado, e com `=== "B"` cravado o
// rename desligaria o braço EM SILÊNCIO. Lendo pela inicial, `B2` continua
// sendo o B. Qualquer outra coisa (`A`, `fora`, vazio, nome desconhecido) é
// o controle: na dúvida, a folha de sempre.
//
// ── O CPF GUARDADO ───────────────────────────────────────────────
//
// Só neste navegador, só os dígitos, só se fechar nos verificadores. Nunca
// vai pra evento, atribuição ou terceiro: a única saída dele é o `criarPix`,
// que já o recebia pela tela do CPF. Quem compra a segunda música (ou volta
// pelo e-mail de PIX abandonado) não digita de novo.

import { cpfValido, soDigitosCpf } from "./cpf";

export const EXP_FOLHA_PIX = "folha_pix";

export type BracoFolha = "A" | "B" | "C";

/** A variante carimbada (`varianteDe`) traduzida pro braço que a tela entende. */
export function bracoDaFolha(variante: string | null | undefined): BracoFolha {
  const v = String(variante ?? "").trim().toUpperCase();
  if (v.startsWith("B")) return "B";
  if (v.startsWith("C")) return "C";
  return "A";
}

/** O CPF vai no próprio resumo? (B e C.) */
export function cpfNoResumo(braco: BracoFolha): boolean {
  return braco !== "A";
}

/** O texto do botão de pagar. Só o C leva o valor dentro. */
export function rotuloGerar(braco: BracoFolha, precoTexto: string): string {
  return braco === "C" ? `Gerar PIX de ${precoTexto}` : "Gerar meu PIX";
}

export const CHAVE_CPF = "mp_cpf";

type Guarda = Pick<Storage, "getItem" | "setItem">;

function guardaPadrao(): Guarda | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** O CPF que este navegador já usou, ou "" (nunca devolve número que não fecha). */
export function lerCpfGuardado(guarda: Guarda | null = guardaPadrao()): string {
  if (!guarda) return "";
  try {
    const d = soDigitosCpf(guarda.getItem(CHAVE_CPF));
    return cpfValido(d) ? d : "";
  } catch {
    // Modo anônimo, cota cheia: a pessoa só digita, como sempre.
    return "";
  }
}

/** Guarda só os dígitos, e só de CPF válido. Devolve se guardou. */
export function guardarCpf(cru: unknown, guarda: Guarda | null = guardaPadrao()): boolean {
  const d = soDigitosCpf(cru);
  if (!guarda || !cpfValido(d)) return false;
  try {
    guarda.setItem(CHAVE_CPF, d);
    return true;
  } catch {
    return false;
  }
}

/**
 * O que o campo do CPF diz embaixo dele.
 *
 * Só reclama de número com 11 dígitos que não fecha, ou quando a pessoa já
 * tocou em pagar: avisar "inválido" no terceiro dígito é reclamar de algo
 * que ela ainda está fazendo (mesma régua da `TelaCpf`).
 */
export function avisoDoCpf(cru: unknown, tentouPagar: boolean): string | null {
  const d = soDigitosCpf(cru);
  if (d.length === 11 && !cpfValido(d)) return "Esse CPF não confere. Confere os números?";
  if (tentouPagar && !cpfValido(d)) {
    return d.length ? "Faltam números no CPF." : "Falta o CPF pra gerar o PIX.";
  }
  return null;
}
