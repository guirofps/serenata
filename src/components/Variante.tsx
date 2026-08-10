import type { ReactNode } from "react";

// UM PEDAÇO DE TELA QUE SÓ APARECE NA VARIANTE SORTEADA.
//
// As duas versões vão no HTML, e o CSS esconde a que não foi sorteada (ver
// `cssExperimentos`). Parece desperdício mandar as duas, e é: são alguns bytes
// a mais. O que se compra com eles é não ter piscada e não ter erro de
// hidratação numa página renderizada no servidor — e a tela que a pessoa vê no
// primeiro segundo é exatamente a que vai ser medida.
//
// Uso:
//
//   <Variante exp="abertura" v="A"><PerguntaDireta /></Variante>
//   <Variante exp="abertura" v="B"><ProvaAntes /><PerguntaDireta /></Variante>
//
// A primeira variante do experimento é o CONTROLE: é ela que aparece quando o
// JavaScript não roda.
//
// Cuidado que não é óbvio: o que está aqui dentro RENDERIZA nas duas
// variantes, mesmo escondido. Efeito colateral no corpo (disparar evento,
// tocar áudio, pedir câmera) acontece nos dois lados e suja a medição. Para
// diferença de COMPORTAMENTO, e não de conteúdo, use `varianteDe()` dentro do
// handler em vez deste componente.

export function Variante({
  exp,
  v,
  children,
}: {
  exp: string;
  v: string;
  children: ReactNode;
}) {
  return <div data-v={`${exp}:${v}`}>{children}</div>;
}
