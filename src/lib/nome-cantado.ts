// TESTE `nome_cantado` (Serenata, funil pt): o nome de quem recebe, do jeito
// que quem comprou escreveu, cantado na letra.
//
// ── O QUE O NÚMERO MOSTROU ───────────────────────────────────────
//
// ~7% das letras não têm o nome como foi digitado: o modelo troca por
// apelido ("Carol" por "Carolina", "Dudinha"), por "meu amor", ou some com
// ele. Essas convertem 14,5% contra 16,8% das que cantam o nome. A prévia é
// o que vende, e ouvir o PRÓPRIO nome é o pico dela.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = a mensagem do usuário de hoje, sem uma vírgula a mais.
//   B = a mesma mensagem + `instrucaoNomeCantado` (em `letra-prompt.ts`):
//       o nome exatamente como digitado, pelo menos no refrão ou na intro;
//       apelido pode vir junto, nunca no lugar.
//
// Vai na MENSAGEM DO USUÁRIO, nunca no system prompt: o system é cacheado e
// igual pra todo mundo (mesma regra do `LOUVOR_INSTRUCOES`).
//
// ── O BRAÇO É LIDO NO SERVIDOR ───────────────────────────────────
//
// O cliente NÃO diz o braço pra server function. Ela lê
// `quiz_responses.attribution.exp.nome_cantado` (a mesma fonte do braço de
// preço em `criar-pix.ts`) e a linha viva de `experimentos`. Não é custo (a
// instrução tem ~80 tokens), mas é a regra da casa: quem decide o que vai pro
// modelo é o servidor. E a linha viva é o que faz desligar pelo `ativo` valer
// na hora, inclusive pra quem já tinha B gravado na atribuição.

export const EXP_NOME_CANTADO = "nome_cantado";

type LinhaExperimento = {
  ativo?: boolean | null;
  variantes?: Array<{ nome?: string; peso?: number }> | null;
} | null;

/**
 * Esta sessão escreve a letra com o nome cantado? Só com o experimento ATIVO
 * na linha viva, e só pra um braço que existe nela e não é o controle (o
 * primeiro). `fora`, braço desconhecido, atribuição vazia ou torta: controle.
 *
 * Braço de peso 0 conta como o controle, a mesma régua do preço
 * (`braco-cobravel.ts`): `?exp=nome_cantado:B` na URL não liga o B depois que
 * o dono zerou o peso dele.
 */
export function nomeCantadoLigado(attribution: unknown, linha: LinhaExperimento): boolean {
  if (!linha?.ativo) return false;
  const variantes = (linha.variantes ?? []).filter((v) => typeof v?.nome === "string");
  if (variantes.length < 2) return false;
  const exp = (attribution as { exp?: Record<string, unknown> } | null)?.exp;
  const braco = typeof exp?.[EXP_NOME_CANTADO] === "string" ? (exp[EXP_NOME_CANTADO] as string) : "";
  if (!braco || braco === variantes[0].nome) return false;
  const achado = variantes.find((v) => v.nome === braco);
  if (!achado) return false;
  return (achado.peso ?? 1) > 0;
}
