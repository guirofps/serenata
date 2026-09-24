import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// O VÍDEO-PRESENTE visto do editor: existe? em que pé está? onde assistir?
//
// Aberto pelo `token_edicao`, a mesma prova de posse que já libera baixar o
// MP3 e editar o presente. Nunca pelo e-mail.

export type EstadoVideo = {
  /**
   * O render está configurado nesta instalação (chaves da AWS + função +
   * site). Enquanto for `false` a OFERTA não aparece: vender um vídeo que a
   * infraestrutura ainda não sabe fazer é cobrar por algo que não vai ser
   * produzido, a regra que este projeto não quebra.
   */
  habilitado: boolean;
  /** Quantas fotos a música tem (capa + galeria). O vídeo precisa de pelo menos uma. */
  fotos: number;
  status: "aguardando" | "renderizando" | "pronto" | "falhou" | null;
  /** URL assinada pra tocar no editor (só quando pronto). */
  url: string | null;
  /** URL assinada que força o download com nome de arquivo decente. */
  urlDownload: string | null;
};

const VAZIO: EstadoVideo = {
  habilitado: false,
  fotos: 0,
  status: null,
  url: null,
  urlDownload: null,
};
const SETE_DIAS = 60 * 60 * 24 * 7;

export const videoDoEditor = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<EstadoVideo> => {
    if (!data.tokenEdicao) return VAZIO;
    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select("id, foto_path, galeria")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m) return VAZIO;

    const habilitado = Boolean(
      process.env.REMOTION_SERVE_URL &&
      process.env.REMOTION_FUNCTION_NAME &&
      process.env.REMOTION_AWS_ACCESS_KEY_ID,
    );
    const fotos = (m.foto_path ? 1 : 0) + (((m.galeria as string[] | null) ?? []).length || 0);

    const { data: v } = await db
      .from("videos")
      .select("status, video_path")
      .eq("musica_id", m.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!v) return { habilitado, fotos, status: null, url: null, urlDownload: null };

    let url: string | null = null;
    let urlDownload: string | null = null;
    if (v.status === "pronto" && v.video_path) {
      const bucket = db.storage.from("videos");
      const [tocar, baixar] = await Promise.all([
        bucket.createSignedUrl(v.video_path as string, SETE_DIAS),
        bucket.createSignedUrl(v.video_path as string, SETE_DIAS, {
          download: "video-serenata.mp4",
        }),
      ]);
      url = tocar.data?.signedUrl ?? null;
      urlDownload = baixar.data?.signedUrl ?? null;
    }
    return { habilitado, fotos, status: v.status as EstadoVideo["status"], url, urlDownload };
  });
