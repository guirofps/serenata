// Google Ads: tag e conversão de compra.
//
// A conversão dispara na /obrigado, que é o destino do redirect pós-pagamento
// da Perfect Pay. É o caminho padrão e o único que a conta de anúncio aceita
// sem integração de servidor (importação offline exigiria OAuth + developer
// token do Google Ads, o que não se justifica antes de escalar).
//
// LIMITAÇÃO CONHECIDA E ACEITA: se a pessoa pagar e NÃO voltar pro site (comum
// em PIX), essa venda não é contada pelo Google. O número do Google Ads tende
// a ficar ABAIXO do real — o que é seguro (não infla resultado), mas precisa
// ser lembrado ao comparar com o painel da Perfect Pay, que é a verdade.

import { MARCA_ATIVA, ehBallad } from "./marca-identidade.js";
import { emailPlausivel } from "./email-limpo.js";

// ── A CONTA DE ANÚNCIO É DA MARCA ─────────────────────────────────
//
// Um repositório, dois sites. Com o id cravado, a Ballad Gift (EUA) carregaria
// a tag da Serenata e contaria venda em dólar na conta brasileira: o Smart
// Bidding daqui aprenderia com tráfego americano, que é o jeito mais caro de
// estragar uma campanha que está vendendo.
//
// Na Serenata os valores de sempre, sem configuração. Na Ballad, só com as
// envs do projeto dela; sem elas não carrega tag nenhuma (melhor não medir
// que medir na conta errada).
const ENV = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
export const GOOGLE_ADS_ID: string | null =
  MARCA_ATIVA.chave === "serenata" ? "AW-16919557808" : ENV.VITE_GOOGLE_ADS_ID?.trim() || null;
const CONVERSAO: string | null =
  MARCA_ATIVA.chave === "serenata"
    ? "AW-16919557808/pSbhCOqvttkcELDt74M_"
    : ENV.VITE_GOOGLE_ADS_CONVERSAO?.trim() || null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara a conversão de compra. Chamada uma vez, na página de obrigado.
 *
 * A MOEDA vem junto do valor, e isso não é detalhe. Até 13/08 a conversão
 * mandava `37 BRL` cravado, inclusive nas vendas do funil espanhol, que são
 * em dólar. O Google recebia o valor errado justamente da campanha que a
 * gente está tentando descobrir se vale a pena — e otimiza em cima do que
 * recebe, não do que aconteceu.
 */
// ── O ID DA TRANSAÇÃO QUANDO O GATEWAY NÃO DEVOLVE UM ────────────
//
// A Perfect Pay mandava `?code=` no redirect, e era ele que impedia um F5 na
// página de obrigado de contar a venda duas vezes. No checkout transparente
// não existe redirect de gateway nenhum: a própria tela manda a pessoa pro
// `/obrigado` quando o webhook confirma. Sem substituto, `transaction_id`
// ficava vazio e toda recarga virava conversão nova — conversão inflada
// estraga o lance da campanha, que é o defeito mais caro dessa mesa.
//
// `sessionStorage` e NÃO a URL, de propósito: `/obrigado` fica fora de
// `rotas-sensiveis` pra que o gtag carregue lá, e o gtag manda a URL inteira
// pro Google. Pôr a referência no endereço seria copiar a chave da cobrança
// pra dentro do Analytics por conveniência de três caracteres.
const CHAVE_TX = "mp_tx";

/** Guarda o id desta compra, na hora em que o pagamento é confirmado. */
// TAMBÉM NO `localStorage`, POR SESSÃO DO FUNIL (16/10). Só na aba, a
// `/obrigado` reaberta numa aba nova (o link do e-mail, o app do banco que
// devolve pro navegador) não achava o id e caía no hash da sessão: a mesma
// venda saía de novo pro GA4, pra tag do Ads e pro pixel do TikTok, com OUTRO
// id, e nada deduplicava contra o `pay_xxx` da primeira contagem. Chaveado
// pela sessão: a segunda música no mesmo navegador gira a sessão e ganha o
// dela.
function chavePersistente(): string | null {
  try {
    const s = localStorage.getItem("mp_session_id")?.trim();
    return s ? `${CHAVE_TX}:${s}` : null;
  } catch {
    return null;
  }
}

export function guardarTransacao(id: string): void {
  try {
    sessionStorage.setItem(CHAVE_TX, id);
  } catch {
    // Modo anônimo: perde a dedupe, não perde a venda.
  }
  try {
    const k = chavePersistente();
    if (k) localStorage.setItem(k, id);
  } catch {
    // idem
  }
}

/** O id guardado, se houver: o da aba, ou o da sessão do funil. */
export function transacaoGuardada(): string | undefined {
  try {
    const daAba = sessionStorage.getItem(CHAVE_TX);
    if (daAba) return daAba;
  } catch {
    // segue pro persistente
  }
  try {
    const k = chavePersistente();
    return (k && localStorage.getItem(k)) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * O ID DA TRANSAÇÃO, e ele NUNCA pode sair vazio.
 *
 * ── O BUG QUE ISTO CONSERTA, E ELE CUSTOU CARO ───────────────────
 *
 * O Google DEDUPLICA conversão por `transaction_id`. Duas conversões com o
 * mesmo id são a mesma venda — e string vazia é um id como outro qualquer.
 * Ou seja: com o campo vazio, o Google guarda UMA e descarta todas as
 * outras, em silêncio, sem erro em lugar nenhum.
 *
 * A versão anterior fazia `args.transactionId ?? ""`. O id vinha do `?code=`
 * que a Perfect Pay devolvia no redirect, e ele NEM SEMPRE VINHA — o próprio
 * `Obrigado.tsx` já documentava isso desde que 33 compradores em 10 dias
 * caíram na tela sem botão pelo mesmo motivo. Quando não vinha, a venda
 * simplesmente não era contada.
 *
 * Medido em 28/08: 23 vendas num dia, 8 contadas pelo Google. Dois terços
 * jogados fora — e a campanha otimizando em cima do terço que sobrou.
 *
 * Com o checkout transparente virou 100% do problema, porque ali não existe
 * redirect de gateway e o `code` nunca vem.
 *
 * ── A ESCADA DE FALLBACK ─────────────────────────────────────────
 *
 * 1. o id que o chamador passou (o `code`, ou a referência do PIX guardada);
 * 2. a REFERÊNCIA guardada em `sessionStorage` pela tela do PIX;
 * 3. o id da SESSÃO, que é único por comprador e sobrevive ao F5 — então a
 *    dedupe contra recarga continua funcionando, que era o motivo do campo
 *    existir.
 *
 * Se as três falharem (modo anônimo com storage bloqueado), o campo é
 * OMITIDO. Sem id, o Google conta a conversão como única; com id vazio, ele
 * a joga fora. Omitir erra pra cima, e errar pra cima aqui é muito melhor.
 */
// ── O SESSION_ID É CREDENCIAL, E POR ISSO SAI POR HASH ────────────
//
// `/retomar?s=<session_id>` devolve e-mail, WhatsApp, as respostas do quiz e o
// `tokenEdicao`. O degrau 3 da escada mandava esse id CRU como
// `transaction_id` — pro Ads e, desde 01/10, pro GA4, que mostra Transaction ID
// como dimensão navegável nos relatórios que o dono compartilha. É o caminho
// de TODA venda de cartão: o cartão não guarda referência antes da `/obrigado`.
//
// A dedupe só precisa de um valor ESTÁVEL por sessão. Hash de mão única,
// síncrono (isto roda dentro do gtag, e `crypto.subtle` é assíncrono). O
// cyrb53 não é criptográfico, mas não precisa ser: a entrada é um UUID
// aleatório, e ninguém reconstrói 122 bits a partir de 53.
function hashDaSessao(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `s_${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

// Exportada pro `ga4.ts`: a compra do GA4 usa ESTA escada, e não uma cópia.
// Duas escadas paralelas sairiam de sincronia no primeiro conserto.
export function idDaTransacao(passado?: string): string | undefined {
  const candidato = passado?.trim() || transacaoGuardada()?.trim();
  if (candidato) return candidato;
  try {
    // Import dinâmico não dá: isto roda dentro do gtag. `mp_session_id` é a
    // mesma chave que `session-context.ts` usa, lida direto pra não arrastar
    // aquele módulo pra cá.
    const s = localStorage.getItem("mp_session_id")?.trim();
    if (s) return hashDaSessao(s);
  } catch {
    // storage bloqueado
  }
  return undefined;
}

/**
 * O e-mail do comprador como o Google quer pras conversões otimizadas: sem
 * espaço nas pontas e minúsculo (a tag faz o hash SHA-256 antes de mandar).
 * Fora do formato, nada: e-mail inválido não casa ninguém e só polui.
 */
export function emailParaConversao(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  return e && emailPlausivel(e) ? e : null;
}

export function conversaoCompra(args: {
  valor?: number;
  moeda?: "BRL" | "USD";
  transactionId?: string;
  /** O e-mail de quem comprou. Só é usado na Ballad (ver abaixo). */
  email?: string | null;
}) {
  if (typeof window === "undefined" || !window.gtag || !CONVERSAO) return;
  const id = idDaTransacao(args.transactionId);
  // ── CONVERSÕES OTIMIZADAS, SÓ NA BALLAD (16/10) ──────────────────
  //
  // Na Ballad a TAG da /obrigado é a conversão principal: a conta nova não
  // aceita a lista importada (`CUSTOMER_NOT_ALLOWLISTED`), então o Google só
  // sabe da venda por aqui, e sem dado do comprador ele só casa quem ainda
  // tem o cookie do clique. Com o e-mail (a tag faz o hash, ele nunca sai
  // cru), o Google casa também quem trocou de aparelho ou bloqueou cookie.
  //
  // Na Serenata NADA muda: lá a principal é a lista em último clique
  // (`api/conversoes.ts`) e esta tag é secundária; mexer nela não ensina nada
  // ao lance e só mandaria dado pessoal à toa.
  //
  // Pelo `gtag('set')`, nunca pela URL: o endereço da /obrigado vai inteiro
  // pro Google. E ANTES do evento, que é o que a tag lê na hora de mandar.
  if (ehBallad()) {
    const email = emailParaConversao(args.email);
    if (email) window.gtag("set", "user_data", { email });
  }
  window.gtag("event", "conversion", {
    send_to: CONVERSAO,
    // Sem default mágico: o valor vem do catálogo de moeda pelo chamador.
    // Um 37 cravado aqui sobreviveria à mudança de preço e o Google passaria
    // a otimizar em cima de um número que não existe mais.
    value: args.valor ?? 38,
    currency: args.moeda ?? "BRL",
    // Presente quando existe, AUSENTE quando não existe. Nunca vazio.
    ...(id ? { transaction_id: id } : {}),
  });
}
