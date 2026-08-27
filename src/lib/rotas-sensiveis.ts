// ONDE SCRIPT DE TERCEIRO NÃO ENTRA.
//
// O Google Ads (gtag) e a UTMify carregavam em TODA rota. Os dois mandam a
// URL COMPLETA da página pro servidor deles — o gtag chama isso de
// `page_location` — e as nossas URLs não são endereços, são CHAVES:
//
//   /editar/<token_edicao>   autoriza editar e baixar o presente
//   /p/<token>               abre o presente
//   /quadro/<token_edicao>   idem
//   /retomar?s=<session_id>  restaura a sessão do quiz
//   /pix/<referencia>        abre um PIX pendente com o código copiável dentro
//   /auth/callback?code=...  troca por sessão de login do Supabase
//
// Ou seja: o token que É a autorização estava sendo copiado pra dentro do
// Google Analytics e da UTMify a cada abertura. Ninguém precisa ser malicioso
// pra isso virar problema — basta o dado existir onde não devia.
//
// Os dois painéis internos entram na lista por outro motivo. `/admin` e
// `/recuperar` mostram nome, telefone, e-mail e status de pagamento de
// clientes, e têm botão que libera acesso. Carregar JS de terceiro ali é dar a
// esse terceiro (e a quem invadir o CDN dele) leitura do DOM inteiro dessas
// telas.
//
// `/obrigado` FICA DE FORA da lista de propósito: é lá que a conversão do
// Google Ads dispara, e sem ela a campanha não otimiza — é o único lugar onde
// o script paga o próprio preço. O `?code=` que ela carrega é o id da
// transação, que só serve pra pedido pago nas últimas 2 horas
// (`pos-compra.ts`), então o estrago possível é pequeno e conhecido.

const PREFIXOS = [
  "/p/",
  "/editar/",
  "/quadro/",
  "/meu-quadro",
  "/dashboard",
  "/admin",
  "/recuperar",
  "/retomar",
  "/pix/",
  "/descadastrar",
  "/auth/",
];

/**
 * `true` quando a rota carrega token, sessão ou PII na URL/na tela — e
 * portanto não deve carregar analytics de terceiro.
 *
 * Compara por PREFIXO e não por rota exata porque o token vem no caminho:
 * `/editar/abc123` e `/editar/def456` são a mesma tela.
 */
export function rotaSensivel(pathname: string): boolean {
  const p = (pathname || "/").toLowerCase();
  // Os prefixos de idioma são os mesmos caminhos, um nível abaixo.
  const semLocale = p.replace(/^\/(es|pt)(?=\/|$)/, "") || "/";
  return PREFIXOS.some((pre) => semLocale === pre.replace(/\/$/, "") || semLocale.startsWith(pre));
}
