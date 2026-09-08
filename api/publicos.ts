// AS LISTAS DE PÚBLICO, NO FORMATO QUE O GOOGLE ADS BUSCA SOZINHO.
//
// ── POR QUE ISTO EXISTE, E NÃO A API ─────────────────────────────
//
// O caminho óbvio era subir os membros pela API. Ele morreu em duas portas,
// nesta ordem:
//
// 1. A Google Ads API recusa: `CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE`,
//    "Customer Match uploads aren't supported in the Google Ads API. Use the
//    Data Manager API". Ela ainda CRIA a lista, só não põe ninguém dentro.
// 2. A Data Manager API pede o escopo `datamanager`, que o token não tem. E
//    conseguir esse escopo esbarrou na autenticação forte da conta do dono
//    (escopo sensível pedido por app não verificado), que travou em 01/09.
//
// Sobrava CSV na mão, e o dono cravou a objeção certa: lista que não atualiza
// sozinha não serve, porque ninguém repete upload manual toda semana.
//
// A saída estava dentro de casa. O Google Ads já busca `api/conversoes.ts`
// num horário agendado, por URL, com usuário e senha. Ele faz o mesmo com
// lista de clientes. Mesmo mecanismo, mesma autenticação, zero OAuth novo.
//
// ── O QUE SOBE, E O QUE NUNCA SOBE ───────────────────────────────
//
// Só SHA-256, em hexadecimal minúsculo. A normalização que o Customer Match
// exige (minúscula, sem espaço nas pontas) acontece ANTES do hash: se fosse
// depois, o mesmo endereço geraria hash diferente e não casaria com ninguém.
//
// E-mail em texto não sai daqui nem por acidente: a função que monta a linha
// só recebe hash.
//
// ── COMO AGENDAR (uma vez, no painel) ────────────────────────────
//
// Ferramentas › Gerenciador de público-alvo › Seus segmentos de dados › abre
// a lista › Fazer upload › Agendar, apontando pra:
//
//   https://www.serenatagift.com/api/publicos?lista=naoPediu
//   https://www.serenatagift.com/api/publicos?lista=abandonou
//   https://www.serenatagift.com/api/publicos?lista=compradores
//
// Usuário e senha são os mesmos das conversões (`CONVERSOES_USUARIO` e
// `CONVERSOES_SECRET`). Marque que os dados JÁ ESTÃO COM HASH.

import type { IncomingMessage, ServerResponse } from "node:http";
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

const LISTAS = ["abandonou", "naoPediu", "compradores"] as const;
type Lista = (typeof LISTAS)[number];

// A porta HTTP Basic mora em `lib/basic-auth.ts`, dividida com
// `conversoes.ts`. Módulo e não cópia: o bloco gêmeo dentro do webhook da
// Perfect Pay já ensinou que conserto num não vai no outro.

/**
 * Baixa a lista já hasheada do parceiro e devolve só o que é hash de verdade.
 *
 * A autorização de usar a base da Cantoria junto com a nossa é acordo entre
 * as duas empresas, registrado pelo dono em 08/09/2026.
 *
 * Lança em vez de devolver lista curta: quem chama transforma isso em 500.
 */
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
  // Fora o cabeçalho, e só o que é SHA-256 em hex minúsculo. Se o formato do
  // lado deles mudar, isto some em vez de contaminar a lista com texto solto
  // — e e-mail cru entrando aqui seria vazamento, não só erro de formato.
  const hashes = linhas.slice(1)
    .map((l) => l.replace(/^"|"$/g, "").trim().toLowerCase())
    .filter((l) => /^[a-f0-9]{64}$/.test(l));
  if (!hashes.length) throw new Error("parceiro devolveu lista vazia");
  return hashes;
}

export default async function handler(req: Req, res: Res) {
  logRequisicao("publicos", req);
  const url = new URL(req.url ?? "/", "https://serenatagift.com");

  const esperado = process.env.CONVERSOES_SECRET;
  if (!esperado || !autorizadoBasic(req, url, esperado, process.env.CONVERSOES_USUARIO || "google")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="publicos"');
    return res.status(401).json({ error: "não autorizado" });
  }

  const pedida = String(url.searchParams.get("lista") ?? "");
  if (!LISTAS.includes(pedida as Lista)) {
    return res.status(400).json({ error: "lista inválida", validas: LISTAS });
  }

  let hashes: string[];
  try {
    // Import dinâmico: a leitura do banco só carrega quando alguém autorizado
    // pede de verdade, e não em todo cold start desta função.
    const { segmentos } = await import("../inngest/lib/publicos-google.js");
    const seg = await segmentos();
    hashes = seg[pedida as Lista];
  } catch (err) {
    console.error("[publicos] consulta falhou:", err);
    // 500 e NÃO um arquivo vazio: arquivo vazio é resposta válida pro Google,
    // e ele esvaziaria a lista inteira achando que é a verdade de hoje. Erro
    // alto faz a importação aparecer como falha no painel, que é o que ela é.
    return res.status(500).json({ error: "falha ao montar a lista" });
  }

  // ── A BASE DO PARCEIRO, COM `?parceiro=1` ────────────────────
  //
  // Se a busca no parceiro falhar, devolve 500 e NÃO a lista só com a nossa
  // parte. Lista que encolhe pode fazer o Google remover membro que estava
  // certo; erro alto aparece no painel, lista curta não aparece em lugar
  // nenhum. Mesma regra do arquivo vazio, logo acima.
  let doParceiro = 0;
  if (url.searchParams.get("parceiro") === "1") {
    try {
      const deles = await listaDoParceiro();
      doParceiro = deles.length;
      // Set porque as duas bases podem ter a mesma pessoa, e o mesmo e-mail
      // normalizado dos dois lados gera o mesmo hash.
      hashes = [...new Set([...hashes, ...deles])];
    } catch (err) {
      console.error("[publicos] parceiro falhou:", err);
      return res.status(500).json({ error: "falha ao ler a lista do parceiro" });
    }
  }

  console.log(`[publicos] ${pedida}: ${hashes.length} membros (parceiro: ${doParceiro})`);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  // Nunca cacheado: o Google busca uma vez por dia e tem que ver quem entrou
  // ontem, não a resposta guardada da semana passada por uma borda da Vercel.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Disposition", `attachment; filename="${pedida}.csv"`);
  // Cabeçalho `Email` é o que o Google Ads espera para Customer Match.
  return res.status(200).send("Email\n" + hashes.join("\n") + "\n");
}
