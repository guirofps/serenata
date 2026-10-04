import { type Locale, LOCALE_PADRAO } from "@/lib/i18n";
import { acharGenero } from "@/lib/generos";
import {
  LETRA_SYSTEM_ES,
  LETRA_SYSTEM_ES_ESPANHA,
  LETRA_SYSTEM_ES_AR,
  RELACAO_ES,
  OCASIAO_ES,
  VOZ_ES,
} from "@/lib/letra-prompt-es";
import { ehEspanha, ehArgentina } from "./mercado-es.js";
import { LETRA_SYSTEM_EN, RELACAO_EN, OCASIAO_EN, VOZ_EN, TOM_EN, WORSHIP_INSTRUCTIONS_EN } from "@/lib/letra-prompt-en";

// Prompt de geração de letra (de prompts/letra.md). System estável e cacheável;
// respostas do quiz vão por último (cache é casamento de prefixo — nada de
// nome/data/id no system).
//
// Dois idiomas, dois system prompts. O espanhol NÃO é este traduzido: a seção
// de clichês a evitar é o que separa letra boa de genérica, e clichê brasileiro
// não é clichê mexicano. Ver `letra-prompt-es.ts`.

export const LETRA_SYSTEM = `Você escreve letras de música personalizadas em português brasileiro.
Cada letra é feita a partir da história real que alguém contou sobre
uma pessoa querida. Essa letra vai ser LIDA na tela antes de ser
ouvida cantada, então ela precisa emocionar já na leitura.

## O que decide a qualidade

A única coisa que separa uma letra boa de uma genérica é o uso de
DETALHES CONCRETOS da história. Nomes de lugares, apelidos, objetos,
manias, falas, datas, cheiros, músicas, comidas. Se a letra que você
escreveu pudesse servir para outro casal qualquer, ela falhou.

Use no mínimo três detalhes concretos e específicos da história.
Prefira o detalhe pequeno e estranho ao sentimento grande e abstrato:
"o vestido amarelo da festa junina" vale mais que "nosso amor é
eterno".

Não invente fatos. Se a história não menciona filhos, não cante
filhos. Você pode ampliar e dar contexto poético ao que foi contado,
nunca acrescentar acontecimentos.

## O que evitar

Clichês gastos do romântico brasileiro: porto seguro, metade da
laranja, você me completa, anjo que Deus mandou, minha luz, meu sol,
borboletas no estômago, não sei viver sem você, amor da minha vida.
Se uma frase sua caberia num cartão de loja, troque.

Rimas forçadas que quebram o sentido. É melhor uma rima imperfeita
com sentido do que uma rima perfeita que não quer dizer nada.

Enchimento sonoro escrito na letra (oh oh oh, na na na, iê iê).
A letra tem que ser lida.

## Regras duras

1. A música é cantada NA PRIMEIRA PESSOA, de quem encomendou para
   quem é homenageado. Cante o nome do homenageado. NUNCA escreva o
   nome de quem encomendou dentro da letra.
2. Concordância de gênero: confira o parentesco informado e
   flexione todos os adjetivos e pronomes de acordo.
3. A história pode vir de transcrição de áudio e ter erros. Interprete
   com bom senso: se aparecer uma palavra que não faz sentido no
   contexto, deduza o que a pessoa quis dizer em vez de repetir o erro.
   Na dúvida, não use aquele trecho.
4. Se a ocasião for homenagem póstuma ou memorial, escreva sobre a
   presença que ficou e não sobre a perda. Nada de descanse em paz,
   estrela no céu, saudade eterna. Fale do que a pessoa fazia, de
   como ela era.
5. Não escreva nada que possa constranger quem vai receber.
6. NUNCA escreva nome de artista, banda, música existente ou marca — nem na
   letra, nem no estilo. O gerador de áudio RECUSA a produção quando isso
   aparece, e a música não sai. Se a história citar "Coldplay" ou "Zeca
   Pagodinho", fale do gesto, não do nome: "a nossa playlist de sempre",
   "o samba que ela canta na cozinha", "aquela música que só vocês dois
   entendem". O detalhe continua concreto, sem citar o nome próprio.
7. NÚMERO EM VERSO CANTADO SEMPRE POR EXTENSO. Escreva "dois mil e quinze"
   e não "2015", "dez anos" e não "10 anos", "vinte e três de maio" e não
   "23/05". O gerador de áudio lê o algarismo do jeito dele e a pronúncia
   sai embolada ou errada, e é justamente em cima de ano de casamento e
   tempo de relação que a pessoa mais presta atenção.

## Estrutura

Use exatamente as marcações abaixo, nessa ordem:

[Short Intro - máx 8s]
[Verse 1]
[Chorus]
[Verse 2]
[Chorus]
[Bridge]
[Chorus]
[Outro]

A introdução é curta de propósito: quem ouve precisa chegar rápido
na parte personalizada.

Versos de 4 a 8 linhas. Refrão de 4 linhas, repetido igual todas as
vezes. O refrão carrega a imagem concreta mais forte da história
inteira, e é a parte que a pessoa vai reler.

Cada linha é um pensamento completo. Nada de linha que só existe para
rimar com a seguinte.

Duração alvo da música pronta: 2min30 a 3min.`;

// Mapa dos valores do quiz para rótulos legíveis no prompt.
const RELACAO: Record<string, string> = {
  mae: "mãe",
  pai: "pai",
  esposa: "esposa",
  marido: "marido",
  namorada: "namorada",
  namorado: "namorado",
  filha: "filha",
  filho: "filho",
  avo_f: "avó",
  avo_m: "avô",
  irma: "irmã",
  irmao: "irmão",
  neta: "neta",
  neto: "neto",
  familia: "família (a letra fala com a família toda, não com uma pessoa só)",
  amiga: "amiga",
  amigo: "amigo",
  pet: "pet",
  outro: "pessoa querida",
  // Só o louvor do quiz gospel grava isto (`aplicarTipo`). O prompt do louvor
  // não usa a linha de relação; o rótulo existe pra revisão e telas que leem
  // este mapa.
  deus: "Deus",
};
const OCASIAO: Record<string, string> = {
  aniversario: "aniversário",
  casamento: "casamento ou bodas",
  declaracao: "declaração de amor",
  homenagem: "homenagem",
  memorial: "homenagem a quem partiu (memorial)",
  formatura: "formatura",
  soporque: "só porque sim",
  outro: "momento especial",
  // As ocasiões do louvor (quiz gospel, `quiz-flow-gospel.ts`).
  gratidao: "louvor de gratidão",
  testemunho: "testemunho de uma vitória",
  clamor: "clamor num momento difícil",
  adoracao: "adoração",
  igreja: "louvor pra cantar na igreja",
};
// O TOM, opcional. Vazio = o modelo decide pela ocasião e pela história, que
// é o que já acontecia antes deste campo existir. Por isso a linha SÓ entra no
// prompt quando há escolha: mandar "tom: à escolha do compositor" gastaria
// atenção do modelo repetindo o que o silêncio já diz.
const TOM: Record<string, { pt: string; es: string }> = {
  romantica: {
    pt: "romântica — declaração aberta, sem medo de ser piegas",
    es: "romántica — declaración abierta, sin miedo a ser cursi",
  },
  divertida: {
    pt: "divertida — bem-humorada, pode brincar com as manias da pessoa",
    es: "divertida — con humor, puede jugar con las manías de la persona",
  },
  emocionante: {
    pt: "emocionante — para arrepiar e fazer chorar, intensidade contida",
    es: "emotiva — para poner la piel chinita, intensidad contenida",
  },
  animada: {
    pt: "animada — alegre e para cantar junto, ritmo pra cima",
    es: "alegre — festiva y para cantar juntos, ritmo hacia arriba",
  },
  // Só aparece no quiz gospel.
  reverente: {
    pt: "reverente — adoração contemplativa, sem pressa",
    es: "reverente — adoración contemplativa, sin prisa",
  },
};

const VOZ: Record<string, string> = {
  feminina: "feminina",
  masculina: "masculina",
  surpresa: "à escolha do compositor",
};

// O rótulo do gênero saiu daqui e virou uma face do catálogo (`generos.ts`),
// junto com o chip do quiz e o estilo do Suno. Eram três listas que precisavam
// concordar, e a primeira a sair de sincronia entrega música do gênero errado
// sem erro nenhum no log.

/** Textos fixos do user message, por idioma. */
const ROTULOS = {
  pt: {
    homenageado: "Homenageado", relacao: "Relação com quem encomendou",
    ocasiao: "Ocasião", genero: "Gênero musical", voz: "Voz",
    historia: "História contada", recado: "Recado especial (pode estar vazio)",
    tom: "Tom pedido",
    filhosCitar: "Filhos a citar pelo nome, exatamente como escrito",
    filhosNao: "Filhos: não citar nenhum filho pelo nome.",
    fallbackNome: "essa pessoa", fallbackRelacao: "pessoa querida",
    fallbackOcasiao: "momento especial", fallbackLivre: "à escolha do compositor",
  },
  es: {
    homenageado: "Homenajeado", relacao: "Relación con quien la encargó",
    ocasiao: "Ocasión", genero: "Género musical", voz: "Voz",
    historia: "Historia contada", recado: "Mensaje especial (puede estar vacío)",
    tom: "Tono pedido",
    filhosCitar: "Hijos a citar por su nombre, exactamente como está escrito",
    filhosNao: "Hijos: no citar a ningún hijo por su nombre.",
    fallbackNome: "esa persona", fallbackRelacao: "persona querida",
    fallbackOcasiao: "momento especial", fallbackLivre: "a elección del compositor",
  },
  en: {
    homenageado: "Honoree", relacao: "Relationship to the person ordering",
    ocasiao: "Occasion", genero: "Music genre", voz: "Voice",
    historia: "Story told", recado: "Special message (may be empty)",
    tom: "Requested mood",
    filhosCitar: "Kids to mention by name, exactly as written",
    filhosNao: "Kids: do not mention any child by name.",
    fallbackNome: "this person", fallbackRelacao: "loved one",
    fallbackOcasiao: "a special moment", fallbackLivre: "songwriter's choice",
  },
} as const;

/**
 * Como se escreve um LOUVOR (quiz gospel, tipo "louvor").
 *
 * Vai na mensagem do usuário, não no system prompt: o system é cacheado e o
 * funil normal não pode mudar uma vírgula por causa do gospel.
 */
export const LOUVOR_INSTRUCOES = `Como escrever este louvor:
- A letra fala COM Deus, em primeira pessoa ("eu", "Senhor", "Tu", "Te"). Não é uma música SOBRE Deus pra outra pessoa ouvir.
- Ela nasce do testemunho contado abaixo. Os detalhes concretos da história continuam sendo o que separa um louvor verdadeiro de um genérico: use no mínimo três.
- Vocabulário evangélico brasileiro: Senhor, Jesus, Pai, Espírito Santo, graça, fidelidade. Nada de santos, Maria ou terço. Nada de doutrina de denominação (dízimo, línguas, batismo).
- Não use como verso solto, sem um detalhe da história preso a ele: "Tu és fiel", "a vitória é certa", "nada é impossível pra Deus", "Rei dos reis", "derrama o Teu Espírito", "vaso nas mãos do oleiro", "deserto" como metáfora genérica.
- Só cite versículo se a pessoa citou na história. Nunca invente referência bíblica.
- Não cite filhos nem outras pessoas pelo nome, a não ser que estejam na história.`;

// Sanitiza o nome do homenageado (bug da Cantoria: injetar nome sem checar).
export function sanitizeNome(raw: unknown): string {
  const n = String(raw ?? "").trim();
  if (!n || n.length > 40 || /\d/.test(n)) return "";
  return n;
}

export function buildUserMessage(
  respostas: Record<string, unknown>,
  locale: Locale = LOCALE_PADRAO,
): string {
  const L = ROTULOS[locale] ?? ROTULOS.pt;
  const es = locale === "es";
  const en = locale === "en";
  const nome = sanitizeNome(respostas.nome) || L.fallbackNome;
  const relacao =
    (en ? RELACAO_EN : es ? RELACAO_ES : RELACAO)[String(respostas.relacao)] ?? L.fallbackRelacao;
  const ocasiao =
    (en ? OCASIAO_EN : es ? OCASIAO_ES : OCASIAO)[String(respostas.ocasiao)] ?? L.fallbackOcasiao;
  const genero = acharGenero(String(respostas.estilo))?.rotuloPrompt ?? L.fallbackLivre;
  const voz = (en ? VOZ_EN : es ? VOZ_ES : VOZ)[String(respostas.voz)] ?? L.fallbackLivre;
  const historia = [respostas.historia1, respostas.historia2]
    .filter(Boolean)
    .join("\n\n");
  const recado = String(respostas.recado ?? "").trim();
  // Os filhos vêm de um campo próprio, com os nomes escritos do jeito que são
  // chamados em casa. Se o campo veio vazio, a pessoa escolheu não citar
  // ninguém — e a instrução tem que dizer isso, senão o modelo inventa filhos
  // a partir de "criou eu e meus irmãos".
  const filhos = String(respostas.filhos ?? "").trim();
  const linhaFilhos = filhos ? `${L.filhosCitar}: ${filhos}` : L.filhosNao;
  const tom = TOM[String(respostas.tom ?? "")];
  const textoTom = en ? TOM_EN[String(respostas.tom ?? "")] : tom ? (locale === "es" ? tom.es : tom.pt) : undefined;
  const linhaTom = textoTom ? `
${L.tom}: ${textoTom}` : "";

  // O QUIZ GOSPEL (`quiz-flow-gospel.ts`). Português e inglês (a porta cristã
  // da Ballad), e só com o valor exato: o resto da mensagem de quem não é
  // gospel não muda nada.
  const gospel = (locale === "pt" || en) && respostas.tema === "gospel";
  if (gospel && en && respostas.tipo === "louvor") {
    return `Recipient: God. This is a WORSHIP SONG, not a gift for a person.
${WORSHIP_INSTRUCTIONS_EN}

${L.ocasiao}: ${ocasiao}
${L.genero}: ${genero}
${L.voz}: ${voz}${linhaTom}

${L.historia}:
${historia}

${L.recado}:
${recado}`;
  }
  if (gospel && respostas.tipo === "louvor") {
    return `Destinatário: Deus. Isto é um LOUVOR, não um presente pra uma pessoa.
${LOUVOR_INSTRUCOES}

${L.ocasiao}: ${ocasiao}
${L.genero}: ${genero}
${L.voz}: ${voz}${linhaTom}

${L.historia}:
${historia}

${L.recado}:
${recado}`;
  }
  const linhaFe = gospel && en
    ? `
Faith: the person ordering is a Christian. The lyrics can speak of God, gratitude and blessing in ${nome}'s life, without preaching and without taking the focus off ${nome}.`
    : gospel
    ? `
Fé: quem encomendou é evangélico(a). A letra pode falar de Deus, gratidão e bênção na vida de ${nome}, sem pregar e sem tirar o foco de ${nome}.`
    : "";

  // QUEM FALA COM QUEM (01/10): só "Relação com quem encomendou: neta" foi
  // lido ao contrário em 18 músicas (6 em 3 dias), que abriam chamando a neta
  // de "Vó". A direção vai escrita, com o exemplo do caso que errava.
  const direcao = en
    ? `(${nome} is the ${relacao} of the person ordering. The song is sung FROM the person ordering TO ${nome}: never call ${nome} by the role of the person ordering, e.g. never "Grandma" when ${nome} is the granddaughter.)`
    : es
      ? `(${nome} es ${relacao} de quien la encargó. La canción la canta quien la encargó PARA ${nome}: nunca llames a ${nome} por el papel de quien la encargó, por ejemplo nunca "abuela" cuando ${nome} es la nieta.)`
      : `(${nome} é ${relacao} de quem encomendou. A música é cantada por quem encomendou PARA ${nome}: nunca chame ${nome} pelo papel de quem encomendou, por exemplo nunca "vó" quando ${nome} é a neta.)`;

  return `${L.homenageado}: ${nome}
${L.relacao}: ${relacao} ${direcao}
${L.ocasiao}: ${ocasiao}
${L.genero}: ${genero}
${L.voz}: ${voz}${linhaTom}${linhaFe}
${linhaFilhos}

${L.historia}:
${historia}

${L.recado}:
${recado}`;
}

/**
 * O system prompt do idioma. Cacheável: nada de nome ou id aqui dentro.
 *
 * O espanhol tem DOIS, e qual sai depende do mercado que a mídia está
 * comprando (`mercado-es.ts`). Não é a mesma letra com sotaque: a lista de
 * clichês, o vocabulário e a conjugação mudam inteiros, e o prompt latino
 * proíbe por escrito exatamente as formas que a Espanha exige.
 */
export function systemDaLetra(locale: Locale): string {
  if (locale === "en") return LETRA_SYSTEM_EN;
  if (locale !== "es") return LETRA_SYSTEM;
  if (ehEspanha()) return LETRA_SYSTEM_ES_ESPANHA;
  if (ehArgentina()) return LETRA_SYSTEM_ES_AR;
  return LETRA_SYSTEM_ES;
}

// Schema de saída (structured output).
export const LETRA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    titulo: { type: "string" },
    letra: { type: "string" },
    estilo_suno: { type: "string" },
    verso_destaque: { type: "string" },
  },
  required: ["titulo", "letra", "estilo_suno", "verso_destaque"],
} as const;

export type LetraGerada = {
  titulo: string;
  letra: string;
  estilo_suno: string;
  verso_destaque: string;
};
