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
import { segredoConfere } from "./lib/segredo.js";

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

/**
 * Mesma autenticação das conversões, e de propósito.
 *
 * O formulário de agendamento do Google pede URL, usuário e senha, e recusa
 * sem os dois últimos. O `?k=` fica como segunda porta porque é o que permite
 * conferir o arquivo com um `curl` sem montar cabeçalho. As duas comparam em
 * tempo constante.
 */
function autorizado(req: Req, url: URL, esperado: string): boolean {
  if (segredoConfere(url.searchParams.get("k"), esperado)) return true;

  const cru = req.headers["authorization"];
  const cabecalho = typeof cru === "string" ? cru : Array.isArray(cru) ? cru[0] : null;
  if (!cabecalho?.toLowerCase().startsWith("basic ")) return false;

  let decodificado: string;
  try {
    decodificado = Buffer.from(cabecalho.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  // `indexOf` e não `split(":")`: senha PODE conter dois-pontos, e partir em
  // todos truncaria a senha em silêncio.
  const corte = decodificado.indexOf(":");
  if (corte < 0) return false;
  const okUsuario = segredoConfere(decodificado.slice(0, corte), process.env.CONVERSOES_USUARIO || "google");
  const okSenha = segredoConfere(decodificado.slice(corte + 1), esperado);
  // Sem `&&` que saia cedo: curto-circuito depois do usuário deixaria o tempo
  // de resposta contar se ele acertou.
  return okUsuario && okSenha;
}

export default async function handler(req: Req, res: Res) {
  const url = new URL(req.url ?? "/", "https://serenatagift.com");

  const esperado = process.env.CONVERSOES_SECRET;
  if (!esperado || !autorizado(req, url, esperado)) {
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

  console.log(`[publicos] ${pedida}: ${hashes.length} membros`);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  // Nunca cacheado: o Google busca uma vez por dia e tem que ver quem entrou
  // ontem, não a resposta guardada da semana passada por uma borda da Vercel.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Disposition", `attachment; filename="${pedida}.csv"`);
  // Cabeçalho `Email` é o que o Google Ads espera para Customer Match.
  return res.status(200).send("Email\n" + hashes.join("\n") + "\n");
}
