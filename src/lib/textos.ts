import type { Locale } from "@/lib/i18n";

// O DICIONÁRIO da interface.
//
// Só o que é "moldura": botão, aviso, rótulo, estado de carregamento. O
// CONTEÚDO do quiz (perguntas, chips, gatilhos) mora em `quiz-flow.ts` e
// `quiz-flow-es.ts`, porque lá não é tradução, é redação — a pergunta em
// espanhol tem exemplo mexicano, gatilho mexicano e mínimo próprio.
//
// Nada aqui pode mudar uma string do português: os valores `pt` são cópia
// literal do que já rodava. Se um `t(...)` mudar o texto brasileiro, é bug.

const PT = {
  // ── moldura do quiz ──────────────────────────────────────────
  continuar: "Continuar",
  verMinhaLetra: "Ver minha letra",
  voltar: "Voltar",
  tudoCerto: "Tudo certo?",
  ultimaConferida: "Última conferida antes de escrever a letra.",
  escreverLetra: "Escrever minha letra grátis",
  emailPlaceholder: "seu@email.com",
  oPresenteDe: "O presente de",
  quemVoceAma: "quem você ama",
  estaNascendo: "está começando a nascer.",
  reacoesLegenda: "Reações de quem ouviu uma música feita por nós.",

  // ── faixa do entregável ──────────────────────────────────────
  oQueVaiMontar: "o que você vai montar",
  musicaCantada: "música cantada",
  paginaComFotos: "página com fotos",
  karaoke: "karaokê",
  qrCode: "QR Code",

  // ── campo de história ────────────────────────────────────────
  semIdeia: "Sem ideia? Toque num pra começar a frase.",
  faltamChars: (n: number) => `Escreva um pouco mais, faltam ${n} caracteres`,
  duasLinhas: "Duas ou três linhas já bastam",
  perfeito: "Perfeito ✓",
  frasesDeVerdade: "Escreva com frases de verdade, pelo menos 3 palavras.",
  palavrasReais: "Use palavras reais, evite números e símbolos soltos.",
  naoRepita: "Evite repetir o mesmo caractere várias vezes seguidas.",
  preferoFalar: "Prefiro contar falando",
  pararGravar: "Parar de gravar",
  naoLembro: "Não lembro de nada agora, seguir sem isso",

  // ── campo de nome ────────────────────────────────────────────
  avisoComposto: (primeiro: string) =>
    `Nome e sobrenome vão ser cantados inteiros. Se você chama de ${primeiro}, fica melhor na música.`,
  usarSo: (primeiro: string) => `Usar só “${primeiro}”`,

  // ── coautoria ────────────────────────────────────────────────
  opcao: (n: number) => `Opção ${n}`,
  outraOpcao: "Ver outras opções",
  gerandoOutras: "Gerando outras…",
  suaLetraSeuJeito: "Sua letra, do seu jeito",
  qualRefrao: "Qual refrão fica melhor?",
  refraoSub: "É a parte que mais se canta. Escolha a que te tocar, dá pra ajustar tudo depois.",
  usarEsteRefrao: "Usar este refrão",
  linkEQrEnviar: "link + QR Code pra enviar",
  assimVaiReceber: "É assim que {n} vai receber",
  estaPronta: "Está pronta",
  preparandoSua: "Preparando sua música…",
  melhorarComIA: "melhorar com IA",
  falhouMelhorar: "Não consegui melhorar agora. A letra continua como está.",

  // ── espera e geração ─────────────────────────────────────────
  loadingLetra: [
    "Lendo a sua história…",
    "Procurando os detalhes que só vocês têm…",
    "Escrevendo dois caminhos pro refrão…",
  ],
  loadingRefrao: "Escrevendo a letra em volta do seu refrão…",
  loadingMusica: [
    "Encontrando o tom da sua história…",
    "Dando ritmo às palavras…",
    "Ajustando os últimos detalhes…",
  ],
  sendoCantada: "sendo cantada",
  gravandoVoz: "Gravando a voz…",
  quasePronta: "Quase pronta…",
  prontaBang: "Pronta!",
  ajustandoDetalhes: "ajustando os detalhes",
  completa: "completa",
  esperaOuvirOutras: "enquanto isso, ouça outras",
  levaDoisMinutos: "Leva cerca de 2 minutos. Pode ir ouvindo outras aqui embaixo enquanto a sua fica pronta.",
  isSoQueVaiEnviar: "é isso que você vai enviar",
  comoVaiChegar: "Você manda o link no WhatsApp. A pessoa toca, e a letra acende no ritmo da música, com as fotos de vocês.",
  prontaEmBreve: "Assim que a gravação ficar pronta, você ouve um trecho aqui.",
  demorouMais: "A gravação demorou mais que o esperado",
  avisamosPorEmail: "Assim que ficar pronta, avisamos no seu e-mail.",

  // ── prévia / karaokê ─────────────────────────────────────────
  ouviuPedacinho: "Você ouviu um pedacinho…",
  musicaContinua: "A música continua…",
  canteJunto: "Cante junto, é a sua música",
  ouvirAMusica: "Ouvir a música",
  umaMusicaPra: "uma música pra",
  linkEQr: "link + QR Code pra compartilhar",

  // ── erros ────────────────────────────────────────────────────
  naoConsegui: "Não consegui escrever agora. Tente de novo.",
  naoMontei: "Não consegui montar a letra. Tente de novo.",
  naoPreparei: "Não consegui preparar a música. Tente de novo.",
  tentarDeNovo: "Tentar de novo",
  faltouImportante: "Faltou a parte mais importante",
  precisoDaHistoria:
    "Preciso da história pra escrever uma letra que seja só dela. Vamos voltar e me contar?",
  contarAHistoria: "Contar a história",

  // ── rótulos da revisão ───────────────────────────────────────
  rotulos: {
    relacao: "Pra quem", nome: "Nome", ocasiao: "Ocasião", estilo: "Estilo",
    voz: "Voz", historia1: "Sobre ela(e)", historia2: "Uma memória",
    recado: "Sua frase", filhos: "Filhos citados",
  } as Record<string, string>,
};

type Textos = typeof PT;

const ES: Textos = {
  continuar: "Continuar",
  verMinhaLetra: "Ver mi letra",
  voltar: "Regresar",
  tudoCerto: "¿Todo bien?",
  ultimaConferida: "Una última revisada antes de escribir la letra.",
  escreverLetra: "Escribir mi letra gratis",
  emailPlaceholder: "tu@correo.com",
  oPresenteDe: "El regalo de",
  quemVoceAma: "quien tú quieres",
  estaNascendo: "ya está naciendo.",
  reacoesLegenda: "Reacciones de quien escuchó una canción hecha por nosotros.",

  oQueVaiMontar: "lo que vas a armar",
  musicaCantada: "canción cantada",
  paginaComFotos: "página con fotos",
  karaoke: "karaoke",
  qrCode: "código QR",

  semIdeia: "¿Sin ideas? Toca una para empezar la frase.",
  faltamChars: (n: number) => `Escribe un poco más, faltan ${n} caracteres`,
  duasLinhas: "Con dos o tres líneas basta",
  perfeito: "Perfecto ✓",
  frasesDeVerdade: "Escribe con frases de verdad, por lo menos 3 palabras.",
  palavrasReais: "Usa palabras reales, evita números y símbolos sueltos.",
  naoRepita: "Evita repetir el mismo carácter varias veces seguidas.",
  preferoFalar: "Mejor lo cuento hablando",
  pararGravar: "Dejar de grabar",
  naoLembro: "No me acuerdo de nada ahorita, seguir sin esto",

  avisoComposto: (primeiro: string) =>
    `El nombre y el apellido se van a cantar completos. Si le dices ${primeiro}, queda mejor en la canción.`,
  usarSo: (primeiro: string) => `Usar solo “${primeiro}”`,

  opcao: (n: number) => `Opción ${n}`,
  outraOpcao: "Ver otras opciones",
  gerandoOutras: "Generando otras…",
  suaLetraSeuJeito: "Tu letra, a tu manera",
  qualRefrao: "¿Cuál coro queda mejor?",
  refraoSub: "Es la parte que más se canta. Elige la que te mueva; todo se puede ajustar después.",
  usarEsteRefrao: "Usar este coro",
  linkEQrEnviar: "link + código QR para enviar",
  assimVaiReceber: "Así es como {n} lo va a recibir",
  estaPronta: "Ya está lista",
  preparandoSua: "Preparando tu canción…",
  melhorarComIA: "mejorar con IA",
  falhouMelhorar: "No pude mejorarla ahora. La letra sigue como estaba.",

  loadingLetra: [
    "Leyendo tu historia…",
    "Buscando los detalles que solo ustedes tienen…",
    "Escribiendo dos caminos para el coro…",
  ],
  loadingRefrao: "Escribiendo la letra alrededor de tu coro…",
  loadingMusica: [
    "Encontrando el tono de tu historia…",
    "Dándole ritmo a las palabras…",
    "Ajustando los últimos detalles…",
  ],
  sendoCantada: "grabándose",
  gravandoVoz: "Grabando la voz…",
  quasePronta: "Casi lista…",
  prontaBang: "¡Lista!",
  ajustandoDetalhes: "ajustando los detalles",
  completa: "completa",
  esperaOuvirOutras: "mientras tanto, escucha otras",
  levaDoisMinutos: "Tarda unos 2 minutos. Puedes ir escuchando otras aquí abajo mientras la tuya queda lista.",
  isSoQueVaiEnviar: "esto es lo que vas a enviar",
  comoVaiChegar: "Le mandas el link por WhatsApp. La persona lo toca, y la letra se enciende al ritmo de la canción, con las fotos de ustedes.",
  prontaEmBreve: "En cuanto la grabación esté lista, escuchas un pedazo aquí.",
  demorouMais: "La grabación tardó más de lo esperado",
  avisamosPorEmail: "En cuanto esté lista, te avisamos a tu correo.",

  ouviuPedacinho: "Escuchaste solo un pedacito…",
  musicaContinua: "La canción sigue…",
  canteJunto: "Canta con ella, es tu canción",
  ouvirAMusica: "Escuchar la canción",
  umaMusicaPra: "una canción para",
  linkEQr: "link + código QR para compartir",

  naoConsegui: "No pude escribirla ahora. Inténtalo de nuevo.",
  naoMontei: "No pude armar la letra. Inténtalo de nuevo.",
  naoPreparei: "No pude preparar la canción. Inténtalo de nuevo.",
  tentarDeNovo: "Intentar de nuevo",
  faltouImportante: "Faltó la parte más importante",
  precisoDaHistoria:
    "Necesito la historia para escribir una letra que sea solo suya. ¿Regresamos y me cuentas?",
  contarAHistoria: "Contar la historia",

  rotulos: {
    relacao: "Para quién", nome: "Nombre", ocasiao: "Ocasión", estilo: "Estilo",
    voz: "Voz", historia1: "Sobre ella(él)", historia2: "Un recuerdo",
    recado: "Tu frase", filhos: "Hijos mencionados",
  },
};

const POR_IDIOMA: Record<Locale, Textos> = { pt: PT, es: ES };

/** Os textos da moldura no idioma dado. Idioma desconhecido cai em português. */
export function t(locale: Locale): Textos {
  return POR_IDIOMA[locale] ?? PT;
}
