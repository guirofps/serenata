// "FALTAM 10 DIAS": o lembrete de uma data que ela mesma cadastrou no editor.
//
// Não é e-mail frio: foi ela que pediu ("me avise nessa data"). Por isso o
// tom é de quem cumpre um combinado, e o botão leva direto ao caminho mais
// curto pra próxima música: o atalho de quem já é cliente, no editor dela
// (`#outra-musica`), e não o funil inteiro a preço cheio.

import type { TipoData } from "../src/lib/datas-especiais";

const SITE = "https://www.serenatagift.com";

function frase(nome: string, tipo: TipoData): string {
  if (tipo === "namoro") return `o aniversário de namoro com ${nome}`;
  if (tipo === "outra") return `a data de ${nome}`;
  return `o aniversário de ${nome}`;
}

export function assuntoLembreteData(nome: string, tipo: TipoData, dias: number): string {
  return `Faltam ${dias} dias pra ${frase(nome, tipo)}`;
}

export function textoLembreteData(args: {
  nome: string;
  tipo: TipoData;
  dias: number;
  link: string;
}): string {
  return (
    `Você pediu pra gente avisar: faltam ${args.dias} dias pra ${frase(args.nome, args.tipo)}.\n\n` +
    `Dá tempo de fazer uma música só pra ${args.nome}. Você conta a história, a letra sai na hora e a música fica pronta em minutos.\n\n` +
    `${args.link}`
  );
}

export function emailLembreteData(args: {
  nome: string;
  tipo: TipoData;
  dias: number;
  dataTexto: string;
  link: string;
}): string {
  const { nome, tipo, dias, dataTexto, link } = args;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${assuntoLembreteData(nome, tipo, dias)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">SERENATA</div>
          <p style="margin:0 0 10px;font-size:13px;letter-spacing:2px;color:rgba(42,21,24,0.5);font-family:Helvetica,Arial,sans-serif;">${dataTexto.toUpperCase()}</p>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">Faltam ${dias} dias pra ${frase(nome, tipo)}.</h1>
        </td></tr>
        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          Você pediu pra gente avisar, e ainda dá tempo. Uma música feita só pra ${nome}, com a história de vocês: você conta, a letra sai na hora e a música fica pronta em minutos, com a página pra entregar.
        </td></tr>
        <tr><td align="center" style="padding:24px 36px 8px;">
          <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
            FAZER A MÚSICA DE ${nome.toUpperCase()}
          </a>
        </td></tr>
        <tr><td style="padding:10px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
          Como você já é cliente, a próxima sai por um preço menor.
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">Serenata · você cadastrou esta data na página do seu presente · <a href="${SITE}" style="color:rgba(42,21,24,0.4);">serenatagift.com</a></p>
    </td></tr>
  </table>
</body></html>`;
}
