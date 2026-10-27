// A PORTA DA DATA MANAGER API DO GOOGLE (27/10). Ver `src/lib/conversao-servidor.ts`.
//
// O token é do DONO, com os escopos `adwords` + `datamanager`
// (`scratch/autorizar-datamanager.mjs`), guardado em `GOOGLE_DM_REFRESH_TOKEN`.
// O cliente OAuth é o que gerou esse token (`GOOGLE_DM_CLIENT_ID/SECRET`): token
// de um cliente não renova com outro, e o `GOOGLE_ADS_CLIENT_*` de cada projeto
// da Vercel não é garantidamente o mesmo. Sem eles, cai no do Google Ads.
//
// Cada marca manda pra sua conta e sua ação, pelas envs do projeto:
//   GOOGLE_DM_CONTA  a conta do Google Ads (só dígitos)
//   GOOGLE_DM_LOGIN  por onde o token entra nela (a própria conta ou a MCC)
//   GOOGLE_DM_ACAO   o id da ação de conversão do tipo importação de cliques
// Faltou uma: desligado, sem erro. Esquecer a env nunca derruba nada.

import type { EventoGoogle } from "../../src/lib/conversao-servidor.js";

const BASE = "https://datamanager.googleapis.com/v1";

export type ConfigDm = { conta: string; login: string; acao: string };

export function configDm(): ConfigDm | null {
  const conta = (process.env.GOOGLE_DM_CONTA ?? "").replace(/\D/g, "");
  const acao = (process.env.GOOGLE_DM_ACAO ?? "").replace(/\D/g, "");
  const login = (process.env.GOOGLE_DM_LOGIN ?? "").replace(/\D/g, "") || conta;
  if (!conta || !acao || !process.env.GOOGLE_DM_REFRESH_TOKEN) return null;
  return { conta, login, acao };
}

let cache: { token: string; ate: number } | null = null;

async function token(): Promise<string> {
  if (cache && cache.ate > Date.now()) return cache.token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DM_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_DM_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_DM_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!j.access_token) throw new Error(`token do Google recusado: ${j.error ?? r.status}`);
  cache = { token: j.access_token, ate: Date.now() + ((j.expires_in ?? 3600) - 120) * 1000 };
  return j.access_token;
}

/** Manda as vendas. Devolve o `requestId` (o resultado de cada uma sai depois, em `statusDoEnvio`). */
export async function enviarEventos(
  cfg: ConfigDm,
  eventos: EventoGoogle[],
  validateOnly = false,
): Promise<{ ok: true; requestId: string } | { ok: false; erro: string }> {
  try {
    const r = await fetch(`${BASE}/events:ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: JSON.stringify({
        destinations: [
          {
            operatingAccount: { accountType: "GOOGLE_ADS", accountId: cfg.conta },
            loginAccount: { accountType: "GOOGLE_ADS", accountId: cfg.login },
            productDestinationId: cfg.acao,
          },
        ],
        // O hash do e-mail vai em hexadecimal (sha256, `api/conversoes-tempo-real.ts`).
        encoding: "HEX",
        events: eventos,
        validateOnly,
      }),
    });
    const texto = await r.text();
    if (!r.ok) return { ok: false, erro: `HTTP ${r.status}: ${texto.slice(0, 400)}` };
    const j = JSON.parse(texto) as { requestId?: string };
    return { ok: true, requestId: j.requestId ?? "" };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}

export type StatusDoEnvio = { estado: string; detalhe: string };

/** O resultado de um envio: PROCESSING, SUCCESS, PARTIAL_SUCCESS ou FAILURE. */
export async function statusDoEnvio(requestId: string): Promise<StatusDoEnvio> {
  const r = await fetch(`${BASE}/requestStatus:retrieve?requestId=${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${await token()}` },
  });
  const texto = await r.text();
  if (!r.ok) return { estado: `HTTP_${r.status}`, detalhe: texto.slice(0, 300) };
  const j = JSON.parse(texto) as {
    requestStatusPerDestination?: Array<{ requestStatus?: string; errorInfo?: unknown; warningInfo?: unknown }>;
  };
  const d = j.requestStatusPerDestination?.[0];
  const detalhe = d?.errorInfo ? JSON.stringify(d.errorInfo) : d?.warningInfo ? JSON.stringify(d.warningInfo) : "";
  return { estado: d?.requestStatus ?? "DESCONHECIDO", detalhe: detalhe.slice(0, 300) };
}
