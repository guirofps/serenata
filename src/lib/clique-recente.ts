// O ÚLTIMO CLIQUE DE ANÚNCIO, guardado ao lado do primeiro toque (16/10).
//
// ── O BURACO ─────────────────────────────────────────────────────
//
// A atribuição da casa é first-touch e NUNCA expira: depois que o navegador
// grava um toque (UTM, referrer, clique), qualquer chegada nova é ignorada
// (`captureFirstTouchAttribution`). Pros RELATÓRIOS isso é o certo, o painel
// inteiro lê canal e campanha pelo primeiro toque. Pros IDENTIFICADORES DE
// CLIQUE é um defeito:
//
// - O Google recusa clique com mais de 90 dias. Na auditoria de 16/10, 34
//   vendas em 7 dias subiram no CSV (`api/conversoes.ts`) com `gclid` de mais
//   de 30 dias, e o mais antigo ainda vivo é de 07/08: as recusas começariam
//   por volta de 05/11, justo com a pessoa tendo clicado num anúncio NOVO na
//   semana da compra (o clique que o Google precisava ver).
// - O TikTok só casa a venda do servidor com `ttclid`. Quem chegou primeiro
//   pelo Google e depois pelo TikTok nunca subia pro TikTok.
//
// ── A REGRA ──────────────────────────────────────────────────────
//
// As UTMs do primeiro toque ficam EXATAMENTE como eram. Ao lado, em
// `attribution.ultimo_clique`, os ids da última chegada que trouxe algum
// clique, com a hora da captura. Cada chegada com clique SOBRESCREVE o objeto
// inteiro (não mescla): os ids de uma chegada só valem com a hora DELA, e
// misturar um `gclid` velho com o `em` de um `ttclid` novo faria o clique
// velho parecer fresco. O primeiro toque continua lá como reserva.
//
// Puro (sem window, sem imports): usado pelo navegador, pelo painel e pelas
// rotas de `api/`, e testado sem navegador.

export type UltimoClique = {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  ttclid?: string;
  /** ISO da captura. */
  em: string;
};

/** O Google não aceita conversão de clique com mais de 90 dias. */
export const VALIDADE_GCLID_DIAS = 90;

const CHAVES = ["gclid", "gbraid", "wbraid", "ttclid"] as const;

type Atrib = Record<string, unknown> | null | undefined;

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Os ids de clique que vieram NESTA URL, ou `null` se não veio nenhum. */
export function ultimoCliqueDaUrl(search: string, agora: Date = new Date()): UltimoClique | null {
  const sp = new URLSearchParams(search);
  const out: UltimoClique = { em: agora.toISOString() };
  let algum = false;
  for (const k of CHAVES) {
    const v = texto(sp.get(k));
    if (v) {
      out[k] = v;
      algum = true;
    }
  }
  return algum ? out : null;
}

/** O `ultimo_clique` da atribuição, se for um objeto válido (veio do banco, é JSON livre). */
export function ultimoCliqueDe(attr: Atrib): UltimoClique | null {
  const u = attr?.ultimo_clique;
  if (!u || typeof u !== "object") return null;
  const r = u as Record<string, unknown>;
  const em = texto(r.em);
  if (!em) return null;
  const out: UltimoClique = { em };
  let algum = false;
  for (const k of CHAVES) {
    const v = texto(r[k]);
    if (v) {
      out[k] = v;
      algum = true;
    }
  }
  return algum ? out : null;
}

function ms(iso: string | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

/**
 * O mais recente de dois `ultimo_clique` (pelo `em`). Usado pelo `/retomar`,
 * que põe o registro do servidor POR CIMA do aparelho: sem isto, um clique
 * mais novo capturado neste aparelho seria trocado pelo velho do registro.
 */
export function cliqueMaisRecente(a: unknown, b: unknown): UltimoClique | null {
  const ua = ultimoCliqueDe({ ultimo_clique: a });
  const ub = ultimoCliqueDe({ ultimo_clique: b });
  if (!ua) return ub;
  if (!ub) return ua;
  const ta = ms(ua.em);
  const tb = ms(ub.em);
  if (!Number.isFinite(tb)) return ua;
  if (!Number.isFinite(ta)) return ub;
  return tb > ta ? ub : ua;
}

/**
 * O `gclid` que pode subir pro Google: o do último clique se ainda estiver na
 * validade, senão o do primeiro toque se estiver; nenhum fresco, nenhum.
 *
 * Primeiro toque SEM data legível (linha antiga, objeto mexido à mão) sobe
 * mesmo assim: era o comportamento de antes, e linha recusada pelo Google
 * custa menos que venda válida jogada fora.
 */
export function gclidParaConversao(
  attr: Atrib,
  agoraMs: number = Date.now(),
  validadeDias: number = VALIDADE_GCLID_DIAS,
): string | null {
  const limite = agoraMs - validadeDias * 86400000;
  const u = ultimoCliqueDe(attr);
  if (u?.gclid && ms(u.em) >= limite) return u.gclid;
  const primeiro = texto(attr?.gclid);
  if (!primeiro) return null;
  const quando = ms(texto(attr?.captured_at));
  if (Number.isFinite(quando) && quando < limite) return null;
  return primeiro;
}

/**
 * O `ttclid` da venda: o do último clique, senão o do primeiro toque. Sem
 * prazo daqui: quem decide se ainda atribui é o TikTok, e o gate continua o
 * mesmo (sem `ttclid` nenhum, a venda não é do TikTok e não sobe).
 */
export function ttclidDaVenda(attr: Atrib): string | null {
  return ultimoCliqueDe(attr)?.ttclid ?? texto(attr?.ttclid) ?? null;
}

/** O canal do último clique, pra quando o primeiro toque não diz nada. */
export function canalDoUltimoClique(attr: Atrib): "Google" | "TikTok" | null {
  const u = ultimoCliqueDe(attr);
  if (!u) return null;
  if (u.ttclid) return "TikTok";
  if (u.gclid || u.gbraid || u.wbraid) return "Google";
  return null;
}
