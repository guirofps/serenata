// Declarado aqui, como nos outros templates deste diretório: eles não
// compartilham um módulo de tipos, e criar um só pra isto seria mexer em seis
// arquivos que funcionam.
type IdiomaEmail = "pt" | "es";

// O E-MAIL DE RECOMPRA, que não existia.
//
// ── POR QUE ELE PRECISA EXISTIR ──────────────────────────────────
//
// Medido em 18/08: 248 dos 294 compradores NUNCA entraram na conta. A vitrine
// que a gente construiu no painel (créditos, quadro, as três abas) não alcança
// 84% de quem compra. E-mail alcança: os de entrega têm 66% de abertura e 57%
// de clique, os melhores números do produto inteiro.
//
// E o comportamento já existe sem a gente pedir: 11 dos 290 compradores
// voltaram e compraram a segunda música por conta própria, pagando preço
// cheio, sem oferta nenhuma. Este e-mail é para os outros 279.
//
// ── O QUE ELE NÃO FAZ ────────────────────────────────────────────
//
// Não inventa prazo ("só até amanhã"), não inventa escassez e não promete
// preço que some. A régua é a mesma da sequência de recuperação, e vale por
// dois motivos: o Google Ads derruba conta por alegação falsa, e a pessoa
// volta a comprar de quem não mentiu da primeira vez.
//
// ── POR QUE ESPERA DIAS ──────────────────────────────────────────
//
// No dia da compra ela ainda não entregou o presente. Vender a segunda música
// antes de a primeira ter cumprido o papel dela é pedir antes de entregar.
// Depois de alguns dias ela já viu a reação de quem recebeu, e é essa memória
// que faz a segunda fazer sentido.

const COPY: Record<
  IdiomaEmail,
  {
    assunto: (n: string) => string;
    titulo: (n: string) => string;
    intro: (n: string) => string;
    quemMais: string;
    precoDe: string;
    precoPor: string;
    porQue: string;
    botao: string;
    quadroTitulo: string;
    quadroTexto: string;
    quadroBotao: string;
    rodape: string;
    sair: string;
  }
> = {
  pt: {
    assunto: (n) => `Quem mais merece uma música como a de ${n}?`,
    titulo: (n) => `A música de <em style="color:#7d2b3a;">${n}</em> já está com quem devia.`,
    intro: (n) =>
      `Espero que a reação tenha valido. Faz uns dias que a música de ${n} está no ar, e a essa altura você já sabe o que ela provoca em quem escuta.`,
    quemMais: "Tem mais alguém que merecia ouvir uma música feita só pra ela?",
    precoDe: "R$ 38",
    precoPor: "R$ 28",
    porQue:
      "Como você já é cliente, a segunda sai mais barata: R$ 28 em vez de R$ 38. Você conta a história de outra pessoa, lê a letra de graça antes de decidir, e só paga se quiser ouvir cantada. O crédito não expira.",
    botao: "CRIAR A PRÓXIMA MÚSICA →",
    quadroTitulo: "Ou coloque essa mesma música na parede",
    quadroTexto:
      "O quadro é a letra e a foto de vocês numa folha A4, com o QR Code que toca a música. Você salva o PDF, manda imprimir, põe numa moldura e pendura. Quem passar na frente aponta a câmera e ouve.",
    quadroBotao: "VER O QUADRO",
    rodape: "Serenata · uma música feita da história de quem você ama",
    sair: "não quero mais receber",
  },
  es: {
    assunto: (n) => `¿Quién más merece una canción como la de ${n}?`,
    titulo: (n) => `La canción de <em style="color:#7d2b3a;">${n}</em> ya está con quien debía.`,
    intro: (n) =>
      `Ojalá la reacción haya valido la pena. Hace unos días que la canción de ${n} está en el aire, y a estas alturas ya sabes lo que provoca en quien la escucha.`,
    quemMais: "¿Hay alguien más que merecía escuchar una canción hecha solo para ella?",
    precoDe: "",
    precoPor: "",
    porQue:
      "Cuentas la historia de otra persona, lees la letra gratis antes de decidir, y solo pagas si quieres escucharla cantada.",
    botao: "CREAR LA PRÓXIMA CANCIÓN →",
    // O quadro não existe na Perfect Pay do México. Texto vazio não renderiza.
    quadroTitulo: "",
    quadroTexto: "",
    quadroBotao: "",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
    sair: "no quiero recibir más",
  },
};

const SITE = "https://www.serenatagift.com";

export function assuntoVolteCriar(nome: string, locale: IdiomaEmail = "pt") {
  return (COPY[locale] ?? COPY.pt).assunto(nome);
}

export function emailVolteCriar(args: {
  nome: string;
  linkCriar: string;
  linkDescadastro: string;
  locale?: IdiomaEmail;
}): string {
  const locale = args.locale ?? "pt";
  const C = COPY[locale] ?? COPY.pt;
  const { nome, linkCriar, linkDescadastro } = args;

  return `<!DOCTYPE html>
<html lang="${locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <!-- O preheader: a linha que aparece na caixa de entrada ao lado do
       assunto. Sem ela o cliente de e-mail mostra o começo do HTML. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${C.quemMais}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:32px 28px 30px;">
          <p style="margin:0 0 18px;text-align:center;font-size:12px;letter-spacing:3px;color:#7d2b3a;font-family:Helvetica,Arial,sans-serif;">SERENATA</p>

          <h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;color:#2a1518;font-weight:normal;text-align:center;">
            ${C.titulo(nome)}
          </h1>

          <div style="font-size:15px;line-height:1.65;color:rgba(42,21,24,0.82);font-family:Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 14px;">${C.intro(nome)}</p>
            <p style="margin:0 0 14px;font-size:17px;color:#2a1518;font-family:Georgia,'Times New Roman',serif;">${C.quemMais}</p>
            <p style="margin:0 0 14px;">${C.porQue}</p>
          </div>

          ${
            C.precoPor
              ? `<p style="margin:18px 0 0;text-align:center;font-family:Helvetica,Arial,sans-serif;">
            <span style="font-size:15px;color:rgba(42,21,24,0.45);text-decoration:line-through;">${C.precoDe}</span>
            <span style="font-size:26px;font-weight:700;color:#7d2b3a;margin-left:8px;">${C.precoPor}</span>
          </p>`
              : ""
          }

          <p style="margin:18px 0 0;text-align:center;">
            <a href="${linkCriar}" style="display:inline-block;padding:15px 30px;border-radius:999px;background:#7d2b3a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;font-family:Helvetica,Arial,sans-serif;">${C.botao}</a>
          </p>

          ${
            C.quadroTitulo
              ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;border-top:1px solid rgba(42,21,24,0.10);">
            <tr><td style="padding-top:24px;" align="center">
              <img src="${SITE}/img/quadro-exemplo.jpg" width="118" alt="" style="display:block;border:6px solid #2c211a;border-radius:2px;background:#f6f2ea;padding:6px;">
              <p style="margin:14px 0 0;font-size:17px;color:#2a1518;font-family:Georgia,'Times New Roman',serif;">${C.quadroTitulo}</p>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:rgba(42,21,24,0.7);font-family:Helvetica,Arial,sans-serif;">${C.quadroTexto}</p>
              <a href="${SITE}/dashboard?aba=quadro" style="display:inline-block;margin-top:14px;padding:13px 24px;border-radius:999px;border:1px solid rgba(125,43,58,0.35);color:#7d2b3a;text-decoration:none;font-weight:600;font-size:13px;font-family:Helvetica,Arial,sans-serif;">${C.quadroBotao}</a>
            </td></tr>
          </table>`
              : ""
          }
        </td></tr>
      </table>

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        ${C.rodape}<br>
        <a href="${linkDescadastro}" style="color:rgba(42,21,24,0.4);">${C.sair}</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}
