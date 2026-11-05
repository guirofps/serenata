// O SEGUNDO E-MAIL DE ENTREGA PRA OUTLOOK/HOTMAIL, pela caixa da Hostinger (05/11).
// Por quê: ver `src/lib/reforco-outlook.ts`.
//
// NUNCA derruba a entrega: roda depois do e-mail do Resend, engole o próprio erro,
// e tem prazo de 10s. Trava "já mandei" por quiz em `emails_enviados`
// (`entrega_outlook`), que falha FECHADA: consulta que falha não envia.
//
// Dois caminhos pra mesma caixa: a API REST com `HOSTINGER_API_TOKEN` (o que mandou
// o e-mail da Teresinha em 04/11) e, sem ela, o caminho do robô de suporte
// (`HOSTINGER_MAIL_TOKEN`, MCP da Hostinger).
import type { SupabaseClient } from "@supabase/supabase-js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { assuntoReforco, ehOutlook, textoReforco } from "../../src/lib/reforco-outlook.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { enviarTextoPelaCaixa } from "../../inngest/lib/suporte.js";

/** A caixa contato@serenatagift.com na Hostinger (id da caixa, não é segredo). */
const CAIXA_PADRAO = "AC47d94fb6e95b57ea639f9d4a29c7";
const PRAZO_MS = 10_000;

async function enviar(e: { to: string; subject: string; text: string }): Promise<boolean> {
  const caixa = process.env.HOSTINGER_MAILBOX_ID || CAIXA_PADRAO;
  const rest = process.env.HOSTINGER_API_TOKEN;
  if (rest) {
    const r = await fetch(`https://api.mail.hostinger.com/api/v1/mailboxes/${caixa}/send`, {
      method: "POST",
      signal: AbortSignal.timeout(PRAZO_MS),
      headers: { Authorization: `Bearer ${rest}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ to: [e.to], displayName: "Serenata", subject: e.subject, text: e.text }),
    });
    if (!r.ok) console.error("[entrega-outlook] Hostinger recusou:", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  }
  const mcp = process.env.HOSTINGER_MAIL_TOKEN;
  if (!mcp) {
    console.error("[entrega-outlook] sem HOSTINGER_API_TOKEN nem HOSTINGER_MAIL_TOKEN");
    return false;
  }
  return Promise.race([
    enviarTextoPelaCaixa(mcp, caixa, e),
    new Promise<boolean>((ok) => setTimeout(() => ok(false), PRAZO_MS)),
  ]);
}

export async function reforcarEntregaOutlook(
  sb: SupabaseClient,
  args: { email: string; nome: string; titulo: string | null; linkEditor: string; quizResponseId: string | null; locale: string },
): Promise<void> {
  try {
    if (MARCA_ATIVA.chave !== "serenata" || args.locale !== "pt" || !ehOutlook(args.email) || !args.quizResponseId) return;
    const { data: ja, error } = await sb
      .from("emails_enviados")
      .select("email_id")
      .eq("template", "entrega_outlook")
      .eq("quiz_response_id", args.quizResponseId)
      .limit(1);
    if (error || (ja ?? []).length > 0) return; // na dúvida, não manda de novo
    const ok = await enviar({
      to: args.email.trim(),
      subject: assuntoReforco(args.nome),
      text: textoReforco({ nome: args.nome, titulo: args.titulo, linkEditor: args.linkEditor }),
    });
    if (!ok) return;
    await registrarEnvio(sb, {
      emailId: `hostinger:${args.quizResponseId}`,
      template: "entrega_outlook",
      para: args.email,
      quizResponseId: args.quizResponseId,
    });
  } catch (e) {
    console.error("[entrega-outlook] falhou:", e);
  }
}
