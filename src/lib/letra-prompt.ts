// Prompt de geração de letra (de prompts/letra.md). System estável e cacheável;
// respostas do quiz vão por último (cache é casamento de prefixo — nada de
// nome/data/id no system).

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
};
const ESTILO: Record<string, string> = {
  sertanejo: "sertanejo",
  sertanejo_univ: "sertanejo universitário",
  piseiro: "piseiro/arrocha romântico",
  pagode: "pagode/samba",
  forro: "forró",
  pop_romantico: "pop romântico",
  mpb: "MPB (voz e violão)",
  bossa: "bossa nova",
  rock: "rock nacional romântico",
  reggae: "reggae romântico brasileiro",
  gospel: "gospel",
  rap: "rap/hip-hop melódico",
  infantil: "infantil",
};
const VOZ: Record<string, string> = {
  feminina: "feminina",
  masculina: "masculina",
  surpresa: "à escolha do compositor",
};

// Sanitiza o nome do homenageado (bug da Cantoria: injetar nome sem checar).
export function sanitizeNome(raw: unknown): string {
  const n = String(raw ?? "").trim();
  if (!n || n.length > 40 || /\d/.test(n)) return "";
  return n;
}

export function buildUserMessage(respostas: Record<string, unknown>): string {
  const nome = sanitizeNome(respostas.nome) || "essa pessoa";
  const relacao = RELACAO[String(respostas.relacao)] ?? "pessoa querida";
  const ocasiao = OCASIAO[String(respostas.ocasiao)] ?? "momento especial";
  const genero = ESTILO[String(respostas.estilo)] ?? "à escolha do compositor";
  const voz = VOZ[String(respostas.voz)] ?? "à escolha do compositor";
  const historia = [respostas.historia1, respostas.historia2]
    .filter(Boolean)
    .join("\n\n");
  const recado = String(respostas.recado ?? "").trim();

  return `Homenageado: ${nome}
Relação com quem encomendou: ${relacao}
Ocasião: ${ocasiao}
Gênero musical: ${genero}
Voz: ${voz}

História contada:
${historia}

Recado especial (pode estar vazio):
${recado}`;
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
