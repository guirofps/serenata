// SEM IMPORTS, de propósito: o mesmo motivo do `cupom.ts`. Este arquivo é lido
// pelo site, pelas server functions e pela migração (que repete as mesmas
// constantes em SQL, ver `20260926000000_indicacao.sql`).

// O MEMBER GET MEMBER, as regras num lugar só.
//
// Quem já comprou ganha um link. Quem chega por ele paga 10% a menos na
// primeira música, e quem indicou ganha 30% do que o convidado pagou. O valor
// fica "a liberar" por 30 dias (reembolso e contestação chegam depois da
// venda), e vira saque por PIX a partir de R$ 100.
//
// ── POR QUE A COMISSÃO SAI DO VALOR PAGO, E NÃO DO PREÇO ─────────
//
// O convidado já pagou com 10% de desconto, e pode ter levado o vídeo ou o
// quadro junto. 20% do que entrou de verdade é a única base que nunca paga
// comissão sobre dinheiro que não existiu.
//
// ── SE MUDAR UM NÚMERO AQUI, MUDE NA MIGRAÇÃO ────────────────────
//
// A comissão é calculada numa trigger do banco (é o único ponto por onde os
// seis caminhos de pagamento passam), então `PCT_COMISSAO` e `CARENCIA_DIAS`
// existem nos dois lados. O teste deste arquivo segura os números daqui.

export const PCT_DESCONTO = 10;
export const PCT_COMISSAO = 30;
export const CARENCIA_DIAS = 30;
export const SAQUE_MINIMO_CENTAVOS = 10_000;

/**
 * Quanto do saldo vira 1 música nova (28/09). É o preço da "música extra"
 * (`OFERTAS` em `creditos.ts`): a troca vale exatamente o que a pessoa
 * pagaria por ela, nem mais nem menos. Repetido na função
 * `trocar_saldo_por_musica` da migração, e o teste confere os três.
 */
export const MUSICA_COM_SALDO_CENTAVOS = 2_800;

/**
 * O alfabeto do código: sem 0/O, 1/I/L. O código é lido em voz alta e
 * digitado de um print, e é aí que "O" e "0" viram suporte.
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TAMANHO = 6;
const FORMATO = new RegExp(`^[${ALFABETO}]{${TAMANHO}}$`);

/**
 * O código como veio da URL, ou `null` se não for um código.
 *
 * O valor viaja dentro da `attribution`, que o CLIENTE escreve e que sai
 * serializada em lugares que não controlamos. Fora do formato, é lixo, e lixo
 * não chega no banco.
 */
export function normalizarCodigo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return FORMATO.test(c) ? c : null;
}

/** Um código novo. `aleatorio` entra por parâmetro pra ter teste. */
export function gerarCodigo(aleatorio: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < TAMANHO; i++) {
    s += ALFABETO[Math.floor(aleatorio() * ALFABETO.length) % ALFABETO.length];
  }
  return s;
}

/**
 * Quanto sai do preço base da música. Só da música: o item extra do checkout
 * (vídeo, quadro) não tem desconto, é oferta à parte.
 *
 * Exportado pra tela e servidor usarem a MESMA conta. Se a tela calculasse de
 * um jeito e o servidor de outro, a folha mostraria R$ 34,20 e o QR cobraria
 * R$ 34,21, e a pessoa confia no número do banco, não no nosso.
 */
export function descontoDoConvite(baseCentavos: number): number {
  if (!Number.isFinite(baseCentavos) || baseCentavos <= 0) return 0;
  return Math.round((baseCentavos * PCT_DESCONTO) / 100);
}

/** A comissão de quem indicou, sobre o que o convidado pagou. */
export function comissaoDe(pagoCentavos: number): number {
  if (!Number.isFinite(pagoCentavos) || pagoCentavos <= 0) return 0;
  return Math.round((pagoCentavos * PCT_COMISSAO) / 100);
}

/**
 * O LINK CAI NO QUIZ (`/criar`), NÃO NA HOME.
 *
 * Quem chega por convite já foi vendido pela pessoa que mandou — a home
 * repetiria um argumento que ela já ouviu de alguém em quem confia, e cada
 * tela a mais antes do quiz é gente que desiste no caminho.
 *
 * O `?ref` continua sendo capturado porque `carimbarIndicacao()` roda na RAIZ
 * (`__root.tsx`), em toda rota, e não na home. Se um dia ele voltar pra
 * dentro da home, este link para de dar desconto EM SILÊNCIO: o convidado
 * paga cheio e o indicador fica sem comissão, sem erro em lugar nenhum.
 */
export function linkDoConvite(codigo: string, site = "https://www.serenatagift.com"): string {
  return `${site}/criar?ref=${codigo}`;
}

/** "R$ 34,20", "R$ 100". Mesmo formato do resto do funil. */
export function reaisDeCentavos(c: number): string {
  const v = (c / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
  return `R$ ${v.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/**
 * A chave PIX do saque, conferida no servidor.
 *
 * Não tenta adivinhar o tipo: quem paga é o dono, na mão, e o aplicativo do
 * banco dele valida a chave melhor do que qualquer regex daqui. O que se
 * barra é o que não pode ser chave de jeito nenhum (vazio, gigante, quebra de
 * linha), porque isso sai escrito no painel.
 */
export function chavePixAceitavel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim();
  if (c.length < 5 || c.length > 140) return null;
  if (/[\r\n\t<>]/.test(c)) return null;
  return c;
}
