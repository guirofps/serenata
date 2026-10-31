// TESTE `documento_depois` (Ballad, 31/10): o CURP sai da nossa folha, no México.
//
// Desde 29/10 o documento é pedido na NOSSA folha, antes de abrir a dLocal
// (`documento-pais.ts`). De 29/10 12h a 31/10, 29 de 51 pessoas que escolheram
// pagar sem cartão não passaram dessa tela, e 25 de 59 nem tentaram digitar.
// Quem digitou errado quase sempre corrigiu (6 de 8): o que pode estar pesando é
// a pessoa não ter o CURP de cor, não a nossa conferência.
//
//   A = como é hoje: nome e CURP na nossa folha, conferidos na hora.
//   B = sem o campo: toca em pagar sem cartão e já abre a página da dLocal, que
//       pede nome e documento só depois de a pessoa escolher o método (conferido
//       em 31/10 com cobrança de teste, sem `document` no `payer`).
//
// O risco do B é o motivo de o campo existir: lá a pessoa digitava "ife" ou o RFC
// sem homoclave e a ficha voltava "Documento inválido". Por isso é teste. Ler por
// PAGO ÷ `documento_depois_exposto` por braço, e olhar as cobranças que ficam
// `PENDING` sem método. Age depois do clique: está no `POS_COMPRA` do `vigiaExperimento`.

export const EXP_DOCUMENTO_DEPOIS = "documento_depois";

/** O B só existe no México. Pela inicial, como os outros testes. */
export function documentoDepoisLigado(variante: string | null | undefined, pais: string | null | undefined): boolean {
  return (
    String(pais ?? "").trim().toUpperCase() === "MX" &&
    String(variante ?? "").trim().toUpperCase().startsWith("B")
  );
}
