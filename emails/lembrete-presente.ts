// Lembrete pra quem PAGOU e não montou o presente.
//
// Medido em 03/08: de 6 compras, 3 nunca montaram. O e-mail de entrega tem o
// botão certo, mas basta ele cair em Promoções pra pessoa nunca ver — e uma
// compradora chegou a pedir 11 links de acesso sem conseguir entrar.
//
// Este e-mail tem UM trabalho e um botão só. Nada de "veja também", nada de
// link secundário: quem não montou não precisa de opção, precisa de um lugar
// pra clicar.
//
// Tom: sem culpa e sem urgência falsa. A pessoa já pagou, o produto é dela, e
// a música não expira. Cobrar de quem já comprou é o jeito mais rápido de
// virar reclamação.

export function emailLembretePresente(args: {
  nome: string;
  titulo: string;
  linkEditor: string;
}): string {
  const { nome, titulo, linkEditor } = args;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A música de ${nome} está esperando</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <img src="https://www.serenatagift.com/img/logo-serenata.png" alt="SERENATA" width="168" height="35" style="display:block;margin:0 auto 16px;border:0;max-width:168px;height:auto;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;text-decoration:none;" />
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">
            A música de <em style="color:#7d2b3a;">${nome}</em> está pronta e esperando.
          </h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          Notei que você ainda não montou a página. Falta pouco: escolher a
          gravação, pôr as fotos de vocês e escrever uma frase sua. Leva uns
          dois minutos, e é o que transforma a música em presente.
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 8px;">
          <a href="${linkEditor}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">
            MONTAR O PRESENTE →
          </a>
        </td></tr>

        <tr><td style="padding:10px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
          Não tem pressa: a música é sua e o link não expira.<br>
          Travou em alguma parte? Responda este e-mail que a gente resolve.
        </td></tr>
      </table>

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        Serenata · uma música feita da história de quem você ama
      </p>
    </td></tr>
  </table>
</body></html>`;
}
