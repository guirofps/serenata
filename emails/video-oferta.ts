// "A SUA PÁGINA VIROU VÍDEO", no dia seguinte à compra.
//
// ── O E-MAIL NÃO VENDE, ELE CONVIDA A ASSISTIR ───────────────────
//
// O vídeo já existe como prévia dentro do editor, montado com as fotos que
// ela subiu (ver `VideoPresenteEditor`). Então o botão não é "comprar": é
// "ver o meu vídeo". Quem abre dá o play no próprio vídeo, com a própria
// música e as próprias fotos, e a oferta está logo embaixo. Descrever um
// vídeo em texto vende menos do que qualquer segundo dele tocando.
//
// Só sai pra quem já subiu foto: sem foto a prévia é o fundo da marca, e o
// e-mail prometeria "as fotos de vocês" que não estão lá.
//
// Só em português: o vídeo é pago no PIX, e quem comprou no funil espanhol
// pagou em dólar. Mesma regra do editor e do quadro.

const COPY = {
  assunto: (n: string) => `A página de ${n} virou vídeo`,
  titulo: "A página que você montou virou vídeo.",
  corpo:
    "As fotos que você escolheu, passando no ritmo da música, com a letra acendendo palavra por palavra no instante em que é cantada. Já está montado: é só abrir e dar o play.",
  botao: "VER O MEU VÍDEO",
  rodapeAviso:
    "Assistir não custa nada. Pra baixar em HD, sem a marca de prévia, e mandar no WhatsApp ou postar no story, são R$ 24,90, pagamento único.",
  rodape: "Serenata · uma música feita da história de quem você ama",
};

export function assuntoVideoOferta(nome: string): string {
  return COPY.assunto(nome);
}

export function textoVideoOferta(args: { nome: string; link: string }): string {
  return (
    `A página de ${args.nome} virou vídeo.\n\n` +
    `As fotos que você escolheu, passando no ritmo da música, com a letra acendendo palavra por palavra. ` +
    `Já está montado: é só abrir e dar o play.\n\n${args.link}\n\n` +
    `Assistir não custa nada. Pra baixar em HD e mandar no WhatsApp, são R$ 24,90.`
  );
}

export function emailVideoOferta(args: { nome: string; titulo: string; link: string }): string {
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
            &#9654;&nbsp; ${COPY.botao}
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
