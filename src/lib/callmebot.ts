// AVISO NO WHATSAPP pelo CallMeBot.
//
// `GET https://api.callmebot.com/whatsapp.php?phone=…&text=…&apikey=…`
//
// ── O WHATSAPP SOMA AO E-MAIL, NUNCA SUBSTITUI ───────────────────
//
// A API é gratuita e o próprio site diz "only for personal use": ela pode
// atrasar, limitar ou simplesmente parar, sem contrato e sem aviso. Um canal
// assim serve pra ACORDAR alguém rápido, não pra ser o único registro de que
// algo quebrou. Todo alerta continua saindo por e-mail; o WhatsApp é o
// empurrão pra quem não está olhando a caixa.
//
// Se um dia virar canal crítico, o caminho é textmebot/Twilio (os dois que o
// próprio CallMeBot indica) — e aí é contrato, não favor.
//
// ── SEM IMPORTS ──────────────────────────────────────────────────
//
// Lido por função do Inngest e por rota da Vercel, que rodam no ESM do Node,
// onde o alias `@/` derruba o endpoint inteiro (`ccbdeb7`). Mesma regra de
// `donos.ts` e `primeiro-nome.ts`.

/** Um destinatário: o telefone com DDI e a chave que o bot deu PRA ELE. */
export type DestinoWhats = { telefone: string; apikey: string };

/**
 * Lê `CALLMEBOT_DONOS`, no formato `telefone:chave,telefone:chave`.
 *
 * ENTRADA RUIM É DESCARTADA, NUNCA LANÇA. Esta função roda dentro do caminho
 * que estava tentando reportar um problema — se ela estourasse por causa de
 * uma vírgula a mais na variável de ambiente, o alerta morreria junto e a
 * falha original ficaria sem aviso nenhum. Linha torta some; as boas passam.
 *
 * A chave é PESSOAL: o CallMeBot só entrega pro telefone que a ativou. Uma
 * chave no telefone errado não dá erro — ela simplesmente não entrega, em
 * silêncio, que é o pior jeito de um alerta falhar. Por isso os dois andam
 * colados no mesmo par, em vez de duas listas paralelas que alguém pode
 * desalinhar.
 */
export function lerDestinos(bruto: string | undefined | null): DestinoWhats[] {
  if (!bruto || typeof bruto !== "string") return [];
  const vistos = new Set<string>();
  const out: DestinoWhats[] = [];
  for (const parte of bruto.split(",")) {
    const [tel, chave] = parte.split(":");
    const telefone = (tel ?? "").trim().replace(/[\s()-]/g, "");
    const apikey = (chave ?? "").trim();
    // DDI + número: 8 a 15 dígitos é a faixa do E.164, com o `+` opcional.
    if (!/^\+?\d{8,15}$/.test(telefone)) continue;
    if (!/^[A-Za-z0-9]{3,40}$/.test(apikey)) continue;
    if (vistos.has(telefone)) continue;
    vistos.add(telefone);
    out.push({ telefone, apikey });
  }
  return out;
}

/**
 * O limite de tamanho da mensagem.
 *
 * O texto viaja na QUERY STRING, e servidor e CDN cortam URL longa — o
 * CallMeBot devolveria erro, ou pior, entregaria a mensagem truncada no meio
 * de uma frase. 700 caracteres cabem com folga depois de escapados (cada
 * quebra de linha vira `%0A`, três bytes) e são muito mais do que um aviso
 * precisa: alerta que não cabe num empurrão de celular devia ser e-mail.
 */
const MAX_TEXTO = 700;

/** Corta no limite sem deixar a frase pela metade sem avisar. */
export function encurtar(texto: string, max = MAX_TEXTO): string {
  const limpo = String(texto ?? "").trim();
  if (limpo.length <= max) return limpo;
  return limpo.slice(0, max - 1).trimEnd() + "…";
}

/**
 * A URL da chamada, montada e escapada.
 *
 * `encodeURIComponent` no texto e no telefone: o `+` do DDI vira `%2B` (numa
 * query string, `+` cru significa ESPAÇO), e um `&` no meio do aviso cortaria
 * a mensagem e inventaria um parâmetro.
 */
export function urlDoAviso(destino: DestinoWhats, texto: string): string {
  const t = encodeURIComponent(encurtar(texto));
  return (
    "https://api.callmebot.com/whatsapp.php" +
    `?phone=${encodeURIComponent(destino.telefone)}` +
    `&text=${t}` +
    `&apikey=${encodeURIComponent(destino.apikey)}`
  );
}
