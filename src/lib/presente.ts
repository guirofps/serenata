import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Carrega a página presente pelo token público.
//
// Tudo server-side: o bucket de áudio é PRIVADO e a URL é assinada aqui.
// O token é a única credencial — imprevisível (22 chars de UUID), sem
// enumeração possível, e não expõe id de sessão nem e-mail de ninguém.

export type Presente = {
  titulo: string;
  letra: string;
  nome: string;
  relacao: string | null;
  ocasiao: string | null;
  historia: string | null;
  audioUrl: string | null;
  timestamps: Array<{ word: string; start: number; end: number }> | null;
  duracaoS: number | null;
};

export const carregarPresente = createServerFn({ method: "GET" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<Presente | null> => {
    const db = supabaseAdmin();

    const { data: m } = await db
      .from("musicas")
      .select(
        "titulo, letra, status, audio_path, timestamps, duracao_s, quiz_response_id",
      )
      .eq("token", data.token)
      .maybeSingle();

    if (!m || m.status !== "pronta") return null;

    const { data: q } = await db
      .from("quiz_responses")
      .select("respostas")
      .eq("id", m.quiz_response_id)
      .maybeSingle();

    const r = (q?.respostas ?? {}) as Record<string, string>;

    let audioUrl: string | null = null;
    if (m.audio_path) {
      // 7 dias: tempo de sobra pra pessoa abrir, reabrir e mostrar pros outros.
      const { data: assinada } = await db.storage
        .from("musicas")
        .createSignedUrl(m.audio_path, 60 * 60 * 24 * 7);
      audioUrl = assinada?.signedUrl ?? null;
    }

    return {
      titulo: m.titulo ?? "Sua música",
      letra: m.letra ?? "",
      nome: r.nome ?? "você",
      relacao: r.relacao ?? null,
      ocasiao: r.ocasiao ?? null,
      // A história vira o "encarte" do disco.
      historia: [r.historia1, r.historia2].filter(Boolean).join("\n\n") || null,
      audioUrl,
      timestamps:
        (m.timestamps as Array<{ word: string; start: number; end: number }>) ?? null,
      duracaoS: m.duracao_s ? Number(m.duracao_s) : null,
    };
  });
