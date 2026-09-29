// A EXTENSÃO `.js` NÃO É OPCIONAL. Este arquivo é importado pelo webhook, que
// roda como ESM na Vercel: sem ela o módulo não resolve em runtime e o handler
// inteiro morre com 500 ANTES de conferir o token.
//
// Foi exatamente o que aconteceu em 18/08: o webhook ficou 5h29 fora do ar e
// nenhum pagamento aprovado virou pedido. Está no CLAUDE.md e eu repeti.
import { linkSuporte } from "../src/lib/suporte-whatsapp.js";
import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import { semComentarios } from "./sem-comentarios.js";

// O domínio, escrito aqui e não deduzido: e-mail não tem `window.location`, e
// caminho relativo em HTML de e-mail não resolve em cliente nenhum.
const SITE = MARCA_ATIVA.url;

﻿// E-mail que o comprador recebe quando o pagamento é confirmado.
//
// É o ÚNICO caminho até o editor: o `token_edicao` não aparece em lugar
// nenhum do site, e é ele que autoriza personalizar a página. Sem este
// e-mail, o comprador paga e não consegue montar o presente.
//
// Estética: papel e vinho (o mundo claro da marca). Tabelas e estilo inline
// porque cliente de e-mail não entende flex nem folha externa.

// `en` é a Ballad Gift (EUA). A copy inglesa foi adaptada do PORTUGUÊS, e
// deixa de fora tudo o que só existe no Brasil: WhatsApp, a segunda música a
// R$ 28 e a oferta do quadro (os dois saem por PIX).
type IdiomaEmail = "pt" | "es" | "en";

// A copy do e-mail, por idioma. Ele é ENTREGA, não marketing: quem recebe já
// pagou, e o único trabalho aqui é levar a pessoa ao editor.
//
// Campo de oferta VAZIO some do e-mail em vez de sair como bloco sem texto.
const COPY: Record<IdiomaEmail, {
  assunto: (n: string) => string;
  titulo: (n: string) => string;
  faltaSo: string; montar: string; coloque: string;
  botao: string; guarde: string; duasVersoes: string; semAnexo: string;
  comPressa: string; verPresente: string; rodape: string;
  ajuda: string; ajudaBotao: string;
  quadroTitulo: string; quadroTexto: string; quadroBotao: string;
  meuQuadroTitulo: string; meuQuadroTexto: string; meuQuadroBotao: string;
  videoTitulo: string; videoTexto: string; videoBotao: string;
  outraMusica: string; outraMusicaLink: string;
}> = {
  pt: {
    assunto: (n) => `A música de ${n} está pronta`,
    titulo: (n) => `A música de <em style="color:#7d2b3a;">${n}</em> está pronta.`,
    faltaSo: "Falta só uma coisa:", montar: "montar o presente",
    coloque:
      "Coloque uma foto e escreva uma frase sua. É o que transforma a página em algo que só vocês dois entendem. <strong style=\"color:#2a1518;\">É aqui também que você baixa o MP3 da música.</strong>",
    botao: "MONTAR O PRESENTE E BAIXAR O MP3 →",
    guarde:
      "Este é o SEU link, guarde ele. É por aqui que você edita a página e baixa a música, sempre que quiser.",
    // DUAS GRAVAÇÕES, dito no e-mail. A oferta promete duas versões e o
    // seletor mora no editor: quem não abre não descobre. Virou ticket em
    // 27/08 ("entendi que seriam duas músicas e veio só uma") de uma cliente
    // que tinha as duas prontas, com karaokê, esperando.
    duasVersoes:
      "São DUAS gravações da mesma letra. Ouça as duas no link acima e escolha a que vai tocar pra ela.",
    // A ENTREGA É POR LINK. Cinco dos sete tickets de 26/08 eram gente
    // esperando arquivo chegar sozinho, por WhatsApp ou anexo.
    semAnexo:
      "A música não vai anexada neste e-mail e não mandamos por WhatsApp: ela mora nesses links, e eles são seus pra sempre.",
    ajuda: "Não conseguiu abrir sua música? Fale com a gente no WhatsApp.",
    ajudaBotao: "Chamar no WhatsApp",
    quadroTitulo: "E se essa música também ficasse na parede?",
    quadroTexto:
      "O quadro é a letra dela e a foto de vocês numa folha A4, com o QR Code que toca a música. Você salva o PDF, manda imprimir, põe numa moldura e pendura. Quem passar na frente aponta a câmera e ouve.",
    quadroBotao: "VER O QUADRO DA MINHA MÚSICA",
    // PRA QUEM JÁ PAGOU. Não é oferta, é entrega: a frase precisa dizer que o
    // quadro é dela e que falta um passo, não convidar a comprar de novo.
    meuQuadroTitulo: "O seu quadro está esperando você montar",
    meuQuadroTexto:
      "Você já pagou por ele. É a letra e a foto de vocês numa folha A4, com o QR Code que toca a música. Escolhe a foto, a gente monta o PDF, e você manda imprimir.",
    meuQuadroBotao: "MONTAR O MEU QUADRO",
    videoTitulo: "O seu vídeo já está pago",
    videoTexto:
      "Ele é feito das fotos de vocês. Suba as fotos na página, dê o play pra conferir e toque em \"Gerar meu vídeo\".",
    videoBotao: "SUBIR AS FOTOS E GERAR",
    comPressa:
      "E este é o link <strong style=\"color:#2a1518;\">que você manda pra ela</strong>. O presente já funciona do jeito que está, mesmo sem a foto:",
    verPresente: "ABRIR A PÁGINA QUE EU VOU MANDAR",
    // UMA LINHA, e no fim. Quem recebe este e-mail ainda não ouviu a música
    // que acabou de comprar, então isto não pode ter peso de oferta. Existe
    // porque a única porta visível pra segunda música levava ao funil a preço
    // cheio: em agosto, 32 recompras pagaram R$ 1.317,40 onde o pacote teria
    // cobrado R$ 896.
    outraMusica: "Tem mais alguém que merece uma? A segunda sai por R$ 28, e você não refaz nada: conta a história e a música fica pronta.",
    outraMusicaLink: "quero mais uma música",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `La canción de ${n} ya está lista`,
    titulo: (n) => `La canción de <em style="color:#7d2b3a;">${n}</em> ya está lista.`,
    faltaSo: "Falta solo una cosa:", montar: "armar el regalo",
    coloque:
      "Pon una foto y escribe una frase tuya. Es lo que convierte la página en algo que solo ustedes dos entienden. <strong style=\"color:#2a1518;\">Aquí también descargas el MP3 de la canción.</strong>",
    botao: "ARMAR EL REGALO Y DESCARGAR EL MP3 →",
    guarde:
      "Este es TU link, guárdalo. Por aquí editas la página y descargas la canción, cuando quieras.",
    duasVersoes:
      "Son DOS grabaciones de la misma letra. Escuchá las dos en el link de arriba y elegí la que va a sonar para ella.",
    semAnexo:
      "La canción no va adjunta en este correo y no la mandamos por WhatsApp: vive en estos links, y son tuyos para siempre.",
    comPressa:
      "Y este es el link <strong style=\"color:#2a1518;\">que le envías a ella</strong>. El regalo ya funciona tal como está, aunque todavía no pongas la foto:",
    verPresente: "ABRIR LA PÁGINA QUE VOY A ENVIAR",
    ajuda: "¿No pudiste abrir tu canción? Habla con nosotros por WhatsApp.",
    ajudaBotao: "Escribir por WhatsApp",
    quadroTitulo: "",
    quadroTexto: "",
    quadroBotao: "",
    meuQuadroTitulo: "Tu cuadro está esperando que lo armes",
    meuQuadroTexto:
      "Ya lo pagaste. Es la letra y la foto de ustedes en una hoja A4, con el código QR que reproduce la canción. Elegís la foto, armamos el PDF y lo mandás a imprimir.",
    meuQuadroBotao: "ARMAR MI CUADRO",
    // O bloco do vídeo sempre saiu em português também no espanhol. Fica
    // igual de propósito: mudar aqui é mudar o e-mail que já está no ar.
    videoTitulo: "O seu vídeo já está pago",
    videoTexto:
      "Ele é feito das fotos de vocês. Suba as fotos na página, dê o play pra conferir e toque em \"Gerar meu vídeo\".",
    videoBotao: "SUBIR AS FOTOS E GERAR",
    // O precio va en real porque el cobro va en real (Perfect Pay), igual que
    // en el panel. Ver el comentario de `outraMusica` en pt.
    outraMusica: "¿Hay alguien más que merece una? La segunda sale por R$ 28, y no rehacés nada: contás la historia y la canción queda lista.",
    outraMusicaLink: "quiero una canción más",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
  },
  en: {
    assunto: (n) => `${n}'s song is ready`,
    titulo: (n) => `<em style="color:#7d2b3a;">${n}</em>'s song is ready.`,
    faltaSo: "Just one thing left:", montar: "set up the gift",
    coloque:
      "Add a photo and write a few words of your own. That's what turns the page into something only the two of you understand. <strong style=\"color:#2a1518;\">This is also where you download the song as an MP3.</strong>",
    botao: "SET UP THE GIFT AND GET THE MP3 →",
    guarde:
      "This is YOUR link, so hold on to it. It's where you edit the page and download the song, anytime you like.",
    duasVersoes:
      "There are TWO recordings of the same lyrics. Listen to both at the link above and pick the one that will play for them.",
    // Sem WhatsApp: nos EUA o canal é só e-mail.
    semAnexo:
      "The song isn't attached to this email: it lives at these links, and they're yours forever.",
    comPressa:
      "And this is the link <strong style=\"color:#2a1518;\">you send to them</strong>, by text message or however you like. The gift already works just as it is, even without a photo:",
    verPresente: "OPEN THE PAGE I'LL SEND",
    // O socorro em inglês é por e-mail, não por WhatsApp.
    ajuda: "Couldn't open your song? Just reply to this email or write to us.",
    ajudaBotao: MARCA_ATIVA.emailContato,
    // Sem oferta de quadro: ele é impresso e pago por PIX, só existe no Brasil.
    quadroTitulo: "",
    quadroTexto: "",
    quadroBotao: "",
    meuQuadroTitulo: "Your print is waiting for you to set it up",
    meuQuadroTexto:
      "You've already paid for it. It's the lyrics and your photo on a letter-size page, with a QR code that plays the song. Pick the photo, we'll make the PDF, and you send it to print.",
    meuQuadroBotao: "SET UP MY PRINT",
    videoTitulo: "Your video is already paid for",
    videoTexto:
      "It's made from your photos. Upload the photos to the page, press play to check it, and tap \"Create my video\".",
    videoBotao: "UPLOAD THE PHOTOS AND CREATE",
    // Sem a segunda música a R$ 28: é produto do Brasil, cobrado por PIX.
    outraMusica: "",
    outraMusicaLink: "",
    rodape: `${MARCA_ATIVA.nome} · a song made from the story of someone you love`,
  },
};

/** O assunto, no idioma da venda. */
export function assuntoPresentePronto(nome: string, locale: IdiomaEmail = "pt") {
  return (COPY[locale] ?? COPY.pt).assunto(nome);
}

export function emailPresentePronto(args: {
  nome: string;
  titulo: string;
  linkEditor: string;
  linkPresente: string;
  /**
   * Ela tem um quadro PAGO e ainda não montado?
   *
   * Troca a oferta pela entrega. Sem isto, quem acabou de pagar R$ 24,90 pelo
   * quadro recebia um anúncio do quadro que já era dela — e nenhuma frase
   * dizendo que ela tinha um. Era a explicação mais provável dos 79% que
   * nunca montaram (19 de 24 com mais de 3 dias, medido em 31/08).
   */
  temQuadroPraMontar?: boolean;
  /** O vídeo veio no checkout (bump) e espera as fotos pra ser gerado. */
  temVideoPraGerar?: boolean;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { nome, titulo, linkEditor, linkPresente } = args;
  const jaTemQuadro = args.temQuadroPraMontar === true;
  const ingles = args.locale === "en";
  // Devolve null quando o número não está configurado, e aí o bloco de ajuda
  // não é renderizado: melhor sem canal do que com um link que não abre.
  // Em inglês não existe WhatsApp: o socorro vira o e-mail de contato.
  const linkAjuda = ingles
    ? `mailto:${MARCA_ATIVA.emailContato}`
    : linkSuporte({
        locale: args.locale === "es" ? "es" : "pt",
        titulo,
      });
  // Os comentários do modelo são pra quem MANTÉM, não pra quem recebe: saem
  // do HTML enviado. O Yahoo já exibiu um deles pra uma cliente (ver
  // `emails-comentarios.test.ts`), e na Ballad eles citavam a Serenata e o
  // PIX no código-fonte do e-mail. Visualmente o e-mail é o mesmo.
  return semComentarios(`<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : ingles ? "en" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(nome)}</title></head>
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
               Era uma imagem com o alt estilizado como plano B. O plano B virou
               o CASO COMUM: Gmail e Apple Mail bloqueiam imagem remota por
               padrao e desenham um ICONE DE QUEBRADO ao lado do alt. O dono
               abriu o proprio e-mail em 17/08 e viu exatamente isso, com o
               arquivo servindo HTTP 200 o tempo todo.
               A marca e uma palavra numa serifa com espacejamento. Texto
               renderiza igual em todo cliente, nunca bloqueia, nunca quebra,
               e nao pesa 50 KB. -->
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">${MARCA_ATIVA.nome.toUpperCase()}</div>
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

        <tr><td style="padding:6px 36px 4px;text-align:center;color:rgba(42,21,24,0.45);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
          ${C.guarde}
        </td></tr>

        <!-- AS DUAS GRAVACOES, colado no botao que leva ate elas. A oferta
             promete duas versoes, o seletor mora no editor, e quem nao abre o
             editor nunca descobre. -->
        <tr><td style="padding:0 36px 26px;text-align:center;">
          <p style="margin:0;display:inline-block;padding:9px 14px;border-radius:8px;background:rgba(125,43,58,0.06);color:#7d2b3a;font-size:12px;line-height:1.55;font-family:Helvetica,Arial,sans-serif;">
            ${C.duasVersoes}
          </p>
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
                   token faltando 1 caractere: 404
                   token com um ponto colado no fim: 404
               (Sem sinal de maior e sem traço duplo aqui dentro: o Yahoo
               fechava este comentário no meio e mostrava o resto como texto
               pro cliente, de 10/08 a 26/09.)
               Como botão, o destino vive só no href e nunca é lido, cortado
               ou reescrito por quem renderiza o e-mail. -->
          <a href="${linkPresente}" style="display:inline-block;margin-top:8px;padding:10px 20px;border-radius:999px;border:1px solid rgba(125,43,58,0.35);color:#7d2b3a;text-decoration:none;font-weight:600;">${C.verPresente}</a>
          <p style="margin:16px 0 0;color:rgba(42,21,24,0.5);font-size:12px;line-height:1.55;">
            ${C.semAnexo}
          </p>
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
        // O VÍDEO COMPRADO JUNTO (order bump): já é dela, e só falta subir as
        // fotos. Mesma lógica do quadro abaixo: entrega, não oferta, botão cheio.
        args.temVideoPraGerar
          ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid rgba(42,21,24,0.10);">
        <tr><td style="padding-top:22px;" align="center">
          <p style="margin:0;font-size:17px;color:#2a1518;font-family:Georgia,'Times New Roman',serif;">
            ${C.videoTitulo}
          </p>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:rgba(42,21,24,0.7);font-family:Helvetica,Arial,sans-serif;">
            ${C.videoTexto}
          </p>
          <a href="${linkEditor}?de=video_entrega#video" style="display:inline-block;margin-top:14px;padding:13px 24px;border-radius:999px;background:#7d2b3a;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;font-family:Helvetica,Arial,sans-serif;">${C.videoBotao}</a>
        </td></tr>
      </table>`
          : ""
      }
      ${
        jaTemQuadro
          ? // JÁ É DELA: entrega, não oferta. Botão CHEIO e não contornado,
            // porque isto não está pedindo dinheiro, está devolvendo o que
            // ela já pagou. E o link é o EDITOR pelo token, não o painel: 84%
            // dos compradores nunca entram na conta, e mandar pro login quem
            // já pagou é onde os R$ 473 pararam.
            `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid rgba(42,21,24,0.10);">
        <tr><td style="padding-top:22px;" align="center">
          <img src="${SITE}/img/quadro-exemplo.jpg" width="120" alt="" style="display:block;border:6px solid #2c211a;border-radius:2px;background:#f6f2ea;padding:6px;">
          <p style="margin:14px 0 0;font-size:17px;color:#2a1518;font-family:Georgia,'Times New Roman',serif;">
            ${C.meuQuadroTitulo}
          </p>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:rgba(42,21,24,0.7);font-family:Helvetica,Arial,sans-serif;">
            ${C.meuQuadroTexto}
          </p>
          <a href="${linkEditor}?de=quadro" style="display:inline-block;margin-top:14px;padding:13px 24px;border-radius:999px;background:#7d2b3a;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;font-family:Helvetica,Arial,sans-serif;">${C.meuQuadroBotao}</a>
        </td></tr>
      </table>`
          : C.quadroTitulo
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

      <!-- MAIS UMA MÚSICA, e de propósito é só UMA LINHA de texto.
           Ela vem depois do quadro e antes do socorro, com peso de rodapé:
           quem lê este e-mail ainda não ouviu a música que comprou, e uma
           oferta com peso aqui competiria com a ação da mensagem, que é
           montar o presente.

           ATENÇÃO ao editar este comentário: ele mora DENTRO do template
           literal do e-mail, então crase aqui fecha a string e o arquivo
           inteiro para de compilar. Nomes de rota vão sem crase.

           O link é o EDITOR pelo token, com âncora, e não o /dashboard.
           Este é o mesmo erro que enterrou o pacote: ele só aparecia na conta,
           e 84% dos compradores nunca entram nela. Pelo token a pessoa cai no
           bloco com o PIX aberto, sem login nenhum. -->
      ${
        // Em inglês a linha não existe: o pacote é produto do Brasil, por PIX.
        C.outraMusica ? `<p style="margin:22px 0 0;color:rgba(42,21,24,0.6);font-size:13px;line-height:1.5;font-family:Helvetica,Arial,sans-serif;">
        ${C.outraMusica}
        <a href="${linkEditor}#outra-musica" style="color:#7d2b3a;font-weight:600;text-decoration:underline;white-space:nowrap;">${C.outraMusicaLink}</a>
      </p>` : ""}

      <!-- O SOCORRO, no e-mail e não só no site.
           Medido em 18/08: 248 dos 294 compradores nunca entraram na conta.
           Quem não consegue abrir o presente não vai procurar uma página de
           ajuda; ela está olhando pra ESTE e-mail, e é aqui que o canal
           precisa estar. Sem isso, quem digitou o e-mail errado ou não achou
           o link simplesmente some, e a gente só descobre pelo ticket. -->
      ${linkAjuda ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid rgba(42,21,24,0.08);color:rgba(42,21,24,0.65);font-size:13px;line-height:1.5;font-family:Helvetica,Arial,sans-serif;">
        ${C.ajuda}<br>
        <a href="${linkAjuda}" style="display:inline-block;margin-top:8px;color:#7d2b3a;font-weight:600;text-decoration:underline;">${C.ajudaBotao}</a>
      </p>` : ""}

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        ${C.rodape}
      </p>
    </td></tr>
  </table>
</body></html>`);
}
