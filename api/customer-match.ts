// AS LISTAS DE PÚBLICO, NO FORMATO QUE O GOOGLE ADS BUSCA SOZINHO.
//
// ── O BURACO QUE ISTO FECHA ──────────────────────────────────────
//
// As três listas de Customer Match da conta estão em ZERO desde agosto:
//
//   9462840188  Serenata · Gerou PIX e não pagou       0
//   9464037546  Serenata · Compradores                 0
//   9464038755  Serenata · Música pronta, não comprou  0
//
// Elas ficaram vazias porque a tentativa de preencher foi pela API do Google
// Ads (`offlineUserDataJobs`), que devolveu `CUSTOMER_NOT_ALLOWLISTED_FOR_
// THIS_FEATURE`. Isso é uma liberação da API, NÃO da conta: pelo painel,
// Customer Match sempre funcionou aqui — a lista `EMAILS` (9453027369) tem
// 1.100 correspondências e está elegível pra Busca e pra Display.
//
// Ou seja, nunca faltou permissão, faltou o transporte certo. Este arquivo é
// o transporte certo: mesma porta do `conversoes.ts`, que o Google já busca
// todo dia sem reclamar.
//
// ── POR QUE ENDPOINT E NÃO CSV NA MÃO ────────────────────────────
//
// Lista de público envelhece de um jeito que lista de conversão não
// envelhece: comprador novo entra todo dia, e uma lista subida na mão vira
// foto do dia em que foi subida. Conectada, o Google rebusca sozinho.
//
// ── HASH: O QUE O GOOGLE EXIGE ───────────────────────────────────
//
// SHA-256 em hexadecimal MINÚSCULO do e-mail normalizado (trim + minúsculo).
// Três jeitos de errar isso, todos silenciosos — o Google aceita o arquivo,
// diz "processando", e 48h depois a lista aparece com zero correspondências:
//
//   hex em MAIÚSCULO ......... casa zero
//   e-mail não normalizado ... "Joao@X.com" e "joao@x.com" viram hashes
//                              diferentes, e o cliente conta como dois
//   BOM no começo do arquivo . o Google lê o cabeçalho como "﻿Email"
//
// ── A LISTA DO PARCEIRO ──────────────────────────────────────────
//
// Com `?parceiro=1` a saída inclui a base da Cantoria, que já vem com hash
// pronto do lado deles (mesma normalização, conferida: 64 hex minúsculos).
// Autorização é acordo entre as duas empresas, registrada pelo dono.
//
// Se a busca no parceiro FALHAR, este endpoint devolve 500 e não uma lista
// menor. Uma lista que encolhe pode fazer o Google remover membros; erro
// alto aparece no painel, lista curta não aparece em lugar nenhum. É a mesma
// regra do `conversoes.ts`: 500 e nunca um arquivo vazio.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { autorizadoBasic, logRequisicao } from "./lib/basic-auth.js";

type Req = IncomingMessage & {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & {
  status: (c: number) => Res;
  json: (b: unknown) => void;
  send: (b: string) => void;
};

/** Teto de membresia do Customer Match. Nada além disso vale mandar. */
const DIAS_MAX = 540;
const DIAS_PADRAO = 540;
const PAGINA = 1000;

type Segmento = "compradores" | "pix-nao-pago" | "leads";
const SEGMENTOS: Segmento[] = ["compradores", "pix-nao-pago", "leads"];

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Normalização do Google: sem espaço nas pontas, tudo minúsculo.
 *
 * Não removemos ponto de endereço @gmail. O Google documenta isso como
 * opcional e faz a normalização do lado dele; fazer só de um lado é o que
 * cria hash que não casa.
 */
export function hashEmail(email: string): string | null {
  const limpo = email.trim().toLowerCase();
  // Barra o que claramente não é endereço antes de virar hash: depois de
  // hasheado não dá mais pra inspecionar, e lixo dentro da lista só derruba
  // a taxa de correspondência que a gente usa pra julgar se deu certo.
  if (!limpo || !limpo.includes("@") || limpo.length < 6) return null;
  return createHash("sha256").update(limpo, "utf8").digest("hex");
}

/**
 * Lê uma tabela inteira paginando.
 *
 * O PostgREST corta em 1000 linhas e `.limit()` NÃO levanta esse teto: ele é
 * do servidor. Toda leitura que não pagina mente quando a tabela cresce, e
 * aqui mentir significa entregar ao Google só os compradores mais recentes,
 * calada — exatamente o defeito que a primeira versão do `conversoes.ts`
 * teve.
 */
async function paginado<T>(
  monta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await monta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = data ?? [];
    for (const l of lote) out.push(l);
    if (lote.length < PAGINA) break;
  }
  return out;
}

/** Baixa a lista já hasheada do parceiro. Lança se não vier inteira. */
async function listaDoParceiro(): Promise<string[]> {
  const url = process.env.PARCEIRO_MATCH_URL;
  const usuario = process.env.PARCEIRO_MATCH_USUARIO;
  const senha = process.env.PARCEIRO_MATCH_SENHA;
  if (!url || !usuario || !senha) throw new Error("PARCEIRO_MATCH_* não configurado");

  const r = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${usuario}:${senha}`).toString("base64") },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`parceiro devolveu HTTP ${r.status}`);

  const linhas = (await r.text()).replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // Fora o cabeçalho, e só o que é hash de verdade. Se o formato do lado
  // deles mudar, isto some em vez de contaminar a lista com texto solto.
  const hashes = linhas.slice(1).map((l) => l.replace(/^"|"$/g, "").trim().toLowerCase())
    .filter((l) => /^[a-f0-9]{64}$/.test(l));
  if (!hashes.length) throw new Error("parceiro devolveu lista vazia");
  return hashes;
}

export default async function handler(req: Req, res: Res) {
  logRequisicao("customer-match", req);

  const esperado = process.env.CONVERSOES_SECRET;
  if (!esperado) {
    // FECHA. Sem segredo, isto serviria a base de clientes pra quem
    // adivinhasse o caminho. É o erro herdado que o CLAUDE.md proíbe.
    return res.status(503).json({ error: "CONVERSOES_SECRET não configurado" });
  }
  const url = new URL(req.url ?? "/", "https://serenatagift.com");
  if (!autorizadoBasic(req, url, esperado, process.env.CONVERSOES_USUARIO || "google")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="customer-match"');
    return res.status(401).json({ error: "credenciais inválidas" });
  }

  const pedido = (url.searchParams.get("lista") ?? "compradores") as Segmento;
  if (!SEGMENTOS.includes(pedido)) {
    return res.status(400).json({ error: `lista inválida; use ${SEGMENTOS.join(", ")}` });
  }
  const comParceiro = url.searchParams.get("parceiro") === "1";
  const dias = Math.min(DIAS_MAX, Math.max(1, Number(url.searchParams.get("dias")) || DIAS_PADRAO));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const hashes = new Set<string>();
  let brutos = 0;

  try {
    const sb = db();

    // Quem pagou, sempre. Serve como a lista `compradores` e como o
    // conjunto a subtrair das outras duas.
    const pagos = await paginado<{ email: string | null; quiz_response_id: string | null }>(
      (de, ate) => sb.from("pedidos")
        .select("email, quiz_response_id")
        .eq("status", "pago")
        // Resgate de crédito não é comprador novo entrando.
        .not("dinheiro_entrou", "is", false)
        .gte("paid_at", desde)
        .order("paid_at", { ascending: false })
        .range(de, ate),
    );
    const emailsPagos = new Set<string>();
    const sessoesPagas = new Set<string>();
    for (const p of pagos) {
      if (p.email) emailsPagos.add(p.email.trim().toLowerCase());
      if (p.quiz_response_id) sessoesPagas.add(p.quiz_response_id);
    }

    const juntar = (email: string | null | undefined) => {
      if (!email) return;
      brutos += 1;
      const h = hashEmail(email);
      if (h) hashes.add(h);
    };

    if (pedido === "compradores") {
      for (const e of emailsPagos) juntar(e);
    } else if (pedido === "pix-nao-pago") {
      const pendentes = await paginado<{ email: string | null; quiz_response_id: string | null }>(
        (de, ate) => sb.from("pedidos")
          .select("email, quiz_response_id")
          .eq("status", "pendente")
          .gte("created_at", desde)
          .order("created_at", { ascending: false })
          .range(de, ate),
      );
      for (const p of pendentes) {
        // Pagou depois? O pendente fica no banco pra sempre; o que decide é
        // existir um pago na mesma sessão. Mesma trava do `pixNaoPago`.
        if (p.quiz_response_id && sessoesPagas.has(p.quiz_response_id)) continue;
        if (p.email && emailsPagos.has(p.email.trim().toLowerCase())) continue;
        juntar(p.email);
      }
    } else {
      const leads = await paginado<{ email: string | null; id: string }>(
        (de, ate) => sb.from("quiz_responses")
          .select("id, email")
          .not("email", "is", null)
          .gte("created_at", desde)
          .order("created_at", { ascending: false })
          .range(de, ate),
      );
      for (const l of leads) {
        if (sessoesPagas.has(l.id)) continue;
        if (l.email && emailsPagos.has(l.email.trim().toLowerCase())) continue;
        juntar(l.email);
      }
    }
  } catch (err) {
    console.error("[customer-match] consulta falhou:", err);
    return res.status(500).json({ error: "falha ao montar a lista" });
  }

  const proprios = hashes.size;
  let doParceiro = 0;
  if (comParceiro) {
    try {
      const deles = await listaDoParceiro();
      doParceiro = deles.length;
      for (const h of deles) hashes.add(h);
    } catch (err) {
      // 500, e nunca a lista só com a nossa parte: encolher a lista pode
      // fazer o Google remover membros que estavam certos.
      console.error("[customer-match] parceiro falhou:", err);
      return res.status(500).json({ error: "falha ao ler a lista do parceiro" });
    }
  }

  console.log(
    `[customer-match] lista=${pedido} parceiro=${comParceiro} ` +
    `brutos=${brutos} proprios=${proprios} parceiro=${doParceiro} total=${hashes.size}`,
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Disposition", 'attachment; filename="customer-match.csv"');
  // Sem BOM. Cabeçalho exatamente "Email".
  return res.status(200).send("Email\n" + [...hashes].join("\n") + "\n");
}
