import { getCookie, setCookie } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// Lógica de autenticação do painel. Arquivo `.server.ts` de propósito: o
// bundler nunca o inclui no cliente (o import de node:crypto quebrava o build
// quando isto vivia junto das server functions).
//
// Escrito para NÃO repetir os erros herdados (CLAUDE.md):
//   - `admin_session=true` era forjável por curl. Aqui o cookie é um token
//     ASSINADO com HMAC-SHA256 e expiração DENTRO da assinatura: sem o
//     segredo do servidor não dá pra fabricar nem esticar a validade.
//   - Comparações timing-safe, pra não vazar o segredo pelo tempo de resposta.
//   - Fail-CLOSED: sem ADMIN_SECRET ninguém entra. (O webhook do numaya fazia
//     o oposto: `!secretEsperado || ...` aceitava qualquer POST.)

const COOKIE = "mp_admin";
const DURACAO_S = 60 * 60 * 12; // 12h

function segredo(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SECRET ausente ou curto demais (mín. 16 caracteres)");
  }
  return s;
}

function assinar(payload: string): string {
  return createHmac("sha256", segredo()).update(payload).digest("base64url");
}

function iguaisSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function tokenValido(token: string | undefined): boolean {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const [expira, nonce, assinatura] = partes;
  if (!iguaisSeguro(assinatura, assinar(`${expira}.${nonce}`))) return false;
  const exp = Number(expira);
  return Number.isFinite(exp) && exp > Date.now();
}

/** Valida a senha e, se bater, grava o cookie assinado. */
export async function autenticar(senha: string): Promise<boolean> {
  let esperado: string;
  try {
    esperado = segredo();
  } catch {
    return false; // sem segredo configurado: painel fechado
  }
  if (!senha || !iguaisSeguro(senha, esperado)) {
    await new Promise((r) => setTimeout(r, 400)); // desencoraja força bruta
    return false;
  }
  const payload = `${Date.now() + DURACAO_S * 1000}.${randomBytes(8).toString("hex")}`;
  setCookie(COOKIE, `${payload}.${assinar(payload)}`, {
    httpOnly: true, // o JS da página não lê
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_S,
  });
  return true;
}

export function encerrarSessao(): void {
  setCookie(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Chamada no topo de TODA consulta do painel. Lança se não autenticado. */
export function exigirAdmin(): void {
  if (!tokenValido(getCookie(COOKIE))) throw new Error("nao-autorizado");
}
