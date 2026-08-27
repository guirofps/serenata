import type { Locale } from "@/lib/i18n";
import { mercadoEs, type MercadoEs } from "@/lib/mercado-es";

// Telefone nos dois funis. Não existia máscara em lugar nenhum do projeto (nem
// nos dois repositórios herdados), e o campo do WhatsApp é o primeiro lugar em
// que a pessoa digita número por vontade própria.
//
// O DDI vem do IDIOMA e não de detecção: o funil português vende no Brasil e o
// espanhol no México. Chutar por IP é o erro que o CLAUDE.md já proíbe pra
// rota, e aqui teria a mesma consequência (número gravado com o país errado
// vira contato que nunca chega).

type Pais = {
  ddi: string;
  digitos: number[];
  exemplo: string;
  /**
   * O que entra ENTRE o DDI e o número no link do WhatsApp.
   *
   * Só a Argentina tem: lá o celular é `54 9 11 ...` e o `wa.me` sem o 9
   * simplesmente não abre conversa nenhuma. Não é detalhe de formatação, é a
   * diferença entre ter o contato e ter uma string inútil no banco.
   */
  movel?: string;
};

const BR: Pais = { ddi: "55", digitos: [10, 11], exemplo: "(11) 91234-5678" };

// ── O ESPANHOL SEGUE O MERCADO ────────────────────────────────────
//
// Isto estava CRAVADO no México (`ddi: "52"`, exemplo de Cidade do México) de
// quando o alvo era o México. Com a campanha na Argentina, todo WhatsApp
// deixado no funil era gravado com o DDI errado — contato que nunca chega, e
// dado de país que mente em qualquer relatório que alguém tente ler depois.
//
// É o quinto lugar que o interruptor de `mercado-es.ts` precisa alcançar, e
// era o único que ninguém tinha notado porque o campo aceita e a máscara
// formata: falha em silêncio, do jeito mais caro.
const ES_POR_MERCADO: Record<MercadoEs, Pais> = {
  // Argentina: 10 dígitos nacionais (código de área + número), DDI 54, e o 9
  // do celular no link.
  argentina: { ddi: "54", movel: "9", digitos: [10], exemplo: "11 1234-5678" },
  // Espanha: 9 dígitos, sem código de área separado. Móvel começa em 6 ou 7.
  espanha: { ddi: "34", digitos: [9], exemplo: "612 34 56 78" },
  // México: 10 dígitos, sempre. O "1" depois do 52 é coisa de discagem
  // internacional antiga e o WhatsApp não usa mais.
  latam: { ddi: "52", digitos: [10], exemplo: "55 1234 5678" },
};

function paisDe(locale: Locale): Pais {
  if (locale === "es") return ES_POR_MERCADO[mercadoEs()] ?? ES_POR_MERCADO.latam;
  return BR;
}

export function exemploTelefone(locale: Locale): string {
  return paisDe(locale).exemplo;
}

/** Só os dígitos, já sem o DDI se a pessoa tiver digitado ele. */
function limpar(valor: string, locale: Locale): string {
  const p = paisDe(locale);
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
    // A MÁSCARA SEGUE O MERCADO, igual ao resto.
    //
    // Espanha são 9 dígitos em 3+3+3 ("612 345 678"); México e Argentina são
    // 10, mas o argentino lê o próprio celular com hífen antes dos quatro
    // últimos ("11 1234-5678"), do mesmo jeito que o brasileiro.
    const m = mercadoEs();
    if (m === "espanha") {
      return so.replace(/^(\d{3})(\d{0,3})(\d{0,3}).*$/, (_, a, b, c) =>
        [a, b, c].filter(Boolean).join(" "),
      );
    }
    if (m === "argentina") {
      if (so.length <= 2) return so;
      const area = so.slice(0, 2);
      const resto = so.slice(2);
      return resto.length <= 4 ? `${area} ${resto}` : `${area} ${resto.slice(0, 4)}-${resto.slice(4)}`;
    }
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
  const p = paisDe(locale);
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
  const p = paisDe(locale);
  // O `movel` entra entre o DDI e o número: na Argentina o WhatsApp é
  // `54 9 11 ...`, e sem o 9 o `wa.me` não abre conversa nenhuma.
  return p.ddi + (p.movel ?? "") + limpar(valor, locale);
}
