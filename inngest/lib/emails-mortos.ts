// QUEM NÃO RECEBE MAIS.
//
// O bounce já era registrado e já alertava, mas nada consultava esse registro
// antes do próximo envio. Em 14 dias isso produziu 13 e-mails disparados pra
// endereço que já tinha voltado: o Edeilson levou três no mesmo endereço morto,
// o Rodrigo dois, e outros dez levaram dois cada.
//
// Não é desperdício de e-mail, é dano. A reputação do domínio é o que decide
// se a ENTREGA da música (o único e-mail que carrega produto pago) cai na
// caixa de entrada ou no spam, e 84% dos compradores estão no Gmail, que é
// justamente quem está devolvendo 4,3% do que a gente manda.
//
// Fica aqui e não em `src/lib` porque quem consulta é job e webhook, e a
// tabela só é legível pelo service role.
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Endereços bloqueados dentro de uma lista.
 *
 * Recebe a lista inteira e devolve um Set, em vez de responder um por vez:
 * os crons mandam em lote, e uma consulta por destinatário seria N chamadas
 * por rodada.
 *
 * FALHA ABERTA de propósito. Se a consulta cair, o certo é mandar o e-mail e
 * arriscar um bounce, não segurar a entrega de quem pagou por causa de uma
 * indisponibilidade do banco.
 */
export async function bloqueados(
  db: SupabaseClient,
  emails: string[],
): Promise<Set<string>> {
  const alvos = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  if (!alvos.length) return new Set();
  try {
    const { data, error } = await db
      .from("emails_mortos")
      .select("email")
      .in("email", alvos)
      .is("liberado_em", null);
    if (error) throw error;
    return new Set((data ?? []).map((r) => String(r.email).toLowerCase()));
  } catch (err) {
    console.error("[emails-mortos] consulta falhou, seguindo sem bloquear:", err);
    return new Set();
  }
}

/** Versão de um endereço só, pros caminhos que não mandam em lote. */
export async function estaBloqueado(db: SupabaseClient, email: string): Promise<boolean> {
  return (await bloqueados(db, [email])).has(email.toLowerCase());
}
