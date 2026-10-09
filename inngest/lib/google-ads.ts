// inngest/lib/google-ads.ts
// O CLIENTE DA API DO GOOGLE ADS, usado pelo `puxarMetricasAds` e pelo
// `puxarCriativosAds`. Cada deploy (Serenata, Ballad) usa as próprias envs.
import type { Linha } from "../../src/lib/ler-criativos-google.js";

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

/** Todas as páginas de uma consulta GAQL (a API devolve 10.000 por página). */
export async function consultarGoogleAds(gaql: string, acesso?: string): Promise<Linha[]> {
  const cid = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!cid) throw new Error("sem GOOGLE_ADS_CUSTOMER_ID");
  const H: Record<string, string> = {
    Authorization: `Bearer ${acesso ?? (await tokenGoogleAds())}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "content-type": "application/json",
  };
  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (mcc) H["login-customer-id"] = mcc;
  const todas: Linha[] = [];
  let pageToken: string | undefined;
  for (let pagina = 0; pagina < 50; pagina++) {
    const r = await fetch(`${API}/customers/${cid}/googleAds:search`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ query: gaql, ...(pageToken ? { pageToken } : {}) }),
    });
    const j = (await r.json()) as { results?: Linha[]; nextPageToken?: string; error?: { message?: string } };
    if (j.error) throw new Error("Google Ads: " + (j.error.message ?? "erro"));
    todas.push(...(j.results ?? []));
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return todas;
}

export async function fusoDaConta(acesso?: string): Promise<string> {
  const [l] = await consultarGoogleAds("SELECT customer.time_zone FROM customer", acesso);
  const fuso = (l?.customer as { timeZone?: string } | undefined)?.timeZone;
  return fuso || "America/Sao_Paulo";
}
