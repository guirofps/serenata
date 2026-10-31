// TESTE `spei_destaque` (Ballad, 30/10): a transferência (SPEI) na frente do
// OXXO, no México.
//
// Desde 23/10, 19 pagamentos pela dLocal Go: 10 por transferência, pagos de 0 a
// 54 minutos depois de abrir a cobrança, e 9 no OXXO, de 13 a 74 horas depois.
// O OXXO depende de a pessoa sair de casa e ir à loja; muitas não vão (68
// cobranças pendentes no mesmo período). A escolha entre os dois acontecia na
// página da dLocal, onde o OXXO aparecia como a opção principal do nosso texto.
//
//   A = como é hoje: "¿Sin tarjeta? Paga en efectivo en OXXO o con
//       transferencia" e a página da dLocal com os dois métodos.
//   B = a transferência primeiro, nas nossas palavras ("se confirma en
//       minutos"), e a pessoa ESCOLHE na nossa folha: transferência ou OXXO.
//       A cobrança já nasce só com o método escolhido (`payment_type` da
//       dLocal; conferido em 30/10 com cobrança de teste: só "Transferencia
//       bancaria" na página deles).
//
// Só no México (o `data-pais` carimbado pelo servidor) e só pra quem vê o botão
// da dLocal (`oxxo_mx` no B). Ler por PAGO ÷ QUEM ABRIU A FOLHA DO CARTÃO
// (`spei_destaque_exposto`), por braço, e o tempo até pagar. Age depois do
// clique: está no `POS_COMPRA` do `vigiaExperimento`.

export const EXP_SPEI_DESTAQUE = "spei_destaque";

export type MetodoDlocal = "transferencia" | "oxxo";

/** O B só existe no México. Pela inicial, como os outros testes. */
export function speiDestaqueLigado(variante: string | null | undefined, pais: string | null | undefined): boolean {
  return (
    String(pais ?? "").trim().toUpperCase() === "MX" &&
    String(variante ?? "").trim().toUpperCase().startsWith("B")
  );
}

/**
 * O que vai no `payment_type` da dLocal. Sem escolha, os dois de sempre. A escolha
 * vale no México (`spei_destaque`) e na Colômbia e no Peru (`local_primeiro`), onde
 * "oxxo" é o VOUCHER: dinheiro na Colômbia, dinheiro e Yape no Peru.
 */
export function tipoPagamentoDlocal(pais: string, metodo: unknown): string {
  if (pais === "MX" || pais === "CO" || pais === "PE") {
    if (metodo === "transferencia") return "BANK_TRANSFER";
    if (metodo === "oxxo") return "VOUCHER";
  }
  return "VOUCHER,BANK_TRANSFER";
}

/** Só os dois valores conhecidos passam; o resto vira "sem escolha". */
export function metodoDlocalValido(metodo: unknown): MetodoDlocal | undefined {
  return metodo === "transferencia" || metodo === "oxxo" ? metodo : undefined;
}

export const TEXTO_SPEI_DESTAQUE = {
  botao: "¿Sin tarjeta? Paga con transferencia (SPEI) o en OXXO",
  titulo: "¿Cómo quieres pagar?",
  transferencia: "Transferencia bancaria (SPEI)",
  transferenciaSub: "Desde la app de tu banco. Se confirma en minutos y tu canción llega al momento.",
  rapido: "Más rápido",
  oxxo: "Efectivo en OXXO",
  oxxoSub: "Recibes una ficha y pagas en la tienda (vale 3 días). Tu canción llega cuando se confirme el pago.",
  comoTransferencia:
    "Al continuar se abre el pago seguro con los datos para transferir desde la app de tu banco. Tu canción completa llega a tu correo en cuanto se confirme, normalmente en minutos.",
  comoOxxo:
    "Al continuar recibes tu ficha para pagarla en efectivo en cualquier OXXO (vale 3 días). Tu canción completa llega a tu correo en cuanto se confirme el pago.",
  trocar: "Cambiar método",
} as const;
