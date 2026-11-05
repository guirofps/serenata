// O LINK DA MÚSICA DE NOVO, POR OUTRO CAMINHO, PRA QUEM USA OUTLOOK/HOTMAIL (05/11).
//
// Medido em 05/11 no Resend (amostra de 3 dias): o e-mail de entrega é aberto por
// 53% no Gmail e por 6% no Outlook/Hotmail, com DKIM, SPF e DMARC certos nos dois
// domínios. A Microsoft joga o envio em massa no lixo eletrônico, e o comprador que
// fechou a folha do PIX pra pagar no banco não passa pela /obrigado: o e-mail é o
// único caminho de volta. Em 04/11 um comprador de Outlook pagou, não achou nada e
// foi bater na porta do dono.
//
// Então, pra esses endereços, sai um SEGUNDO e-mail curto, em texto puro, pela
// caixa de verdade da Serenata na Hostinger (contato@serenatagift.com), que é
// como uma pessoa escreve e entra melhor no Outlook. Só Serenata e só português:
// a Ballad tem o support@ próprio e outro público.
//
// Regra pura aqui; quem envia é `api/lib/entrega-outlook.ts`.

/** Endereço da Microsoft (hotmail, outlook, live, msn, em qualquer país). */
export function ehOutlook(email: string): boolean {
  const dominio = email.trim().toLowerCase().split("@")[1] ?? "";
  return /^(hotmail|outlook|live|msn|windowslive)\.[a-z.]+$/.test(dominio);
}

export function assuntoReforco(nome: string): string {
  return `Seu link da música de ${nome}`;
}

/** Texto puro, curto, sem cara de disparo: o link do editor e o que fazer com ele. */
export function textoReforco(args: { nome: string; titulo: string | null; linkEditor: string }): string {
  const musica = args.titulo ? `"${args.titulo}"` : `a música de ${args.nome}`;
  return `Olá!

Seu pagamento entrou e ${musica} já está pronta. Mandamos este e-mail também por aqui porque o Hotmail/Outlook às vezes joga o nosso primeiro e-mail no lixo eletrônico.

É só abrir este link pra ouvir a música completa, baixar o MP3 e pegar o link do presente:
${args.linkEditor}

Guarde este e-mail: o link é seu e não muda. Qualquer dúvida, é só responder aqui.

Um abraço,
Equipe Serenata`;
}
