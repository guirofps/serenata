// E-mail do LINK DE ACESSO (magic link) à conta do comprador.
//
// É a porta da área dele: o link entra logado e leva ao painel, onde estão
// as músicas, o editor de cada presente e o download. O link é de uso único
// e expira — o texto avisa, pra ninguém achar que "parou de funcionar" é bug.
//
// Estética: papel e vinho (mundo claro da marca), tudo inline porque cliente
// de e-mail não entende folha externa.

type IdiomaEmail = "pt" | "es";

/** Um presente já pronto desta conta, pra listar como link direto. */
export type PresenteDoAcesso = { titulo: string | null; tokenEdicao: string };

const COPY: Record<IdiomaEmail, {
  assunto: string; titulo: string; corpo: string; botao: string;
  aviso: (m: number) => string; rodape: string;
  soUltimo: string; atalhoTitulo: string; atalhoCorpo: string; semTitulo: string;
}> = {
  pt: {
    assunto: "Seu acesso à Serenata",
    titulo: "Entrar na sua conta",
    corpo:
      "É só tocar no botão abaixo. Você entra direto, sem senha, na sua área: as músicas que você criou, o editor de cada presente e o download de cada uma.",
    botao: "ENTRAR →",
    aviso: (m) =>
      `Este link é de uso único e expira em ${m} minutos. Se não foi você que pediu, pode ignorar este e-mail com tranquilidade.`,
    rodape: "Serenata · uma música feita da história de quem você ama",
    // A armadilha número 1 do login sem senha: a pessoa não vê o e-mail chegar
    // em dez segundos, pede outro, e com isso MATA o link que estava vindo.
    // Depois clica no antigo, dá erro, e pede outro. Em 15/08 um comprador
    // repetiu isso sete vezes em vinte e um minutos.
    soUltimo:
      "Pediu o link mais de uma vez? Use sempre o e-mail MAIS RECENTE. Ao pedir um novo, os anteriores param de funcionar na hora.",
    atalhoTitulo: "Ou vá direto, sem entrar na conta:",
    atalhoCorpo:
      "Estes links são seus e não expiram. Guarde este e-mail.",
    semTitulo: "Sua música",
  },
  es: {
    assunto: "Tu acceso a Serenata",
    titulo: "Entra a tu cuenta",
    corpo:
      "Solo toca el botón de abajo. Entras directo, sin contraseña, a tu área: las canciones que creaste, el editor de cada regalo y la descarga de cada una.",
    botao: "ENTRAR →",
    aviso: (m) =>
      `Este link es de un solo uso y expira en ${m} minutos. Si no fuiste tú quien lo pidió, puedes ignorar este correo sin problema.`,
    rodape: "Serenata · una canción hecha de la historia de quien tú quieres",
    soUltimo:
      "¿Pediste el link más de una vez? Usa siempre el correo MÁS RECIENTE. Al pedir uno nuevo, los anteriores dejan de funcionar de inmediato.",
    atalhoTitulo: "O entra directo, sin cuenta:",
    atalhoCorpo:
      "Estos links son tuyos y no expiran. Guarda este correo.",
    semTitulo: "Tu canción",
  },
};

/** O assunto, no idioma da conta. */
export function assuntoAcesso(locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto;
}

const SITE = "https://www.serenatagift.com";

// O título vem da IA e passa por uma história escrita pelo usuário. Nada disso
// é confiável dentro de HTML.
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailAcesso(args: {
  link: string;
  expiraMin?: number;
  locale?: IdiomaEmail;
  /**
   * Os presentes já prontos desta conta.
   *
   * O MAGIC LINK NÃO PODE SER O ÚNICO CAMINHO. Ele é de uso único, expira, e
   * é invalidado por qualquer pedido novo — três formas de falhar pra chegar
   * a algo que a pessoa JÁ PAGOU. Quando falha, ela não perde o login, ela
   * perde a música.
   *
   * O link do editor não tem nenhuma dessas fragilidades: é um token estável,
   * sem sessão e sem expiração. Listar os presentes aqui torna o login um
   * atalho em vez de um portão.
   */
  presentes?: PresenteDoAcesso[];
}): string {
  const { link, expiraMin = 60 } = args;
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const presentes = args.presentes ?? [];
  const listaPresentes = presentes.length
    ? `
        <tr><td style="padding:4px 36px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(42,21,24,0.12);padding-top:18px;">
            <tr><td style="padding-top:18px;color:#2a1518;font-size:14px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">
              ${C.atalhoTitulo}
            </td></tr>
            ${presentes
              .map(
                (p) => `<tr><td style="padding:10px 0 0;">
              <a href="${SITE}/editar/${p.tokenEdicao}" style="color:#7d2b3a;font-size:15px;font-family:Helvetica,Arial,sans-serif;text-decoration:underline;">
                ${escapar(p.titulo?.trim() || C.semTitulo)}
              </a>
            </td></tr>`,
              )
              .join("")}
            <tr><td style="padding:12px 0 0;color:rgba(42,21,24,0.45);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
              ${C.atalhoCorpo}
            </td></tr>
          </table>
        </td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto}</title></head>
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
            ${C.titulo}
          </h1>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${C.corpo}
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 8px;">
          <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">
            ${C.botao}
          </a>
        </td></tr>

        <tr><td style="padding:6px 36px 10px;text-align:center;color:rgba(42,21,24,0.45);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
          ${C.aviso(expiraMin)}
        </td></tr>

        <tr><td style="padding:0 36px 22px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2e9dc;border-radius:10px;">
            <tr><td style="padding:13px 16px;color:rgba(42,21,24,0.7);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
              ${C.soUltimo}
            </td></tr>
          </table>
        </td></tr>
${listaPresentes}
        <tr><td height="24"></td></tr>
      </table>

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        ${C.rodape}
      </p>
    </td></tr>
  </table>
</body></html>`;
}
