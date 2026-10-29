// TESTE `extra_ballad` (Ballad, 28/10/2026): a SEGUNDA MÚSICA mais barata.
//
// Na Serenata o atalho "Quem é a próxima?" vende a música extra a R$ 28 (o
// preço base é R$ 38), e o pacote é o upsell que mais converte lá. Na Ballad
// não existia: quem queria outra música só tinha o convite pro funil inteiro,
// a US$ 19. O RESGATE do crédito já funcionava no funil da Ballad (`TelaOferta`
// confere o crédito antes de qualquer caixa), faltava a COMPRA.
//
//   A  como era: só o convite pro funil (`ConviteOutraMusica`), preço cheio.
//   B  o atalho, no editor e na página de obrigado: outra música por US$ 14
//      ($149 MXN no México), paga pelo Stripe sem login, o crédito vai pro
//      e-mail da compra e o crachá pro navegador; a pessoa cai no quiz e o
//      fim do quiz resgata. O convite continua embaixo, nos dois braços.
//
// O braço sai do `token_edicao` (o 3º caractere do fim, hexadecimal, pela
// paridade), não do sorteio do navegador: quem abre o editor no celular pelo
// e-mail e a /gracias no computador cai no MESMO braço, e a leitura é
// recalculável no banco sem carimbo nenhum. O último caractere é o do
// `preco_video` da Serenata; este usa outro pra não andar junto.
//
// Leitura: RECEITA DE MÚSICA EXTRA POR COMPRADOR em 14 dias, por braço
// (`extra_ballad_exposto` → pedido `up:extra` pago, ligado pelo e-mail), com
// guarda: compra pelo funil a preço cheio de quem já comprou (o B pode só
// trocar US$ 19 por US$ 14 de quem já ia voltar).

export const EXP_EXTRA_BALLAD = "extra_ballad";

/** Desligar = todo mundo no A, sem deploy de tela nova. */
export const LIGADO = true;

/** O braço deste presente. Token inválido ou teste desligado: A. */
export function bracoExtraBallad(tokenEdicao: string | null | undefined): "A" | "B" {
  if (!LIGADO) return "A";
  const t = String(tokenEdicao ?? "");
  const c = t.length >= 3 ? t[t.length - 3] : "";
  const n = parseInt(c, 16);
  if (Number.isNaN(n)) return "A";
  return n % 2 === 1 ? "B" : "A";
}

export const TEXTO_EXTRA_BALLAD = {
  en: {
    pergunta: "Who's next?",
    rotulo: (preco: string) => `Make one for someone else for ${preco}`,
    jaTem: (n: number) => `You already have ${n === 1 ? "1 song paid" : `${n} songs paid`}. Start the next one`,
    // O preço cheio entra pelo `NaMoeda`, como o da oferta (peso no México).
    cheio: "$19",
    fino: (cheio: string) => `Same as this one: their story, their name, sung in minutes. Instead of ${cheio}.`,
    folha: (preco: string) => `Another personalized song · ${preco}`,
  },
  es: {
    pergunta: "¿Quién sigue?",
    rotulo: (preco: string) => `Haz otra para alguien más por ${preco}`,
    jaTem: (n: number) => `Ya tienes ${n === 1 ? "1 canción pagada" : `${n} canciones pagadas`}. Empieza la siguiente`,
    cheio: "US$ 19",
    fino: (cheio: string) => `Igual que esta: su historia, su nombre, cantada en minutos. En vez de ${cheio}.`,
    folha: (preco: string) => `Otra canción personalizada · ${preco}`,
  },
} as const;
