// A DESCRIÇÃO DA COBRANÇA DA MÚSICA leva o caminho de volta (10/11/2026).
//
// Medido em 10/11 (compradores de 15/10 a 08/11): 3% pagam e não dão nenhum sinal
// de chegar no que compraram (nem editor, nem página, nem e-mail aberto). Quem
// procura a compra depois procura no app do banco ou no recibo do gateway, e lá só
// aparecia "Serenata · <título>". Agora aparece também onde ouvir: o login por
// e-mail acha a música de quem pagou sem precisar do e-mail de entrega.
//
// Só na cobrança da MÚSICA (PIX e cartão, Woovi e Asaas). Extra, quadro e vídeo
// são comprados de dentro do editor: quem compra já está lá.

/** Onde o comprador entra com o e-mail da compra. Rota `/login` (magic link). */
export const CAMINHO_DE_VOLTA = "serenatagift.com/login";

export function descricaoCobrancaMusica(titulo: string | null | undefined): string {
  // A Woovi corta o comentário em 140: título longo cortado AQUI, pra o caminho
  // de volta nunca ser o pedaço que some (11 + 80 + 33 = 124).
  const bruto = String(titulo ?? "").trim() || "sua música";
  const t = bruto.length > 80 ? bruto.slice(0, 79).trimEnd() + "…" : bruto;
  return `Serenata · ${t} · ouça em ${CAMINHO_DE_VOLTA}`;
}
