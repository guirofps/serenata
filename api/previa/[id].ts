// A PRÉVIA, SERVIDA PELO NOSSO DOMÍNIO.
//
// ── POR QUE ESTA ROTA EXISTE ─────────────────────────────────────
//
// O provedor devolve DUAS URLs de áudio, e elas ficam prontas em momentos
// muito diferentes. Medido em 30/08, duas gerações reais:
//
//   22s a 32s   `streamAudioUrl` aparece e JÁ serve áudio tocável
//               (3.091.206 bytes baixados no instante, 118s de música)
//   57s a 74s   `audioUrl`, o MP3 final, aparece
//
// A gente esperava o final e mostrava "gerando" por ~2 minutos. O concorrente
// entrega prévia em 30 a 40 segundos, e a diferença nunca foi fornecedor,
// crédito nem infraestrutura: era qual das duas URLs se usa.
//
// ── POR QUE NÃO MANDAR A URL DO PROVEDOR DIRETO ──────────────────
//
// Porque ela se chama `audiopipe.suno.ai` (ou `musicfile.kie.ai`), e o
// primeiro concorrente que abrisse o DevTools saberia nosso fornecedor.
//
// Isso não é paranoia: está no CLAUDE.md que foi lendo a tag ID3 de um MP3
// que a gente descobriu que o ForeverSongs usa Suno, e existe uma regra
// (`ffmpeg -map_metadata -1`) só pra não entregar o mesmo de graça. Servir o
// stream cru desfaria essa proteção pela porta da frente.
//
// ── O QUE ESTA ROTA NÃO É ────────────────────────────────────────
//
// Não é a entrega. O comprador leva o arquivo limpo do nosso Storage, como
// sempre foi. Esta rota serve o que TOCA enquanto a música termina de nascer,
// e some do caminho assim que `audio_path` existe.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

type Req = IncomingMessage & {
  method?: string;
  query?: Record<string, string | string[]>;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & {
  status: (c: number) => Res;
  json: (b: unknown) => void;
  send: (b: unknown) => void;
};

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: Req, res: Res) {
  const cru = req.query?.id;
  const id = String(Array.isArray(cru) ? cru[0] : (cru ?? "")).trim();
  // A chave é o uuid da música. Não é adivinhável, e o que ela abre é a
  // mesma prévia que a pessoa ouve de graça na tela de espera.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: "id inválido" });
  }

  const { data: m } = await db()
    .from("musicas")
    .select("previa_url, status")
    .eq("id", id)
    .maybeSingle();

  if (!m?.previa_url) {
    // 404 e não 503: pra quem chama, "ainda não existe" e "nunca vai existir"
    // se resolvem do mesmo jeito, que é continuar esperando o arquivo final.
    return res.status(404).json({ error: "prévia ainda não disponível" });
  }

  // ── O REPASSE ────────────────────────────────────────────────
  //
  // `Range` viaja nos dois sentidos: sem ele o player não consegue arrastar a
  // barra, e o navegador baixa a faixa inteira antes de tocar o primeiro
  // segundo — que desfaria o ganho que esta rota existe pra dar.
  const range = req.headers["range"];
  let upstream: Response;
  try {
    upstream = await fetch(m.previa_url, {
      headers: typeof range === "string" ? { Range: range } : {},
    });
  } catch (err) {
    console.error("[previa] provedor não respondeu:", err);
    return res.status(502).json({ error: "prévia indisponível" });
  }

  if (!upstream.ok && upstream.status !== 206) {
    // O stream é temporário: quando a faixa fecha, ele morre. Isso é normal,
    // e a tela já terá trocado pelo arquivo final a essa altura.
    return res.status(404).json({ error: "prévia expirou" });
  }

  res.statusCode = upstream.status;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Accept-Ranges", "bytes");
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  // Sem cache: a prévia dura minutos e some. Guardar isso numa borda só
  // produziria 404 servido de cache depois que ela expira.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.end(buf);
}
