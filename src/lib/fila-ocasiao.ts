// QUEM ENTRA NA LEVA DE OCASIÃO (Dia das Crianças, Natal, Dia das Mães).
//
// Puro, pra ter teste: o `ocasiaoCalendario` lê o banco e passa pra cá.
//
// ── POR QUE SAIU DO JOB (08/10) ──────────────────────────────────
//
// O job lia os pedidos pagos de 180 dias numa consulta só, sem paginar e sem
// ordem: o PostgREST devolvia ~1.000 dos ~9.300, uma amostra arbitrária, e o
// Dia das Crianças de 2026 chegou a só 261 compradores. A leitura agora é
// inteira, por cursor; a decisão de quem entra e com que nome mora aqui.
import { OCASIAO_PROIBIDA, primeiroNome, type Ocasiao } from "./ocasioes.js";

export type PedidoDaOcasiao = {
  email: string | null;
  quiz_response_id: string | null;
  paid_at: string | null;
  dinheiro_entrou: boolean | null;
};

export type CompraDaPessoa = { email: string; quizId: string; paidAt: string };

/**
 * A compra MAIS RECENTE de cada pessoa desde `desde`, da pessoa que comprou
 * por último pra a que comprou primeiro.
 *
 * A mais recente porque é a história mais fresca e o nome que ela vai
 * reconhecer no e-mail. A ordem decide quem sai primeiro quando o teto da
 * rodada corta a fila: comprador recente lembra da marca.
 */
export function compraMaisRecentePorEmail(pedidos: PedidoDaOcasiao[], desde: string): CompraDaPessoa[] {
  const corte = Date.parse(desde);
  const porEmail = new Map<string, CompraDaPessoa>();
  for (const p of pedidos) {
    const email = (p.email ?? "").trim().toLowerCase();
    // Resgate de crédito não é compra nova.
    if (!email || !p.quiz_response_id || !p.paid_at || p.dinheiro_entrou === false) continue;
    const quando = Date.parse(p.paid_at);
    if (!Number.isFinite(quando) || quando < corte) continue;
    const atual = porEmail.get(email);
    if (!atual || quando > Date.parse(atual.paidAt)) {
      porEmail.set(email, { email, quizId: p.quiz_response_id, paidAt: p.paid_at });
    }
  }
  return [...porEmail.values()].sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt));
}

export type AlvoDaOcasiao = { filho: string; nomeMusica: string; locale: "pt" | "es" };

/**
 * Esta resposta de quiz recebe a ocasião? E com que nome no assunto?
 * `null` = fica de fora. As regras são as do cabeçalho do `ocasiaoCalendario`.
 */
export function alvoDaOcasiao(
  respostas: Record<string, unknown>,
  locale: string | null | undefined,
  ocasiao: Pick<Ocasiao, "exigeCampo" | "pulaSeJaFezPara">,
): AlvoDaOcasiao | null {
  // Memorial nunca recebe oferta alegre. Regra dura, vale sempre.
  if (String(respostas.ocasiao ?? "").toLowerCase().includes(OCASIAO_PROIBIDA)) return null;

  const relacao = String(respostas.relacao ?? "").toLowerCase();
  // LOUVOR (quiz gospel): a música foi pra Deus. A oferta de ocasião cita a
  // música anterior pelo nome do homenageado, e "a música de Deus" ali não
  // faz sentido.
  if (relacao === "deus") return null;
  // Já fez pra essa relação? O e-mail não faz sentido pra ela.
  if (ocasiao.pulaSeJaFezPara.some((r) => relacao.includes(r))) return null;

  // O campo que a ocasião exige, se exigir.
  if (ocasiao.exigeCampo && !String(respostas[ocasiao.exigeCampo] ?? "").trim()) return null;
  const filho = ocasiao.exigeCampo
    ? primeiroNome(respostas[ocasiao.exigeCampo])
    : String(respostas.nome ?? "").trim() || null;
  // Sem nome limpo, fora: assunto genérico é o que já falhou.
  if (!filho) return null;

  const idioma = locale === "es" ? "es" : "pt";
  return {
    filho,
    nomeMusica: String(respostas.nome ?? "").trim() || (idioma === "es" ? "esa persona" : "essa pessoa"),
    locale: idioma,
  };
}
