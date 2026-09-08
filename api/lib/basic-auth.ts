// HTTP BASIC PARA OS ARQUIVOS QUE O GOOGLE ADS VEM BUSCAR.
//
// Extraído de `api/conversoes.ts` quando o segundo endpoint (customer-match)
// precisou exatamente da mesma porta. Módulo e não cópia: o bloco gêmeo do
// webhook da Perfect Pay já ensinou que conserto num não vai no outro.
//
// Cada detalhe abaixo veio de uma falha real; ver os comentários.

import type { IncomingMessage } from "node:http";
import { segredoConfere } from "./segredo.js";

export type ReqBasic = IncomingMessage & {
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Confere a credencial de uma requisição do Google Ads.
 *
 * Aceita duas portas, as duas em tempo constante:
 *
 * 1. `Authorization: Basic ...` — é o que o Google usa. O formulário dele
 *    pede URL, nome de usuário e senha, e recusa sem os dois últimos. A
 *    primeira versão do `conversoes.ts` só tinha a porta do `?k=` por eu
 *    supor que a importação agendada só sabia buscar um endereço.
 * 2. `?k=<segredo>` — segunda porta, que permite conferir o arquivo com um
 *    `curl` sem montar cabeçalho.
 */
export function autorizadoBasic(
  req: ReqBasic,
  url: URL,
  esperado: string,
  usuarioEsperado: string,
): boolean {
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
  // todos truncaria a senha em silêncio — o pior tipo de recusa, a que parece
  // "credencial errada" quando na verdade é o nosso parser.
  const corte = decodificado.indexOf(":");
  if (corte < 0) return false;

  // Os dois em tempo constante, e sem `&&` que saia cedo: um curto-circuito
  // depois do usuário deixaria o tempo de resposta contar se ele acertou.
  const okUsuario = segredoConfere(decodificado.slice(0, corte), usuarioEsperado);
  const okSenha = segredoConfere(decodificado.slice(corte + 1), esperado);
  return okUsuario && okSenha;
}

/**
 * Só metadado, NUNCA o `Authorization` nem o `k` da query — log de produção é
 * lido por mais gente que o banco.
 *
 * Existe porque em 27/08 a importação do Google falhou com "Arquivo não
 * encontrado" DEPOIS de ter lido o mesmo arquivo com sucesso na configuração,
 * e sem ver a requisição dele não dava pra passar de palpite.
 */
export function logRequisicao(rotulo: string, req: ReqBasic & { method?: string; url?: string }) {
  const cru = req.headers["authorization"];
  const agente = req.headers["user-agent"];
  console.log(
    `[${rotulo}] req`,
    JSON.stringify({
      metodo: req.method ?? "?",
      caminho: (req.url ?? "").split("?")[0],
      temQuery: (req.url ?? "").includes("?"),
      temBasic: typeof cru === "string" && cru.toLowerCase().startsWith("basic "),
      agente: typeof agente === "string" ? agente.slice(0, 120) : null,
    }),
  );
}
