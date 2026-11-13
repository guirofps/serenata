// TESTE `sotaque_latam` (Ballad, 13/11): a música da Colômbia, do Chile e do
// Peru cantada com o sotaque do país.
//
// ── POR QUE ───────────────────────────────────────────────────────
//
// A Espanha e a Argentina já pedem o sotaque no estilo do Suno ("acento
// castellano de España", "acento rioplatense argentino"). Colômbia, Chile e
// Peru usam a lista NEUTRA (`ES`, com o gênero do país na frente), cantada
// num espanhol "de lugar nenhum". O dono decidiu medir pela conversão em vez
// de ouvir exemplos (ele não distingue o sotaque de ouvido).
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = o estilo de hoje, sem uma vírgula a mais.
//   B = o mesmo estilo + "acento colombiano" / "acento chileno" / "acento
//       peruano", logo depois do texto curado do gênero (o Suno pesa o começo).
//
// Só nos três países e só nos gêneros da lista neutra. Quem está no México,
// nos EUA, na Espanha ou na Argentina é sorteado igual (o carimbo é de todo
// visitante), mas a música dele não muda: a leitura é SÓ dos três países.
//
// ── O BRAÇO É LIDO NO SERVIDOR ───────────────────────────────────
//
// Mesma regra do `nome_cantado`: o job da música lê
// `quiz_responses.attribution.exp.sotaque_latam` e a linha viva de
// `experimentos`. Desligar pelo `ativo` vale na hora, inclusive pra quem já
// tinha B gravado. Peso 0 conta como o controle.
//
// Leitura: venda por lead (pedido pago ÷ quiz com e-mail) por braço, só
// `quiz_responses.pais in ('CO','CL','PE')`; diagnóstico: clicou em comprar ÷
// ouviu a prévia.

export const EXP_SOTAQUE_LATAM = "sotaque_latam";

export const SOTAQUE_POR_PAIS: Record<string, string> = {
  CO: "acento colombiano",
  CL: "acento chileno",
  PE: "acento peruano",
};

type LinhaExperimento = {
  ativo?: boolean | null;
  variantes?: Array<{ nome?: string; peso?: number }> | null;
} | null;

/** O braço desta sessão é um B vivo? Mesma régua do `nomeCantadoLigado`. */
export function sotaqueLigado(attribution: unknown, linha: LinhaExperimento): boolean {
  if (!linha?.ativo) return false;
  const variantes = (linha.variantes ?? []).filter((v) => typeof v?.nome === "string");
  if (variantes.length < 2) return false;
  const exp = (attribution as { exp?: Record<string, unknown> } | null)?.exp;
  const braco = typeof exp?.[EXP_SOTAQUE_LATAM] === "string" ? (exp[EXP_SOTAQUE_LATAM] as string) : "";
  if (!braco || braco === variantes[0].nome) return false;
  const achado = variantes.find((v) => v.nome === braco);
  if (!achado) return false;
  return (achado.peso ?? 1) > 0;
}

/**
 * O sotaque que entra no estilo desta música, ou `null` (o estilo de hoje).
 * `generoNeutro` diz se o gênero é da lista neutra (`ehGeneroLatamNeutro`).
 */
export function sotaqueDaMusica(args: {
  pais: string | null | undefined;
  generoNeutro: boolean;
  attribution: unknown;
  linha: LinhaExperimento;
}): string | null {
  const pais = String(args.pais ?? "").trim().toUpperCase();
  const sotaque = SOTAQUE_POR_PAIS[pais];
  if (!sotaque || !args.generoNeutro) return null;
  return sotaqueLigado(args.attribution, args.linha) ? sotaque : null;
}
