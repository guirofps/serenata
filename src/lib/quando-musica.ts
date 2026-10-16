import type { Locale } from "@/lib/i18n";

// A DATA NO CARD DE CADA MÚSICA do painel do comprador (`dashboard.tsx`).
//
// Duas músicas da mesma pessoa costumam ter o MESMO título (é o título da
// canção, não do arquivo): quando ela pede um ajuste na letra, a nova nasce
// com o nome da antiga. Sem a data no card não dá pra saber qual é qual.
//
// O formato segue o PAÍS de quem lê, não só a língua (16/10). Até aqui o
// espanhol caía no formato e no fuso do Brasil, e o hispano da Ballad via a
// hora de São Paulo. Nos EUA vale o fuso do próprio aparelho (o país tem seis;
// a lista só aparece no navegador, depois da sessão, então não há SSR pra
// divergir): o inglês sai "10/03, 3:00 PM" e o espanhol "03/10, 3:00 p.m."
// (o `es-US` do Intl põe o dia antes do mês, com relógio de 12 horas). O
// espanhol da Serenata é argentino: `es-AR`, fuso do aparelho também.

const BR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const EUA_EN = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});
const EUA_ES = new Intl.DateTimeFormat("es-US", {
  day: "2-digit",
  month: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});
const AR = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** O formatador da data do card, pelo idioma da música e pela marca do deploy. */
export function formatoDoQuando(locale: Locale, ballad: boolean): Intl.DateTimeFormat {
  if (locale === "en") return EUA_EN;
  if (locale === "es") return ballad ? EUA_ES : AR;
  return BR;
}
