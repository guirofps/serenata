import { createClient } from "@supabase/supabase-js";
import { assinaturaDescadastro } from "../inngest/lib/descadastro.js";
import { segredoConfere } from "./lib/segredo.js";
import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import { paginaConfirmarDescadastro, paginaDescadastrado } from "../src/lib/descadastro-pagina.js";

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

// A página veste a marca do deploy (08/10): a Ballad manda o mesmo
// cabeçalho, e até aqui o americano caía numa página "SERENATA" em
// português. Ver `src/lib/descadastro-pagina.ts`.

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
    return res.status(200).send(paginaConfirmarDescadastro(MARCA_ATIVA, email, acao));
  }

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // O "pronto" só depois de gravado (08/10). Antes a página dizia que a
  // pessoa saiu da lista mesmo com o banco fora, e ela continuava recebendo.
  // Erro aqui devolve 500, e o provedor do botão de um clique tenta de novo.
  if (!url || !key) return res.status(500).json({ erro: "indisponível" });
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("descadastros").upsert({ email, motivo: "list-unsubscribe" }, { onConflict: "email" });
  if (error) {
    console.error("[descadastro] gravação falhou:", error.message);
    return res.status(500).json({ erro: "indisponível" });
  }
  return res.status(200).send(paginaDescadastrado(MARCA_ATIVA));
}
