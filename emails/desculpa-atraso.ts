// PEDIDO DE DESCULPA por atraso na entrega.
//
// Escrito em 08/08, quando o saldo do kie.ai zerou e 7 compradores ficaram
// esperando até 4h20 pela música que já tinham pago.
//
// Três decisões de tom, e todas contra o instinto:
//
// 1. DIZ O QUE ACONTECEU. "Instabilidade técnica" é o que se escreve quando
//    não se quer contar. A pessoa já sabe que atrasou; o que ela não sabe é
//    se foi descaso. Dizer "acabou o crédito do nosso fornecedor" é feio e é
//    exatamente por isso que funciona.
// 2. NÃO PEDE PACIÊNCIA. Ela já esperou. Pedir paciência agora é cobrar de
//    novo de quem já pagou.
// 3. O LINK VEM JUNTO. Desculpa sem a coisa entregue é só texto.
//
// NÃO promete reembolso. A primeira versão dizia "devolvemos seu dinheiro sem
// perguntar nada", que é a coisa certa a dizer depois de 4h de espera num
// produto pago — mas é dinheiro do dono, e ele pediu desculpa, não reembolso.
// A frase abre o caminho ("responde este e-mail") sem comprometer a decisão
// dele em cada caso.

type IdiomaEmail = "pt" | "es";

const COPY: Record<IdiomaEmail, {
  assunto: (n: string) => string;
  titulo: string;
  oQueHouve: string;
  agora: string;
  botao: string;
  seNaoGostar: string;
  rodape: string;
}> = {
  pt: {
    assunto: (n) => `Desculpa a demora — a música de ${n} está pronta`,
    titulo: "A gente demorou, e a culpa foi nossa.",
    oQueHouve:
      "Você comprou e a música devia ter chegado em minutos. Não chegou: o serviço que grava as vozes ficou sem saldo na nossa conta, e o pedido ficou parado até a gente perceber. Foi falha de operação nossa, não teve nada a ver com você nem com o seu pedido.",
    agora:
      "Já está resolvido e a sua música está pronta, do jeito que devia ter ficado desde o começo.",
    botao: "OUVIR E MONTAR O PRESENTE →",
    seNaoGostar:
      "Se ainda assim ficou alguma coisa mal resolvida, responde este e-mail. Quem lê é gente, e a gente resolve.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `Perdón por la demora — la canción de ${n} ya está lista`,
    titulo: "Nos tardamos, y la culpa fue nuestra.",
    oQueHouve:
      "Compraste y la canción debía haber llegado en minutos. No llegó: el servicio que graba las voces se quedó sin saldo en nuestra cuenta, y tu pedido se quedó detenido hasta que nos dimos cuenta. Fue una falla de operación nuestra, no tuvo nada que ver contigo ni con tu pedido.",
    agora:
      "Ya está resuelto y tu canción está lista, como debió haber estado desde el principio.",
    botao: "ESCUCHAR Y ARMAR EL REGALO →",
    seNaoGostar:
      "Si aun así quedó algo mal resuelto, responde este correo. Quien lee es una persona, y lo resolvemos.",
    rodape: "Serenata · una canción hecha de la historia de quien tú quieres",
  },
};

export function assuntoDesculpa(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto(nome);
}

export function emailDesculpaAtraso(args: {
  nome: string;
  linkEditor: string;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { linkEditor } = args;

  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf5ee;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ee;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(42,21,24,0.06);">
        <tr><td style="height:5px;background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#2a1518;font-weight:500;">
            ${C.titulo}
          </h1>
        </td></tr>
        <tr><td style="padding:16px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#5a4448;">
          ${C.oQueHouve}
        </td></tr>
        <tr><td style="padding:16px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#2a1518;font-weight:600;">
          ${C.agora}
        </td></tr>
        <tr><td align="center" style="padding:28px 32px 8px;">
          <a href="${linkEditor}" style="display:inline-block;background:#7d2b3a;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.04em;padding:16px 28px;border-radius:999px;">
            ${C.botao}
          </a>
        </td></tr>
        <tr><td style="padding:20px 32px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.6;color:#8a7276;">
          ${C.seNaoGostar}
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a7276;">
        ${C.rodape}
      </p>
    </td></tr>
  </table>
</body></html>`;
}
