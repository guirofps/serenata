import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { montarKaraoke } from "@/lib/karaoke-video";
import { assinaturaDoVideo, entradaDaMusica } from "@/lib/assinatura-video";
import type { LinhaKaraoke } from "../../video/src/props.js";

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
  /**
   * A letra cantada de cada versão, pra prévia ao vivo no editor. Foto,
   * título e dedicatória a prévia tira do PRÓPRIO editor (é o que faz ela
   * mudar na hora em que a pessoa troca uma foto); só o karaokê vem daqui.
   */
  karaoke: { v1: LinhaKaraoke[]; v2: LinhaKaraoke[] };
  /** Reserva de duração da v1, se o navegador não conseguir medir o áudio. */
  duracaoS: number;
  /** Pronto, mas a página mudou depois (foto, dedicatória, versão): cabe "atualizar". */
  desatualizado: boolean;
  atualizacoesRestantes: number;
};

/** Re-renders grátis por vídeo, quando a página muda depois da compra. */
const MAX_ATUALIZACOES = 5;

const VAZIO: EstadoVideo = {
  habilitado: false,
  fotos: 0,
  status: null,
  url: null,
  urlDownload: null,
  karaoke: { v1: [], v2: [] },
  duracaoS: 0,
  desatualizado: false,
  atualizacoesRestantes: 0,
};
const SETE_DIAS = 60 * 60 * 24 * 7;

export const videoDoEditor = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<EstadoVideo> => {
    if (!data.tokenEdicao) return VAZIO;
    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select(
        "id, foto_path, galeria, timestamps, timestamps_v2, duracao_s, dedicatoria, titulo, versao_preferida, audio_path_v2",
      )
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m) return VAZIO;
    const assinaturaAgora = assinaturaDoVideo(entradaDaMusica(m));
    const karaoke = { v1: montarKaraoke(m.timestamps), v2: montarKaraoke(m.timestamps_v2) };
    const duracaoS = Number(m.duracao_s) || 0;

    const habilitado = Boolean(
      process.env.REMOTION_SERVE_URL &&
      process.env.REMOTION_FUNCTION_NAME &&
      process.env.REMOTION_AWS_ACCESS_KEY_ID,
    );
    const fotos = (m.foto_path ? 1 : 0) + (((m.galeria as string[] | null) ?? []).length || 0);

    const { data: v } = await db
      .from("videos")
      .select("status, video_path, assinatura, atualizacoes")
      .eq("musica_id", m.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!v) return { ...VAZIO, habilitado, fotos, karaoke, duracaoS };

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
    return {
      habilitado,
      fotos,
      status: v.status as EstadoVideo["status"],
      url,
      urlDownload,
      karaoke,
      duracaoS,
      // Vídeo sem assinatura é de antes deste recurso: não dá pra saber se
      // mudou, e oferecer atualizar "por via das dúvidas" gastaria à toa.
      desatualizado: v.status === "pronto" && !!v.assinatura && v.assinatura !== assinaturaAgora,
      atualizacoesRestantes: Math.max(0, MAX_ATUALIZACOES - (Number(v.atualizacoes) || 0)),
    };
  });

/**
 * "Atualizar meu vídeo": a página mudou depois do render e o vídeo acompanha.
 *
 * Sem cobrança, com teto (`MAX_ATUALIZACOES`): cada re-render custa ~US$ 0,04
 * de Lambda, e sem teto um clique repetido vira conta aberta. A troca de
 * status é CONDICIONAL (`status = pronto`): dois cliques seguidos, ou duas
 * abas, disparam um render só.
 */
export const atualizarVideo = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; motivo?: string }> => {
    if (!data.tokenEdicao) return { ok: false, motivo: "sem token" };
    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select("id, foto_path, galeria, dedicatoria, titulo, versao_preferida, audio_path_v2")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m) return { ok: false, motivo: "música não encontrada" };

    const { data: v } = await db
      .from("videos")
      .select("id, status, assinatura, atualizacoes")
      .eq("musica_id", m.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!v || v.status !== "pronto") return { ok: false, motivo: "sem vídeo pronto" };
    if (v.assinatura === assinaturaDoVideo(entradaDaMusica(m)))
      return { ok: false, motivo: "o vídeo já é igual à página" };
    const feitas = Number(v.atualizacoes) || 0;
    if (feitas >= MAX_ATUALIZACOES) return { ok: false, motivo: "limite de atualizações" };

    const { data: trocou } = await db
      .from("videos")
      .update({ status: "aguardando", atualizacoes: feitas + 1, erro: null })
      .eq("id", v.id)
      .eq("status", "pronto")
      .select("id");
    if (!trocou?.length) return { ok: true }; // outro clique chegou antes: o render já foi pedido

    const chave = process.env.INNGEST_EVENT_KEY;
    const r = chave
      ? await fetch(`https://inn.gs/e/${chave}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "video/renderizar", data: { videoId: v.id } }),
        }).catch(() => null)
      : null;
    if (!r?.ok) {
      // Sem o evento o render nunca sai: devolve o vídeo antigo e o clique.
      await db.from("videos").update({ status: "pronto", atualizacoes: feitas }).eq("id", v.id);
      return { ok: false, motivo: "não conseguiu pedir o render" };
    }
    return { ok: true };
  });
