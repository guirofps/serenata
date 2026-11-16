// O E-MAIL DA CAMPANHA METADE (16/11/2026, Ralph): 50% em qualquer música,
// vídeo ou quadro, por 7 dias, SÓ pra quem já comprou.
//
// Quem já comprou conhece a entrega e confia na marca: o e-mail fala da PRÓXIMA
// pessoa, com o Natal como motivo real (o envio é de 17 a 19/11). Não cita quem
// foi homenageado: na base tem memorial e tem casal que acabou.
//
// Sem preço em real (o desconto é sobre o preço de cada pessoa), sem promessa de
// tempo, e a validade é a REAL: a data sai de `cupom.ts`.

import { RESPONSAVEL } from "../src/lib/empresa.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cnpj(c: string): string {
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export function assuntoCampanhaMetade(nome: string | null): string {
  return nome ? `${nome}, a próxima música sai pela metade` : "A sua próxima música sai pela metade";
}

export function emailCampanhaMetade(args: {
  nome: string | null;
  linkCriar: string;
  linkConta: string;
  linkExemplo: string;
  linkDescadastro: string;
  valeAte: string;
}): string {
  const nome = args.nome ? esc(args.nome) : null;
  const criar = esc(args.linkCriar);
  const conta = esc(args.linkConta);
  const exemplo = esc(args.linkExemplo);
  const sair = esc(args.linkDescadastro);
  const ate = esc(args.valeAte);
  const sans = "Helvetica,Arial,sans-serif";
  const serif = "Georgia,'Times New Roman',serif";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assuntoCampanhaMetade(args.nome))}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:${serif};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">50% em qualquer música, vídeo ou quadro, até ${ate}. Só pra quem já comprou.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:#7d2b3a;background:linear-gradient(90deg,#7d2b3a,#c9a227);font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 30px 32px;">
          <p style="margin:0 0 22px;text-align:center;font-size:12px;letter-spacing:4px;color:#7d2b3a;font-family:${sans};">SERENATA</p>

          <h1 style="margin:0 0 22px;font-size:28px;line-height:1.3;color:#2a1518;font-weight:normal;text-align:center;font-family:${serif};">
            Você já emocionou alguém. <em style="color:#7d2b3a;">A próxima música sai pela metade.</em>
          </h1>

          <div style="font-size:15px;line-height:1.7;color:rgba(42,21,24,0.82);font-family:${sans};">
            <p style="margin:0 0 14px;">${nome ? `Oi, ${nome}.` : "Oi."}</p>
            <p style="margin:0 0 14px;">Uma música sua já tocou pra alguém que ouviu a própria história cantada e não esqueceu.</p>
            <p style="margin:0 0 14px;">O Natal está chegando, e tem mais gente na sua vida que nunca ganhou uma música: a mãe, o pai, um filho, a amiga de sempre. Pra quem já é da casa, um presente nosso:</p>
          </div>

          <!-- O PRESENTE: o cupom como bloco central, com a validade real. -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;">
            <tr><td align="center" style="border:1px dashed #c9a227;border-radius:14px;background-color:#fffaf2;padding:22px 18px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:rgba(42,21,24,0.55);font-family:${sans};">SEU CUPOM</p>
              <p style="margin:0 0 8px;font-size:28px;font-weight:700;letter-spacing:6px;color:#7d2b3a;font-family:${sans};">METADE</p>
              <p style="margin:0 0 4px;font-size:15px;color:#2a1518;font-family:${sans};"><strong>50% de desconto</strong> em qualquer música, vídeo ou quadro</p>
              <p style="margin:0;font-size:12px;color:rgba(42,21,24,0.55);font-family:${sans};">Válido até ${ate} · já aplicado nos botões abaixo</p>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;text-align:center;">
            <a href="${criar}" style="display:inline-block;padding:16px 34px;border-radius:999px;background:#7d2b3a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.4px;font-family:${sans};">Criar uma música nova</a>
          </p>
          <p style="margin:14px 0 0;text-align:center;font-size:13px;line-height:1.6;font-family:${sans};color:rgba(42,21,24,0.7);">
            Quer o vídeo ou o quadro de uma música que você já tem?<br>
            <a href="${conta}" style="color:#7d2b3a;">Entre na sua conta com o desconto</a>
          </p>
          <p style="margin:14px 0 0;text-align:center;font-size:13px;font-family:${sans};">
            <a href="${exemplo}" style="color:#7d2b3a;">Ouvir um exemplo: “Domingo na Casa da Eva”</a>
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-top:1px solid rgba(42,21,24,0.10);">
            <tr>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">1</span>Você conta a história</td>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">2</span>Ouve a prévia de graça</td>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">3</span>Leva a música pela metade</td>
            </tr>
          </table>

          <p style="margin:30px 0 0;padding-top:20px;border-top:1px solid rgba(42,21,24,0.10);text-align:center;font-size:12px;line-height:1.6;color:rgba(42,21,24,0.5);font-family:${sans};">
            Serenata · música feita da história de quem você ama<br>
            CNPJ ${cnpj(RESPONSAVEL.cnpj)}<br>
            <a href="${sair}" style="color:rgba(42,21,24,0.5);">Não quero mais estes e-mails</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
