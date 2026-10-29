// TESTE `oxxo_pendente` (Ballad México, 28/10/2026): A FICHA DO OXXO QUE NÃO
// FOI PAGA.
//
// O irmão do `pixNaoPago` da Serenata, mas o OXXO não é o PIX. Medido em
// 28/10, sobre as 63 fichas desde 23/10: das pagas, 9 caíram em menos de 1h
// (transferência) e 8 entre 12h e 3 dias (a ficha paga na loja, quando a
// pessoa passa por uma). A ficha vale 3 dias (`dlocalgo-checkout.ts`). Então
// "10 minutos depois" não serve: quem vai pagar na loja ainda nem saiu de casa.
//
// E ninguém cuidava dela. O `quaseComprou` pula quem tem pedido que não é do
// Stripe, e o `pixNaoPago` só roda na Serenata: a ficha gerada e esquecida
// ficava só com a escada genérica, que não sabe que ela existe. Em 28/10 eram
// 21 fichas do dia sem pagar.
//
//   A  como era: nada.
//   B  dois toques, do remetente transacional (ela PEDIU a ficha):
//        1. 2h depois de gerar: "a sua ficha continua valendo até <data>", com
//           o botão que reabre a MESMA ficha (a página da dLocal, `pix_url`);
//        2. no último dia: "a sua ficha vence amanhã/hoje".
//      Os dois só entre 8h e 21h do México, e nunca pra quem já pagou (o
//      job pergunta à dLocal antes, e se pagou, entrega).
//
// Braço pelo 8º caractere do fim do id do quiz, paridade (os sete de antes
// são de outros testes de e-mail). A trava grava o braço e o toque nos DOIS
// braços: no A ela é o registro de "teria recebido", o denominador.
//
// Leitura: FICHA PAGA ÷ FICHA GERADA por braço (pedido `dlocalgo` pendente →
// pago), e o tempo até pagar.

export const EXP_OXXO_PENDENTE = "oxxo_pendente";

/** Desligar = ninguém recebe, os dois braços continuam registrados. */
export const LIGADO = true;

/** A ficha só recebe e-mail se ainda tiver pelo menos isto de validade. */
export const FOLGA_MINIMA_MS = 2 * 3600e3;
/** O 1º toque sai depois disto da ficha gerada. */
export const ESPERA_TOQUE_1_MS = 2 * 3600e3;
/** O 2º toque é o do último dia: falta isto ou menos pra vencer. */
export const JANELA_TOQUE_2_MS = 24 * 3600e3;
/** Entre um toque e outro, pelo menos isto. */
export const INTERVALO_MS = 12 * 3600e3;

export type Toque = 1 | 2;

/** O braço deste quiz. Id estranho: A. */
export function bracoOxxoPendente(quizId: string | null | undefined): "A" | "B" {
  const t = String(quizId ?? "");
  const c = t.length >= 8 ? t[t.length - 8] : "";
  const n = parseInt(c, 16);
  if (Number.isNaN(n)) return "A";
  return n % 2 === 1 ? "B" : "A";
}

/**
 * Qual toque esta ficha deve receber AGORA, ou `null`. Puro: o job passa as
 * horas e o que já foi registrado.
 */
export function toqueDevido(a: {
  criadaEm: number;
  venceEm: number;
  agora: number;
  /** Os toques já registrados (nos dois braços). */
  feitos: ReadonlySet<Toque>;
  /** Quando foi o último toque registrado, se houve. */
  ultimoEm?: number | null;
}): Toque | null {
  const falta = a.venceEm - a.agora;
  if (falta < FOLGA_MINIMA_MS) return null;
  if (a.ultimoEm != null && a.agora - a.ultimoEm < INTERVALO_MS) return null;
  if (!a.feitos.has(2) && falta <= JANELA_TOQUE_2_MS) return 2;
  if (!a.feitos.has(1) && !a.feitos.has(2) && a.agora - a.criadaEm >= ESPERA_TOQUE_1_MS) return 1;
  return null;
}

/** A hora no México (o país não tem mais horário de verão: UTC-6 o ano todo). */
function horaNoMexico(agora: number): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hourCycle: "h23" }).format(
      new Date(agora),
    ),
  );
}

/** Hora de mandar e-mail pra quem está no México: 8h às 21h59 de lá. */
export function horaBoaNoMexico(agora: number): boolean {
  const h = horaNoMexico(agora);
  return h >= 8 && h < 22;
}

/** "el jueves 30 de octubre a las 3:40 p. m." no horário do México. */
export function quandoVence(venceEm: number): string {
  const d = new Date(venceEm);
  // Por partes: o formato inteiro do es-MX põe vírgula ("viernes, 30 de
  // octubre"), que no meio da frase lê errado.
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const dia = `${p.weekday} ${p.day} de ${p.month}`;
  const hora = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `el ${dia} a las ${hora}`;
}

/** "hoy" ou "mañana", pelo calendário do México; mais longe, `null`. */
export function venceHojeOuAmanha(venceEm: number, agora: number): "hoy" | "mañana" | null {
  const dia = (t: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date(t));
  const hoje = dia(agora);
  const venc = dia(venceEm);
  if (venc === hoje) return "hoy";
  if (venc === dia(agora + 86400e3)) return "mañana";
  return null;
}

/**
 * UMA FICHA POR QUIZ, A MAIS NOVA (29/10).
 *
 * Quem gera a ficha de novo (fechou a folha e voltou, trocou de OXXO pra SPEI)
 * fica com duas pendentes no mesmo quiz. O job lia em ordem crescente e
 * ficava com a PRIMEIRA, a mais velha: o e-mail mandava pagar a ficha que a
 * pessoa já tinha trocado, e o "vence em" era o dela. Agora fica a de
 * `created_at` maior, e as outras do mesmo quiz saem da fila, mesmo que a
 * mais nova não tenha toque devido agora (senão a velha passaria no lugar).
 */
export function fichaMaisNovaPorQuiz<T extends { quiz_response_id: string | null; created_at: string }>(
  pedidos: T[],
): T[] {
  const porQuiz = new Map<string, T>();
  for (const p of pedidos) {
    if (!p.quiz_response_id) continue;
    const atual = porQuiz.get(p.quiz_response_id);
    if (!atual || Date.parse(p.created_at) > Date.parse(atual.created_at)) porQuiz.set(p.quiz_response_id, p);
  }
  return [...porQuiz.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
