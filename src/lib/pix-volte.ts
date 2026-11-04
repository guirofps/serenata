// TESTE `pix_volte` (Serenata, funil pt): na tela do QR do PIX, avisar EM
// DESTAQUE que a música abre ali depois de pagar e que chega no e-mail.
//
// ── POR QUE (04/11) ──────────────────────────────────────────────
//
// O assunto número um do suporte é "paguei e não recebi", e quase sempre a
// pessoa RECEBEU: o e-mail de entrega saiu e foi entregue (9 de 9 casos de
// 02 a 04/11). O gesto real é copiar o código, ir pro app do banco e nunca
// mais voltar à aba. A Teresinha (04/11) pagou às 6h50, não voltou ao site nem
// abriu o e-mail, e abriu um MED às 7h15.
//
// A frase "Assim que o banco confirmar, a sua música abre sozinha aqui" JÁ
// existe, mas pequena, no fim da tela, DEPOIS do botão de copiar: quem copia
// sai pro banco antes de ler.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = como é hoje.
//   B = logo abaixo do botão de copiar, uma caixa: "Depois de pagar, volte
//       para esta tela: a sua música abre aqui." e o e-mail onde ela também
//       chega, escrito por extenso (é a tela da própria pessoa).
//
// Ler por: MED/contestação e e-mail de suporte "não recebi" por comprador,
// e PAGO ÷ PIX GERADO (não pode cair). Diagnóstico: `pix_volte_exposto`
// (braco), `pix_transparente_pago` com `segundos` (quem esperou na tela).
// Age depois do clique: está no `POS_COMPRA` do `vigiaExperimento`.

export const EXP_PIX_VOLTE = "pix_volte";

/** O braço B vale aqui? Só no funil pt (o PIX só existe nele). Pela inicial. */
export function pixVolteLigado(variante: string | null | undefined, locale: string): boolean {
  if (locale !== "pt") return false;
  return String(variante ?? "").trim().toUpperCase().startsWith("B");
}

/** O e-mail que vai na caixa, ou `null` se não parece um e-mail (aí a caixa sai sem ele). */
export function emailDaCaixa(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
