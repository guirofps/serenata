// A TRAVA DE "JÁ MANDEI" É GRAVADA ANTES DE MANDAR (08/10).
//
// Quase toda régua de e-mail marcava o envio com um `funnel_events.insert`
// DEPOIS do Resend, e não lia o erro dessa gravação. Se ela falhasse (o mesmo
// banco lento do incidente de 04/10), o e-mail já tinha saído e a marca não:
// a rodada seguinte não via nada e mandava DE NOVO, e a seguinte também.
// Achado na auditoria de 08/10 na escada, no `quaseComprou`, no `volteCriar`,
// no `videoPendente` e nos lembretes de crédito e quadro.
//
// Agora a ordem é:
//   1. grava a trava e CONFERE. Não gravou? Não manda (falha fechada).
//   2. manda.
//   3. o Resend recusou? Solta a trava, pra a próxima rodada tentar. Se nem
//      soltar der, a pessoa fica sem ESTE e-mail, nunca com dois.
//
// O id do Resend continua indo pro `emails_enviados` pelo `registrarEnvio`,
// depois do envio, como antes: ele mede, quem decide é a trava.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Trava = {
  event_name: string;
  event_data: Record<string, unknown>;
  session_id?: string | null;
};

/**
 * Já existe trava com este conteúdo desde `desde`?
 *
 * Erro conta como SIM (04/10): consulta que falha não pode virar reenvio.
 * `desde` é obrigatório: `funnel_events` sem janela de `created_at` foi o que
 * estourou o tempo do PostgREST em 04/10.
 */
export async function jaTravado(
  sb: SupabaseClient,
  eventName: string,
  contem: Record<string, unknown>,
  desde: string,
): Promise<boolean> {
  try {
    const { data, error } = await sb
      .from("funnel_events")
      .select("id")
      .eq("event_name", eventName)
      .contains("event_data", contem)
      .gte("created_at", desde)
      .limit(1);
    if (error) {
      console.error(`[trava] ${eventName} ilegível, pulando por segurança:`, error.message);
      return true;
    }
    return (data ?? []).length > 0;
  } catch (err) {
    console.error(`[trava] ${eventName} ilegível, pulando por segurança:`, err);
    return true;
  }
}

/** Grava a trava. Devolve o id da linha, ou `null` se não gravou: aí NÃO mande. */
export async function travarEnvio(sb: SupabaseClient, trava: Trava): Promise<string | null> {
  try {
    const { data, error } = await sb
      .from("funnel_events")
      .insert({
        event_name: trava.event_name,
        event_data: trava.event_data,
        ...(trava.session_id ? { session_id: trava.session_id } : {}),
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      console.error(`[trava] ${trava.event_name} não gravou, sem envio:`, error?.message ?? "sem id");
      return null;
    }
    return String(data.id);
  } catch (err) {
    console.error(`[trava] ${trava.event_name} não gravou, sem envio:`, err);
    return null;
  }
}

/** O envio NÃO saiu: apaga a trava pra a próxima rodada tentar de novo. */
export async function soltarTrava(sb: SupabaseClient, id: string): Promise<void> {
  try {
    const { error } = await sb.from("funnel_events").delete().eq("id", id);
    if (error) console.error("[trava] não soltou, a pessoa fica sem este e-mail:", id, error.message);
  } catch (err) {
    console.error("[trava] não soltou, a pessoa fica sem este e-mail:", id, err);
  }
}
