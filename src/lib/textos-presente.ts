import type { Locale } from "@/lib/i18n";
import { ehArgentina, ehEua } from "@/lib/mercado-es";

// Textos da PÁGINA-PRESENTE e do EDITOR.
//
// Separados de `textos.ts` (que é do quiz) porque a fonte do idioma é outra:
// aqui ele vem da COLUNA `locale` do registro, não da rota. A página presente
// é aberta pelo presenteado, que nunca passou pelo nosso funil e não tem
// prefixo `/es` nenhum no link que recebeu no WhatsApp.

const PT = {
  umaMusicaPara: "uma música para",
  umPresente: "Um presente",
  descricao: (n?: string) =>
    n ? `Uma música feita só para ${n}.` : "Uma música feita só para você.",
  ogTitulo: (n?: string) => (n ? `Uma música para ${n}` : "Um presente"),
  soVoceVe: "só você vê isto",
  // Estes dois estavam escritos direto na rota e saíam em português na
  // página presente espanhola — a única tela que o PRESENTEADO vê.
  toqueParaOuvir: "toque para ouvir",
  feitoCom: "feito com",
  // O convite pra quem RECEBE (depois do play, nunca pro dono).
  conviteTitulo: "Alguém que você ama merece uma dessas?",
  conviteSub: "Conta a história de vocês e a letra sai na hora, de graça.",
  conviteBotao: "Criar uma música",
  ariaTocar: "Tocar",
  ariaPausar: "Pausar",
  // ── editor: sobras que estavam escritas direto no JSX ──────
  versaoN: (n: number) => `Versão ${n}`,
  seloNova: "nova versão",
  removerFotoConfirma: "Tirar esta foto do presente?",
  anterioresTitulo: "Versões anteriores",
  anterioresTexto: "As gravações de antes do seu ajuste. Ficam guardadas: se você preferir uma delas, é só falar com a gente.",
  anterioresVer: "Ouvir as versões anteriores",
  anterioresPedido: "Você pediu:",
  eEssa: "é essa",
  escolherEsta: "escolher esta",
  ouvir: "Ouvir",
  pausar: "Pausar",
  baixarQr: "baixar o QR Code",
  qrAlt: (n: string) => `QR Code do presente de ${n}`,
  verComoVaiVer: "Ver como ela vai ver",
  previa: "prévia",
  dedicatoriaPlaceholder: (n: string) => `Pra você, ${n}. Com todo o meu amor.`,
  baixarMusica: "Baixar a música",
  guardarOuEnviar: "Guardar ou enviar",
  comoBaixa: "como baixa a música?",
  ajudaCelular:
    "O MP3 vai pros seus downloads. Pra mandar direto no WhatsApp, use o botão de enviar.",
  ajudaDesktop: "O MP3 vai pra pasta de downloads do seu computador.",
  baixarOuEnviar: "Baixar ou enviar a música",
  enviarMusica: "Enviar pelo WhatsApp",
  preparandoAudio: "preparando o áudio…",
  pronto: "pronto",
  posicaoMusica: "Posição da música",
  // ── editor ─────────────────────────────────────────────────
  suaConta: "sua conta",
  suaMusicaPronta: "sua música está pronta",
  agoraMonte: (n: string) => `Agora monte o presente de ${n}`,
  umaFotoUmaFrase:
    "Uma foto e uma frase sua. É o que transforma a página em algo que só vocês dois entendem.",
  qualGravacao: "Qual gravação você prefere?",
  fizemosDuas:
    "Fizemos duas. Ouça as duas e escolha a que emociona mais. É a que vai abrir quando ela receber.",
  escolhida: "escolhida",
  aCorDaPagina: "A cor da página",
  aCorTexto: "É a cor do play, da letra que acende e da barra. Veja na prévia ao lado.",
  umEfeito: "Um efeito na tela",
  umEfeitoTexto: "Passa sobre a foto enquanto a música toca. Sutil, pra emocionar sem poluir.",
  aFotoDaCapa: "A foto da capa",
  aFotoTexto: "Ela aparece atrás do nome. Fotos de rosto funcionam melhor.",
  trocarFoto: "Trocar a foto", escolherFoto: "Escolher uma foto", remover: "Remover",
  asFotosQuePassam: "As fotos que passam com a música",
  asFotosTexto: (max: number) =>
    `Elas ficam atrás da letra e trocam nas viradas da canção. A foto muda bem quando o refrão entra. Até ${max}.`,
  adicionarMais: "Adicionar mais fotos", escolherFotos: "Escolher as fotos",
  umaFraseSua: "Uma frase sua",
  umaFraseTexto: "Aparece embaixo do play. É a única coisa da página escrita por você.",
  agoraEntregar: "Agora é só entregar",
  copieEMande: "Copie e mande no WhatsApp. Quem entrega o presente é você.",
  mensagemPronta: (link: string) =>
    `Fiz uma música pra você. É sua, só sua, a letra é sobre a gente.

${link}`,
  copiado: "Copiado!", copiarMensagem: "Copiar mensagem",
  prefereMao: "Prefere entregar na mão?",
  qrTexto:
    "Imprima este código e cole num cartão, numa caixa de bombom ou no embrulho. Ela aponta a câmera e a música abre.",
  erroFoto: "Não consegui salvar a foto.",
  erroUsarFoto: "Não consegui usar essa foto.",
  erroFotos: "Não consegui usar essas fotos.",
  erroSalvarFotos: "Não consegui salvar as fotos.",
  erroRemoverFoto: "Não consegui tirar a foto agora. Tente de novo.",
  erroFrase: "Não consegui salvar a frase.",
  erroCopiar: "Não consegui copiar. Selecione o texto e copie na mão.",
  galeriaCheia: (n: number) => `A galeria já está cheia (${n} fotos).`,
  linkNaoExiste: "Esse link de edição não existe.",
  confiraLink: "Confira o link que você recebeu por e-mail.",
  // ── painel do comprador ────────────────────────────────────
  ola: (n: string) => `Olá, ${n}`,
  suasMusicas: "Suas músicas",
  credito: "crédito",
  creditos: "créditos",
  abaMusicas: "Minhas músicas",
  // "Nova música" não cabia com a aba do vídeo em 360px (medido em 25/09).
  abaCriar: "Criar",
  abaQuadro: "Quadro",
  abaVideo: "Vídeo",
  seloDesconto: "-26%",
  seloQuadro: "novo",
  chamadaQuadroTitulo: "O quadro pra pendurar na parede",
  chamadaQuadroSub: "A letra da música e a foto de vocês, no papel",
  confirmandoPix: "Confirmando seu pagamento. Isso leva menos de um minuto.",
  criarComCredito: (n: number) =>
    n === 1 ? "Criar nova música (1 crédito)" : `Criar nova música (${n} créditos)`,
  criarSemCredito: "Criar nova música",
  quadroPronto1: "Você tem 1 quadro pra montar",
  quadroPronto: (n: number) => `Você tem ${n} quadros pra montar`,
  quadroProntoSub: "Escolha a música e salve o PDF pra imprimir",
  painelSub: "Aqui ficam as músicas que você criou. Toque em uma pra montar o presente ou ver a página.",
  carregando: "carregando…",
  semMusicas: "Você ainda não tem nenhuma música.",
  criarPrimeira: "Criar minha primeira música",
  suaMusica: "Sua música",
  presenteMontado: " · presente montado",
  criadaEm: "criada em",
  verPagina: "Ver página",
  montarBotao: "Montar o presente",
  sair: "Sair",
  status: { pronta: "pronta", gerando: "gerando…", aguardando: "na fila", falhou: "falhou" } as Record<string, string>,
  // Ajuste em curso (08/10): o editor avisa e espera; o link continua tocando
  // a versão anterior em vez de virar "link incompleto".
  regravandoTitulo: "Sua nova versão está sendo gravada",
  regravandoTexto:
    "Leva 1 ou 2 minutos e esta tela se atualiza sozinha. Enquanto isso, o link do presente continua tocando a versão anterior.",
  atualizandoDono: "Sua nova versão está sendo gravada. Até ela ficar pronta, a página toca a versão anterior.",

};

type TextosPresente = typeof PT;

const ES: TextosPresente = {
  umaMusicaPara: "una canción para",
  umPresente: "Un regalo",
  descricao: (n?: string) =>
    n ? `Una canción hecha solo para ${n}.` : "Una canción hecha solo para ti.",
  ogTitulo: (n?: string) => (n ? `Una canción para ${n}` : "Un regalo"),
  soVoceVe: "solo tú ves esto",
  toqueParaOuvir: "toca para escuchar",
  feitoCom: "hecho con",
  conviteTitulo: "¿Alguien que amas merece una así?",
  conviteSub: "Cuenta la historia de ustedes y la letra sale al instante, gratis.",
  conviteBotao: "Crear una canción",
  ariaTocar: "Reproducir",
  ariaPausar: "Pausar",
  versaoN: (n: number) => `Versión ${n}`,
  seloNova: "nueva versión",
  removerFotoConfirma: "¿Quitar esta foto del regalo?",
  anterioresTitulo: "Versiones anteriores",
  anterioresTexto: "Las grabaciones de antes de tu ajuste. Quedan guardadas: si prefieres alguna, solo avísanos.",
  anterioresVer: "Escuchar las versiones anteriores",
  anterioresPedido: "Pediste:",
  eEssa: "es esta",
  escolherEsta: "elegir esta",
  ouvir: "Escuchar",
  pausar: "Pausar",
  baixarQr: "descargar el código QR",
  qrAlt: (n: string) => `Código QR del regalo de ${n}`,
  verComoVaiVer: "Ver como lo va a ver",
  previa: "vista previa",
  dedicatoriaPlaceholder: (n: string) => `Para ti, ${n}. Con todo mi cariño.`,
  baixarMusica: "Descargar la canción",
  guardarOuEnviar: "Guardar o enviar",
  comoBaixa: "¿cómo se descarga?",
  ajudaCelular:
    "El MP3 va a tus descargas. Para mandarla directo por WhatsApp, usá el botón de enviar.",
  ajudaDesktop: "El MP3 va a la carpeta de descargas de tu computadora.",
  baixarOuEnviar: "Descargar o enviar la canción",
  enviarMusica: "Enviar por WhatsApp",
  preparandoAudio: "preparando el audio…",
  pronto: "listo",
  posicaoMusica: "Posición de la canción",
  suaConta: "tu cuenta",
  suaMusicaPronta: "tu canción ya está lista",
  agoraMonte: (n: string) => `Ahora arma el regalo de ${n}`,
  umaFotoUmaFrase:
    "Una foto y una frase tuya. Es lo que convierte la página en algo que solo ustedes dos entienden.",
  qualGravacao: "¿Cuál grabación prefieres?",
  fizemosDuas:
    "Hicimos dos. Escucha las dos y elige la que más emocione. Es la que se va a abrir cuando la reciba.",
  escolhida: "elegida",
  aCorDaPagina: "El color de la página",
  aCorTexto: "Es el color del play, de la letra que se enciende y de la barra. Míralo en la vista previa.",
  umEfeito: "Un efecto en pantalla",
  umEfeitoTexto: "Pasa sobre la foto mientras suena la canción. Sutil, para emocionar sin estorbar.",
  aFotoDaCapa: "La foto de portada",
  aFotoTexto: "Aparece detrás del nombre. Las fotos de rostro funcionan mejor.",
  trocarFoto: "Cambiar la foto", escolherFoto: "Elegir una foto", remover: "Quitar",
  asFotosQuePassam: "Las fotos que pasan con la canción",
  asFotosTexto: (max: number) =>
    `Quedan detrás de la letra y cambian en los quiebres de la canción. La foto cambia bonito cuando entra el coro. Hasta ${max}.`,
  adicionarMais: "Agregar más fotos", escolherFotos: "Elegir las fotos",
  umaFraseSua: "Una frase tuya",
  umaFraseTexto: "Aparece debajo del play. Es lo único de la página escrito por ti.",
  agoraEntregar: "Ahora solo falta entregarlo",
  copieEMande: "Copia y manda por WhatsApp. Quien entrega el regalo eres tú.",
  mensagemPronta: (link: string) =>
    `Te hice una canción. Es tuya, solo tuya, y la letra es sobre nosotros.

${link}`,
  copiado: "¡Copiado!", copiarMensagem: "Copiar mensaje",
  prefereMao: "¿Prefieres entregarlo en mano?",
  qrTexto:
    "Imprime este código y pégalo en una tarjeta, en una caja de chocolates o en la envoltura. Apunta la cámara y la canción se abre.",
  erroFoto: "No pude guardar la foto.",
  erroUsarFoto: "No pude usar esa foto.",
  erroFotos: "No pude usar esas fotos.",
  erroSalvarFotos: "No pude guardar las fotos.",
  erroRemoverFoto: "No pude quitar la foto ahora. Inténtalo de nuevo.",
  erroFrase: "No pude guardar la frase.",
  erroCopiar: "No pude copiar. Selecciona el texto y cópialo a mano.",
  galeriaCheia: (n: number) => `La galería ya está llena (${n} fotos).`,
  linkNaoExiste: "Este link de edición no existe.",
  confiraLink: "Revisa el link que recibiste por correo.",
  ola: (n: string) => `Hola, ${n}`,
  suasMusicas: "Tus canciones",
  credito: "crédito",
  creditos: "créditos",
  abaMusicas: "Mis canciones",
  abaCriar: "Crear",
  abaQuadro: "Cuadro",
  abaVideo: "Video",
  seloDesconto: "-26%",
  seloQuadro: "nuevo",
  chamadaQuadroTitulo: "El cuadro para colgar en la pared",
  chamadaQuadroSub: "La letra de la canción y su foto, en papel",
  confirmandoPix: "Confirmando tu pago. Esto toma menos de un minuto.",
  criarComCredito: (n: number) =>
    n === 1 ? "Crear canción nueva (1 crédito)" : `Crear canción nueva (${n} créditos)`,
  criarSemCredito: "Crear canción nueva",
  quadroPronto1: "Tienes 1 cuadro para armar",
  quadroPronto: (n: number) => `Tienes ${n} cuadros para armar`,
  quadroProntoSub: "Elige la canción y guarda el PDF para imprimir",
  painelSub: "Aquí están las canciones que creaste. Toca una para armar el regalo o ver la página.",
  carregando: "cargando…",
  semMusicas: "Todavía no tienes ninguna canción.",
  criarPrimeira: "Crear mi primera canción",
  suaMusica: "Tu canción",
  presenteMontado: " · regalo armado",
  criadaEm: "creada el",
  verPagina: "Ver página",
  montarBotao: "Armar el regalo",
  sair: "Salir",
  status: { pronta: "lista", gerando: "grabando…", aguardando: "en la fila", falhou: "falló" } as Record<string, string>,
  regravandoTitulo: "Tu nueva versión se está grabando",
  regravandoTexto:
    "Tarda 1 o 2 minutos y esta pantalla se actualiza sola. Mientras tanto, el link del regalo sigue tocando la versión anterior.",
  atualizandoDono: "Tu nueva versión se está grabando. Hasta que esté lista, la página toca la versión anterior.",

};

// A PÁGINA PRESENTE EM RIOPLATENSE. Mesmo desenho de `textos.ts` e
// `quiz-flow-ar.ts`: sobreposição do que diverge, nada de dicionário paralelo.
//
// Aqui a aposta é maior do que no quiz. Esta é a tela que o PRESENTEADO abre,
// e que ele manda pra outras pessoas — é o único ativo do funil que circula
// sozinho. Um "solo tú ves esto" numa tela que uma argentina mostra pra irmã
// é a diferença entre "isto é um presente" e "isto é um site estrangeiro".
//
// Possessivo (`tu ajuste`, `una frase tuya`) NÃO muda: é igual nos dois
// espanhóis. Ver a nota longa em `textos.ts`.
const AR: Partial<TextosPresente> = {
  descricao: (n?: string) =>
    n ? `Una canción hecha solo para ${n}.` : "Una canción hecha solo para vos.",
  soVoceVe: "solo vos ves esto",
  anterioresTexto:
    "Las grabaciones de antes de tu ajuste. Quedan guardadas: si preferís alguna, avisanos nomás.",
  ajudaCelular:
    "El MP3 va a tus descargas. Para mandarla directo por WhatsApp, usá el botón de enviar.",
  ajudaDesktop: "El MP3 va a la carpeta de descargas de tu compu.",
  enviarMusica: "Enviar por WhatsApp",
  qualGravacao: "¿Cuál grabación preferís?",
  fizemosDuas:
    "Hicimos dos. Escuchá las dos y elegí la que más te emocione. Es la que se va a abrir cuando la reciba.",
  umaFraseTexto: "Aparece debajo del play. Es lo único de la página escrito por vos.",
  copieEMande: "Copiá y mandá por WhatsApp. El que entrega el regalo sos vos.",
  quadroProntoSub: "Elegí la canción y guardá el PDF para imprimir",
  semMusicas: "Todavía no tenés ninguna canción.",
};

// INGLÊS, pra Ballad Gift (EUA), a partir do português. Nada de WhatsApp: o
// link vai por mensagem de texto, e "enviar" é o menu de compartilhar do
// celular. A caixa de bombom do QR vira o cartão e o embrulho, que é o que
// o americano tem na mão num presente.
const EN: TextosPresente = {
  umaMusicaPara: "a song for",
  umPresente: "A gift",
  descricao: (n?: string) =>
    n ? `A song made just for ${n}.` : "A song made just for you.",
  ogTitulo: (n?: string) => (n ? `A song for ${n}` : "A gift"),
  soVoceVe: "only you can see this",
  toqueParaOuvir: "tap to listen",
  feitoCom: "made with",
  conviteTitulo: "Someone you love deserves one of these?",
  conviteSub: "Tell your story and the lyrics are ready in seconds, free.",
  conviteBotao: "Create a song",
  ariaTocar: "Play",
  ariaPausar: "Pause",
  versaoN: (n: number) => `Version ${n}`,
  seloNova: "new version",
  removerFotoConfirma: "Remove this photo from the gift?",
  anterioresTitulo: "Earlier versions",
  anterioresTexto: "The recordings from before your change. They're saved: if you prefer one of them, just let us know.",
  anterioresVer: "Listen to earlier versions",
  anterioresPedido: "You asked for:",
  eEssa: "this one",
  escolherEsta: "choose this one",
  ouvir: "Play",
  pausar: "Pause",
  baixarQr: "download the QR code",
  qrAlt: (n: string) => `QR code for ${n}'s gift`,
  verComoVaiVer: "See it the way they will",
  previa: "preview",
  dedicatoriaPlaceholder: (n: string) => `For you, ${n}. With all my love.`,
  baixarMusica: "Download the song",
  guardarOuEnviar: "Keep it or send it",
  comoBaixa: "how do I download it?",
  ajudaCelular:
    "The MP3 goes to your downloads. To send it straight to someone, use the share button.",
  ajudaDesktop: "The MP3 goes to your computer's downloads folder.",
  baixarOuEnviar: "Download or send the song",
  enviarMusica: "Share the song",
  preparandoAudio: "preparing the audio…",
  pronto: "ready",
  posicaoMusica: "Song position",
  suaConta: "your account",
  suaMusicaPronta: "your song is ready",
  agoraMonte: (n: string) => `Now put together ${n}'s gift`,
  umaFotoUmaFrase:
    "One photo and one line from you. That's what turns the page into something only the two of you understand.",
  qualGravacao: "Which recording do you like best?",
  fizemosDuas:
    "We made two. Listen to both and pick the one that moves you most. It's the one that plays when they open it.",
  escolhida: "chosen",
  aCorDaPagina: "Page color",
  aCorTexto: "It's the color of the play button, the lyrics that light up and the progress bar. See it in the preview.",
  umEfeito: "A touch on screen",
  umEfeitoTexto: "It drifts over the photo while the song plays. Subtle, to move them without the clutter.",
  aFotoDaCapa: "Cover photo",
  aFotoTexto: "It sits behind the name. Photos of faces work best.",
  trocarFoto: "Change photo", escolherFoto: "Choose a photo", remover: "Remove",
  asFotosQuePassam: "Photos that play with the song",
  asFotosTexto: (max: number) =>
    `They sit behind the lyrics and change as the song turns. The photo switches right as the chorus comes in. Up to ${max}.`,
  adicionarMais: "Add more photos", escolherFotos: "Choose photos",
  umaFraseSua: "A line from you",
  umaFraseTexto: "It shows up under the play button. It's the only thing on the page written by you.",
  agoraEntregar: "Now all that's left is to give it",
  copieEMande: "Copy it and text it to them. You're the one giving the gift.",
  mensagemPronta: (link: string) =>
    `I made you a song. It's yours, only yours, and it's about us.

${link}`,
  copiado: "Copied!", copiarMensagem: "Copy message",
  prefereMao: "Rather give it in person?",
  qrTexto:
    "Print this code and put it on a card, a gift box or the wrapping. They point their camera at it and the song opens.",
  erroFoto: "Couldn't save the photo.",
  erroUsarFoto: "Couldn't use that photo.",
  erroFotos: "Couldn't use those photos.",
  erroSalvarFotos: "Couldn't save the photos.",
  erroRemoverFoto: "Couldn't remove the photo right now. Try again.",
  erroFrase: "Couldn't save your line.",
  erroCopiar: "Couldn't copy. Select the text and copy it manually.",
  galeriaCheia: (n: number) => `The gallery is already full (${n} photos).`,
  linkNaoExiste: "This edit link doesn't exist.",
  confiraLink: "Check the link you got by email.",
  ola: (n: string) => `Hi, ${n}`,
  suasMusicas: "Your songs",
  credito: "credit",
  creditos: "credits",
  abaMusicas: "My songs",
  abaCriar: "Create",
  abaQuadro: "Print",
  abaVideo: "Video",
  seloDesconto: "-26%",
  seloQuadro: "new",
  chamadaQuadroTitulo: "A print to hang on the wall",
  chamadaQuadroSub: "Your song's lyrics and your photo, on paper",
  confirmandoPix: "Confirming your payment. This takes less than a minute.",
  criarComCredito: (n: number) =>
    n === 1 ? "Create a new song (1 credit)" : `Create a new song (${n} credits)`,
  criarSemCredito: "Create a new song",
  quadroPronto1: "You have 1 print to design",
  quadroPronto: (n: number) => `You have ${n} prints to design`,
  quadroProntoSub: "Pick the song and save the PDF to print",
  painelSub: "Your songs live here. Tap one to put the gift together or see its page.",
  carregando: "loading…",
  semMusicas: "You don't have any songs yet.",
  criarPrimeira: "Create my first song",
  suaMusica: "Your song",
  presenteMontado: " · gift ready",
  criadaEm: "created on",
  verPagina: "View page",
  montarBotao: "Put the gift together",
  sair: "Sign out",
  status: { pronta: "ready", gerando: "creating…", aguardando: "in line", falhou: "failed" } as Record<string, string>,
  regravandoTitulo: "Your new version is being recorded",
  regravandoTexto:
    "It takes 1 or 2 minutes and this screen updates by itself. Meanwhile, the gift link keeps playing the previous version.",
  atualizandoDono: "Your new version is being recorded. Until it's ready, this page plays the previous one.",
};

// O ESPANHOL DA BALLAD (hispanos dos EUA). A base `ES` já é `tú`; o que muda é
// o que depende do PAÍS, como no inglês da Ballad: nada de WhatsApp (o link vai
// por mensagem de texto e "enviar" é o menu de compartilhar do celular). O
// `ajudaCelular` da base também trazia um "usá" que escapou do voseo.
const EUA: Partial<TextosPresente> = {
  ajudaCelular:
    "El MP3 va a tus descargas. Para mandarla directo a alguien, usa el botón de compartir.",
  enviarMusica: "Compartir la canción",
  copieEMande: "Cópialo y mándaselo por mensaje. Quien entrega el regalo eres tú.",
};

const POR_IDIOMA: Record<Locale, TextosPresente> = { pt: PT, es: ES, en: EN };

export function tp(locale: Locale): TextosPresente {
  if (locale === "es" && ehEua()) return { ...ES, ...EUA };
  if (locale === "es" && ehArgentina()) return { ...ES, ...AR };
  return POR_IDIOMA[locale] ?? PT;
}
