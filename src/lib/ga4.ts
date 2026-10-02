// GA4: o segundo destino do funil.
//
// Irmão de `google-ads.ts` e `tiktok-pixel.ts`, de propósito: mesmo desenho,
// mesmas travas. O banco próprio (`funnel_events`) continua sendo a verdade
// e recebe tudo; este módulo decide o que, disso, pode sair pro Google.
//
// ── O ID É DA MARCA ──────────────────────────────────────────────
//
// Mesma regra do GOOGLE_ADS_ID: cravado na Serenata, por env na Ballad, e
// sem id o módulo inteiro é no-op. Melhor não medir que medir na propriedade
// errada.
//
// ── `send_to` EM TODA CHAMADA ────────────────────────────────────
//
// O GA4 entrou como DESTINO da tag que carrega o Ads (`GT-5TWGDWC6`). Um
// `gtag('event', ...)` sem `send_to` vai pra TODOS os destinos da tag,
// inclusive o `AW-16919557808`: um `purchase` daqui chegaria no Ads como uma
// terceira contagem da mesma venda, pelo caminho mais difícil de perceber.
// O dono decidiu "públicos sim, conversão não" em 01/10; esta é a trava
// técnica dessa decisão.

import { MARCA_ATIVA } from "@/lib/marca-identidade";
import { rotaSensivel } from "@/lib/rotas-sensiveis";
import { idDaTransacao } from "@/lib/google-ads";

const ENV = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const GA4_ID: string | null =
  MARCA_ATIVA.chave === "serenata" ? "G-E2EKHK3RQF" : ENV.VITE_GA4_ID?.trim() || null;

/**
 * Os nomes nossos que sobem para nome padrão do GA4 NO PONTO DE CHAMADA, por
 * função tipada (abaixo). O encaminhamento automático pula estes: o GA4
 * recebe `begin_checkout`, nunca `checkout_click` + `begin_checkout`.
 */
export const PROMOVIDOS: ReadonlySet<string> = new Set([
  "letra_finalizada",
  "oferta_vista",
  "checkout_click",
  "pix_transparente_gerado",
]);

// `page_view` é a única colisão entre os nossos nomes e os do GA4, que já o
// coleta sozinho: mandar o nosso dobraria a contagem.
const NAO_ENCAMINHAR: ReadonlySet<string> = new Set(["page_view", ...PROMOVIDOS]);

// ── O FILTRO TEM DUAS CAMADAS ────────────────────────────────────
//
// Pela CHAVE: identificador do Meta (é `fbp`/`fbc` no payload do trackEvent;
// `_fbp`/`_fbc` são os cookies), o `path` (o GA4 já tem `page_location`), o
// objeto de atribuição (achatado à parte), os parâmetros que o GA4 trata como
// especiais (só as funções tipadas podem pô-los, senão um payload qualquer
// viraria receita) e tudo que tem cara de dado pessoal.
//
// Pela FORMA do valor: texto só passa se parecer rótulo. Pega o texto livre
// que chega por chave inocente — o `titulo` da letra pode ser "Para Camila",
// e nenhuma lista de chaves adivinha isso. O pior caso deste rigor é um
// parâmetro útil não chegar, e isso se descobre olhando o GA4. O contrário,
// nome de pessoa no Google, ninguém descobre.
const FORA: ReadonlySet<string> = new Set([
  "fbp",
  "fbc",
  "_fbp",
  "_fbc",
  "path",
  "attribution",
  "device",
  "value",
  "currency",
  "transaction_id",
  "send_to",
  "items",
]);
const CHAVE_PESSOAL = /email|token|telefone|phone|cpf|chave|senha|nome/i;
const ROTULO = /^[A-Za-z0-9_.:-]{1,40}$/;
const ATRIBUICAO = ["ref", "utm_source", "utm_medium", "utm_campaign"] as const;
const TETO_PARAMS = 25; // limite do GA4 por evento

type Escalar = string | number | boolean;

function aceita(v: unknown): v is Escalar {
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && ROTULO.test(v);
}

/** Pura: o que de `dados` pode virar parâmetro no GA4. */
export function montarParams(dados: Record<string, unknown>): Record<string, Escalar> {
  const saida: Record<string, Escalar> = {};
  const por = (chave: string, valor: unknown) => {
    if (!(chave in saida) && Object.keys(saida).length >= TETO_PARAMS) return;
    if (aceita(valor)) saida[chave] = valor;
  };
  por("device", dados.device);
  const atribuicao = dados.attribution;
  if (atribuicao && typeof atribuicao === "object") {
    for (const chave of ATRIBUICAO) por(chave, (atribuicao as Record<string, unknown>)[chave]);
  }
  for (const chave of Object.keys(dados).sort()) {
    if (FORA.has(chave) || CHAVE_PESSOAL.test(chave)) continue;
    por(chave, dados[chave]);
  }
  return saida;
}

/**
 * O único `gtag` deste módulo. `send_to` vai POR ÚLTIMO: nenhum parâmetro
 * consegue mandar o evento pra outro destino.
 *
 * Rota sensível é conferida aqui também, e não só no `__root` (que nem
 * carrega o gtag lá): se alguém um dia carregar antes da checagem, o módulo
 * continua calado.
 */
export function enviarEvento(
  nome: string,
  params: Record<string, unknown>,
  id: string | null = GA4_ID,
): void {
  if (!id || typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (rotaSensivel(window.location?.pathname ?? "/")) return;
  window.gtag("event", nome, { ...params, send_to: id });
}

/** Chamado pelo `trackEvent` com tudo; manda o que não for pulado. */
export function encaminharGa4(
  nome: string,
  dados: Record<string, unknown>,
  id: string | null = GA4_ID,
): void {
  if (NAO_ENCAMINHAR.has(nome)) return;
  enviarEvento(nome, montarParams(dados), id);
}

// ── A PROMOÇÃO, NO PONTO DE CHAMADA ──────────────────────────────
//
// Mesmo mecanismo do `tiktok-pixel.ts` (`carrinhoTiktok`, `checkoutTiktok`):
// funções tipadas chamadas onde o evento acontece. O valor chega em UNIDADE
// CHEIA por contrato, porque os payloads de hoje divergem — `checkout_click`
// manda `plano.valor`, `pix_transparente_gerado` manda `valorCentavos`. Um
// mapa que lesse `payload.valor` registraria R$ 3.800 num PIX de R$ 38.

export type Valor = { valor: number; moeda: "BRL" | "USD" };

// Ticket R$ 38, US$ 19: nada que se vende aqui chega a mil. Acima disso é
// centavo passado por engano. O evento ainda conta como etapa, mas sem
// `value`: etapa sem valor não envenena a receita; receita 100x maior sim.
const TETO_VALOR = 1000;

function comValor({ valor, moeda }: Valor): Record<string, unknown> {
  if (!Number.isFinite(valor) || valor <= 0 || valor > TETO_VALOR) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[ga4] valor fora da unidade cheia, enviado sem value: ${valor}`);
    }
    return {};
  }
  return { value: valor, currency: moeda };
}

/** A letra grátis pronta: é quando a visita vira lead. Sem valor de propósito. */
export function leadGa4(id: string | null = GA4_ID): void {
  enviarEvento("generate_lead", {}, id);
}

/** Viu a oferta com preço. */
export function vitrineGa4(v: Valor, id: string | null = GA4_ID): void {
  enviarEvento("view_item", comValor(v), id);
}

/** Clicou pra pagar e foi pro checkout de verdade (não o resgate de crédito). */
export function checkoutGa4(v: Valor, id: string | null = GA4_ID): void {
  enviarEvento("begin_checkout", comValor(v), id);
}

/** O meio de pagamento foi apresentado (o código do PIX nasceu). */
export function pagamentoGa4(
  v: Valor & { meio: "pix" | "cartao" },
  id: string | null = GA4_ID,
): void {
  enviarEvento("add_payment_info", { ...comValor(v), payment_type: v.meio }, id);
}

/**
 * A venda. Sai do MESMO ponto que a conversão do Ads (`Obrigado.tsx`), com a
 * MESMA escada de `transaction_id`, que nasceu de medir 23 vendas num dia e
 * 8 contadas. Sem id o campo é OMITIDO: vazio, o Google descarta.
 */
export function compraGa4(v: Valor & { transactionId?: string }, id: string | null = GA4_ID): void {
  const transacao = idDaTransacao(v.transactionId);
  enviarEvento(
    "purchase",
    { ...comValor(v), ...(transacao ? { transaction_id: transacao } : {}) },
    id,
  );
}
