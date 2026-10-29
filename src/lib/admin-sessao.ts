// A VALIDADE DA SESSÃO DO PAINEL (28/10/2026).
//
// Era 12h fixas, sem renovação: quem entrava às 9h era deslogado às 21h, todo
// dia, nas duas marcas. Agora são 30 dias, renovados a cada uso: quem abre o
// painel todo dia nunca mais vê a senha, e um aparelho parado 30 dias pede de
// novo. A renovação acontece no máximo uma vez por dia, pra não regravar o
// cookie em cada consulta do painel.
//
// O que continua derrubando tudo na hora: trocar o `ADMIN_SECRET` (ou o
// `RECUPERACAO_SECRET`, pro operador) na Vercel, porque a assinatura deixa de
// bater. Arquivo puro, sem `node:crypto`, pra regra ser testada sem servidor.

export const DURACAO_SESSAO_S = 60 * 60 * 24 * 30;

const RENOVA_DEPOIS_DE_MS = 24 * 60 * 60 * 1000;

/** Renova se a sessão ainda vale e foi emitida há mais de 1 dia. */
export function deveRenovarSessao(expiraEmMs: number, agoraMs: number): boolean {
  if (expiraEmMs <= agoraMs) return false;
  const emitidaEm = expiraEmMs - DURACAO_SESSAO_S * 1000;
  return agoraMs - emitidaEm > RENOVA_DEPOIS_DE_MS;
}
