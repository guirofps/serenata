import type { FlowStep, SkipMap } from "@/lib/flow-engine";
import type { Locale } from "@/lib/i18n";
import { generos } from "@/lib/generos";
import { QUIZ_FLOW_ES } from "@/lib/quiz-flow-es";

// Conteúdo do nosso quiz (Fase 1), conforme docs/quiz-fase1.md.
// Enquadramento: é um PRESENTE/homenagem, não "uma música".
// Mistura o melhor dos 4 concorrentes:
//   - micro-compromissos e história guiada em 3 telas (ForeverSongs/LoveTune)
//   - tom conversacional (Lovepanda)
//   - validação anti-lixo dura, mín. 150 chars (LoveTune)
//   - lead parcial desde o passo 1 (nenhum concorrente tem)

const QUIZ_FLOW_PT: FlowStep[] = [
  // PRIMEIRA TELA, antes de qualquer pergunta. `indexOfId` devolve 0 quando
  // não há `?step=` na URL, então quem cai do anúncio direto em /criar entra
  // por aqui sem precisar de rota nova. A copy vive no componente, junto da
  // versão espanhola, como no `AberturaProva`.
  {
    id: "abertura",
    kind: "intro",
  },
  {
    id: "relacao",
    kind: "question",
    block: "Pra quem",
    text: "Pra quem é esse presente?",
    field: "relacao",
    input: "chips",
    // A ORDEM VEM DO PAINEL, não do parentesco (17/08).
    //
    // Antes os chips vinham em PARES (mãe/pai, esposa/marido, namorada/
    // namorado…), que é bonito de ler e não tem nada a ver com o que as
    // pessoas escolhem. Medido em "Pra quem", no painel:
    //
    //   esposa 404 · namorada 66 · filha 56 · filho 37 · marido 36 · mãe 23
    //
    // Esposa sozinha é 6x a segunda colocada, e estava em TERCEIRO — atrás de
    // mãe, que tem 23. Numa lista de dezenove chips onde o primeiro par ocupa
    // a linha mais visível, isso é o item que mais vende começando abaixo de
    // dois que quase ninguém marca.
    //
    // Os seis medidos sobem, na ordem exata do painel. O resto mantém a ordem
    // relativa que já tinha.
    //
    // O QUE ISSO CUSTA: os pares se separam. Esposa e marido deixam de ficar
    // lado a lado, e quem procura o par masculino não o acha mais ao lado do
    // feminino. É o preço de ordenar por demanda, e é reversível numa
    // ordenação por par (esposa/marido, namorada/namorado, filha/filho,
    // mãe/pai) se a leitura piorar.
    //
    // Só o funil PORTUGUÊS. O `quiz-flow-es.ts` tem a ordem dele, e estes
    // números são de tráfego brasileiro — o México pode presentear outro
    // parente, e reordenar lá com dado daqui seria chutar com cara de medida.
    options: [
      // "EM ALTA" mudou de chip junto com a ordem. Estava no Pai desde a
      // janela do Dia dos Pais; hoje o painel não põe o pai nem entre os seis
      // primeiros, e o selo passou a apontar pra um item que quase ninguém
      // marca — chamando atenção justamente pra longe do que vende.
      //
      // Na esposa ele é o único que é literalmente verdade: 404 contra 66 da
      // segunda colocada. Selo em cima do primeiro colocado não cria alegação
      // nova, só diz em voz alta o que o número já diz.
      { value: "esposa", label: "Esposa", emoji: "💍", tag: "em alta" },
      { value: "namorada", label: "Namorada", emoji: "❤️" },
      { value: "filha", label: "Filha", emoji: "👧" },
      { value: "filho", label: "Filho", emoji: "👦" },
      { value: "marido", label: "Marido", emoji: "💍" },
      { value: "mae", label: "Mãe", emoji: "👩" },
      // Daqui pra baixo, a ordem de antes.
      { value: "pai", label: "Pai", emoji: "👨" },
      { value: "namorado", label: "Namorado", emoji: "❤️" },
      { value: "avo_f", label: "Avó", emoji: "👵" },
      { value: "avo_m", label: "Avô", emoji: "👴" },
      { value: "irma", label: "Irmã", emoji: "🤝" },
      { value: "irmao", label: "Irmão", emoji: "🤝" },
      // Netos e família entraram porque os DADOS pediram: as 3 pessoas que
      // marcaram "Outro" escreveram "Familia", "Fami lia" e "Amanda minha
      // neta". Sem o chip certo, a pessoa enfia a relação dentro do campo do
      // nome, e é esse campo que vai ser cantado.
      { value: "neta", label: "Neta", emoji: "🧒" },
      { value: "neto", label: "Neto", emoji: "🧒" },
      { value: "familia", label: "Família", emoji: "🏡" },
      { value: "amiga", label: "Amiga", emoji: "🫂" },
      { value: "amigo", label: "Amigo", emoji: "🫂" },
      { value: "pet", label: "Pet", emoji: "🐾" },
      { value: "outro", label: "Outro", emoji: "✨" },
    ],
  },
  {
    id: "nome",
    kind: "question",
    block: "Pra quem",
    text: "Como você chama essa pessoa?",
    // A DICA DE PRONÚNCIA SAIU (17/08). Era: "Se a pronúncia não for óbvia,
    // escreva como se fala (ex.: Thaís → ta-ís)". Resolvia um problema real
    // (o Suno canta o que está escrito, e nome incomum sai torto), mas cobrava
    // caro por isso: dobrava o tamanho do subtexto, pedia uma segunda decisão
    // numa tela que só quer um nome, e a que mais perde gente do quiz inteiro
    // — 881 pessoas, 41,5%, é a maior queda do funil.
    //
    // Se voltar, o lugar é o `eco` ou uma dica que só aparece depois de
    // digitar, não no enunciado de quem ainda não escreveu nada.
    subtext:
      "Escreva do jeito que você chama no dia a dia, pode ser um apelido carinhoso.",
    field: "nome",
    input: "text",
    placeholder: "Zé, mãe, vó Rosa...",
    maxLength: 40,
    eco: "É assim que vai ser cantado",
    cortarComposto: true,
  },
  {
    id: "ocasiao",
    kind: "question",
    block: "A ocasião",
    text: "Qual é a ocasião?",
    field: "ocasiao",
    input: "chips",
    // TAMBÉM ORDENADA PELO PAINEL (17/08), como "Pra quem" e "Estilo".
    //
    //   declaração 373 · aniversário 79 · homenagem 78 · só porque 44
    //   · outro 24 · casamento 20
    //
    // Declaração é 4,7x o segundo colocado e estava em TERCEIRO, atrás de
    // casamento (20), que é o último dos seis.
    //
    // "OUTRO MOMENTO" FICA NO FIM, e é a única divergência do painel.
    // Ele aparece em quinto (24), mas é a saída de emergência da pergunta:
    // subir a saída pra perto do topo faz gente marcar por preguiça, e essa
    // resposta vai direto pro prompt da letra como "ocasião não informada" —
    // ou seja, o chip que menos informa passaria na frente dos que mais
    // informam. Foi por dado igual a este que "Família" e "Neta" viraram chip
    // próprio em "Pra quem": parte do 24 é gente que não achou o chip dela.
    options: [
      { value: "declaracao", label: "Declaração de amor", emoji: "❤️" },
      { value: "aniversario", label: "Aniversário", emoji: "🎂" },
      { value: "homenagem", label: "Homenagem", emoji: "🌟" },
      { value: "soporque", label: "Só porque sim", emoji: "✨" },
      { value: "casamento", label: "Casamento ou bodas", emoji: "💒" },
      // Sem medição no recorte; mantêm a ordem relativa que já tinham.
      { value: "memorial", label: "Saudade de quem partiu", emoji: "🕊️" },
      { value: "formatura", label: "Formatura", emoji: "🎓" },
      { value: "outro", label: "Outro momento", emoji: "🎁" },
    ],
  },
  {
    id: "prova1",
    kind: "social-proof",
    // Prova REAL: o vídeo das pessoas que ouviram músicas feitas por nós.
    // Antes havia aqui um depoimento fabricado ("Fernanda · pra mãe dela"),
    // que era mentira e é o tipo de alegação que derruba conta no Google Ads.
    // O vídeo é MUDO de propósito: emociona sem competir com o preenchimento
    // do quiz e sem dar um player pra pessoa se distrair.
    eyebrow: "reações reais",
    testimonial: "A cara de quem ouve pela primeira vez.",
  },
  {
    id: "estilo",
    kind: "question",
    block: "O estilo",
    text: "Que estilo combina com {nome}?",
    subtext: "É o clima da música. Dá pra mudar depois.",
    field: "estilo",
    input: "chips",
    // Sem "Outro": num seletor de GÊNERO, "outro" virava "à escolha do
    // compositor" e saía qualquer coisa. Os rótulos, o estilo do Suno e o
    // rótulo do prompt vivem juntos no catálogo (`generos.ts`) — eram três
    // listas que precisavam concordar entre si.
    options: generos("pt").map((g) => ({ value: g.value, label: g.label, emoji: g.emoji })),
  },
  {
    id: "voz",
    kind: "question",
    block: "O estilo",
    text: "Quem canta essa música?",
    field: "voz",
    input: "chips",
    options: [
      { value: "feminina", label: "Voz feminina", emoji: "👩" },
      { value: "masculina", label: "Voz masculina", emoji: "👨" },
      { value: "surpresa", label: "Surpreenda-me", emoji: "🎲" },
    ],
    // O TOM, segunda fileira. Estava no passo do ESTILO e veio pra cá em
    // 18/08. Opcional: sem escolha, o modelo decide pela ocasião e pela
    // história, que é o que já fazia antes deste campo existir. Os `value` são
    // idênticos nos dois idiomas (é o que vai pro banco).
    //
    // POR QUE AQUI E NÃO LÁ: o estilo já é a tela mais cheia do quiz — treze
    // gêneros, que a reordenação de 17/08 deixou em quatro fileiras. Empilhar
    // uma segunda pergunta embaixo disso enterrava o tom, e ele é opcional
    // justamente pra quem já rolou até o fim. A voz tem três chips e sobra
    // tela; as duas perguntas são da mesma natureza (como a música SOA), então
    // dividir 13+4 em 13 e 3+4 não separa assunto nenhum.
    //
    // EFEITO COLATERAL, no `Quiz.tsx`: o avanço automático da variante B é
    // desligado onde existe `extraChips` (avançar sozinho pularia um campo que
    // a pessoa nem viu). Ao mover o bloco, essa trava sai do estilo e vai pra
    // voz junto. Hoje não muda nada — a variante B só roda com `?f=b` na URL —
    // mas se ela for ligada, é o estilo que passa a avançar no toque.
    extraChips: {
      field: "tom",
      pergunta: "E o tom? (opcional)",
      options: [
        { value: "romantica", label: "Romântica", emoji: "💗" },
        { value: "divertida", label: "Divertida", emoji: "😄" },
        { value: "emocionante", label: "Emocionante", emoji: "🥹" },
        { value: "animada", label: "Animada", emoji: "🎉" },
      ],
    },
  },
  {
    id: "historia1",
    kind: "question",
    block: "A história",
    text: "O que {nome} é pra você?",
    subtext: "Escreva do seu jeito. Quanto mais real, mais única fica a letra.",
    field: "historia1",
    input: "story",
    placeholder:
      "Ex: minha mãe criou eu e meus irmãos sozinha, sempre com um sorriso...",
    // 60, igual ao historia2. Era 120: a gente oferecia gatilhos que escrevem
    // meia frase pra pessoa e, logo abaixo, exigia o dobro de texto pra
    // liberar o botão. Pedir o detalhe e cobrar a redação é o jeito mais
    // rápido de fazer alguém fechar a aba.
    minChars: 60,
    allowAudio: true,
    // Os mesmos gatilhos que destravaram o `historia2`. Aqui o campo é maior
    // (120 chars) e vem antes: se a pessoa trava logo neste, os dois passos de
    // história vão junto. As frases pedem SENTIMENTO e HISTÓRIA DOS DOIS, não
    // recall de episódio — é a diferença que faz este passo perder pouca gente.
    triggers: [
      { rotulo: "como se conheceram", inicio: "A gente se conheceu " },
      { rotulo: "o que admiro", inicio: "O que eu mais admiro em {nome} é " },
      { rotulo: "o que faz por mim", inicio: "O que {nome} faz por mim e quase ninguém vê é " },
      { rotulo: "o que aprendi", inicio: "O que eu aprendi com {nome} foi " },
      { rotulo: "nunca falei isso", inicio: "Uma coisa que eu nunca falei pra {nome} é que " },
      { rotulo: "o que sinto perto", inicio: "Do lado de {nome} eu me sinto " },
    ],
  },
  {
    id: "historia2",
    kind: "question",
    block: "A história",
    // Enunciado REESCRITO (04/08). "Uma memória que só vocês têm" pede
    // RECALL de um episódio específico, e recall sob pressão dá branco. É o
    // passo que mais perde gente no quiz inteiro: 11 de 40, enquanto todos
    // os outros perdem 4 ou 5 — e o `historia1`, que pede sentimento em vez
    // de lembrança, não perde ninguém.
    text: "Me conta uma coisa boba sobre {nome}",
    subtext:
      "Uma mania, um apelido, uma comida. Não precisa ser história bonita, precisa ser verdade.",
    field: "historia2",
    input: "story",
    placeholder: "Ela faz um bolo de fubá que...",
    // 60 e não 120. O subtexto dizia "um detalhe pequeno vale mais que um
    // sentimento grande" e logo abaixo o botão exigia um parágrafo: a gente
    // pedia o detalhe e cobrava a redação. "Ela fazia bolo de fubá todo
    // domingo" tem 38 caracteres e vira letra melhor que 120 de encheção.
    minChars: 60,
    allowAudio: true,
    permitePular: true,
    // Cada gatilho começa a frase pela pessoa. O campo em branco é o que
    // trava: com o começo escrito, sobra completar, que é fácil.
    // `{nome}` é trocado pelo nome real. Todas as frases foram escritas SEM
    // pronome de propósito: "dela(e)" fica feio e o gênero da relação nem
    // sempre resolve (pet, outro). Com o nome no lugar, some o problema e a
    // frase fica mais pessoal ainda.
    triggers: [
      { rotulo: "um apelido", inicio: "O apelido que eu dou pra {nome} é " },
      { rotulo: "uma comida", inicio: "A comida que me lembra {nome} é " },
      { rotulo: "um lugar", inicio: "Tem um lugar que é a cara da gente: " },
      { rotulo: "uma mania", inicio: "Uma mania que só {nome} tem: " },
      { rotulo: "uma frase", inicio: "Uma frase que {nome} vive falando é " },
      { rotulo: "uma música", inicio: "Tem uma música que me lembra {nome}: " },
    ],
  },
  {
    id: "recado",
    kind: "question",
    block: "A história",
    text: "Se {nome} pudesse ouvir UMA frase sua no refrão, qual seria?",
    subtext: "Opcional, mas costuma virar a parte mais forte.",
    field: "recado",
    input: "text",
    placeholder: "A frase que você queria que ficasse pra sempre",
    maxLength: 120,
    opcional: true,
    // Campo em branco aqui produz "meu amor pra toda a vida", e isso vai pro
    // REFRÃO, que é a parte que a pessoa relê. Cada gatilho empurra pra uma
    // frase que só serve pra essa pessoa: gratidão por algo, uma coisa nunca
    // dita, o que ela ensinou. Substituem em vez de somar (é UMA frase).
    triggers: [
      { rotulo: "obrigado por…", inicio: "Obrigado por " },
      { rotulo: "nunca te disse", inicio: "Eu nunca te disse, mas " },
      { rotulo: "você me ensinou", inicio: "Você me ensinou a " },
      { rotulo: "enquanto eu viver", inicio: "Enquanto eu viver, " },
      { rotulo: "ninguém sabe", inicio: "Ninguém sabe, mas você " },
      { rotulo: "se eu pudesse", inicio: "Se eu pudesse, eu " },
    ],
    // Os filhos moram AQUI, e não no passo do nome (onde viraram um link
    // cinza que sumiu) nem num passo próprio (que não se paga).
    //
    // Este passo faz a mesma pergunta de fundo — o que mais entra na música —
    // e é a tela mais vazia do quiz: um campo curto e nada mais. Cabe.
    //
    // Preencher JÁ É o consentimento pra citar: não precisa de um "quer
    // citar?" antes do "quais nomes?".
    extra: {
      field: "filhos",
      pergunta: "Quer que a música cite os filhos?",
      subtexto:
        "Escreva os nomes do jeito que são chamados em casa, é assim que vão ser cantados. Se preferir não citar ninguém, é só continuar.",
      placeholder: "Ex.: Pedro, Aninha e o Caçula",
      maxLength: 80,
      eco: "Vão ser cantados assim",
      ecoModelo: "“…e {v}, o amor que ficou”",
      // Não aparece onde a pergunta é estranha: pro próprio filho, pro neto,
      // pro pet e pro amigo, "os filhos" não é o que a música vai falar.
      mostrarSe: (r) =>
        !["filha", "filho", "neta", "neto", "pet", "amiga", "amigo"].includes(
          String(r.relacao),
        ),
    },
  },
  {
    id: "contato",
    kind: "contact",
    text: "Pra onde eu mando a sua letra?",
    subtext: "A letra fica pronta na próxima tela. O e-mail é só pra você não perder.",
  },
  {
    id: "revisao",
    kind: "review",
  },
  {
    id: "reveal",
    kind: "reveal",
  },
  {
    id: "oferta",
    kind: "oferta",
  },
];

// Skip por ID (nunca por offset). Vazio por ora; exemplo de uso quando precisar:
// { recado: (r) => r.ocasiao === "memorial" }  // pula o recado em memorial
export const QUIZ_SKIP: SkipMap = {};

// ── Despacho por idioma ───────────────────────────────────────────
// O português é o default em todo caminho: idioma desconhecido cai em PT.
export function quizFlow(locale: Locale): FlowStep[] {
  return locale === "es" ? QUIZ_FLOW_ES : QUIZ_FLOW_PT;
}

/**
 * Compatibilidade: código que ainda não conhece idioma continua vendo o funil
 * português, exatamente como antes.
 */
export const QUIZ_FLOW = QUIZ_FLOW_PT;
