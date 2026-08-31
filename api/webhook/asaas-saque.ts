// AUTORIZAÇÃO DE SAQUE — E ELE NEGA TUDO, DE PROPÓSITO.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// A chave de produção do Asaas mora numa variável de ambiente da Vercel. Se
// ela vazar (log, dependência comprometida, print de tela), o que o atacante
// pode fazer de lucrativo não é criar cobrança: é SACAR o dinheiro.
//
// Com este recurso ligado, o Asaas pergunta à nossa aplicação antes de
// executar qualquer saque pedido pela API. E a resposta certa, no nosso caso,
// é sempre não: a operação nunca pede saque por API. O dono saca pelo painel
// e pelo aplicativo, que é outro caminho e não passa por aqui.
//
// Então este endpoint transforma "roubaram a chave e esvaziaram a conta" em
// "roubaram a chave e não conseguem tirar nada".
//
// ── E ELE É UM ALARME ────────────────────────────────────────────
//
// Como nenhum saque legítimo nosso passa por aqui, TODA chamada é anômala. Por
// isso ele avisa o dono: a primeira notícia de uma chave vazada vai ser este
// e-mail, e não o extrato.
//
// ── NÃO MARQUE "VALIDAR TAMBÉM SAQUES VIA INTERFACE" ─────────────
//
// Aquela opção estende a validação pros saques feitos no painel e no
// aplicativo. Com um endpoint que nega tudo, marcar aquilo travaria o dinheiro
// do próprio dono. A proteção existe pra o caminho que a gente NÃO usa.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { segredoConfere } from "../lib/segredo.js";
import { Resend } from "resend";

type Req = IncomingMessage & {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & {
  status: (c: number) => Res;
  json: (b: unknown) => void;
};

async function avisar(assunto: string, html: string) {
  try {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) return;
    await new Resend(chave).emails.send({
      from: "Serenata <contato@serenatagift.com>",
      to: ["guilhermerojasiqueira@gmail.com"],
      subject: assunto,
      html,
    });
  } catch (err) {
    console.error("[asaas-saque] aviso falhou:", err);
  }
}

async function registrar(nome: string, dados: unknown) {
  try {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    await createClient(url, key, { auth: { persistSession: false } })
      .from("funnel_events")
      .insert({ event_name: nome, event_data: dados });
  } catch {
    // Registro nunca decide o desfecho: a recusa acontece de qualquer jeito.
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "método" });

  const corpo = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as {
    type?: string;
    transfer?: { value?: number; id?: string };
    bill?: { value?: number };
    pixQrCode?: { value?: number };
  } | null;

  const tipo = String(corpo?.type ?? "desconhecido");
  const valor =
    corpo?.transfer?.value ?? corpo?.bill?.value ?? corpo?.pixQrCode?.value ?? null;

  // ── O TOKEN ──────────────────────────────────────────────────
  //
  // Em tempo constante, como todo segredo do projeto. Token errado não é só
  // "recusa": é sinal de que alguém está batendo aqui sem ser o Asaas.
  const esperado = process.env.ASAAS_SAQUE_TOKEN;
  if (!esperado || !segredoConfere(req.headers["asaas-access-token"], esperado)) {
    await registrar("asaas_saque_token_invalido", { tipo, valor });
    // Continua RECUSANDO em vez de devolver 401: a documentação deles diz que
    // resposta sem `APPROVED`/`REFUSED` cancela a operação, mas recusar
    // explicitamente é mais previsível do que depender do tratamento de erro
    // deles pra proteger dinheiro.
    return res.status(200).json({
      status: "REFUSED",
      refuseReason: "Origem não reconhecida.",
    });
  }

  // ── A RECUSA, QUE É A RESPOSTA CERTA SEMPRE ──────────────────
  //
  // Se algum dia a operação passar a sacar por API, este é o lugar de abrir a
  // exceção — e ela tem que ser estreita: um valor máximo, uma conta de
  // destino conferida contra uma lista, e nunca "aprova se parecer certo".
  await registrar("asaas_saque_recusado", { tipo, valor });
  await avisar(
    "SAQUE PEDIDO PELA API — recusado",
    `<p>O Asaas pediu autorização pra um saque via API, e a aplicação recusou.</p>` +
      `<p><b>Isto não deveria acontecer.</b> Nenhuma rotina nossa saca por API; ` +
      `os seus saques pelo painel e pelo aplicativo não passam por aqui.</p>` +
      `<p>tipo: ${tipo}<br>valor: ${valor ?? "não informado"}</p>` +
      `<p>Se não foi você testando, <b>troque a chave de API do Asaas agora</b>.</p>`,
  );

  return res.status(200).json({
    status: "REFUSED",
    refuseReason: "Saques por API não são permitidos nesta conta.",
  });
}
