type IdiomaEmail = "pt" | "es";

// A SEQUÊNCIA DE RECUPERAÇÃO — e-mails 2, 3 e 4.
//
// O e-mail 1 (a letra) é entrega do que o quiz prometeu, e por isso não é
// marketing. Estes três são. O dado que autorizou escrevê-los, medido em
// 10/08 sobre 216 envios do primeiro: 7 compras, 18 cliques em comprar,
// e UM descadastro. A caixa de entrada aguenta; o que não aguenta é
// insistência sem assunto novo.
//
// A regra que segura os três: CADA UM TRAZ UM FATO QUE A PESSOA NÃO SABIA.
//
//   2 · a música existe. Ela saiu do funil com a letra na tela e uma
//       gravação em produção. A gravação ficou pronta depois que ela foi
//       embora, e ela não tem como saber disso.
//   3 · o que ela recebe não é um arquivo, é uma página que a pessoa
//       homenageada abre. Quem só leu a letra imagina um MP3.
//   4 · o encerramento. Diz que é o último e cumpre.
//
// Nenhum inventa urgência falsa ("acaba hoje", "última chance"), porque
// nada acaba: a letra continua lá. Inventar prazo numa coisa que não tem
// prazo é o caminho mais rápido pro botão de spam — e o domínio de envio é
// o mesmo que carrega a recuperação inteira.
//
// O 4 existe por um motivo contraintuitivo: dizer "não escrevo mais" reduz
// reclamação de spam. Quem estava incomodado descobre que acabou, e quem
// estava só adiando recebe a última chamada honesta.

const COPY: Record<
  IdiomaEmail,
  {
    // 2 · a música ficou pronta
    a2Assunto: (n: string) => string;
    a2Titulo: (n: string) => string;
    a2Intro: string;
    a2Corpo: string;
    a2Botao: string;
    // 3 · não é um arquivo, é uma página
    a3Assunto: (n: string) => string;
    a3Titulo: string;
    a3Intro: string;
    a3Itens: string[];
    a3Botao: string;
    // 4 · encerramento
    a4Assunto: (n: string) => string;
  a4Cupom: (texto: string, por: string) => string;
  a4CupomBotao: string;
    a4Titulo: string;
    a4Intro: string;
    a4Corpo: string;
    a4Botao: string;
    // comuns
    rodape: string;
    sair: string;
  }
> = {
  pt: {
    a2Assunto: (n) => `A música de ${n} ficou pronta`,
    a2Titulo: (n) => `A música de <em style="color:#7d2b3a;">${n}</em> ficou pronta.`,
    a2Intro:
      "Você leu a letra e foi embora antes da gravação terminar. Ela terminou.",
    a2Corpo:
      "É a sua letra, cantada, do jeito que você escreveu. Dá pra ouvir um trecho agora, sem pagar nada, e decidir depois de ouvir. É diferente de ler.",
    a2Botao: "OUVIR UM TRECHO CANTADO →",

    a3Assunto: (n) => `O presente de ${n} não é um arquivo`,
    a3Titulo: "Não é um MP3 que você manda no WhatsApp.",
    a3Intro:
      "Quem lê a letra e sai imagina que vai receber um arquivo de música. Não é isso. É uma página que a pessoa abre no celular dela:",
    a3Itens: [
      "A música toca sozinha quando ela abre o link.",
      "A letra acende palavra por palavra, no ritmo do que está sendo cantado.",
      "As fotos de vocês passam ao fundo, mudando nas viradas da música.",
      "Um QR Code pra imprimir e colar numa caixa de bombom, se você quiser entregar na mão.",
    ],
    a3Botao: "VER COMO FICA →",

    a4Assunto: (n) => `Último e-mail sobre a música de ${n}`,
    a4Titulo: "Este é o último e-mail que eu te mando.",
    a4Intro:
      "Você escreveu uma letra aqui e não seguiu adiante. Tudo bem, acontece, e não vou insistir mais que isso.",
    a4Corpo:
      "A letra continua sua e o link continua funcionando, sem prazo pra acabar. Se um dia der vontade, é só abrir. E se você respondeu não porque desistiu, mas porque alguma coisa não funcionou, me responde este e-mail contando o que foi. Quem lê é gente.",
    a4Botao: "ABRIR MINHA LETRA →",
    // Só aparece enquanto o cupom estiver valendo. O texto NÃO inventa prazo:
    // a escassez aqui é o e-mail ser o último, que é verdade e a pessoa sabe.
    a4Cupom: (t, por) =>
      `E vou junto com uma coisa: separei <strong>${t} de desconto</strong> pra você terminar essa música. O botão aqui embaixo já leva o desconto aplicado, sai por <strong>${por}</strong> em vez do preço cheio.`,
    a4CupomBotao: "TERMINAR COM DESCONTO →",

    rodape: "Serenata · uma música feita da história de quem você ama",
    sair: "não quero mais receber",
  },
  es: {
    a2Assunto: (n) => `La canción de ${n} ya quedó lista`,
    a2Titulo: (n) => `La canción de <em style="color:#7d2b3a;">${n}</em> ya quedó lista.`,
    a2Intro:
      "Leíste la letra y te fuiste antes de que la grabación terminara. Ya terminó.",
    a2Corpo:
      "Es tu letra, cantada, tal como la escribiste. Puedes escuchar un pedazo ahora, sin pagar nada, y decidir después de escucharla. Es distinto a leerla.",
    a2Botao: "ESCUCHAR UN PEDAZO CANTADO →",

    a3Assunto: (n) => `El regalo de ${n} no es un archivo`,
    a3Titulo: "No es un MP3 que mandas por WhatsApp.",
    a3Intro:
      "Quien lee la letra y se va imagina que va a recibir un archivo de música. No es eso. Es una página que la persona abre en su celular:",
    a3Itens: [
      "La canción suena sola cuando abre el link.",
      "La letra se enciende palabra por palabra, al ritmo de lo que se está cantando.",
      "Las fotos de ustedes pasan de fondo, cambiando en los quiebres de la canción.",
      "Un código QR para imprimir y pegar en una caja de chocolates, si prefieres entregarlo en mano.",
    ],
    a3Botao: "VER CÓMO QUEDA →",

    a4Assunto: (n) => `Último correo sobre la canción de ${n}`,
    a4Titulo: "Este es el último correo que te mando.",
    a4Intro:
      "Escribiste una letra aquí y no seguiste. Está bien, pasa, y no voy a insistir más que esto.",
    a4Corpo:
      "La letra sigue siendo tuya y el link sigue funcionando, sin fecha de vencimiento. Si algún día te dan ganas, solo ábrelo. Y si no seguiste no porque cambiaste de idea, sino porque algo no funcionó, respóndeme este correo y cuéntame qué pasó. Quien lee es una persona.",
    a4Botao: "ABRIR MI LETRA →",
    a4Cupom: (t, por) =>
      `Y va junto con algo: te separé <strong>${t} de descuento</strong> para que termines esa canción. El botón de aquí abajo ya lleva el descuento aplicado, te queda en <strong>${por}</strong> en vez del precio completo.`,
    a4CupomBotao: "TERMINAR CON DESCUENTO →",

    rodape: "Serenata · una canción hecha de la historia de quien tú quieres",
    sair: "ya no quiero recibir",
  },
};

/** Qual e-mail da sequência: 2, 3 ou 4. */
export type NumeroDaSequencia = 2 | 3 | 4;

export function assuntoSequencia(
  n: NumeroDaSequencia,
  nome: string,
  locale: IdiomaEmail = "pt",
): string {
  const C = COPY[locale] ?? COPY.pt;
  return n === 2 ? C.a2Assunto(nome) : n === 3 ? C.a3Assunto(nome) : C.a4Assunto(nome);
}

/**
 * A casca é a mesma dos e-mails que já rodam: tabela, largura fixa e estilo
 * em atributo. Não é preguiça de escrever CSS moderno — cliente de e-mail
 * ignora folha de estilo, e Outlook ignora quase tudo que não seja tabela.
 */
function moldura(args: {
  locale: IdiomaEmail;
  preheader: string;
  titulo: string;
  miolo: string;
  botao: string;
  link: string;
  linkDescadastro: string;
}): string {
  const C = COPY[args.locale] ?? COPY.pt;
  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${args.preheader}</title></head>
<body style="margin:0;padding:0;background:#faf5ee;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ee;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(42,21,24,0.06);">
        <tr><td style="height:5px;background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:36px 32px 0;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#2a1518;font-weight:500;">
            ${args.titulo}
          </h1>
        </td></tr>

        <tr><td style="padding:18px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#5a4448;">
          ${args.miolo}
        </td></tr>

        <tr><td align="center" style="padding:28px 32px 8px;">
          <a href="${args.link}" style="display:inline-block;background:#7d2b3a;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;padding:15px 30px;border-radius:999px;">
            ${args.botao}
          </a>
        </td></tr>

        <tr><td style="padding:26px 32px 30px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.6;color:#a89296;text-align:center;">
            ${C.rodape}<br>
            <a href="${args.linkDescadastro}" style="color:#a89296;text-decoration:underline;">${C.sair}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function emailSequencia(args: {
  numero: NumeroDaSequencia;
  nome: string;
  link: string;
  linkDescadastro: string;
  locale?: IdiomaEmail;
  /** Cupom da recuperação, quando ainda vale. Só entra no e-mail 4. */
  cupom?: { codigo: string; texto: string; por: string } | null;
  /**
   * Duas linhas da letra QUE ELA ESCREVEU.
   *
   * Entrou no lugar do cupom. Zero cupons usados em 383 vendas (medido em
   * 18/08): desconto não era o obstáculo. O que a gente tem e nenhum
   * concorrente tem é a letra dela, e um e-mail que MOSTRA duas linhas dela é
   * outra coisa que um e-mail que diz "sua letra está lá".
   */
  verso?: string | null;
}): string {
  const locale = args.locale ?? "pt";
  const C = COPY[locale] ?? COPY.pt;
  const p = (t: string) =>
    `<p style="margin:0 0 14px;">${t}</p>`;

  // A letra vem do banco e vai pra dentro de HTML: um "&" ou um "<" na letra
  // quebraria a marcação. Escapar não é paranoia, é o mesmo cuidado que o
  // CLAUDE.md manda ter com nome injetado sem sanitizar.
  const escapar = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // O VERSO DELA, em citação. Serifa e recuo, do mesmo jeito que ele aparece
  // na tela de oferta: é a letra, não é copy nossa, e precisa parecer letra.
  const citacao = (v?: string | null) =>
    v
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
        <tr><td style="padding:14px 18px;border-left:3px solid rgba(125,43,58,0.45);background:rgba(125,43,58,0.045);">
          <p style="margin:0;font-size:17px;line-height:1.55;color:#2a1518;font-family:Georgia,'Times New Roman',serif;font-style:italic;white-space:pre-line;">${escapar(v)}</p>
        </td></tr>
      </table>`
      : "";


  if (args.numero === 2) {
    return moldura({
      locale,
      preheader: C.a2Assunto(args.nome),
      titulo: C.a2Titulo(args.nome),
      miolo: p(C.a2Intro) + citacao(args.verso) + p(C.a2Corpo),
      botao: C.a2Botao,
      link: args.link,
      linkDescadastro: args.linkDescadastro,
    });
  }

  if (args.numero === 3) {
    const itens = C.a3Itens.map(
      (i) =>
        `<tr><td style="padding:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#5a4448;"><span style="color:#c9a227;">&#9679;</span>&nbsp;&nbsp;${i}</td></tr>`,
    ).join("");
    return moldura({
      locale,
      preheader: C.a3Assunto(args.nome),
      titulo: C.a3Titulo,
      miolo:
        p(C.a3Intro) +
        `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 0;">${itens}</table>`,
      botao: C.a3Botao,
      link: args.link,
      linkDescadastro: args.linkDescadastro,
    });
  }

  // O QUARTO é o último, e é onde o desconto cabia. Quem chegou aqui atravessou
  // três e-mails sem comprar, então não há venda pra canibalizar; nos
  // anteriores seria dar desconto pra quem ia comprar de qualquer jeito.
  return moldura({
    locale,
    preheader: C.a4Assunto(args.nome),
    titulo: C.a4Titulo,
    miolo: p(C.a4Intro) + citacao(args.verso) + p(C.a4Corpo),
    botao: C.a4Botao,
    link: args.link,
    linkDescadastro: args.linkDescadastro,
  });
}
