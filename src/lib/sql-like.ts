// E-MAIL DENTRO DE `ilike` NÃO É COMPARAÇÃO DE IGUALDADE.
//
// `.ilike("email", email)` parece "e-mail igual, sem ligar pra maiúscula".
// Não é: `%` e `_` são CURINGAS do LIKE, e os dois são caracteres válidos num
// endereço de e-mail (o `_` é comum, e o `%` é aceito pela RFC 5322 e por boa
// parte dos provedores).
//
// O estrago que isso fazia, medido lendo o código em 20/08:
//
//   - `inngest/lib/suporte.ts` casava o REMETENTE de um e-mail recebido com
//     `pedidos.email`. Quem escrevesse pro suporte com um endereço contendo
//     `%` casava com o pedido pago mais recente, e o cron respondia SOZINHO
//     mandando `/editar/<token_edicao>` — a página-presente de um cliente
//     real, entregue de bandeja a um estranho.
//   - `meus-quadros.ts` procurava o DIREITO de quadro por `ilike`: um
//     cadastro com `_` no endereço gastava o quadro que era de outra pessoa.
//   - `meus-creditos`, `quadro` e `nome-comprador` liam saldo, presente e
//     nome do titular errado pelo mesmo caminho.
//
// É a mesma família do `admin_session=true` forjável que o CLAUDE.md manda não
// repetir: um valor que o atacante escolhe (o endereço com que ele se cadastra)
// mudando o SENTIDO da consulta, não só o conteúdo dela.
//
// A saída NÃO é trocar tudo por `.eq`: o banco tem endereço gravado por três
// caminhos diferentes (webhook, Supabase Auth, quiz) e nem todos normalizam a
// caixa, então `.eq` transformaria um furo de segurança num cliente que não
// acha o próprio presente. Escapar mantém a comparação sem caixa e mata o
// curinga.

/**
 * Escapa os curingas do LIKE/ILIKE para que o texto valha como literal.
 *
 * O `\` vem primeiro de propósito: escapá-lo depois de `%` e `_` escaparia de
 * novo as barras que acabaram de ser inseridas.
 *
 * PostgREST repassa o padrão pro `ilike` do Postgres, cujo caractere de escape
 * padrão é a própria barra invertida — não é preciso `ESCAPE` explícito.
 */
export function literalLike(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}

/**
 * Os separadores da sintaxe de `or`/`filter` do PostgREST.
 *
 * `,` separa condições e `()` agrupa: um termo de busca com qualquer um dos
 * três deixa de ser um valor e vira ESTRUTURA da consulta. Vira espaço, que
 * é inofensivo dentro de um `%...%`.
 */
export function termoParaOr(texto: string): string {
  return literalLike(texto).replace(/[(),]/g, " ").trim();
}
