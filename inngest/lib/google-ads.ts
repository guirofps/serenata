// inngest/lib/google-ads.ts
// O CLIENTE DA API DO GOOGLE ADS, usado pelo `puxarMetricasAds` e pelo
// `puxarCriativosAds`. Cada deploy (Serenata, Ballad) usa as próprias envs.
// Quais contas: `contasGoogleAds` (a Serenata lê a nova E a suspensa desde 17/10).
import type { Linha } from "../../src/lib/ler-criativos-google.js";
import { contasGoogleAds, type ContaGoogleAds } from "../../src/lib/contas-google-ads.js";

export { contasGoogleAds, type ContaGoogleAds };

export const API = "https://googleads.googleapis.com/v25";

export async function tokenGoogleAds(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const j = (await r.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error("OAuth do Google Ads falhou: " + (j.error_description ?? "sem token"));
  return j.access_token;
}

/** Sem `conta`, a primeira de `contasGoogleAds` (a que recebe escrita). */
export async function consultarGoogleAds(gaql: string, acesso?: string, conta?: ContaGoogleAds): Promise<Linha[]> {
  const alvo = conta ?? contasGoogleAds()[0];
  if (!alvo) throw new Error("sem GOOGLE_ADS_CUSTOMER_ID");
  const cid = alvo.id;
  const H: Record<string, string> = {
    Authorization: `Bearer ${acesso ?? (await tokenGoogleAds())}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "content-type": "application/json",
  };
  // Conta filha de MCC: sem este cabeçalho a consulta volta vazia em vez de dar erro.
  if (alvo.login) H["login-customer-id"] = alvo.login;
  try {
    return await paginas(cid, gaql, H);
  } catch (err) {
    // O login de produção não enxergava a conta nova pela MCC Falkland (18/10,
    // "The caller does not have permission") e o painel ficou sem o gasto. Com
    // o login convidado DIRETO na conta, ele só entra sem o cabeçalho da MCC.
    if (!alvo.login || !/permission/i.test(String(err))) throw err;
    delete H["login-customer-id"];
    return paginas(cid, gaql, H);
  }
}

/** Todas as páginas de uma consulta GAQL (a API devolve 10.000 por página). */
async function paginas(cid: string, gaql: string, H: Record<string, string>): Promise<Linha[]> {
  const todas: Linha[] = [];
  let pageToken: string | undefined;
  for (let pagina = 0; pagina < 50; pagina++) {
    const r = await fetch(`${API}/customers/${cid}/googleAds:search`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ query: gaql, ...(pageToken ? { pageToken } : {}) }),
    });
    const j = (await r.json()) as { results?: Linha[]; nextPageToken?: string; error?: { message?: string } };
    if (j.error) throw new Error(`Google Ads ${cid}: ` + (j.error.message ?? "erro"));
    todas.push(...(j.results ?? []));
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return todas;
}

/**
 * A mesma consulta em todas as contas, linhas juntas. Uma conta que falha é
 * pulada (e logada); só lança se NENHUMA respondeu.
 */
export async function consultarTodasAsContas(gaql: string, acesso?: string): Promise<Linha[]> {
  const contas = contasGoogleAds();
  const linhas: Linha[] = [];
  const falhas: string[] = [];
  for (const conta of contas) {
    try {
      linhas.push(...(await consultarGoogleAds(gaql, acesso, conta)));
    } catch (err) {
      console.error("[google-ads] conta", conta.id, "falhou:", err);
      falhas.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (falhas.length === contas.length) throw new Error(falhas.join(" | ") || "sem GOOGLE_ADS_CUSTOMER_ID");
  return linhas;
}

export async function fusoDaConta(acesso?: string, conta?: ContaGoogleAds): Promise<string> {
  const [l] = await consultarGoogleAds("SELECT customer.time_zone FROM customer", acesso, conta);
  const fuso = (l?.customer as { timeZone?: string } | undefined)?.timeZone;
  return fuso || "America/Sao_Paulo";
}
