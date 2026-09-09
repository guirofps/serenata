// PRA ONDE O CALLBACK DE AUTENTICAÇÃO MANDA A PESSOA.
//
// `/auth/callback` atende dois fluxos: o magic link do comprador (vai pro
// `/dashboard`) e o login pelo Google do painel (vai pro `/admin`). Quem diz
// qual é vem na URL, e é por isso que esta função existe separada e com teste.
//
// ── É UM ENUM, NUNCA UMA URL ─────────────────────────────────────
//
// Esta rota CRIA SESSÃO, o que a torna a pior página do site pra ter um
// redirect aberto: a pessoa chega nela justamente confiando no link que a
// trouxe. Se `destino` aceitasse endereço, `?destino=https://...` mandaria
// alguém recém-logado pra um clone, com a sessão fresca no bolso.
//
// A defesa não é sanitizar a URL — é não aceitar URL nenhuma. O retorno é uma
// palavra de uma lista de uma.

export type DestinoDoCallback = "admin";

/**
 * Lê o `destino` da URL.
 *
 * `undefined` é o caminho de sempre (`/dashboard`), e é onde cai TODA entrada
 * que não seja exatamente `"admin"` — inclusive lixo, URL e caminho. Valor
 * estranho não pode inventar um terceiro comportamento.
 */
export function destinoDoCallback(valor: unknown): DestinoDoCallback | undefined {
  return valor === "admin" ? "admin" : undefined;
}
