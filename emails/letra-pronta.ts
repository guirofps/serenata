// A LETRA, POR E-MAIL — a promessa que a gente fazia e não cumpria.
//
// No passo do contato o quiz diz: "A letra fica pronta na próxima tela. O
// e-mail é só pra você não perder." E esse e-mail nunca existiu. A pessoa
// deixava o endereço, via a letra, saía, e não recebia nada.
//
// Por isso ele é o primeiro da sequência de recuperação, e o único que não é
// marketing: é entrega do que foi prometido. Chega esperado, e quem esperava
// não marca como spam.
//
// O QUE ELE NÃO FAZ, de propósito:
//   - não fala preço. A pessoa acabou de sair do funil; repetir o valor aqui
//     transforma uma promessa cumprida em cobrança.
//   - não tem urgência inventada. Nada de "sua letra expira".
//   - não pede nada. O único link leva ela de volta a ouvir o que já é dela.

type IdiomaEmail = "pt" | "es";

const COPY: Record<IdiomaEmail, {
  assunto: (n: string) => string;
  titulo: (n: string) => string;
  intro: string;
  botao: string;
  depois: string;
  descadastrar: string;
  rodape: string;
}> = {
  pt: {
    assunto: (n) => `A letra que você escreveu pra ${n}`,
    titulo: (n) => `A letra de ${n}, pra você não perder`,
    intro:
      "Você escreveu isto agora há pouco. É sua, e continua sua — guarde este e-mail.",
    botao: "OUVIR UM TRECHO CANTADO →",
    depois:
      "A gravação com esta letra está no ar, esperando você. Dá pra ouvir um pedaço sem pagar nada.",
    descadastrar: "não quero mais receber",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `La letra que escribiste para ${n}`,
    titulo: (n) => `La letra de ${n}, para que no la pierdas`,
    intro:
      "Escribiste esto hace un momento. Es tuya, y sigue siendo tuya — guarda este correo.",
    botao: "ESCUCHAR UN PEDAZO CANTADO →",
    depois:
      "La grabación con esta letra ya está lista, esperándote. Puedes escuchar un pedazo sin pagar nada.",
    descadastrar: "ya no quiero recibir",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
  },
};

export function assuntoLetraPronta(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto(nome);
}

/** Marcações do Suno ([Chorus], [Verse 1]) não vão pro e-mail: são instrução
 *  pro gerador, não parte da letra que a pessoa escreveu. */
function letraLimpa(letra: string): string {
  return letra
    .split("\n")
    .filter((l) => !/^\s*\[.*\]\s*$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function emailLetraPronta(args: {
  nome: string;
  titulo: string;
  letra: string;
  linkPrevia: string;
  linkDescadastro: string;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const corpo = letraLimpa(args.letra)
    .split("\n")
    .map((l) => (l.trim() ? l : "&nbsp;"))
    .join("<br>");

  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf5ee;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ee;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(42,21,24,0.06);">
        <tr><td style="height:5px;background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:36px 32px 0;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#2a1518;font-weight:500;">
            ${C.titulo(args.nome)}
          </h1>
          <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.6;color:#8a7276;">
            ${C.intro}
          </p>
        </td></tr>

        <tr><td style="padding:24px 32px 0;">
          <div style="background:#faf5ee;border-left:3px solid #c9a227;border-radius:8px;padding:22px 24px;">
            <p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#7d2b3a;">
              ${args.titulo}
            </p>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.85;color:#2a1518;">
              ${corpo}
            </div>
          </div>
        </td></tr>

        <tr><td style="padding:24px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#5a4448;">
          ${C.depois}
        </td></tr>

        <tr><td align="center" style="padding:22px 32px 36px;">
          <a href="${args.linkPrevia}" style="display:inline-block;background:#7d2b3a;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.04em;padding:16px 28px;border-radius:999px;">
            ${C.botao}
          </a>
        </td></tr>
      </table>

      <p style="margin:18px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a7276;">
        ${C.rodape}<br>
        <a href="${args.linkDescadastro}" style="color:#8a7276;">${C.descadastrar}</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}
