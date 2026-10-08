// O CAMINHO DE VOLTA PRA MÚSICA DA PESSOA, a partir de um link de e-mail.
//
// ── POR QUE NÃO `/criar?checkout=1` ──────────────────────────────
//
// O `/pix/<ref>` e a `/oferta/<token>` mandavam quem não conseguia pagar ali
// pra `/criar?checkout=1`. O schema de busca do `/criar` só conhece `step` e
// `t`: o `checkout=1` era descartado em silêncio e a pessoa caía na ABERTURA
// do quiz. Tocar em "começar" ali gira a sessão (conserto de 04/10, pra a
// segunda música não sobrescrever a primeira), e ela ficava separada da
// música que já estava gravada e paga a geração. Visto em 08/10, lendo as
// duas rotas depois de a oferta da escada voltar a funcionar.
//
// `/retomar?s=<sessão>` é o caminho que já existe pra isso: reidrata a sessão,
// a letra e o braço de preço, e manda pro reveal. Quem já pagou vai direto
// pro editor.
//
// ── A SESSÃO É CREDENCIAL ────────────────────────────────────────
//
// `/retomar?s=` devolve e-mail, WhatsApp e o token do editor. Por isso:
//   - ela só sai do SERVIDOR, lida a partir de um token ou referência que a
//     própria pessoa recebeu por e-mail, nunca montada no cliente;
//   - `/retomar`, `/pix/` e `/oferta/` ficam em `rotas-sensiveis.ts`, onde
//     script de terceiro não carrega;
//   - o formato é conferido aqui: qualquer coisa fora de um id de sessão vira
//     `/criar`, e não um link montado com lixo.

/** O id de sessão é um `crypto.randomUUID()`. Folga de formato, sem aceitar `&`, `/` ou `?`. */
const SESSAO_VALIDA = /^[A-Za-z0-9-]{8,64}$/;
/** Os cupons de `cupom.ts` (SRN27, MUSICA10): letras e números, nada mais. */
const CUPOM_VALIDO = /^[A-Za-z0-9]{2,32}$/;

/**
 * Pra onde mandar quem precisa continuar a compra fora desta tela.
 *
 * Sem sessão conhecida, `/criar`: é o melhor que dá, e é o que essas telas já
 * faziam. O cupom só vai junto quando o pedido original tinha um, pra o preço
 * do reveal ser o mesmo que a pessoa já tinha visto.
 */
export function caminhoDeVolta(sessao: string | null | undefined, cupom?: string | null): string {
  const s = String(sessao ?? "").trim();
  if (!SESSAO_VALIDA.test(s)) return "/criar";
  const c = String(cupom ?? "").trim();
  const comCupom = CUPOM_VALIDO.test(c) ? `&cupom=${encodeURIComponent(c)}` : "";
  return `/retomar?s=${encodeURIComponent(s)}${comCupom}`;
}
