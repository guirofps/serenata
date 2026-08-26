import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * OS DOIS MODELOS QUE ESCREVEM AS LETRAS.
 *
 * Moram aqui, junto do preço, porque a string do modelo e a tabela de preço
 * são a mesma decisão: trocar uma sem a outra faz o painel contabilizar errado
 * em silêncio (o `registrarCustoLetra` abaixo cai no modelo ATIVO quando não
 * conhece o nome). Antes a constante estava duplicada em `coautoria.ts` e em
 * `recuperacao-letra.ts`, onde podia divergir.
 *
 * ── POR QUE DOIS, EM 26/08 ──────────────────────────────────────
 *
 * Em 20/08 tudo passou pro Haiku 4.5, por volume: com ~820 letras/dia o
 * Sonnet 5 saía R$ 181/dia contra R$ 90 do Haiku. A ressalva ficou escrita:
 * "se as letras piorarem, o caminho de volta é uma linha".
 *
 * Pioraram. Medição de 26/08 sobre 5.322 letras reais, 2.595 do Sonnet contra
 * 2.727 do Haiku, contra as regras do próprio `letra-prompt.ts`:
 *
 *   detalhes concretos por letra   4,93 -> 3,89   (-21%)
 *   palavras por letra              290  -> 235    (-19%)
 *   clichê da lista proibida       2,6% -> 5,0%   (z=4,6, p<0,00001)
 *   estrutura / refrão / marcações        idênticos
 *
 * O Haiku obedece o formato e escreve mais raso: o MESMO número de versos com
 * 55 palavras a menos. E perde justo na métrica que o prompt elegeu como
 * definição de qualidade ("a única coisa que separa uma letra boa de uma
 * genérica é o uso de detalhes concretos").
 *
 * A conversão NÃO mudou (10,64% -> 10,05% dentro do mesmo preço, p≈0,71), e
 * é por isso que a volta é parcial e não total: não há prova de que a letra
 * rasa esteja custando venda, então não se paga o preço cheio por ela.
 *
 * ── ONDE CADA UM ENTRA ──────────────────────────────────────────
 *
 * As chamadas de letra se dividem em duas, e foram medidas separadas:
 *
 *   opções de refrão   5.062 chamadas, saída ~210 tokens, 45% do custo
 *   letra inteira      3.386 chamadas, saída ~610 tokens, 55% do custo
 *
 * A letra inteira é o que o cliente LÊ na prévia e o que o Suno CANTA com 95%
 * de fidelidade: vai de Sonnet. As opções de refrão são uma escolha entre três
 * frases curtas, onde a diferença entre os modelos vale muito menos que os
 * R$ 36/dia que ela custaria: ficam no Haiku.
 *
 * Conta: voltar tudo custaria R$ 79/dia; só a letra final custa R$ 43/dia,
 * uns R$ 0,38 por venda. E a tarifa introdutória do Sonnet ($2/$10) acaba em
 * 31/08 — depois disso estes números praticamente dobram, e vale remedir.
 */
export const MODELO_LETRA = "claude-sonnet-5";

/**
 * O modelo das etapas CURTAS (as opções de refrão da coautoria).
 *
 * Separado de `MODELO_LETRA` de propósito: quando alguém for mexer no modelo
 * da letra, tem que ver que existem dois e que a escolha entre eles foi
 * medida, não herdada.
 */
export const MODELO_LETRA_CURTA = "claude-haiku-4-5";

// Preços dos provedores, num lugar só. Quando mudarem, muda aqui — o
// histórico não se reescreve porque o custo em BRL fica congelado na linha.
//
// Cache: leitura 0,1x do input; escrita 1,25x — em todos os modelos.
export const PRECOS = {
  cambioUsdBrl: 5.4,
  anthropic: {
    // $1 in / $5 out por 1M.
    //
    // O CACHE NÃO PEGA NESTE MODELO, e não é bug: o Haiku 4.5 exige 4.096
    // tokens de prefixo pra criar entrada de cache, e o nosso system prompt
    // tem ~1.200. A chamada não falha nem avisa — volta
    // `cache_creation_input_tokens: 0` e paga entrada cheia. As duas linhas de
    // cache abaixo ficam por completude; na prática elas somam zero.
    "claude-haiku-4-5": {
      in: 1.0 / 1e6,
      out: 5.0 / 1e6,
      cacheRead: 0.1 / 1e6,
      cacheWrite: 1.25 / 1e6,
    },
    // Fica na tabela pra o histórico continuar sendo lido com o preço certo:
    // as linhas de `custos` gravadas até 20/08 têm `modelo` = sonnet, e o
    // painel as recalcula por aqui.
    //
    // ATENÇÃO: estes são os valores INTRODUTÓRIOS, válidos até 31/08/2026.
    // Depois disso a tarifa é $3 in / $15 out — se voltar pro Sonnet 5 depois
    // dessa data sem corrigir aqui, o painel subestima o custo em 1/3.
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
    // Modelo desconhecido cai no preço do modelo ATIVO, não num fixo: com o
    // fixo apontando pro Sonnet, uma chamada de Haiku que chegasse aqui sem
    // nome seria contabilizada pelo dobro — e o erro só apareceria comparando
    // o painel com a fatura.
    const p =
      PRECOS.anthropic[args.modelo as keyof typeof PRECOS.anthropic] ??
      PRECOS.anthropic[MODELO_LETRA];
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
