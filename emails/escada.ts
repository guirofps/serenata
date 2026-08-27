import { moldura } from "./sequencia.js";

// A ESCADA DE RECUPERAÇÃO — dez e-mails, quatro preços descendo.
//
// Substitui os e-mails 2 a 4 da `sequencia.ts` no funil PORTUGUÊS. O espanhol
// continua na régua curta de lá: volume pequeno demais pra sustentar dez
// disparos, e a copy abaixo é escrita, não traduzida.
//
// ── O QUE O DADO DE VOCÊS DIZ, E POR QUE ISTO EXISTE MESMO ASSIM ─
//
// Medido em 16/08, na régua anterior:
//
//   1 · a letra        1.068 envios   63 compras   5,9%
//   2 · "ficou pronta"   827 envios    8 compras   1,0%
//   3 · "esperando"      330 envios    1 compra    0,3%
//
// Foi por isso que `ULTIMO_EMAIL` tinha sido travado em 2. Ir a dez é decisão
// do dono, tomada com esse número à vista, apostando que o que faltava era
// PREÇO — coisa que a régua anterior nunca ofereceu (ela mandava todo mundo
// pro funil no preço cheio).
//
// O que isso arrisca é a REPUTAÇÃO do remetente, não o custo de envio. 84% dos
// compradores estão no Gmail, e é o Gmail que decide se o e-mail de ENTREGA —
// o único que carrega produto pago — cai na caixa ou no spam. Cada degrau sai
// com `template: recuperacao_<n>`, então o painel de e-mail mostra abertura,
// clique, descadastro e reclamação POR DEGRAU. É lá que se vê a conta virando:
// se a reclamação de spam subir no degrau 6, corte em 5.
//
// ── A ESCADA DE PREÇO ───────────────────────────────────────────
//
// Quatro degraus reais: R$ 38 → R$ 29 → R$ 19 → R$ 9. Não são dez preços
// porque só existem quatro links na Perfect Pay, e inventar um quinto degrau
// de R$ 1 (o cupom SRN27 dá R$ 28, colado no link de R$ 29) faria a escada
// parecer arbitrária pra quem recebe os dois.
//
// O preço cheio segura os TRÊS primeiros de propósito. Descontar no dia
// seguinte ao abandono ensina que basta esperar, e quem aprende isso nunca
// mais paga R$ 38 — inclusive quem ainda nem abandonou, porque as pessoas
// conversam.
//
// ── OS LINKS SÃO OS DO TESTE A/B ────────────────────────────────
//
// R$ 29, R$ 19 e R$ 9 são as variantes D, B e C de `preco.ts`. Enquanto o
// teste de preço estiver no ar, uma venda de recuperação a R$ 9 entra na
// receita do braço em que a pessoa foi sorteada, que pode ser o de R$ 37 — a
// leitura de receita por lead do teste fica contaminada. Ler o teste durante
// esta campanha exige descontar as vendas com `?ppc=` ou vindas destes links.

/** Os dez degraus. O `numero` é o do e-mail na régua (o 1 é a letra). */
export type DegrauEscada = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const DEGRAUS: DegrauEscada[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * Espera desde o e-mail ANTERIOR daquela pessoa, em horas.
 *
 * Contado do anterior e não do quiz: quem recebeu a letra atrasada receberia
 * dois e-mails no mesmo dia, que é o jeito mais rápido de virar spam.
 *
 * Soma 720h = 30 dias do começo ao fim. É por isso que a janela de entrada da
 * sequência subiu pra 45 dias: com 30, a pessoa saía da lista de leads no meio
 * da régua e os últimos degraus nunca sairiam.
 */
export const ESPERA_H: Record<DegrauEscada, number> = {
  2: 24,
  3: 24,
  4: 48,
  5: 48,
  6: 72,
  7: 72,
  8: 96,
  9: 96,
  10: 120,
  11: 120,
};

/** Preço de cada degrau, com o link que cobra exatamente aquilo. */
type Oferta = { texto: string; checkout: string };

const CHEIO: Oferta = { texto: "R$ 38", checkout: "https://go.perfectpay.com.br/PPU38CQER4D" };
const VINTE_NOVE: Oferta = { texto: "R$ 29", checkout: "https://go.perfectpay.com.br/PPU38CQFF7J" };
const DEZENOVE: Oferta = { texto: "R$ 19", checkout: "https://go.perfectpay.com.br/PPU38CQFF7H" };
const NOVE: Oferta = { texto: "R$ 9", checkout: "https://go.perfectpay.com.br/PPU38CQFF7I" };

export const OFERTA: Record<DegrauEscada, Oferta> = {
  2: CHEIO,
  3: CHEIO,
  4: CHEIO,
  5: VINTE_NOVE,
  6: VINTE_NOVE,
  7: DEZENOVE,
  8: DEZENOVE,
  9: NOVE,
  10: NOVE,
  11: NOVE,
};

/**
 * O link de compra do degrau, com a ponte pro webhook.
 *
 * `src` é o `session_id`, e ele NÃO é enfeite: é por ele que
 * `api/webhook/perfectpay.ts` casa o pagamento com a música que já foi gerada.
 * Sem ele a compra entra como "pago sem música casada" e alguém precisa
 * entregar à mão — o modo de falha que o projeto inteiro existe pra evitar.
 *
 * O e-mail vai pré-preenchido porque é um campo a menos num formulário onde a
 * gente já perde muita gente (223 cliques em comprar produziram 86 pedidos).
 */
export function linkDeCompra(numero: DegrauEscada, sessao: string, email: string): string {
  const u = new URL(OFERTA[numero].checkout);
  u.searchParams.set("src", sessao);
  if (email) u.searchParams.set("email", email);
  return u.toString();
}

// ── A COPY ──────────────────────────────────────────────────────
//
// Uma ideia por e-mail, e nenhuma repete o argumento da anterior. Dez e-mails
// dizendo "sua música está esperando" de dez jeitos é o que faz alguém marcar
// spam mesmo gostando do produto.
//
// O que NÃO entra em nenhum: número de cliente inventado, depoimento
// fabricado, contagem regressiva falsa. O CLAUDE.md registra que alegação
// inventada derruba conta no Google Ads, e o mesmo texto costuma circular
// entre e-mail e anúncio.

type Passo = {
  assunto: (nome: string) => string;
  preheader: string;
  titulo: (nome: string) => string;
  /** Parágrafos do miolo. `{nome}` e `{preco}` são trocados na montagem. */
  corpo: string[];
  botao: string;
};

// ── O DEGRAU 2 TEM DUAS VERSÕES, E ISSO É CONSERTO DE UMA MENTIRA ──
//
// O texto do degrau 2 diz, com todas as letras: "você foi embora antes da
// última parte" e "a gravação ficou pronta depois que você saiu".
//
// Isso é falso pra 81% de quem o recebe. Medido em 7 dias: 4.858 pessoas
// chegaram na letra e 3.947 delas TOCARAM a música (`musica_play`) — e
// praticamente todas bateram no corte da prévia (`preview_limite`). Elas não
// foram embora antes: elas ouviram, o áudio parou no refrão, e elas saíram.
//
// Contar pra alguém uma história que ela sabe que não aconteceu é o jeito
// mais barato de perder a única coisa que este e-mail tem — ser verdadeiro
// sobre algo que ela viveu dez minutos antes.
//
// A versão de baixo fala do que ELA de fato viveu: o corte. E o argumento
// deixa de ser "ficou pronta" (que ela já sabe) e passa a ser o que ela ainda
// não ouviu — o fim da música, e a segunda gravação, que ela nem sabia que
// existia.
const PASSO_2_OUVIU: Passo = {
  assunto: (n) => `O resto da música de ${n}`,
  preheader: "Você ouviu até o refrão. Ela não termina ali.",
  titulo: (n) => `Você parou no melhor pedaço da música de ${n}`,
  corpo: [
    "A prévia corta no refrão de propósito, e é uma escolha meio cruel: é exatamente onde a música começa a virar o que ela é.",
    "O que vem depois você ainda não ouviu — o segundo verso, a parte em que o nome de {nome} volta, e o fim.",
    "E tem uma coisa que a prévia não mostra: existem DUAS gravações da sua letra, com interpretações diferentes. Você escolhe qual delas vai tocar quando {nome} abrir o link.",
  ],
  botao: "Ouvir a música inteira",
};

const PASSOS: Record<DegrauEscada, Passo> = {
  // ── R$ 38 · o preço cheio segura três e-mails ──
  2: {
    assunto: (n) => `A letra que você escreveu pra ${n} está pronta`,
    preheader: "A gravação ficou pronta depois que você saiu.",
    titulo: (n) => `A música de ${n} terminou de ser gravada`,
    corpo: [
      "Você escreveu a história, escolheu o refrão e foi embora antes da última parte — a hora em que aquilo vira música de verdade, com voz, violão e o nome de {nome} sendo cantado.",
      "Ela ficou pronta alguns minutos depois. Está guardada, do jeito que você deixou.",
      "É a mesma letra que você leu. Nada foi trocado.",
    ],
    botao: "Ouvir a música de {nome}",
  },
  3: {
    assunto: (n) => `O que acontece quando ${n} ouvir`,
    preheader: "O presente não é o arquivo. É o momento.",
    titulo: () => "Presente que ninguém mais deu",
    corpo: [
      "Toda pessoa já ganhou perfume, chocolate, uma caneca. Ninguém nunca ganhou uma música em que a própria história é cantada — com o detalhe que só você sabia contar.",
      "O que {nome} vai receber é um link. Ela abre no celular, aparece o nome dela, e a música começa.",
      "Os primeiros dez segundos são a parte que a gente mais ouve falar. É quando a pessoa entende que aquilo é sobre ela.",
    ],
    botao: "Terminar o presente de {nome}",
  },
  4: {
    assunto: (n) => `Duas linhas da música de ${n}`,
    preheader: "Escritas a partir do que você contou.",
    titulo: () => "Isto aqui é seu",
    corpo: [
      "Estas duas linhas saíram da história que você escreveu. Não existem em nenhuma outra música do mundo:",
      "{verso}",
      "O resto está lá, cantado. Faltam dois minutos pra {nome} ouvir.",
    ],
    botao: "Ouvir a música inteira",
  },

  // ── R$ 29 · o primeiro degrau ──
  5: {
    assunto: () => "Não quero que o preço seja o motivo",
    preheader: "R$ 29 em vez de R$ 38.",
    titulo: () => "Se foi o preço, resolve assim",
    corpo: [
      "Você chegou até o fim e parou. Pode ter sido o momento, pode ter sido o valor — daqui eu não tenho como saber.",
      "Se foi o valor: <strong>{preco}</strong>, pelo mesmo presente. A música já está gravada, é a mesma.",
      "Se foi o momento, ignora este e-mail. Ela continua guardada.",
    ],
    botao: "Levar por {preco}",
  },
  6: {
    assunto: (n) => `O que sobra depois que ${n} abrir`,
    preheader: "Presente que não acaba na semana seguinte.",
    titulo: () => "Daqui a um ano ainda vai estar lá",
    corpo: [
      "Flor murcha em quatro dias. Bombom acaba na mesma noite. O link da música de {nome} continua funcionando no ano que vem, e no outro.",
      "As pessoas voltam a ouvir. É o tipo de coisa que fica no favoritos do celular.",
      "Ainda está por <strong>{preco}</strong>.",
    ],
    botao: "Terminar por {preco}",
  },

  // ── R$ 19 ──
  7: {
    assunto: () => "R$ 19 e o presente está feito",
    preheader: "Menos que um lanche.",
    titulo: () => "Menos que um lanche de sexta",
    corpo: [
      "Não vou fingir que este é o preço normal — não é. É o que eu consigo fazer pra essa música não ficar parada num servidor pra sempre.",
      "<strong>{preco}</strong>, e o link de {nome} sai hoje.",
      "A gravação, a página com o nome dela e o arquivo pra baixar. Tudo que estava lá desde o começo.",
    ],
    botao: "Levar por {preco}",
  },
  8: {
    assunto: (n) => `Alguém precisa entregar isso pra ${n}`,
    preheader: "Você é a única pessoa que pode.",
    titulo: () => "Ninguém mais sabe essa história",
    corpo: [
      "Essa música existe porque você sentou e contou uma coisa que só você sabia. Se ela não for entregue, ninguém mais vai escrever de novo — nem você daqui a seis meses, porque a gente esquece o detalhe.",
      "É por isso que eu insisto. Não é pelo valor, que a essa altura é <strong>{preco}</strong>.",
      "É porque {nome} não vai ganhar isso de mais ninguém.",
    ],
    botao: "Entregar pra {nome} · {preco}",
  },

  // ── R$ 9 · o fim da escada ──
  9: {
    assunto: () => "R$ 9 — o menor que dá pra fazer",
    preheader: "Não tem degrau depois deste.",
    titulo: () => "Este é o último preço",
    corpo: [
      "<strong>{preco}</strong>. Abaixo disso a taxa do cartão come o que sobra, então é honestamente onde acaba.",
      "A música de {nome} está gravada desde o dia em que você escreveu a letra. Só falta alguém apertar o botão.",
      "Se ainda assim não for a hora, tudo bem — é só ignorar.",
    ],
    botao: "Levar por {preco}",
  },
  10: {
    assunto: (n) => `Tem alguma data chegando pra ${n}?`,
    preheader: "Guarda o link e usa quando for a hora.",
    titulo: () => "Não precisa entregar hoje",
    corpo: [
      "Aniversário, Dia das Mães, um domingo qualquer em que ela estiver pra baixo. O link não expira, e você escolhe o dia de mandar.",
      "Muita gente compra semanas antes e guarda. Funciona melhor assim, inclusive — presente entregue na data certa acerta mais forte.",
      "Continua <strong>{preco}</strong>.",
    ],
    botao: "Garantir por {preco}",
  },
  11: {
    assunto: () => "Último e-mail sobre essa música",
    preheader: "Depois deste eu paro de escrever.",
    titulo: () => "É o último que eu mando",
    corpo: [
      "Este é o décimo e último e-mail sobre a música de {nome}. Depois dele eu paro — você não precisa fazer nada pra isso acontecer.",
      "A letra continua sendo sua. Se um dia quiser, o link abaixo funciona por <strong>{preco}</strong>.",
      "Obrigado por ter escrito a história. Ela ficou boa mesmo que ninguém nunca ouça.",
    ],
    botao: "Ouvir antes de sumir",
  },
};

const trocar = (t: string, nome: string, preco: string) =>
  t.replaceAll("{nome}", nome).replaceAll("{preco}", preco);

/** O passo do degrau, já escolhendo a versão certa do 2. */
function passoDe(numero: DegrauEscada, ouviu?: boolean): Passo {
  if (numero === 2 && ouviu) return PASSO_2_OUVIU;
  return PASSOS[numero];
}

export function assuntoEscada(numero: DegrauEscada, nome: string, ouviu?: boolean): string {
  return trocar(passoDe(numero, ouviu).assunto(nome), nome, OFERTA[numero].texto);
}

export function emailEscada(args: {
  numero: DegrauEscada;
  nome: string;
  /** Link de compra já com `src` e e-mail. Ver `linkDeCompra`. */
  link: string;
  linkDescadastro: string;
  /** Duas linhas da letra dela. Só o degrau 4 usa; sem elas, ele cai no genérico. */
  verso?: string | null;
  /** Esta pessoa TOCOU a prévia? Só o degrau 2 usa. Ver `PASSO_2_OUVIU`. */
  ouviu?: boolean;
}): string {
  const passo = passoDe(args.numero, args.ouviu);
  const preco = OFERTA[args.numero].texto;
  const nome = args.nome || "essa pessoa";

  const paragrafo = (t: string) => `<p style="margin:0 0 14px;">${trocar(t, nome, preco)}</p>`;

  const miolo = passo.corpo
    .map((t) => {
      if (t !== "{verso}") return paragrafo(t);
      // O VERSO DELA, quando existe. É a única coisa neste e-mail que nenhum
      // concorrente consegue mandar — e por isso ele vai em destaque, não
      // como mais um parágrafo.
      if (!args.verso) {
        return paragrafo("A letra inteira está guardada, do jeito que você deixou.");
      }
      return `<p style="margin:0 0 14px;padding:14px 18px;background:#faf5ee;border-left:3px solid #7d2b3a;border-radius:8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#2a1518;font-style:italic;">${args.verso.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return moldura({
    locale: "pt",
    preheader: passo.preheader,
    titulo: trocar(passo.titulo(nome), nome, preco),
    miolo,
    botao: trocar(passo.botao, nome, preco),
    link: args.link,
    linkDescadastro: args.linkDescadastro,
  });
}
