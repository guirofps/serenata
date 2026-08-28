// O DEGRAU DA ESCADA, ASSINADO.
//
// ── POR QUE PRECISA DE ASSINATURA ────────────────────────────────
//
// A escada desce o preço com o tempo: R$ 38 nos primeiros degraus, R$ 29,
// R$ 19, e R$ 9 no fim. Enquanto o link ia pro checkout da Perfect Pay, cada
// degrau era um PRODUTO com preço fixo lá — o degrau não viajava na URL, e
// não havia o que adulterar.
//
// Com o checkout próprio, quem define o preço somos nós. Se o degrau fosse um
// parâmetro comum (`?d=11`), a primeira pessoa que reparasse compraria tudo a
// R$ 9 — e contaria pros outros. É a mesma família do `admin_session=true`
// forjável que o CLAUDE.md manda não repetir: confiar num valor que o cliente
// controla.
//
// Aqui o token carrega sessão + degrau + assinatura HMAC. Trocar qualquer um
// dos dois invalida a assinatura, e sem a chave não dá pra forjar outra.
//
// ── E A SESSÃO ENTRA NA ASSINATURA DE PROPÓSITO ──────────────────
//
// Sem ela, um token de R$ 9 legítimo (de quem chegou ao degrau 11) serviria
// pra QUALQUER pessoa: bastaria passar adiante. Com a sessão assinada junto,
// o token só compra a música daquela sessão — e ela já é dona da letra.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Só o servidor assina. Sem chave, nada é emitido e nada é aceito. */
function chave(): string | null {
  return process.env.RECUPERACAO_SECRET || null;
}

function base64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function assinar(corpo: string, k: string): string {
  return base64url(createHmac("sha256", k).update(corpo).digest());
}

/**
 * `<sessao>.<degrau>.<assinatura>`.
 *
 * Devolve `null` sem chave configurada, e quem chamou tem que tratar isso
 * como "não dá pra oferecer o degrau" — nunca como "então manda sem
 * assinatura".
 */
export function assinarOferta(sessao: string, degrau: number): string | null {
  const k = chave();
  if (!k || !sessao || !Number.isInteger(degrau)) return null;
  const corpo = `${sessao}.${degrau}`;
  return `${corpo}.${assinar(corpo, k)}`;
}

/** Devolve o que foi assinado, ou `null` se qualquer coisa não bater. */
export function conferirOferta(token: string): { sessao: string; degrau: number } | null {
  const k = chave();
  if (!k || !token) return null;
  // A sessão é um uuid (não tem ponto), então dois pontos separam três
  // partes. `split` com limite evita que um ponto injetado mude o sentido.
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [sessao, degrauCru, assinatura] = partes;
  const degrau = Number(degrauCru);
  if (!sessao || !Number.isInteger(degrau)) return null;

  const esperada = assinar(`${sessao}.${degrau}`, k);
  // TEMPO CONSTANTE, como manda o CLAUDE.md pra qualquer comparação de
  // segredo. `timingSafeEqual` exige mesmo tamanho, então o `length` primeiro
  // — e comprimento diferente já é assinatura errada.
  if (assinatura.length !== esperada.length) return null;
  if (!timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;

  return { sessao, degrau };
}
