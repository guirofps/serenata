// DESCADASTRO EM UM TOQUE (List-Unsubscribe, RFC 8058), 25/09/2026.
//
// Microsoft, Gmail e Yahoo pedem, de quem manda e-mail de marketing, o
// cabeçalho que vira o "Cancelar inscrição" no topo da mensagem. Sem ele,
// quem não quer mais receber tem uma saída só: "marcar como spam". É o sinal
// que mais derruba a reputação, e o Hotmail/Outlook abria 4,7% (o Gmail 23%),
// com 10% dos compradores lá.
//
// O link carrega o e-mail ASSINADO (HMAC com o `RECUPERACAO_SECRET`, com um
// rótulo próprio pra não servir de assinatura de outra coisa): trocar o
// endereço na URL não descadastra outra pessoa.
//
// Só vai em e-mail de marketing e recuperação. Entrega, acesso e vídeo pronto
// ficam de fora: são o que a pessoa pagou pra receber.

import { createHmac } from "node:crypto";

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

export function assinaturaDescadastro(email: string): string | null {
  const segredo = process.env.RECUPERACAO_SECRET;
  if (!segredo) return null;
  return createHmac("sha256", `${segredo}:descadastro`)
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function linkDescadastroUmClique(email: string): string | null {
  const t = assinaturaDescadastro(email);
  if (!t) return null;
  return `${SITE}/api/descadastro?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${t}`;
}

/**
 * Os cabeçalhos pro `emails.send` do Resend. Sem segredo configurado, sai
 * vazio (o e-mail vai igual, só sem o botão): melhor que um link que não
 * confere e devolve erro.
 */
export function cabecalhosDescadastro(email: string): Record<string, string> {
  const link = linkDescadastroUmClique(email);
  if (!link) return {};
  return {
    "List-Unsubscribe": `<${link}>, <mailto:contato@serenatagift.com?subject=descadastrar>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
