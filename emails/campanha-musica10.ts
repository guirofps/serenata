// O E-MAIL DA CAMPANHA MUSICA10 (07/10/2026): a base inteira que deixou
// e-mail, com R$ 10 de desconto em qualquer música ou extra, por 7 dias.
//
// Duas versões, um layout. Quem JÁ COMPROU conhece a entrega e confia na
// marca: o e-mail fala da PRÓXIMA pessoa. Quem só fez a letra nunca ouviu a
// música cantada: o e-mail fala da história dele. Nenhuma das duas cita a
// pessoa homenageada pelo nome: na base tem memorial e tem casal que acabou,
// e um nome errado ali estraga o e-mail inteiro.
//
// O cupom é o bloco central, com a validade REAL (a data sai de `cupom.ts`).
// Nada de "últimas horas" inventado: a urgência permitida é a que existe.

export type VersaoCampanha = "comprador" | "lead";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COPY: Record<
  VersaoCampanha,
  {
    assunto: (nome: string | null) => string;
    preheader: (valeAte: string) => string;
    titulo: string;
    saudacao: (nome: string | null) => string;
    texto: string[];
  }
> = {
  comprador: {
    assunto: (n) => (n ? `${n}, quem merece a próxima música?` : "Quem merece a próxima música?"),
    preheader: (d) => `R$ 10 de desconto em qualquer música ou extra, até ${d}.`,
    titulo: 'Você já emocionou alguém uma vez. <em style="color:#7d2b3a;">Quem é o próximo?</em>',
    saudacao: (n) => (n ? `Oi, ${n}.` : "Oi."),
    texto: [
      "Uma música sua já tocou num aniversário, num jantar, numa chamada de vídeo. Alguém ouviu a própria história cantada e não esqueceu.",
      "Tem mais gente na sua vida que nunca teve uma música: a mãe, o pai, um filho, a amiga de sempre. Pra quem já é da casa, um presente nosso:",
    ],
  },
  lead: {
    assunto: (n) => (n ? `${n}, a sua história ainda pode virar música` : "A sua história ainda pode virar música"),
    preheader: (d) => `R$ 10 de desconto em qualquer música ou extra, até ${d}.`,
    titulo: 'Tem uma música <em style="color:#7d2b3a;">esperando por você.</em>',
    saudacao: (n) => (n ? `Oi, ${n}.` : "Oi."),
    texto: [
      "Você começou a contar uma história pra gente, e a letra ficou pronta. A música é o que falta: a mesma história, cantada, com o nome de quem você ama.",
      "Pode ser aquela pessoa ou outra. Você conta, lê a letra na hora e de graça, e só paga se quiser ouvir cantada. E agora com um presente nosso:",
    ],
  },
};

export function assuntoCampanhaMusica10(versao: VersaoCampanha, nome: string | null): string {
  return COPY[versao].assunto(nome);
}

export function emailCampanhaMusica10(args: {
  versao: VersaoCampanha;
  nome: string | null;
  linkCriar: string;
  linkExemplo: string;
  linkDescadastro: string;
  valeAte: string;
}): string {
  const C = COPY[args.versao];
  const nome = args.nome ? esc(args.nome) : null;
  const criar = esc(args.linkCriar);
  const exemplo = esc(args.linkExemplo);
  const sair = esc(args.linkDescadastro);
  const sans = "Helvetica,Arial,sans-serif";
  const serif = "Georgia,'Times New Roman',serif";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(C.assunto(args.nome))}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:${serif};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${C.preheader(esc(args.valeAte))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:#7d2b3a;background:linear-gradient(90deg,#7d2b3a,#c9a227);font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 30px 32px;">
          <p style="margin:0 0 22px;text-align:center;font-size:12px;letter-spacing:4px;color:#7d2b3a;font-family:${sans};">SERENATA</p>

          <h1 style="margin:0 0 22px;font-size:28px;line-height:1.3;color:#2a1518;font-weight:normal;text-align:center;font-family:${serif};">
            ${C.titulo}
          </h1>

          <div style="font-size:15px;line-height:1.7;color:rgba(42,21,24,0.82);font-family:${sans};">
            <p style="margin:0 0 14px;">${C.saudacao(nome)}</p>
            ${C.texto.map((t) => `<p style="margin:0 0 14px;">${t}</p>`).join("\n            ")}
          </div>

          <!-- O PRESENTE: o cupom como bloco central, com a validade real. -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;">
            <tr><td align="center" style="border:1px dashed #c9a227;border-radius:14px;background-color:#fffaf2;padding:22px 18px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:rgba(42,21,24,0.55);font-family:${sans};">SEU CUPOM</p>
              <p style="margin:0 0 8px;font-size:28px;font-weight:700;letter-spacing:6px;color:#7d2b3a;font-family:${sans};">MUSICA10</p>
              <p style="margin:0 0 4px;font-size:15px;color:#2a1518;font-family:${sans};"><strong>R$ 10 de desconto</strong> em qualquer música ou extra</p>
              <p style="margin:0;font-size:12px;color:rgba(42,21,24,0.55);font-family:${sans};">Válido até ${esc(args.valeAte)} · já aplicado no botão abaixo</p>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;text-align:center;">
            <a href="${criar}" style="display:inline-block;padding:16px 34px;border-radius:999px;background:#7d2b3a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.4px;font-family:${sans};">Criar uma música nova</a>
          </p>
          <p style="margin:14px 0 0;text-align:center;font-size:13px;font-family:${sans};">
            <a href="${exemplo}" style="color:#7d2b3a;">Ouvir um exemplo: “Domingo na Casa da Eva”</a>
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-top:1px solid rgba(42,21,24,0.10);">
            <tr>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">1</span>Você conta a história</td>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">2</span>Lê a letra na hora, de graça</td>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">3</span>Ouve cantada e decide</td>
            </tr>
          </table>

          <p style="margin:30px 0 0;padding-top:20px;border-top:1px solid rgba(42,21,24,0.10);text-align:center;font-size:12px;line-height:1.6;color:rgba(42,21,24,0.5);font-family:${sans};">
            Serenata · música feita da história de quem você ama<br>
            CNPJ 45.835.258/0001-46<br>
            <a href="${sair}" style="color:rgba(42,21,24,0.5);">Não quero mais estes e-mails</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
