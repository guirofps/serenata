// E-mail do LINK DE ACESSO (magic link) à conta do comprador.
//
// É a porta da área dele: o link entra logado e leva ao painel, onde estão
// as músicas, o editor de cada presente e o download. O link é de uso único
// e expira — o texto avisa, pra ninguém achar que "parou de funcionar" é bug.
//
// Estética: papel e vinho (mundo claro da marca), tudo inline porque cliente
// de e-mail não entende folha externa.

export function emailAcesso(args: { link: string; expiraMin?: number }): string {
  const { link, expiraMin = 60 } = args;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seu acesso à Serenata</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <!-- A logo é imagem, e o Gmail BLOQUEIA imagem de remetente novo por
               padrão (aparece ícone quebrado). Por isso o alt vem estilizado
               com a tipografia da marca: se a imagem não carregar, o leitor vê
               SERENATA em serifada vinho, não um quadradinho quebrado. -->
          <img src="https://www.serenatagift.com/img/logo-serenata.png" alt="SERENATA" width="168" height="35" style="display:block;margin:0 auto 16px;border:0;max-width:168px;height:auto;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;text-decoration:none;" />
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">
            Entrar na sua conta
          </h1>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          É só tocar no botão abaixo. Você entra direto, sem senha, na sua
          área: as músicas que você criou, o editor de cada presente e o
          download de cada uma.
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 8px;">
          <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">
            ENTRAR →
          </a>
        </td></tr>

        <tr><td style="padding:6px 36px 26px;text-align:center;color:rgba(42,21,24,0.45);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
          Este link é de uso único e expira em ${expiraMin} minutos. Se não
          foi você que pediu, pode ignorar este e-mail com tranquilidade.
        </td></tr>
      </table>

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        Serenata · uma música feita da história de quem você ama
      </p>
    </td></tr>
  </table>
</body></html>`;
}
