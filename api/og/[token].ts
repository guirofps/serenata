// IMAGEM DA PRÉVIA DO LINK (og:image) da página-presente.
//
// Por que existe: o link vai colado no WhatsApp, e a prévia é a PRIMEIRA
// coisa que a pessoa homenageada vê — antes da música, da letra, de tudo.
// Sem `og:image` o WhatsApp cai no ícone do site, e foi o que aconteceu na
// entrega real gravada em 01/08: a mãe recebeu um coração genérico no lugar
// do rosto dela.
//
// Não redimensiona nada: as fotos já sobem 1200x1200 JPEG a 85% (o editor
// corta no cliente, ver src/lib/imagem.ts), o que dá ~300 KB — dentro do que
// o robô do WhatsApp busca sem reclamar. Trazer uma biblioteca de imagem pro
// servidor só pra repetir um trabalho já feito seria peso à toa.
//
// Segurança: a rota é pública e a chave é o mesmo `token` que já abre a
// página. Não expõe nada que o link não exponha — quem tem o token já vê a
// foto, a letra e a música. O que NÃO entra aqui é o `token_edicao`.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

type Req = IncomingMessage & { method?: string; query?: Record<string, string | string[]>; url?: string };
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void; send: (b: unknown) => void };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Fallback da marca, pra presente que ainda não tem foto. */
function semFoto(res: Res, origem: string) {
  res.statusCode = 302;
  res.setHeader("Location", `${origem}/og-presente.jpg`);
  res.end();
}

export default async function handler(req: Req, res: Res) {
  const bruto = req.query?.token;
  const token = String(Array.isArray(bruto) ? bruto[0] : (bruto ?? "")).trim();

  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? (req.headers.host as string);
  const origem = process.env.VITE_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;

  // Token tem formato conhecido (22 hex). Recusar o resto evita virar proxy
  // de arquivo arbitrário do bucket.
  if (!/^[a-f0-9]{16,40}$/i.test(token)) return semFoto(res, origem);

  try {
    const sb = db();
    const { data: m } = await sb
      .from("musicas")
      .select("foto_path, galeria, status")
      .eq("token", token)
      .maybeSingle();

    // Só presente PRONTO tem prévia: link de música ainda gerando não deve
    // vazar foto nenhuma.
    if (!m || m.status !== "pronta") return semFoto(res, origem);

    // Capa primeiro; sem capa, a primeira da galeria (é o que a própria
    // página faz quando não há foto de capa).
    const caminho: string | null = m.foto_path ?? (m.galeria as string[] | null)?.[0] ?? null;
    if (!caminho) return semFoto(res, origem);

    const { data: arquivo, error } = await sb.storage.from("fotos").download(caminho);
    if (error || !arquivo) {
      console.error("[og] download falhou:", error?.message);
      return semFoto(res, origem);
    }

    const buf = Buffer.from(await arquivo.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", String(buf.length));
    // O robô do WhatsApp busca uma vez e guarda por muito tempo. Cache longo
    // na borda economiza download do bucket; a troca de foto depois do envio
    // é rara e o `?v=` no og:image quebra o cache quando acontece.
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=604800, immutable");
    res.end(buf);
  } catch (err) {
    console.error("[og] erro:", err);
    semFoto(res, origem);
  }
}
