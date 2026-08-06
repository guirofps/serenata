import type { FlowStep, SkipMap } from "@/lib/flow-engine";

// Conteúdo do nosso quiz (Fase 1), conforme docs/quiz-fase1.md.
// Enquadramento: é um PRESENTE/homenagem, não "uma música".
// Mistura o melhor dos 4 concorrentes:
//   - micro-compromissos e história guiada em 3 telas (ForeverSongs/LoveTune)
//   - tom conversacional (Lovepanda)
//   - validação anti-lixo dura, mín. 150 chars (LoveTune)
//   - lead parcial desde o passo 1 (nenhum concorrente tem)

export const QUIZ_FLOW: FlowStep[] = [
  {
    id: "relacao",
    kind: "question",
    block: "Pra quem",
    text: "Pra quem é esse presente?",
    field: "relacao",
    input: "chips",
    options: [
      { value: "mae", label: "Mãe", emoji: "👩" },
      { value: "pai", label: "Pai", emoji: "👨", tag: "em alta" },
      { value: "esposa", label: "Esposa", emoji: "💍" },
      { value: "marido", label: "Marido", emoji: "💍" },
      { value: "namorada", label: "Namorada", emoji: "❤️" },
      { value: "namorado", label: "Namorado", emoji: "❤️" },
      { value: "filha", label: "Filha", emoji: "👧" },
      { value: "filho", label: "Filho", emoji: "👦" },
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
    subtext:
      "Escreva do jeito que você chama no dia a dia, apelido vale. Se a pronúncia não for óbvia, escreva como se fala (ex.: Thaís → ta-ís).",
    field: "nome",
    input: "text",
    placeholder: "Zé, mãe, vó Rosa...",
    maxLength: 40,
    eco: "É assim que vai ser cantado",
    cortarComposto: true,
  },
  {
    // Os filhos são o detalhe que mais aparece nas letras que emocionam, e
    // hoje só entram se a pessoa lembrar de escrever na história — quem
    // escreve "minha mãe criou eu e meus irmãos" nunca dá os nomes, e a letra
    // sai falando de "os filhos" no genérico.
    //
    // Um passo só, e opcional: preencher JÁ É o consentimento pra citar. Uma
    // pergunta "tem filhos?" seguida de outra "quer citar?" seriam dois
    // degraus a mais num quiz que perde gente a cada um.
    id: "filhos",
    kind: "question",
    block: "Pra quem",
    text: "Quer que a música cite os filhos?",
    subtext:
      "Escreva os nomes do jeito que são chamados em casa, é assim que vão ser cantados. Se preferir não citar ninguém, é só continuar.",
    field: "filhos",
    input: "text",
    placeholder: "Ex.: Pedro, Aninha e o Caçula",
    maxLength: 80,
    eco: "Vão ser cantados assim",
    ecoModelo: "“…e {v}, o amor que ficou”",
    opcional: true,
  },
  {
    id: "ocasiao",
    kind: "question",
    block: "A ocasião",
    text: "Qual é a ocasião?",
    field: "ocasiao",
    input: "chips",
    options: [
      { value: "aniversario", label: "Aniversário", emoji: "🎂" },
      { value: "casamento", label: "Casamento ou bodas", emoji: "💒" },
      { value: "declaracao", label: "Declaração de amor", emoji: "❤️" },
      { value: "homenagem", label: "Homenagem", emoji: "🌟" },
      { value: "memorial", label: "Saudade de quem partiu", emoji: "🕊️" },
      { value: "formatura", label: "Formatura", emoji: "🎓" },
      { value: "soporque", label: "Só porque sim", emoji: "✨" },
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
    // compositor" e saía qualquer coisa — a IA escolhia sem direção, e o
    // Suno precisa de um estilo concreto. A saída é cobrir bem os gêneros
    // reais do presente brasileiro. Ordenados por quanto se pede.
    options: [
      { value: "sertanejo", label: "Sertanejo", emoji: "🤠" },
      { value: "sertanejo_univ", label: "Sertanejo universitário", emoji: "🎸" },
      { value: "piseiro", label: "Piseiro / arrocha", emoji: "🎹" },
      { value: "pagode", label: "Pagode / samba", emoji: "🥁" },
      { value: "forro", label: "Forró", emoji: "🪗" },
      { value: "pop_romantico", label: "Pop romântico", emoji: "💕" },
      { value: "mpb", label: "MPB / voz e violão", emoji: "🎙️" },
      { value: "bossa", label: "Bossa nova", emoji: "🌙" },
      { value: "rock", label: "Rock", emoji: "🤘" },
      { value: "reggae", label: "Reggae", emoji: "🌴" },
      { value: "gospel", label: "Gospel", emoji: "📖" },
      { value: "rap", label: "Rap / hip-hop", emoji: "🎤" },
      { value: "infantil", label: "Infantil", emoji: "⭐" },
    ],
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
    minChars: 120,
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

// Skip por ID (nunca por offset). Inserir uma pergunta no meio não quebra nada.
export const QUIZ_SKIP: SkipMap = {
  // Perguntar dos filhos só faz sentido pra quem PODE tê-los. Pra um filho,
  // um neto ou um pet a pergunta é estranha e custa um passo — e passo
  // estranho é passo onde a pessoa fecha a aba.
  filhos: (r) =>
    ["filha", "filho", "neta", "neto", "pet"].includes(String(r.relacao)),
};
