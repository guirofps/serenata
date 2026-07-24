import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Personalização da página-presente pelo COMPRADOR.
//
// Autorização: `token_edicao`, que é diferente do `token` público. O público
// vai colado no WhatsApp do presenteado; se ele autorizasse escrita, quem
// GANHA o presente poderia alterá-lo. Aqui um lê e o outro escreve.
//
// Tudo passa pelo servidor com service role — não existe policy de storage
// para anon, então não há caminho que escreva sem passar por esta validação.

export type PresenteEditavel = {
  titulo: string;
  nome: string;
  dedicatoria: string | null;
  fotoUrl: string | null;
  /** Galeria que passa atrás da letra. Caminho + URL assinada, na ordem. */
  galeria: Array<{ caminho: string; url: string }>;
  tokenPublico: string;
  publicada: boolean;
};

export const MAX_GALERIA = 12;

const MAX_DEDICATORIA = 280;
// O bucket recusa acima de 5 MB, mas a checagem aqui evita subir o payload
// inteiro só para o storage rejeitar no fim.
const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"] as const;

async function buscarPorTokenEdicao(tokenEdicao: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("musicas")
    .select(
      "id, token, titulo, foto_path, galeria, dedicatoria, personalizada_em, quiz_response_id",
    )
    .eq("token_edicao", tokenEdicao)
    .maybeSingle();
  return data;
}

/** Assina vários caminhos de uma vez, preservando a ordem. */
export async function assinarGaleria(
  caminhos: string[] | null,
): Promise<Array<{ caminho: string; url: string }>> {
  if (!caminhos?.length) return [];
  const { data } = await supabaseAdmin()
    .storage.from("fotos")
    .createSignedUrls(caminhos, 60 * 60 * 24 * 7);
  // createSignedUrls devolve na ordem pedida; um caminho que sumiu do bucket
  // vem sem signedUrl e é descartado, em vez de virar imagem quebrada.
  return (data ?? [])
    .map((d, i) => ({ caminho: caminhos[i], url: d.signedUrl ?? "" }))
    .filter((x) => x.url);
}

async function urlDaFoto(caminho: string | null): Promise<string | null> {
  if (!caminho) return null;
  const { data } = await supabaseAdmin()
    .storage.from("fotos")
    .createSignedUrl(caminho, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

/** Carrega o presente para a tela de edição. */
export const carregarParaEditar = createServerFn({ method: "GET" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<PresenteEditavel | null> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return null;

    const { data: q } = await supabaseAdmin()
      .from("quiz_responses")
      .select("respostas")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    const r = (q?.respostas ?? {}) as Record<string, string>;

    return {
      titulo: m.titulo ?? "Sua música",
      nome: r.nome ?? "você",
      dedicatoria: m.dedicatoria,
      fotoUrl: await urlDaFoto(m.foto_path),
      galeria: await assinarGaleria(m.galeria),
      tokenPublico: m.token,
      publicada: Boolean(m.personalizada_em),
    };
  });

/** Acrescenta fotos à galeria (as que passam atrás da letra). */
export const adicionarNaGaleria = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; fotosBase64: string[] }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; galeria?: Array<{ caminho: string; url: string }>; erro?: string }> => {
      const m = await buscarPorTokenEdicao(data.tokenEdicao);
      if (!m) return { ok: false, erro: "não encontrado" };

      const atual: string[] = m.galeria ?? [];
      const cabem = MAX_GALERIA - atual.length;
      if (cabem <= 0) return { ok: false, erro: `A galeria já tem ${MAX_GALERIA} fotos.` };

      const db = supabaseAdmin();
      const novos: string[] = [];

      for (const [i, b64] of data.fotosBase64.slice(0, cabem).entries()) {
        const casa = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(b64);
        if (!casa) continue; // ignora o inválido em vez de derrubar o lote
        const [, tipo, corpo] = casa;
        const bytes = Buffer.from(corpo, "base64");
        if (bytes.length > MAX_FOTO_BYTES) continue;

        // Nome único por posição+tempo: sem isso, subir duas fotos no mesmo
        // segundo sobrescreveria uma com a outra.
        const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
        const caminho = `${m.id}/g-${Date.now()}-${atual.length + i}.${ext}`;
        const { error } = await db.storage
          .from("fotos")
          .upload(caminho, bytes, { contentType: tipo, upsert: false });
        if (error) {
          console.error("[galeria] upload falhou:", error.message);
          continue;
        }
        novos.push(caminho);
      }

      if (!novos.length) return { ok: false, erro: "Nenhuma foto pôde ser usada." };

      const galeria = [...atual, ...novos];
      const { error } = await db
        .from("musicas")
        .update({ galeria, personalizada_em: new Date().toISOString() })
        .eq("id", m.id);
      if (error) {
        console.error("[galeria] update falhou:", error.message);
        return { ok: false, erro: "Não consegui salvar agora." };
      }
      return { ok: true, galeria: await assinarGaleria(galeria) };
    },
  );

/** Remove uma foto da galeria (e do bucket). */
export const removerDaGaleria = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; caminho: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; galeria: Array<{ caminho: string; url: string }> }> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return { ok: false, galeria: [] };
    const db = supabaseAdmin();
    const galeria = (m.galeria ?? []).filter((c: string) => c !== data.caminho);
    await db.storage.from("fotos").remove([data.caminho]);
    await db.from("musicas").update({ galeria }).eq("id", m.id);
    return { ok: true, galeria: await assinarGaleria(galeria) };
  });

/**
 * Salva foto e/ou dedicatória.
 *
 * A foto chega já redimensionada e cortada pelo cliente (canvas), em base64.
 * Redimensionar no cliente evita subir 8 MB de foto de celular e é o mesmo
 * passo que o corte quadrado exige de qualquer jeito.
 */
export const salvarPersonalizacao = createServerFn({ method: "POST" })
  .validator(
    (data: { tokenEdicao: string; dedicatoria?: string | null; fotoBase64?: string | null }) =>
      data,
  )
  .handler(async ({ data }): Promise<{ ok: boolean; fotoUrl?: string | null; erro?: string }> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    // Mensagem genérica de propósito: não confirma se o token existe.
    if (!m) return { ok: false, erro: "não encontrado" };

    const db = supabaseAdmin();
    const patch: Record<string, unknown> = { personalizada_em: new Date().toISOString() };

    // ── dedicatória ──
    if (data.dedicatoria !== undefined) {
      const texto = (data.dedicatoria ?? "").trim();
      if (texto.length > MAX_DEDICATORIA) {
        return { ok: false, erro: `A dedicatória passa de ${MAX_DEDICATORIA} caracteres.` };
      }
      patch.dedicatoria = texto || null;
    }

    // ── foto ──
    let fotoUrl: string | null | undefined;
    if (data.fotoBase64) {
      const casa = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data.fotoBase64);
      if (!casa) return { ok: false, erro: "Formato de imagem não aceito." };
      const [, tipo, b64] = casa;
      if (!TIPOS_OK.includes(tipo as (typeof TIPOS_OK)[number])) {
        return { ok: false, erro: "Formato de imagem não aceito." };
      }

      const bytes = Buffer.from(b64, "base64");
      if (bytes.length > MAX_FOTO_BYTES) {
        return { ok: false, erro: "A imagem é grande demais." };
      }

      // Caminho fixo por música: republicar SUBSTITUI em vez de acumular
      // lixo no bucket a cada troca de foto.
      const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
      const caminho = `${m.id}/capa.${ext}`;
      const { error } = await db.storage
        .from("fotos")
        .upload(caminho, bytes, { contentType: tipo, upsert: true });
      if (error) {
        console.error("[personalizar] upload falhou:", error);
        return { ok: false, erro: "Não consegui subir a foto agora." };
      }

      // Trocou de extensão? Apaga a anterior, senão fica órfã no bucket.
      if (m.foto_path && m.foto_path !== caminho) {
        await db.storage.from("fotos").remove([m.foto_path]);
      }
      patch.foto_path = caminho;
      fotoUrl = await urlDaFoto(caminho);
    }

    const { error } = await db.from("musicas").update(patch).eq("id", m.id);
    if (error) {
      console.error("[personalizar] update falhou:", error);
      return { ok: false, erro: "Não consegui salvar agora." };
    }
    return { ok: true, fotoUrl };
  });

/** Remove a foto de capa (volta ao visual padrão). */
export const removerFoto = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return { ok: false };
    const db = supabaseAdmin();
    if (m.foto_path) await db.storage.from("fotos").remove([m.foto_path]);
    await db.from("musicas").update({ foto_path: null }).eq("id", m.id);
    return { ok: true };
  });
