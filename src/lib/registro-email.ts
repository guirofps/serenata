import type { SupabaseClient } from "@supabase/supabase-js";

// REGISTRA QUAL E-MAIL FOI ENVIADO, pra o webhook do Resend saber depois.
//
// O Resend NÃO devolve as `tags` nos eventos de entrega, abertura e clique
// (conferido em 25/08: 10.172 eventos seguidos com `template: null`). O que
// ele devolve em todo evento é o `email_id`, o mesmo que retorna no envio.
//
// Então a ligação é gravada aqui, no instante do envio, e o webhook resolve
// por esse id. Ver `supabase/migrations/20260825000000_emails_enviados.sql`.
//
// ── NUNCA DERRUBA O ENVIO ────────────────────────────────────────
//
// Esta função engole o próprio erro de propósito. Ela existe pra MEDIR, e
// medição que impede a pessoa de receber a música é troca ruim: o pior caso
// aceitável é um e-mail sem etiqueta, não um e-mail que não saiu.

export async function registrarEnvio(
  db: SupabaseClient,
  args: {
    /** O `data.id` que o Resend devolve no envio. Sem ele não há o que ligar. */
    emailId: string | null | undefined;
    /** `entrega`, `letra_pronta`, `escada_3`, `volte_criar`... */
    template: string;
    para?: string | null;
    quizResponseId?: string | null;
  },
): Promise<void> {
  if (!args.emailId) return;
  try {
    await db.from("emails_enviados").insert({
      email_id: args.emailId,
      template: args.template,
      para: args.para ?? null,
      quiz_response_id: args.quizResponseId ?? null,
    });
  } catch (err) {
    console.error("[registro-email] não gravado:", err);
  }
}
