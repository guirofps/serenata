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

/**
 * Tira as tags ID3 do MP3, sem ffmpeg.
 *
 * ── POR QUE ISTO EXISTE ──────────────────────────────────────────
 *
 * O stream do provedor vem com esta tag dentro:
 *
 *   comment = made with suno; created=...; id=...
 *
 * Esconder a URL e servir o arquivo assim não esconderia nada: bastaria
 * baixar a prévia e abrir. É EXATAMENTE a tag que o CLAUDE.md registra como
 * a forma que a gente descobriu o gerador do ForeverSongs, e existe uma
 * regra no projeto (`ffmpeg -map_metadata -1`) só pra não entregar isso.
 *
 * Aqui não dá pra chamar o ffmpeg: ele não existe nesta função e o custo de
 * invocá-lo comeria o ganho de tempo que esta rota inteira existe pra dar.
 * Mas não precisa: ID3 é um cabeçalho no começo e um rodapé de 128 bytes no
 * fim, e cortar os dois é aritmética de buffer.
 */
function semTagsId3(buf: Buffer): Buffer {
  let ini = 0;
  // ID3v2: "ID3" + 2 de versão + 1 de flags + 4 de tamanho SYNCHSAFE (7 bits
  // úteis por byte, o oitavo é sempre 0 pra não imitar um frame de áudio).
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const tam =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    ini = 10 + tam;
    // Bit 4 das flags marca um footer de mais 10 bytes.
    if (buf[5] & 0x10) ini += 10;
  }
  let fim = buf.length;
  // ID3v1: os últimos 128 bytes, começando com "TAG".
  if (fim - ini >= 128) {
    const t = fim - 128;
    if (buf[t] === 0x54 && buf[t + 1] === 0x41 && buf[t + 2] === 0x47) fim = t;
  }
  return ini > 0 || fim < buf.length ? buf.subarray(ini, fim) : buf;
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

  // ── O REPASSE, SEMPRE INTEIRO ────────────────────────────────
  //
  // Sem `Range`, de propósito. Cortar a tag ID3 tira bytes do COMEÇO do
  // arquivo, e aí todo offset se desloca: o pedaço que o navegador pede
  // deixa de ser o pedaço que ele recebe, e o player toca lixo ou nada.
  //
  // O preço é buscar o arquivo inteiro (~4 MB) a cada requisição. Custa
  // um ou dois segundos contra os ~90 que a rota economiza, e some assim
  // que o arquivo final entra no lugar.
  let upstream: Response;
  try {
    upstream = await fetch(m.previa_url);
  } catch (err) {
    console.error("[previa] provedor não respondeu:", err);
    return res.status(502).json({ error: "prévia indisponível" });
  }

  if (!upstream.ok && upstream.status !== 206) {
    // O stream é temporário: quando a faixa fecha, ele morre. Isso é normal,
    // e a tela já terá trocado pelo arquivo final a essa altura.
    return res.status(404).json({ error: "prévia expirou" });
  }

  const limpo = semTagsId3(Buffer.from(await upstream.arrayBuffer()));

  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  // `none` e não `bytes`: o tamanho mudou ao tirar a tag, então prometer
  // range seria prometer o que os offsets não sustentam.
  res.setHeader("Accept-Ranges", "none");
  res.setHeader("Content-Length", String(limpo.length));
  // Sem cache: a prévia dura minutos e some. Guardar isso numa borda só
  // produziria 404 servido de cache depois que ela expira.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  return res.end(limpo);
}
