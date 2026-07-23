import { supabaseAdmin } from "@/lib/supabase-admin";

// Preços dos provedores, num lugar só. Quando mudarem, muda aqui — o
// histórico não se reescreve porque o custo em BRL fica congelado na linha.
//
// Sonnet 5 (introdutório até 2026-08-31): $2 in / $10 out por 1M.
// Cache: leitura 0,1x do input; escrita 1,25x.
export const PRECOS = {
  cambioUsdBrl: 5.4,
  anthropic: {
    "claude-sonnet-5": {
      in: 2.0 / 1e6,
      out: 10.0 / 1e6,
      cacheRead: 0.2 / 1e6,
      cacheWrite: 2.5 / 1e6,
    },
  },
  // kie.ai: pacote base $5 = 1.000 créditos.
  kie: { usdPorCredito: 0.005 },
} as const;

export type UsoClaude = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

/** Registra o custo de uma chamada ao Claude. Nunca lança: custo não pode
 *  derrubar a entrega do produto. */
export async function registrarCustoLetra(args: {
  quizResponseId?: string | null;
  musicaId?: string | null;
  modelo: string;
  uso: UsoClaude;
}): Promise<void> {
  try {
    const p =
      PRECOS.anthropic[args.modelo as keyof typeof PRECOS.anthropic] ??
      PRECOS.anthropic["claude-sonnet-5"];
    const tIn = args.uso.input_tokens ?? 0;
    const tOut = args.uso.output_tokens ?? 0;
    const tRead = args.uso.cache_read_input_tokens ?? 0;
    const tWrite = args.uso.cache_creation_input_tokens ?? 0;
    const usd = tIn * p.in + tOut * p.out + tRead * p.cacheRead + tWrite * p.cacheWrite;

    await supabaseAdmin()
      .from("custos")
      .insert({
        quiz_response_id: args.quizResponseId ?? null,
        musica_id: args.musicaId ?? null,
        tipo: "letra",
        provider: "anthropic",
        modelo: args.modelo,
        tokens_in: tIn,
        tokens_out: tOut,
        tokens_cache_read: tRead,
        tokens_cache_write: tWrite,
        custo_usd: usd,
        custo_brl: usd * PRECOS.cambioUsdBrl,
        cambio: PRECOS.cambioUsdBrl,
      });
  } catch (err) {
    console.error("[custos] falha ao registrar letra:", err);
  }
}

/** Registra custo de uma operação no provedor de música (por créditos). */
export async function registrarCustoCreditos(args: {
  quizResponseId?: string | null;
  musicaId?: string | null;
  tipo: "musica" | "timestamps";
  modelo?: string;
  creditos: number;
}): Promise<void> {
  try {
    const usd = args.creditos * PRECOS.kie.usdPorCredito;
    await supabaseAdmin()
      .from("custos")
      .insert({
        quiz_response_id: args.quizResponseId ?? null,
        musica_id: args.musicaId ?? null,
        tipo: args.tipo,
        provider: "kie.ai",
        modelo: args.modelo ?? null,
        creditos: args.creditos,
        custo_usd: usd,
        custo_brl: usd * PRECOS.cambioUsdBrl,
        cambio: PRECOS.cambioUsdBrl,
      });
  } catch (err) {
    console.error("[custos] falha ao registrar créditos:", err);
  }
}

// Consumo conhecido de cada operação do kie.ai (tabela pública de preços).
export const CREDITOS = { musica: 12, timestamps: 0.5 } as const;
