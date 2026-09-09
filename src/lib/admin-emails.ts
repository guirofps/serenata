// QUEM PODE ENTRAR NO PAINEL PELO GOOGLE.
//
// Arquivo próprio, sem `node:crypto` e sem cookie, pra a regra ter teste. É a
// mesma razão de `admin-estado.ts` existir: a decisão de acesso é a parte que
// não pode estar errada, e a parte que não pode estar errada é a que precisa
// ser testável isolada.
//
// A lista vem de `ADMIN_EMAILS`, e não do código, pra tirar ou pôr um admin não
// exigir deploy. Ela FALHA FECHADO: sem variável, ninguém entra pelo Google.
// É a regra que `ADMIN_SECRET` já segue, e o oposto do webhook herdado do
// numaya (`!secretEsperado || ...`), que aceitava qualquer POST quando a env
// faltava.

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Lê `ADMIN_EMAILS` e devolve a lista normalizada.
 *
 * Aceita vírgula, ponto-e-vírgula, espaço e quebra de linha como separador,
 * porque ninguém cola uma lista de e-mails limpa na caixinha da Vercel.
 *
 * Pedaço vazio é DESCARTADO. Sem isso, `"a@x.com,,"` deixaria um `""` na
 * lista, e uma entrada vazia casando com um e-mail vazio é justamente como uma
 * lista de permissão vira uma porta aberta.
 */
export function lerListaDeAdmins(bruto: string | undefined | null): string[] {
  if (!bruto) return [];
  return bruto
    .split(/[,;\s]+/)
    .map(norm)
    .filter(Boolean);
}

/**
 * O e-mail está liberado?
 *
 * IGUALDADE, depois de baixar a caixa e tirar o espaço das pontas. Nada de
 * "começa com", "contém" ou normalização de provedor: um `nosfer@gmail.com.br`
 * passaria em qualquer coisa mais frouxa que isso, e é o truque mais barato que
 * existe.
 *
 * Sufixo com `+` é NEGADO de propósito. O Gmail entrega
 * `nosfer+admin@gmail.com` na mesma caixa, então quem usaria isso já é o dono
 * da conta — não é brecha. A escolha é de legibilidade: abrir a exceção
 * trocaria uma comparação que qualquer um confere de olho por uma regra de
 * normalização que só vale pro Gmail, e que passaria a decidir acesso.
 */
export function emailLiberado(email: string | null | undefined, lista: string[]): boolean {
  if (!email) return false;
  const alvo = norm(email);
  if (!alvo) return false;
  // NORMALIZA OS DOIS LADOS, mesmo que `lerListaDeAdmins` já entregue limpo.
  //
  // Não é redundância defensiva: esta função DECIDE ACESSO, e não pode depender
  // de disciplina de quem a chama. Um chamador futuro passando um array escrito
  // à mão com uma maiúscula trancaria o dono fora do painel, e o sintoma seria
  // "o Google não loga" — o tipo de bug que se procura em tudo, menos aqui.
  //
  // Lista vazia = ninguém entra. O fail-closed mora nesta linha, num lugar só.
  return lista.some((permitido) => norm(permitido) === alvo);
}
