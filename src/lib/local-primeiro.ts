// TESTE `local_primeiro` (Ballad, 31/10): o pagamento local na frente do cartão,
// na Colômbia e no Peru.
//
// De 29/10 a 31/10, na Colômbia 12 pessoas abriram a folha, nenhum cartão
// colombiano foi tentado e 9 não fizeram nada: a tela que elas veem é o cartão do
// Stripe, com Nequi e PSE num botão acima. Na página da dLocal, ainda por cima, o
// dinheiro em espécie vem primeiro, o Nequi fica no fim de uma lista de bancos e o
// Yape é a 3ª opção.
//
//   A = como é hoje: o cartão na tela e o botão "¿Sin tarjeta?".
//   B = a pessoa escolhe antes de ver o cartão: o método local primeiro, dinheiro
//       e cartão abaixo. A cobrança nasce só com o escolhido (`payment_type`).
//       Conferido em 31/10 com cobranças de teste: na Colômbia BANK_TRANSFER
//       mostra só a lista com PSE e Nequi, e VOUCHER só o dinheiro; no Peru VOUCHER
//       mostra dinheiro e Yape, BANK_TRANSFER só os bancos. Tipo que a dLocal não
//       conhece (WALLET, YAPE) não dá erro: abre TODOS os métodos, inclusive cartão.
//
// O Chile fica de fora: lá o cartão passa (3 de 5) e vendeu. Ler por PAGO ÷
// `local_primeiro_exposto` por braço. Age depois do clique: está no `POS_COMPRA`.

import type { MetodoDlocal } from "@/lib/spei-destaque";

export const EXP_LOCAL_PRIMEIRO = "local_primeiro";

export type PaisLocalPrimeiro = "CO" | "PE";

/** O B só existe na Colômbia e no Peru. Pela inicial, como os outros testes. */
export function localPrimeiroLigado(variante: string | null | undefined, pais: string | null | undefined): boolean {
  const p = String(pais ?? "").trim().toUpperCase();
  return (p === "CO" || p === "PE") && String(variante ?? "").trim().toUpperCase().startsWith("B");
}

type Opcao = { metodo: MetodoDlocal; rotulo: string; sub: string; como: string };

export const TEXTO_LOCAL_PRIMEIRO: Record<
  PaisLocalPrimeiro,
  { titulo: string; principal: Opcao; outra: Opcao; cartao: string; selo: string }
> = {
  CO: {
    titulo: "¿Cómo quieres pagar?",
    selo: "Recomendado",
    principal: {
      metodo: "transferencia",
      rotulo: "Nequi o PSE",
      sub: "Desde tu app o tu banco. Tu canción llega en cuanto se confirme.",
      como: "Al continuar se abre el pago seguro: elige Nequi o tu banco en la lista. Tu canción completa llega a tu correo en cuanto se confirme el pago.",
    },
    outra: {
      metodo: "oxxo",
      rotulo: "Efectivo",
      sub: "Efecty y otros puntos. Recibes un código para pagar en el punto.",
      como: "Al continuar recibes tu código para pagarlo en efectivo en Efecty y otros puntos. Tu canción completa llega a tu correo en cuanto se confirme el pago.",
    },
    cartao: "Pagar con tarjeta",
  },
  PE: {
    titulo: "¿Cómo quieres pagar?",
    selo: "Recomendado",
    principal: {
      metodo: "oxxo",
      rotulo: "Yape",
      sub: "Desde tu app. Tu canción llega en cuanto se confirme.",
      como: "Al continuar se abre el pago seguro: elige Yape en la siguiente pantalla (también puedes pagar en efectivo). Tu canción completa llega a tu correo en cuanto se confirme el pago.",
    },
    outra: {
      metodo: "transferencia",
      rotulo: "Transferencia bancaria",
      sub: "Desde la app de tu banco.",
      como: "Al continuar se abre el pago seguro: elige tu banco en la lista. Tu canción completa llega a tu correo en cuanto se confirme el pago.",
    },
    cartao: "Pagar con tarjeta",
  },
};
