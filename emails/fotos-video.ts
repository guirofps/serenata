// "COLOQUE AS FOTOS DE VOCÊS", pra quem comprou e não subiu nenhuma foto.
//
// ── POR QUE ESTE E-MAIL EXISTE ───────────────────────────────────
//
// Em 25/09, de 40 compradores só 19 tinham foto na página, e os 3 vídeos
// vendidos saíram todos desses 19. Sem foto, a prévia do vídeo é o fundo da
// marca e o botão de compra nem aparece. O e-mail do vídeo (`video-oferta.ts`)
// só vai pra quem tem foto, então a outra metade não recebia nada.
//
// ── ELE NÃO VENDE O VÍDEO, ELE PEDE AS FOTOS ─────────────────────
//
// O pedido é pequeno e bom pra ela de qualquer jeito: a página que ela manda
// fica mais bonita com as fotos. O link cai no bloco do vídeo, onde o botão
// "Escolher as fotos" abre a galeria do celular; as fotos sobem, a prévia se
// monta na frente dela, e só então aparece a oferta. O preço vai no rodapé
// pra ninguém se sentir enganado ao ver a oferta depois.

const COPY = {
  assunto: (n: string) => `Coloque as fotos de vocês na música de ${n}`,
  titulo: "A página ainda está sem as fotos de vocês.",
  corpo:
    "Escolha umas fotos no celular e veja acontecer: elas passam no ritmo da música, com a letra acendendo palavra por palavra no instante em que é cantada. Leva um minuto, e a página que você manda fica muito mais bonita.",
  botao: "ESCOLHER AS FOTOS",
  rodapeAviso:
    "Colocar as fotos e assistir não custa nada. Se quiser o vídeo em HD pra mandar no WhatsApp ou postar no story, são R$ 24,90, pagamento único.",
  rodape: "Serenata · uma música feita da história de quem você ama",
};

export function assuntoFotosVideo(nome: string): string {
  return COPY.assunto(nome);
}

export function textoFotosVideo(args: { nome: string; link: string }): string {
  return (
    `A página de ${args.nome} ainda está sem as fotos de vocês.\n\n` +
    `Escolha umas fotos no celular e veja elas passando no ritmo da música, com a letra acendendo palavra por palavra. ` +
    `Leva um minuto:\n\n${args.link}\n\n` +
    `Colocar as fotos e assistir não custa nada. O vídeo em HD, pra mandar no WhatsApp, sai por R$ 24,90.`
  );
}

export function emailFotosVideo(args: { nome: string; titulo: string; link: string }): string {
  const { nome, titulo, link } = args;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${COPY.assunto(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">${COPY.titulo}</h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>
        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${COPY.corpo}
        </td></tr>
        <tr><td align="center" style="padding:24px 36px 8px;">
          <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
            ${COPY.botao}
          </a>
        </td></tr>
        <tr><td style="padding:10px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
          ${COPY.rodapeAviso}
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">${COPY.rodape}</p>
    </td></tr>
  </table>
</body></html>`;
}
