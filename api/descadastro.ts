import { createClient } from "@supabase/supabase-js";
import { assinaturaDescadastro } from "../inngest/lib/descadastro.js";
import { segredoConfere } from "./lib/segredo.js";

// O "CANCELAR INSCRIÇÃO" do Outlook/Gmail (List-Unsubscribe, RFC 8058).
//
// POST descadastra: é o que o provedor chama sozinho quando a pessoa toca no
// botão do topo da mensagem (`List-Unsubscribe=One-Click` no corpo), e é o
// que o botão da página abaixo envia.
//
// GET NÃO descadastra, só mostra o botão. De propósito: filtro de segurança
// (o Safe Links da Microsoft, por exemplo) ABRE os links sozinho pra checar,
// e um GET que descadastrasse tiraria gente da lista sem ela ter pedido.
//
// O e-mail vem assinado (`inngest/lib/descadastro.ts`) e confere em tempo
// constante: trocar o endereço na URL não descadastra outra pessoa.

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = {
  status: (c: number) => Res;
  setHeader: (k: string, v: string) => void;
  send: (b: string) => void;
  json: (b: unknown) => void;
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function pagina(corpo: string): string {
  return (
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Serenata</title></head>` +
    `<body style="margin:0;background:#f2e9dc;font-family:Georgia,serif;color:#2a1518;display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center">` +
    `<div style="max-width:420px"><p style="letter-spacing:3px;color:#7d2b3a">SERENATA</p>${corpo}</div></body></html>`
  );
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ erro: "método" });
  const email = um(req.query.e).trim().toLowerCase();
  const t = um(req.query.t);
  const esperado = email ? assinaturaDescadastro(email) : null;
  if (!email || !esperado || !segredoConfere(t, esperado)) {
    return res.status(400).json({ erro: "link inválido" });
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (req.method === "GET") {
    const acao = `/api/descadastro?e=${encodeURIComponent(email)}&t=${encodeURIComponent(t)}`;
    return res.status(200).send(
      pagina(
        `<h1 style="font-weight:normal;font-size:23px">Parar de receber os nossos e-mails de novidades?</h1>` +
          `<p style="color:rgba(42,21,24,0.6);font-family:Helvetica,Arial,sans-serif;font-size:14px">${escapar(email)}</p>` +
          `<form method="POST" action="${escapar(acao)}"><button style="margin-top:14px;background:#7d2b3a;color:#faf5ee;border:0;border-radius:999px;padding:14px 28px;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;cursor:pointer">Sim, não quero mais receber</button></form>`,
      ),
    );
  }

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    await sb.from("descadastros").upsert({ email, motivo: "list-unsubscribe" }, { onConflict: "email" });
  }
  return res.status(200).send(
    pagina(
      `<h1 style="font-weight:normal;font-size:24px">Pronto, você não recebe mais estes e-mails.</h1>` +
        `<p style="color:rgba(42,21,24,0.6);font-family:Helvetica,Arial,sans-serif;font-size:14px">Os e-mails da música que você comprou continuam chegando normalmente.</p>`,
    ),
  );
}
