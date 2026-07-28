import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Gatilho da música + status da música da sessão.
//
// A GERAÇÃO da letra migrou pra coautoria.ts (a pessoa constrói a letra em
// etapas). Este arquivo guarda só as duas peças que sobreviveram a essa
// mudança: disparar a música quando a letra fica pronta, e o polling de
// status que o reveal faz pra trocar a espera pelo player.

// Envia o evento pro Inngest por HTTP, em vez de importar o SDK: assim o
// pacote `inngest` não é arrastado pro bundle do cliente. Chamado pela
// coautoria no momento em que a letra é finalizada — ainda antes do
// pagamento (a mudança arquitetural do PLANO).
export async function dispararGeracaoMusica(musicaId: string): Promise<void> {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  if (!eventKey) {
    console.error("[musica] INNGEST_EVENT_KEY ausente; geração não disparada");
    return;
  }
  try {
    const r = await fetch(`https://inn.gs/e/${eventKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "musica/gerar", data: { musicaId } }),
    });
    if (!r.ok) console.error("[musica] evento recusado:", r.status, await r.text());
  } catch (err) {
    // Falha aqui não pode derrubar a entrega da letra.
    console.error("[musica] falha ao disparar geração:", err);
  }
}

// Status da música desta sessão — o reveal faz polling nisto pra trocar a
// espera pelo player quando ficar pronta.
export const statusMusica = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      status: string;
      audioUrl: string | null;
      timestamps: Array<{ word: string; start: number; end: number }> | null;
      titulo: string | null;
    }> => {
      const db = supabaseAdmin();
      const { data: qr } = await db
        .from("quiz_responses")
        .select("id")
        .eq("session_id", data.sessionId)
        .maybeSingle();
      if (!qr?.id) return { status: "aguardando", audioUrl: null, timestamps: null, titulo: null };

      const { data: m } = await db
        .from("musicas")
        .select("status, audio_path, timestamps, titulo")
        .eq("quiz_response_id", qr.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!m) return { status: "aguardando", audioUrl: null, timestamps: null, titulo: null };

      // Bucket é privado: a URL é assinada e temporária, gerada no servidor.
      let audioUrl: string | null = null;
      if (m.status === "pronta" && m.audio_path) {
        const { data: assinada } = await db.storage
          .from("musicas")
          .createSignedUrl(m.audio_path, 60 * 60);
        audioUrl = assinada?.signedUrl ?? null;
      }
      return {
        status: m.status,
        audioUrl,
        timestamps: (m.timestamps as Array<{ word: string; start: number; end: number }>) ?? null,
        titulo: m.titulo,
      };
    },
  );
