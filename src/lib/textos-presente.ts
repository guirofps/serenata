import type { Locale } from "@/lib/i18n";

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
  // ── painel do comprador ────────────────────────────────────
  ola: (n: string) => `Olá, ${n}`,
  suasMusicas: "Suas músicas",
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
  ola: (n: string) => `Hola, ${n}`,
  suasMusicas: "Tus canciones",
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

const POR_IDIOMA: Record<Locale, TextosPresente> = { pt: PT, es: ES };

export function tp(locale: Locale): TextosPresente {
  return POR_IDIOMA[locale] ?? PT;
}
