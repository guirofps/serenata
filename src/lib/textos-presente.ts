import type { Locale } from "@/lib/i18n";
import { ehArgentina } from "@/lib/mercado-es";

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
    "No celular abre as opções do aparelho: escolha “Salvar em Arquivos” pra guardar, ou o WhatsApp pra mandar direto.",
  ajudaDesktop: "Baixa o MP3 no seu computador.",
  baixarOuEnviar: "Baixar ou enviar a música",
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
  abaCriar: "Nova música",
  abaQuadro: "Quadro",
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
    "En el celular abre las opciones del teléfono: elige “Guardar en Archivos” para guardarla, o WhatsApp para mandarla directo.",
  ajudaDesktop: "Descarga el MP3 en tu computadora.",
  baixarOuEnviar: "Descargar o enviar la canción",
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
  abaCriar: "Nueva canción",
  abaQuadro: "Cuadro",
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
    "En el celu abrí las opciones del teléfono: elegí “Guardar en Archivos” para guardarla, o WhatsApp para mandarla directo.",
  ajudaDesktop: "Descargá el MP3 en tu compu.",
  qualGravacao: "¿Cuál grabación preferís?",
  fizemosDuas:
    "Hicimos dos. Escuchá las dos y elegí la que más te emocione. Es la que se va a abrir cuando la reciba.",
  umaFraseTexto: "Aparece debajo del play. Es lo único de la página escrito por vos.",
  copieEMande: "Copiá y mandá por WhatsApp. El que entrega el regalo sos vos.",
  quadroProntoSub: "Elegí la canción y guardá el PDF para imprimir",
  semMusicas: "Todavía no tenés ninguna canción.",
};

const POR_IDIOMA: Record<Locale, TextosPresente> = { pt: PT, es: ES };

export function tp(locale: Locale): TextosPresente {
  if (locale === "es" && ehArgentina()) return { ...ES, ...AR };
  return POR_IDIOMA[locale] ?? PT;
}
