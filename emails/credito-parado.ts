// VOCÊ TEM UMA MÚSICA PAGA E NÃO USOU.
//
// ── A MESMA CLASSE DE DEFEITO DO QUADRO ──────────────────────────
//
// Crédito é a segunda coisa da casa que a pessoa paga e não recebe sozinha:
// ela precisa voltar e fazer outro quiz. Enquanto o pacote só era vendido no
// painel, quem comprava já estava logado e resgatava (14 comprados, 11 usados,
// 78,6%). Em 02/09 ele passou pra `/obrigado` e pro e-mail de entrega, ou seja,
// pra quem não tem login — e o número de crédito parado vai crescer.
//
// Este e-mail é a rede. Sai pelo remetente TRANSACIONAL porque é entrega de
// coisa paga, não oferta, e a copy segue a mesma regra: nenhum verbo de venda,
// nenhum preço, nenhuma âncora. A primeira dúvida de quem recebe um e-mail
// sobre algo que esqueceu é se vão cobrar de novo, e a primeira linha responde.
//
// ── O LINK CARREGA A CREDENCIAL ──────────────────────────────────
//
// Ele aponta pra `/credito/<token_edicao>`, que guarda a prova de posse no
// navegador e sai pro funil. Sem isso a pessoa faria o quiz inteiro e a tela
// de oferta cobraria de novo, porque a sessão nova não sabe quem ela é.

type IdiomaEmail = "pt" | "es";

const COPY: Record<
  IdiomaEmail,
  {
    assunto: string;
    titulo: string;
    corpo: string;
    passos: string[];
    botao: string;
    aviso: string;
    ajuda: string;
    rodape: string;
  }
> = {
  pt: {
    assunto: "Você tem uma música paga esperando",
    titulo: "Falta você dizer pra quem é.",
    corpo:
      "Você comprou uma música a mais e ela ficou guardada esperando uma coisa só: você contar a história de quem vai ganhar. Não precisa pagar nada de novo.",
    passos: [
      "Abra o link abaixo. Ele já entra com o seu crédito reconhecido.",
      "Conte a história dessa pessoa, como você fez da primeira vez.",
      "No fim, em vez de cobrar, o site usa o crédito que já é seu.",
    ],
    botao: "USAR A MINHA MÚSICA",
    aviso: "Você já pagou por ela. O crédito é seu e não tem prazo pra usar.",
    ajuda: "Se alguma coisa não abrir, é só responder este e-mail que a gente resolve.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: "Tenés una canción pagada esperando",
    titulo: "Falta que digas para quién es.",
    corpo:
      "Compraste una canción más y quedó guardada esperando una sola cosa: que cuentes la historia de quien la va a recibir. No tenés que pagar nada de nuevo.",
    passos: [
      "Abrí el link de abajo. Ya entra con tu crédito reconocido.",
      "Contá la historia de esa persona, como hiciste la primera vez.",
      "Al final, en vez de cobrar, el sitio usa el crédito que ya es tuyo.",
    ],
    botao: "USAR MI CANCIÓN",
    aviso: "Ya la pagaste. El crédito es tuyo y no vence.",
    ajuda: "Si algo no abre, respondé este correo y lo resolvemos.",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
  },
};

export function assuntoCreditoParado(locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto;
}

export function emailCreditoParado(args: {
  /** `/credito/<token_edicao>`: guarda a prova de posse e entra no funil. */
  link: string;
  /** Quantos créditos parados. Muda a frase quando é mais de um. */
  saldo?: number;
  locale?: IdiomaEmail;
}) {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { link } = args;
  const saldo = args.saldo ?? 1;
  const es = args.locale === "es";

  return `<!DOCTYPE html>
<html lang="${es ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 28px 30px;">

          <p style="margin:0;font-size:22px;line-height:1.3;color:#2a1518;">
            ${C.titulo}
          </p>

          <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:rgba(42,21,24,0.78);font-family:Helvetica,Arial,sans-serif;">
            ${C.corpo}
          </p>

          ${
            saldo > 1
              ? `<p style="margin:10px 0 0;font-size:14px;color:rgba(42,21,24,0.55);font-family:Helvetica,Arial,sans-serif;">
            ${es ? "Tenés" : "Você tem"} <strong style="color:#2a1518;">${saldo} ${es ? "créditos" : "créditos"}</strong> ${es ? "guardados" : "guardados"}.
          </p>`
              : ""
          }

          <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td align="center">
            <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
              ${C.botao}
            </a>
          </td></tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-top:1px solid rgba(42,21,24,0.10);">
            <tr><td style="padding-top:20px;">
              ${C.passos
                .map(
                  (p, i) =>
                    `<p style="margin:${i ? "10px" : "0"} 0 0;font-size:14px;line-height:1.55;color:rgba(42,21,24,0.7);font-family:Helvetica,Arial,sans-serif;"><strong style="color:#7d2b3a;">${i + 1}.</strong> ${p}</p>`,
                )
                .join("")}
            </td></tr>
          </table>

          <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid rgba(42,21,24,0.08);font-size:13px;line-height:1.55;color:rgba(42,21,24,0.6);font-family:Helvetica,Arial,sans-serif;">
            ${C.aviso}<br>${C.ajuda}
          </p>

          <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
            ${C.rodape}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
