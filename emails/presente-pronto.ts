import { linkSuporte } from "../src/lib/suporte-whatsapp";

// O domínio, escrito aqui e não deduzido: e-mail não tem `window.location`, e
// caminho relativo em HTML de e-mail não resolve em cliente nenhum.
const SITE = "https://www.serenatagift.com";

﻿// E-mail que o comprador recebe quando o pagamento é confirmado.
//
// É o ÚNICO caminho até o editor: o `token_edicao` não aparece em lugar
// nenhum do site, e é ele que autoriza personalizar a página. Sem este
// e-mail, o comprador paga e não consegue montar o presente.
//
// Estética: papel e vinho (o mundo claro da marca). Tabelas e estilo inline
// porque cliente de e-mail não entende flex nem folha externa.

type IdiomaEmail = "pt" | "es";

// A copy do e-mail, por idioma. Ele é ENTREGA, não marketing: quem recebe já
// pagou, e o único trabalho aqui é levar a pessoa ao editor.
const COPY: Record<IdiomaEmail, {
  assunto: (n: string) => string;
  titulo: (n: string) => string;
  faltaSo: string; montar: string; coloque: string;
  botao: string; guarde: string; comPressa: string; verPresente: string; rodape: string;
  ajuda: string; ajudaBotao: string;
  quadroTitulo: string; quadroTexto: string; quadroBotao: string;
}> = {
  pt: {
    assunto: (n) => `A música de ${n} está pronta`,
    titulo: (n) => `A música de <em style="color:#7d2b3a;">${n}</em> está pronta.`,
    faltaSo: "Falta só uma coisa:", montar: "montar o presente",
    coloque:
      "Coloque uma foto e escreva uma frase sua. É o que transforma a página em algo que só vocês dois entendem.",
    botao: "MONTAR O PRESENTE →",
    guarde: "Guarde este e-mail: este link é seu e só ele deixa editar a página.",
    ajuda: "Não conseguiu abrir sua música? Fale com a gente no WhatsApp.",
    ajudaBotao: "Chamar no WhatsApp",
    quadroTitulo: "E se essa música também ficasse na parede?",
    quadroTexto:
      "O quadro é a letra dela e a foto de vocês numa folha A4, com o QR Code que toca a música. Você salva o PDF, manda imprimir, põe numa moldura e pendura. Quem passar na frente aponta a câmera e ouve.",
    quadroBotao: "VER O QUADRO DA MINHA MÚSICA",
    comPressa: "Com pressa? O presente já funciona do jeito que está:",
    verPresente: "VER A PÁGINA DO PRESENTE",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `La canción de ${n} ya está lista`,
    titulo: (n) => `La canción de <em style="color:#7d2b3a;">${n}</em> ya está lista.`,
    faltaSo: "Falta solo una cosa:", montar: "armar el regalo",
    coloque:
      "Pon una foto y escribe una frase tuya. Es lo que convierte la página en algo que solo ustedes dos entienden.",
    botao: "ARMAR EL REGALO →",
    guarde: "Guarda este correo: este link es tuyo y solo él permite editar la página.",
    comPressa: "¿Con prisa? El regalo ya funciona tal como está:",
    verPresente: "VER LA PÁGINA DEL REGALO",
    ajuda: "¿No pudiste abrir tu canción? Habla con nosotros por WhatsApp.",
    ajudaBotao: "Escribir por WhatsApp",
    quadroTitulo: "",
    quadroTexto: "",
    quadroBotao: "",
    rodape: "Serenata · una canción hecha de la historia de quien tú quieres",
  },
};

/** O assunto, no idioma da venda. */
export function assuntoPresentePronto(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto(nome);
}

export function emailPresentePronto(args: {
  nome: string;
  titulo: string;
  linkEditor: string;
  linkPresente: string;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { nome, titulo, linkEditor, linkPresente } = args;
  // Devolve null quando o número não está configurado, e aí o bloco de ajuda
  // não é renderizado: melhor sem canal do que com um link que não abre.
  const linkZap = linkSuporte({
    locale: args.locale === "es" ? "es" : "pt",
    titulo,
  });
  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <!-- alt estilizado: o Gmail bloqueia imagem de remetente novo, e
               assim aparece SERENATA em serifada vinho no lugar do ícone
               quebrado. -->
          <!-- A LOGO E TEXTO, nao imagem, e isso e decisao.
               Era um <img> com o alt estilizado como plano B. O plano B virou
               o CASO COMUM: Gmail e Apple Mail bloqueiam imagem remota por
               padrao e desenham um ICONE DE QUEBRADO ao lado do alt. O dono
               abriu o proprio e-mail em 17/08 e viu exatamente isso, com o
               arquivo servindo HTTP 200 o tempo todo.
               A marca e uma palavra numa serifa com espacejamento. Texto
               renderiza igual em todo cliente, nunca bloqueia, nunca quebra,
               e nao pesa 50 KB. -->
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">
            ${C.titulo(nome)}
          </h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${C.faltaSo} <strong style="color:#2a1518;">${C.montar}</strong>.
          ${C.coloque}
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 8px;">
          <a href="${linkEditor}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">
            ${C.botao}
          </a>
        </td></tr>

        <tr><td style="padding:6px 36px 26px;text-align:center;color:rgba(42,21,24,0.45);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
          ${C.guarde}
        </td></tr>

        <tr><td style="padding:0 36px;"><div style="height:1px;background:rgba(42,21,24,0.12);"></div></td></tr>

        <tr><td style="padding:22px 36px 34px;color:rgba(42,21,24,0.6);font-size:13px;line-height:1.7;font-family:Helvetica,Arial,sans-serif;">
          ${C.comPressa}<br>
          <!-- O LINK VIRA BOTÃO, e não texto solto.
               Em 11/08 uma compradora mexicana abriu um ticket dizendo
               "página no encontrada 404". Os links dela estavam todos certos e
               respondendo 200 — o que quebrou foi a URL escrita AQUI como
               texto visível: cliente de e-mail corta URL longa no fim da
               linha, ou cola a pontuação da frase nela. E token errado por um
               caractere dá 404 seco, sem pista nenhuma:
                   /p/783ef70709164f46b9fd1   (faltando 1 char)  -> 404
                   /p/783ef70709164f46b9fd1e. (com ponto)        -> 404
               Como botão, o destino vive só no href e nunca é lido, cortado
               ou reescrito por quem renderiza o e-mail. -->
          <a href="${linkPresente}" style="display:inline-block;margin-top:8px;padding:10px 20px;border-radius:999px;border:1px solid rgba(125,43,58,0.35);color:#7d2b3a;text-decoration:none;font-weight:600;">${C.verPresente}</a>
        </td></tr>
      </table>

      <!-- O QUADRO, no e-mail de entrega.
           Medido em 18/08: 248 dos 294 compradores NUNCA entraram na conta.
           A vitrine do painel não alcança essa gente; este e-mail alcança
           (66% de abertura, 57% de clique, os melhores números que a gente
           tem em qualquer lugar). Se a oferta só existir no painel, ela não
           existe pra 84% de quem compra.

           VAI DEPOIS DO CTA PRINCIPAL, e é visualmente mais fraco: a ação
           desta mensagem é montar o presente, e uma oferta competindo com ela
           faria a pessoa sair sem montar nada, que é o defeito que a gente já
           corrigiu na tela de obrigado.

           E é o QUADRO, não "mais uma música": ele soma ao que ela acabou de
           receber. Pedir a segunda música de alguém que ainda não ouviu a
           primeira é pedir cedo demais. -->
      ${
        C.quadroTitulo
          ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid rgba(42,21,24,0.10);">
        <tr><td style="padding-top:22px;" align="center">
          <img src="${SITE}/img/quadro-exemplo.jpg" width="120" alt="" style="display:block;border:6px solid #2c211a;border-radius:2px;background:#f6f2ea;padding:6px;">
          <p style="margin:14px 0 0;font-size:17px;color:#2a1518;font-family:Georgia,'Times New Roman',serif;">
            ${C.quadroTitulo}
          </p>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:rgba(42,21,24,0.7);font-family:Helvetica,Arial,sans-serif;">
            ${C.quadroTexto}
          </p>
          <a href="${SITE}/dashboard?aba=quadro" style="display:inline-block;margin-top:14px;padding:13px 24px;border-radius:999px;border:1px solid rgba(125,43,58,0.35);color:#7d2b3a;text-decoration:none;font-weight:600;font-size:13px;font-family:Helvetica,Arial,sans-serif;">${C.quadroBotao}</a>
        </td></tr>
      </table>`
          : ""
      }

      <!-- O SOCORRO, no e-mail e não só no site.
           Medido em 18/08: 248 dos 294 compradores nunca entraram na conta.
           Quem não consegue abrir o presente não vai procurar uma página de
           ajuda; ela está olhando pra ESTE e-mail, e é aqui que o canal
           precisa estar. Sem isso, quem digitou o e-mail errado ou não achou
           o link simplesmente some, e a gente só descobre pelo ticket. -->
      ${linkZap ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid rgba(42,21,24,0.08);color:rgba(42,21,24,0.65);font-size:13px;line-height:1.5;font-family:Helvetica,Arial,sans-serif;">
        ${C.ajuda}<br>
        <a href="${linkZap}" style="display:inline-block;margin-top:8px;color:#7d2b3a;font-weight:600;text-decoration:underline;">${C.ajudaBotao}</a>
      </p>` : ""}

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        ${C.rodape}
      </p>
    </td></tr>
  </table>
</body></html>`;
}
