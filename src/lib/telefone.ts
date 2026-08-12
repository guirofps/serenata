import type { Locale } from "@/lib/i18n";

// Telefone nos dois funis. Não existia máscara em lugar nenhum do projeto (nem
// nos dois repositórios herdados), e o campo do WhatsApp é o primeiro lugar em
// que a pessoa digita número por vontade própria.
//
// O DDI vem do IDIOMA e não de detecção: o funil português vende no Brasil e o
// espanhol no México. Chutar por IP é o erro que o CLAUDE.md já proíbe pra
// rota, e aqui teria a mesma consequência (número gravado com o país errado
// vira contato que nunca chega).

const PAIS: Record<Locale, { ddi: string; digitos: number[]; exemplo: string }> = {
  // 11 dígitos (celular com o 9) ou 10 (fixo, que ainda aparece).
  pt: { ddi: "55", digitos: [10, 11], exemplo: "(11) 91234-5678" },
  // México: 10 dígitos, sempre. O "1" depois do 52 é coisa de discagem
  // internacional antiga e o WhatsApp não usa mais.
  es: { ddi: "52", digitos: [10], exemplo: "55 1234 5678" },
};

export function exemploTelefone(locale: Locale): string {
  return (PAIS[locale] ?? PAIS.pt).exemplo;
}

/** Só os dígitos, já sem o DDI se a pessoa tiver digitado ele. */
function limpar(valor: string, locale: Locale): string {
  const p = PAIS[locale] ?? PAIS.pt;
  let so = valor.replace(/\D/g, "");
  const max = Math.max(...p.digitos);
  // Quem digita "+55 11 9..." não pode ver o 55 virar DDD.
  if (so.length > max && so.startsWith(p.ddi)) so = so.slice(p.ddi.length);
  return so.slice(0, max);
}

/** O que aparece no campo enquanto digita. */
export function mascaraTelefone(valor: string, locale: Locale): string {
  const so = limpar(valor, locale);
  if (locale === "es") {
    // 55 1234 5678
    return so.replace(/^(\d{2})(\d{0,4})(\d{0,4}).*$/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" "),
    );
  }
  // (11) 91234-5678 — o hífen entra antes dos 4 últimos, seja 10 ou 11 dígitos.
  if (so.length <= 2) return so.length ? `(${so}` : "";
  const ddd = so.slice(0, 2);
  const resto = so.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export function telefoneValido(valor: string, locale: Locale): boolean {
  const p = PAIS[locale] ?? PAIS.pt;
  const so = limpar(valor, locale);
  if (!p.digitos.includes(so.length)) return false;
  // DDD brasileiro vai de 11 a 99: nenhum tem 0 em qualquer das duas casas.
  // (Escrevi "não começa com 1" na primeira versão e o teste pegou na hora:
  // recusava TODO número de São Paulo.) No México o indicativo também não
  // começa com 0.
  if (locale === "es" ? /^0/.test(so) : /^[1-9][1-9]/.test(so) === false) return false;
  // Número de um dígito só repetido é o que sai quando alguém quer se livrar
  // do campo. Aceitar isso é encher a lista do operador de lixo.
  if (/^(\d)\1+$/.test(so)) return false;
  return true;
}

/** Formato que o wa.me exige: dígitos com DDI na frente, sem + nem espaço. */
export function paraE164(valor: string, locale: Locale): string {
  const p = PAIS[locale] ?? PAIS.pt;
  return p.ddi + limpar(valor, locale);
}
