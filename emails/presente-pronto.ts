// E-mail que o comprador recebe quando o pagamento é confirmado.
//
// É o ÚNICO caminho até o editor: o `token_edicao` não aparece em lugar
// nenhum do site, e é ele que autoriza personalizar a página. Sem este
// e-mail, o comprador paga e não consegue montar o presente.
//
// Estética: papel e vinho (o mundo claro da marca). Tabelas e estilo inline
// porque cliente de e-mail não entende flex nem folha externa.

export function emailPresentePronto(args: {
  nome: string;
  titulo: string;
  linkEditor: string;
  linkPresente: string;
}): string {
  const { nome, titulo, linkEditor, linkPresente } = args;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A música de ${nome} está pronta</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <!-- alt estilizado: o Gmail bloqueia imagem de remetente novo, e
               assim aparece SERENATA em serifada vinho no lugar do ícone
               quebrado. -->
          <img src="https://www.serenatagift.com/img/logo-serenata.png" alt="SERENATA" width="168" height="35" style="display:block;margin:0 auto 16px;border:0;max-width:168px;height:auto;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;text-decoration:none;" />
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">
            A música de <em style="color:#7d2b3a;">${nome}</em> está pronta.
          </h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          Falta só uma coisa: <strong style="color:#2a1518;">montar o presente</strong>.
          Coloque uma foto e escreva uma frase sua. É o que transforma a
          página em algo que só vocês dois entendem.
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 8px;">
          <a href="${linkEditor}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">
            MONTAR O PRESENTE →
          </a>
        </td></tr>

        <tr><td style="padding:6px 36px 26px;text-align:center;color:rgba(42,21,24,0.45);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
          Guarde este e-mail: este link é seu e só ele deixa editar a página.
        </td></tr>

        <tr><td style="padding:0 36px;"><div style="height:1px;background:rgba(42,21,24,0.12);"></div></td></tr>

        <tr><td style="padding:22px 36px 34px;color:rgba(42,21,24,0.6);font-size:13px;line-height:1.7;font-family:Helvetica,Arial,sans-serif;">
          Com pressa? O presente já funciona do jeito que está:<br>
          <a href="${linkPresente}" style="color:#7d2b3a;">${linkPresente}</a>
        </td></tr>
      </table>

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        Serenata · uma música feita da história de quem você ama
      </p>
    </td></tr>
  </table>
</body></html>`;
}
