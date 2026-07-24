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
  /** Existe uma segunda versão pra ouvir? */
  temAlternativa: boolean;
  /** Qual está tocando agora. */
  versao: 1 | 2;
};

export const carregarPresente = createServerFn({ method: "GET" })
  // `versao: 2` toca a alternativa. O Suno devolve duas gravações da mesma
  // letra numa única chamada; as duas fazem parte do que a pessoa leva.
  .validator((data: { token: string; versao?: number }) => data)
  .handler(async ({ data }): Promise<Presente | null> => {
    const db = supabaseAdmin();

    const { data: m } = await db
      .from("musicas")
      .select(
        "titulo, letra, status, audio_path, audio_path_v2, timestamps, duracao_s, quiz_response_id",
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

    const temAlternativa = Boolean(m.audio_path_v2);
    // Só cai na alternativa se ela existir de verdade — link com ?v=2 numa
    // música de uma versão só toca a principal em vez de dar tela muda.
    const versao: 1 | 2 = data.versao === 2 && temAlternativa ? 2 : 1;
    const caminho = versao === 2 ? m.audio_path_v2 : m.audio_path;

    let audioUrl: string | null = null;
    if (caminho) {
      // 7 dias: tempo de sobra pra pessoa abrir, reabrir e mostrar pros outros.
      const { data: assinada } = await db.storage
        .from("musicas")
        .createSignedUrl(caminho, 60 * 60 * 24 * 7);
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
      // Os timestamps são de UMA gravação específica (a principal). Usá-los
      // na alternativa acenderia a letra fora do que se ouve — pior que não
      // acender. Na v2 mostramos a letra estática.
      timestamps:
        versao === 1
          ? ((m.timestamps as Array<{ word: string; start: number; end: number }>) ?? null)
          : null,
      duracaoS: versao === 1 && m.duracao_s ? Number(m.duracao_s) : null,
      temAlternativa,
      versao,
    };
  });
