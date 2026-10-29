import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarPais } from "./mercados.js";

// O PAÍS GRAVADO NO QUIZ E A MOEDA GRAVADA NO PEDIDO (Ballad, 29/10/2026).
//
// O espanhol da página segue o país do ACESSO, mas três coisas não têm acesso
// nenhum: a letra que termina numa requisição posterior, os e-mails (cron e
// webhook) e a página presente aberta pelo presenteado. Pra elas, o país que
// vale é o de quando a pessoa começou: `quiz_responses.pais`, gravado uma vez
// e nunca sobrescrito.
//
// TUDO AQUI É À PARTE E ENGOLE O ERRO. A coluna nasce na migration
// `20261029000000_mercados_pais`, e o código pode subir antes dela: um
// `select("id, pais, …")` numa tabela sem a coluna devolve erro e derrubaria a
// consulta inteira (e o checkout, a letra, o e-mail junto). Então o país é
// sempre lido numa consulta SÓ DELE, e escrito num update SÓ DELE.
//
// Relativo e com `.js`: os jobs (inngest/) importam isto pelo Node.

type Db = SupabaseClient;

/** O país gravado no quiz. Sem coluna, sem linha ou sem país: `null`. */
export async function paisDoQuiz(db: Db, filtro: { id?: string | null; sessionId?: string | null }): Promise<string | null> {
  try {
    let q = db.from("quiz_responses").select("pais");
    if (filtro.id) q = q.eq("id", filtro.id);
    else if (filtro.sessionId) q = q.eq("session_id", filtro.sessionId);
    else return null;
    const { data, error } = await q.maybeSingle();
    if (error) return null;
    return normalizarPais((data as { pais?: string | null } | null)?.pais);
  } catch {
    return null;
  }
}

/**
 * O país que vale pra este quiz: o gravado, ou (na primeira vez) o do acesso,
 * que é gravado agora. NUNCA sobrescreve: o `update` só pega linha com `pais`
 * nulo, então duas abas ao mesmo tempo não brigam.
 */
export async function garantirPaisDoQuiz(
  db: Db,
  sessionId: string | null | undefined,
  paisDoAcesso: string | null | undefined,
): Promise<string | null> {
  if (!sessionId) return normalizarPais(paisDoAcesso);
  const gravado = await paisDoQuiz(db, { sessionId });
  if (gravado) return gravado;
  const pais = normalizarPais(paisDoAcesso);
  if (!pais) return null;
  try {
    const { error } = await db.from("quiz_responses").update({ pais }).eq("session_id", sessionId).is("pais", null);
    if (error) console.warn("[pais] não gravou o país do quiz:", error.message);
  } catch (e) {
    console.warn("[pais] não gravou o país do quiz:", e);
  }
  return pais;
}

/**
 * Grava no pedido o que o caixa cobrou de verdade (moeda, valor local, país).
 * Update à parte depois do insert: sem as colunas, o pedido nasce igual e só
 * o registro da moeda se perde (o webhook confere pela sessão do gateway).
 */
export async function marcarMoedaDoPedido(
  db: Db,
  paymentId: string,
  dados: { moeda: string; valorMoeda: number; pais: string | null },
): Promise<void> {
  try {
    const { error } = await db
      .from("pedidos")
      .update({ moeda: dados.moeda, valor_moeda: dados.valorMoeda, pais: dados.pais })
      .eq("payment_id", paymentId);
    if (error) console.warn("[pais] não gravou a moeda do pedido:", error.message);
  } catch (e) {
    console.warn("[pais] não gravou a moeda do pedido:", e);
  }
}
