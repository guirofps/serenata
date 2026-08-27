import type { Locale } from "@/lib/i18n";
import { ehArgentina } from "@/lib/mercado-es";

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
  emailQuisDizer: "Você quis dizer",
  // Barra flutuante de CTA das duas homes.
  barraRotulo: "Criar minha música",
  barraTitulo: "A letra e um trecho da música, grátis",
  barraSub: "Você paga só pela música inteira e a página",
  oPresenteDe: "O presente de",
  quemVoceAma: "quem você ama",
  estaNascendo: "está começando a nascer.",
  reacoesLegenda: "Reações de quem ouviu uma música feita por nós.",

  // ── faixa do entregável ──────────────────────────────────────
  // "MONTAR" virou "RECEBER EM 2 MINUTOS" (17/08). Montar descreve trabalho
  // pra quem está no meio de um formulário; receber descreve prêmio, e o prazo
  // é a parte que responde "quando" — a mesma promessa da tela de abertura, e
  // dentro do medido (84-110s do pedido ao arquivo).
  //
  // Sem ponto final: o rótulo é renderizado em caixa alta com `tracking`, onde
  // ponto vira sujeira. A chave continua `oQueVaiMontar` de propósito, pra não
  // espalhar renomeação por um texto que muda de novo no próximo teste.
  oQueVaiMontar: "o que você vai receber em 2 minutos",
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
  // Rótulos do botão de play. Só leitor de tela vê, e por isso passaram
  // despercebidos em português no funil espanhol.
  ariaOuvir: "Ouvir",
  ariaPausar: "Pausar",
  // O que a prévia entrega quando corta. Estava CRAVADO em português dentro
  // do componente, e aparecia assim no funil espanhol.
  desbloqueieCompleta:
    "Desbloqueie a música completa + a página presente pra enviar + o MP3 pra guardar.",
  desbloquearBotao: "Desbloquear minha música",
  // ── popup do fim da prévia ───────────────────────────────────
  popupTitulo: "Gostou? Essa música é sua.",
  popupTexto:
    "Ela já está gravada inteira, com a letra que você escreveu. Aqui você ouviu só o começo.",
  popupItens: [
    "A música completa, nas duas versões",
    "A página presente com as fotos e o QR Code",
    "O MP3 pra guardar pra sempre",
  ],
  popupCta: "Quero a música completa",
  popupDepois: "Agora não",
  // ── WhatsApp (na espera, enquanto a música grava) ───────────
  //
  // A promessa é mandar O LINK. Nada de "a gente monta o presente pra você":
  // quem coloca as fotos é o comprador, dentro da plataforma.
  //
  // A PRIMEIRA VERSÃO CONVIDAVA A SAIR, e o número mostrou o preço disso.
  // Ela dizia "se você sair da página, eu te aviso". Medido em 24h, entre quem
  // chegou na espera: quem deixou o WhatsApp clicou em comprar 39% das vezes,
  // contra 54% de quem ignorou o campo e 65% de quem dispensou dizendo que
  // esperava ali. Não prova causa (pode ser que quem já ia sair seja quem
  // aceita o aviso), mas não faz sentido correr o risco de dar licença pra
  // embora justo antes da prévia, que é a peça que mais vende.
  //
  // Agora é EXTRA, não saída: recebe no WhatsApp ALÉM do que já vai ver aqui.
  // ── O WHATSAPP É RESERVA, NÃO É CANAL DE ENTREGA (27/08) ────────
  //
  // A copy anterior prometia: "mando o link no seu WhatsApp também". Duas
  // coisas quebravam nisso.
  //
  // 1. A GENTE NÃO CUMPRE. Os números de WhatsApp do atendimento caem toda
  //    hora, e promessa que depende de canal instável é promessa que vira
  //    reclamação. Prometer menos e entregar é melhor negócio que o inverso.
  //
  // 2. ENSINAVA A ESPERAR A COISA ERRADA. Em 26/08, CINCO dos sete tickets do
  //    dia eram gente esperando a música chegar por WhatsApp ou anexa no
  //    e-mail. A entrega é por LINK, e o funil inteiro dizia o contrário aqui.
  //
  // A troca é de enquadramento, não de campo: o telefone continua sendo
  // pedido, e como SEGURO. "Se o e-mail falhar, a gente te acha" é motivo
  // melhor pra dar o número do que "receba em dois lugares" — protege ela em
  // vez de encher a caixa. E o aviso de spam vai junto, porque é onde a
  // música chega de verdade.
  zapTitulo: "Deixa um WhatsApp de reserva?",
  zapTexto:
    "A sua música vai pro e-mail que você deixou. O WhatsApp é só garantia: se o e-mail voltar ou sumir, a gente te procura por lá pra você não ficar sem nada.",
  zapCampo: "Seu WhatsApp (opcional)",
  zapBotao: "Deixar meu WhatsApp",
  zapDispensar: "Não precisa",
  zapInvalido: "Confere o número, parece faltar um dígito.",
  zapPronto: "Guardado. Só usamos se o e-mail falhar.",
  zapSpam: "A música chega sempre por e-mail. Vale conferir a caixa de spam e a aba Promoções.",
  umaMusicaPra: "uma música pra",
  linkEQr: "link + QR Code pra compartilhar",
  queroCantada: (n: string) => `Quero a música de ${n} cantada`,
  aPartirDe: (preco: string) =>
    `A partir de ${preco}, pagamento único. A letra continua sua de qualquer jeito.`,

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
    voz: "Voz", tom: "Tom", historia1: "Sobre ela(e)", historia2: "Uma memória",
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
  emailQuisDizer: "¿Quisiste decir",
  // Mesma promessa da home ES, na mesma voz: a letra e um pedaço são
  // grátis, e o pago é a canção inteira mais a página.
  barraRotulo: "Crear mi canción",
  barraTitulo: "La letra y un pedazo de la canción, gratis",
  barraSub: "Pagas solo por la canción completa y la página",
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
  ariaOuvir: "Escuchar",
  ariaPausar: "Pausar",
  desbloqueieCompleta:
    "Desbloquea la canción completa + la página regalo para enviar + el MP3 para guardar.",
  desbloquearBotao: "Desbloquear mi canción",
  popupTitulo: "¿Te gustó? Esta canción es tuya.",
  popupTexto:
    "Ya está grabada entera, con la letra que tú escribiste. Aquí escuchaste solo el comienzo.",
  popupItens: [
    "La canción completa, en las dos versiones",
    "La página regalo con las fotos y el código QR",
    "El MP3 para guardarlo para siempre",
  ],
  popupCta: "Quiero la canción completa",
  popupDepois: "Ahora no",
  // Mesmo enquadramento do português: reserva, não canal de entrega. Ver o
  // comentário longo no bloco `pt`.
  zapTitulo: "¿Nos dejás un WhatsApp de respaldo?",
  zapTexto:
    "Tu canción va al e-mail que dejaste. El WhatsApp es solo garantía: si el e-mail rebota o se pierde, te buscamos por ahí para que no te quedes sin nada.",
  zapCampo: "Tu WhatsApp (opcional)",
  zapBotao: "Dejar mi WhatsApp",
  zapDispensar: "No hace falta",
  zapInvalido: "Revisa el número, parece que falta un dígito.",
  zapPronto: "Guardado. Solo lo usamos si el e-mail falla.",
  zapSpam: "La canción llega siempre por e-mail. Conviene revisar la carpeta de spam y la pestaña Promociones.",
  umaMusicaPra: "una canción para",
  linkEQr: "link + código QR para compartir",
  queroCantada: (n: string) => `Quiero la canción de ${n} cantada`,
  aPartirDe: (preco: string) =>
    `Desde ${preco}, pago único. La letra es tuya de todos modos.`,

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
    voz: "Voz", tom: "Tono", historia1: "Sobre ella(él)", historia2: "Un recuerdo",
    recado: "Tu frase", filhos: "Hijos mencionados",
  },
};

// ── A MOLDURA EM RIOPLATENSE ──────────────────────────────────────
//
// O ES acima é espanhol neutro-mexicano, escrito quando o alvo era o México.
// Isto é o que muda pra ARGENTINA, e é o mesmo desenho da camada do quiz
// (`quiz-flow-ar.ts`): sobreposição só do que diverge, nunca um dicionário
// paralelo que sai de sincronia na primeira melhoria.
//
// ── O QUE É E O QUE NÃO É DIFERENÇA ───────────────────────────────
//
// Nem todo `tu` é tuteo. O POSSESSIVO é idêntico nos dois espanhóis: "tu
// canción", "es tuya", "tu WhatsApp" estão certos na Argentina e não entram
// aqui. O que muda é o pronome sujeito (`tú` → `vos`), o preposicional
// (`para ti` → `para vos`, `contigo` → `con vos`) e a CONJUGAÇÃO —
// `dices/querés`, `puedes/podés`, `escucha/escuchá`, `elige/elegí`.
//
// Trocar possessivo por engano seria pior que não trocar nada: viraria um
// espanhol que não existe em lugar nenhum.
//
// `aquí` → `acá` entra junto. Não é gramática, é sotaque, e é exatamente o
// tipo de palavra que faz um argentino sentir que o site é daqui.
const AR: Partial<Textos> = {
  quemVoceAma: "quien vos querés",
  frasesDeVerdade: "Escribí con frases de verdad, por lo menos 3 palabras.",
  avisoComposto: (primeiro: string) =>
    `El nombre y el apellido se van a cantar completos. Si le decís ${primeiro}, queda mejor en la canción.`,
  refraoSub:
    "Es la parte que más se canta. Elegí la que te mueva; todo se puede ajustar después.",
  esperaOuvirOutras: "mientras tanto, escuchá otras",
  levaDoisMinutos:
    "Tarda unos 2 minutos. Podés ir escuchando otras acá abajo mientras la tuya queda lista.",
  prontaEmBreve: "En cuanto la grabación esté lista, escuchás un pedazo acá.",
  desbloqueieCompleta:
    "Ya está grabada entera, con la letra que escribiste vos. Acá escuchaste solo el comienzo.",
  zapInvalido: "Revisá el número, parece que falta un dígito.",
};

const POR_IDIOMA: Record<Locale, Textos> = { pt: PT, es: ES };

/** Os textos da moldura no idioma dado. Idioma desconhecido cai em português. */
export function t(locale: Locale): Textos {
  if (locale === "es" && ehArgentina()) return { ...ES, ...AR };
  return POR_IDIOMA[locale] ?? PT;
}
