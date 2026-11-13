import type { SupabaseClient } from "@supabase/supabase-js";
import { EXP_SOTAQUE_LATAM, sotaqueDaMusica } from "../../src/lib/sotaque-latam.js";
import { ehGeneroLatamNeutro } from "../../src/lib/generos.js";

/**
 * O sotaque do teste `sotaque_latam` pra esta música, lido no banco: país e
 * atribuição do quiz + a linha viva de `experimentos`. Usado pelo job da música
 * e pelo gerador reserva, pra os dois gravarem igual.
 *
 * FALHA PRO CONTROLE: qualquer erro de leitura devolve `null` (o estilo de
 * hoje). Um teste nunca derruba nem atrasa a geração.
 */
export async function lerSotaqueDaMusica(
  sb: SupabaseClient,
  quizId: string | null | undefined,
  genero: string | null | undefined,
): Promise<string | null> {
  try {
    if (!quizId || !ehGeneroLatamNeutro(genero)) return null;
    const [{ data: q }, { data: linha }] = await Promise.all([
      sb.from("quiz_responses").select("pais, attribution").eq("id", quizId).maybeSingle(),
      sb.from("experimentos").select("ativo, variantes").eq("id", EXP_SOTAQUE_LATAM).maybeSingle(),
    ]);
    return sotaqueDaMusica({
      pais: (q as { pais?: string | null } | null)?.pais,
      generoNeutro: true,
      attribution: (q as { attribution?: unknown } | null)?.attribution,
      linha: linha as { ativo?: boolean | null; variantes?: Array<{ nome?: string; peso?: number }> | null } | null,
    });
  } catch {
    return null;
  }
}
