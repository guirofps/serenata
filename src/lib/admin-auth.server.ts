import { getCookie, setCookie } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { emailLiberado, lerListaDeAdmins } from "@/lib/admin-emails";

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

// DOIS PAPÉIS, e a diferença não é conforto: é o que a pessoa consegue ver.
//
// `admin`        — o dono. Painel inteiro, incluindo faturamento e custo.
// `recuperacao`  — quem trabalha o carrinho abandonado. Vê nome, telefone e a
//                  música de quem travou no Pix, e nada de dinheiro.
//
// Senhas separadas porque a rotatividade é diferente: se o operador sair,
// troca-se UMA variável e o acesso dele morre, sem mexer no do dono.
export type Papel = "admin" | "recuperacao";

function segredo(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SECRET ausente ou curto demais (mín. 16 caracteres)");
  }
  return s;
}

/** Senha do operador de recuperação. Ausente = ninguém entra por esse papel. */
function segredoRecuperacao(): string | null {
  const s = process.env.RECUPERACAO_SECRET;
  return s && s.length >= 16 ? s : null;
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

/**
 * Devolve o PAPEL do token, ou null.
 *
 * O papel entra DENTRO da assinatura, junto da expiração. Guardá-lo fora (num
 * segundo cookie, por exemplo) deixaria qualquer um se promover a admin
 * editando um valor no navegador — que é a versão moderna do
 * `admin_session=true` forjável que este arquivo existe pra não repetir.
 */
function papelDoToken(token: string | undefined): Papel | null {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 4) return null;
  const [expira, nonce, papel, assinatura] = partes;
  if (!iguaisSeguro(assinatura, assinar(`${expira}.${nonce}.${papel}`))) return null;
  const exp = Number(expira);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  return papel === "admin" || papel === "recuperacao" ? papel : null;
}

/** Valida a senha e, se bater, grava o cookie assinado com o papel. */
export async function autenticar(senha: string): Promise<Papel | null> {
  if (!senha) return null;

  let papel: Papel | null = null;
  try {
    if (iguaisSeguro(senha, segredo())) papel = "admin";
  } catch {
    // sem ADMIN_SECRET: o papel de dono fica fechado, mas o de recuperação
    // ainda pode funcionar. Fail-closed é por papel, não global.
  }
  if (!papel) {
    const rec = segredoRecuperacao();
    if (rec && iguaisSeguro(senha, rec)) papel = "recuperacao";
  }
  if (!papel) {
    await new Promise((r) => setTimeout(r, 400)); // desencoraja força bruta
    return null;
  }

  abrirSessao(papel);
  return papel;
}

/**
 * Grava o cookie de sessão assinado. UM lugar só, de propósito.
 *
 * Nasceu quando o login pelo Google entrou: são dois jeitos de PROVAR quem você
 * é (senha e Google) e um jeito só de ESTAR logado. Duas funções gravando
 * sessão significaria, na primeira vez que alguém encurtasse a validade ou
 * mexesse no `sameSite`, um caminho com a correção e outro sem — e o que fica
 * sem é o que o atacante usa.
 */
function abrirSessao(papel: Papel): void {
  const payload = `${Date.now() + DURACAO_S * 1000}.${randomBytes(8).toString("hex")}.${papel}`;
  setCookie(COOKIE, `${payload}.${assinar(payload)}`, {
    httpOnly: true, // o JS da página não lê
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_S,
  });
}

/**
 * ENTRADA PELO GOOGLE — a segunda forma de provar quem você é.
 *
 * O que muda em relação à senha é só a PROVA. A sessão que sai daqui é a mesma:
 * o mesmo cookie assinado, o mesmo papel dentro da assinatura, as mesmas 12h.
 * `exigirAdmin` não sabe por onde a pessoa entrou, e é isso que faz este
 * caminho ser um acréscimo em vez de um segundo sistema de autenticação.
 *
 * ── A LINHA QUE CARREGA A SEGURANÇA INTEIRA ──────────────────────
 *
 * O cliente manda um TOKEN, nunca um e-mail. Quem diz de quem é o token é o
 * Supabase, com a chave dele: `getUser(token)` valida a assinatura do JWT e
 * devolve o usuário. Aceitar um e-mail vindo do navegador seria o
 * `admin_session=true` forjável por curl — o primeiro item da lista de erros
 * herdados no CLAUDE.md — com outra roupa e o mesmo buraco.
 *
 * Devolve `null` em toda recusa, sem dizer qual foi: "e-mail não liberado" e
 * "token inválido" são a mesma resposta pra quem está tentando.
 */
export async function autenticarPorGoogle(accessToken: string): Promise<Papel | null> {
  if (!accessToken) return null;

  const lista = lerListaDeAdmins(process.env.ADMIN_EMAILS);
  // Curto-circuito antes de falar com o Supabase: sem lista ninguém entra, e
  // não há por que gastar uma ida à rede pra confirmar isso.
  if (lista.length === 0) {
    console.error("[admin] ADMIN_EMAILS ausente: entrada pelo Google está fechada");
    return null;
  }

  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const { data, error } = await supabaseAdmin().auth.getUser(accessToken);
  if (error || !data?.user) {
    console.error("[admin] token do Google não validou:", error?.message);
    return null;
  }

  const u = data.user;
  // E-MAIL CONFIRMADO, sempre. Num login Google ele vem confirmado por
  // construção, mas a checagem não custa nada e fecha a porta pra qualquer
  // provider que venha a ser ligado depois no MESMO projeto Supabase sem
  // verificação de e-mail — e aí a lista de permissão passaria a valer contra
  // um endereço que ninguém provou ser seu.
  if (!u.email_confirmed_at) {
    console.error("[admin] e-mail sem confirmação:", u.email);
    return null;
  }

  if (!emailLiberado(u.email, lista)) {
    // Fica registrado: alguém logou com uma conta Google válida e pediu o
    // painel. Não é erro do sistema, é tentativa de acesso, e é a única coisa
    // aqui que vale olhar depois.
    console.error("[admin] conta fora da lista tentou o painel:", u.email);
    return null;
  }

  abrirSessao("admin");
  return "admin";
}

export function encerrarSessao(): void {
  setCookie(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Chamada no topo de TODA consulta do painel. Lança se não for o dono. */
export function exigirAdmin(): void {
  if (papelDoToken(getCookie(COOKIE)) !== "admin") throw new Error("nao-autorizado");
}

/**
 * Tela de recuperação: aceita o operador E o dono.
 *
 * O dono entra em tudo de propósito — ter que sair e logar de novo com outra
 * senha pra ver a própria fila é o tipo de atrito que faz ninguém usar.
 */
export function exigirRecuperacao(): void {
  const p = papelDoToken(getCookie(COOKIE));
  if (p !== "recuperacao" && p !== "admin") throw new Error("nao-autorizado");
}

/** Quem está logado agora. Serve pra tela decidir o que mostrar. */
export function papelAtual(): Papel | null {
  return papelDoToken(getCookie(COOKIE));
}
