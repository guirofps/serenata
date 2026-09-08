// O E-MAIL DE OCASIÃO: a data do calendário, não o tempo desde a compra.
//
// Declarado aqui, como nos outros templates deste diretório: eles não
// compartilham um módulo de tipos, e criar um só pra isto seria mexer em
// seis arquivos que funcionam.
type IdiomaEmail = "pt" | "es";

// ── O QUE ESTE E-MAIL FAZ DE DIFERENTE DO `volte-criar` ──────────
//
// O `volte-criar` diz "faz uns dias que você comprou, que tal outra?". Ele
// mandou 511 e-mails e vendeu zero (Raio-X, 07/09). O motivo não é a copy:
// é que "faz uns dias que você comprou" não é motivo pra presentear
// ninguém.
//
// Este diz "o Dia das Crianças é daqui a duas semanas, e a música do João
// não existe". Duas diferenças que mudam tudo:
//
//   a DATA é real e vale pra todo mundo ao mesmo tempo
//   o NOME é o que a própria pessoa escreveu no quiz
//
// ── A URGÊNCIA AQUI É HONESTA, E É A ÚNICA PERMITIDA ─────────────
//
// A régua da casa proíbe prazo inventado e preço que some. Esta não inventa
// nada: o Dia das Crianças cai no dia 12 de outubro quer a gente mande
// e-mail ou não. Dizer quantos dias faltam é informação, não pressão — e é
// justamente por ser verdade que ela pode ser dita.

const COPY: Record<
  IdiomaEmail,
  {
    assunto: (filho: string) => string;
    preheader: (dias: number) => string;
    titulo: (filho: string) => string;
    intro: (nomeMusica: string, ocasiao: string, dias: number) => string;
    proposta: (filho: string) => string;
    comoFunciona: string;
    botao: (filho: string) => string;
    rodape: string;
    sair: string;
  }
> = {
  // ── SEM GÊNERO, E ISSO NÃO É ESTILO ────────────────────────────
  //
  // O nome vem do campo `filhos` e pode ser de qualquer gênero: Renata,
  // Josi, Sabrina, Kaleb, Marko. Não dá pra deduzir pelo nome sem errar, e
  // o ensaio de 08/09 mostrou a primeira versão mandando "Renata nunca teve
  // uma música só DELE" — erro em metade da lista.
  //
  // A saída é construção com "de <nome>", que serve pros dois: "a música de
  // Renata", "a música de Kaleb". Nenhum ele/ela em lugar nenhum.
  pt: {
    assunto: (filho) => `${filho} ainda não tem uma música`,
    preheader: (dias) => `Faltam ${dias} dias, e a letra sai na hora, de graça.`,
    titulo: (filho) => `E a música de <em style="color:#7d2b3a;">${filho}</em>?`,
    intro: (nomeMusica, ocasiao, dias) =>
      `Quando você fez a música de ${nomeMusica}, escreveu esse nome pra gente. ` +
      `O ${ocasiao} é daqui a ${dias} dias.`,
    proposta: (filho) =>
      `Uma música com o nome de ${filho} cantado, feita da história de vocês. ` +
      `Não é playlist nem trilha pronta: é uma canção que só existe por causa de uma pessoa.`,
    comoFunciona:
      "Você conta a história, lê a letra na hora e de graça, e só paga se quiser ouvir cantada. " +
      "Se não emocionar, não paga nada.",
    botao: (filho) => `Criar a música de ${filho}`,
    rodape: "Serenata · música feita da história de quem você ama",
    sair: "Não quero mais estes e-mails",
  },
  es: {
    assunto: (filho) => `${filho} todavía no tiene una canción`,
    preheader: (dias) => `Faltan ${dias} días, y la letra sale al momento, gratis.`,
    titulo: (filho) => `¿Y la canción de <em style="color:#7d2b3a;">${filho}</em>?`,
    intro: (nomeMusica, ocasiao, dias) =>
      `Cuando hiciste la canción de ${nomeMusica}, nos escribiste ese nombre. ` +
      `El ${ocasiao} es en ${dias} días.`,
    proposta: (filho) =>
      `Una canción con el nombre de ${filho} cantado, hecha de la historia de ustedes. ` +
      `No es una playlist ni una pista lista: es una canción que existe por una sola persona.`,
    comoFunciona:
      "Contás la historia, leés la letra al momento y gratis, y solo pagás si querés escucharla cantada. " +
      "Si no te emociona, no pagás nada.",
    botao: (filho) => `Crear la canción de ${filho}`,
    rodape: "Serenata · música hecha de la historia de quien amás",
    sair: "No quiero más estos correos",
  },
};

export function assuntoOcasiao(filho: string, locale: IdiomaEmail = "pt") {
  return (COPY[locale] ?? COPY.pt).assunto(filho);
}

export function emailOcasiao(args: {
  /** Nome do filho, já extraído e limpo por `primeiroNome`. */
  filho: string;
  /** Pra quem foi a PRIMEIRA música. É o que prova que a gente lembra. */
  nomeMusica: string;
  ocasiao: string;
  diasQueFaltam: number;
  linkCriar: string;
  linkDescadastro: string;
  locale?: IdiomaEmail;
}): string {
  const locale = args.locale ?? "pt";
  const C = COPY[locale] ?? COPY.pt;
  const { filho, nomeMusica, ocasiao, diasQueFaltam, linkCriar, linkDescadastro } = args;

  return `<!DOCTYPE html>
<html lang="${locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(filho)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <!-- Preheader: a linha ao lado do assunto na caixa de entrada. Sem ela o
       cliente de e-mail mostra o começo do HTML. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${C.preheader(diasQueFaltam)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:32px 28px 30px;">
          <p style="margin:0 0 18px;text-align:center;font-size:12px;letter-spacing:3px;color:#7d2b3a;font-family:Helvetica,Arial,sans-serif;">SERENATA</p>

          <h1 style="margin:0 0 18px;font-size:27px;line-height:1.3;color:#2a1518;font-weight:normal;text-align:center;">
            ${C.titulo(filho)}
          </h1>

          <div style="font-size:15px;line-height:1.65;color:rgba(42,21,24,0.82);font-family:Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 14px;">${C.intro(nomeMusica, ocasiao, diasQueFaltam)}</p>
            <p style="margin:0 0 14px;font-size:17px;color:#2a1518;font-family:Georgia,'Times New Roman',serif;">${C.proposta(filho)}</p>
            <p style="margin:0 0 14px;">${C.comoFunciona}</p>
          </div>

          <p style="margin:22px 0 0;text-align:center;">
            <a href="${linkCriar}" style="display:inline-block;padding:15px 30px;border-radius:999px;background:#7d2b3a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;font-family:Helvetica,Arial,sans-serif;">${C.botao(filho)}</a>
          </p>

          <p style="margin:30px 0 0;padding-top:20px;border-top:1px solid rgba(42,21,24,0.10);text-align:center;font-size:12px;line-height:1.6;color:rgba(42,21,24,0.5);font-family:Helvetica,Arial,sans-serif;">
            ${C.rodape}<br>
            <a href="${linkDescadastro}" style="color:rgba(42,21,24,0.5);">${C.sair}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
