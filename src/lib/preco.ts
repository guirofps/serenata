import { type Locale, LOCALE_PADRAO, MOEDA } from "@/lib/i18n";
import {
  EXPERIMENTOS,
  type Plano,
  varianteDe,
  configAtual,
  type ExperimentoConfigPublica,
} from "@/lib/experimentos";

// O PREÇO, QUANDO ELE É A COISA SENDO TESTADA.
//
// Até 18/08 o preço era um valor só, em `MOEDA` (`i18n.ts`), e o checkout era
// um link só, em `checkout.ts`. Isso basta enquanto o preço é uma decisão. No
// momento em que ele vira uma PERGUNTA, três coisas passam a ter que andar
// juntas, e é o desalinhamento entre elas que estraga o teste:
//
//   1. o número que a pessoa LÊ na tela,
//   2. o produto da Perfect Pay que ela ABRE no clique,
//   3. o valor que o Google Ads APRENDE quando ela compra.
//
// Se (1) e (2) divergem, a pessoa lê 38 e o caixa cobra 47 — que é
// exatamente o problema do checkout internacional (US$ 9 anunciado, US$ 9,68
// cobrado) que já custou vendas aqui. Se (3) diverge, o Google otimiza a
// campanha em cima de um faturamento que não aconteceu, e aí o teste não só
// não mede: ele estraga a máquina que traz o tráfego.
//
// Por isso o plano é UM objeto. Não há como mexer no preço da tela e esquecer
// do link, porque são o mesmo registro.
//
// ── A VARIANTE NÃO PODE SER LIDA NO SERVIDOR ──────────────────────
//
// `/criar?step=oferta` é uma URL de verdade: reload, botão voltar e o link do
// e-mail de recuperação caem direto nela, renderizada no servidor. E o
// servidor não sabe qual variante esta pessoa tirou — o sorteio mora no
// navegador dela.
//
// Então o preço na TELA vai por `<Variante>` (as duas versões no HTML, o CSS
// esconde a perdedora antes do primeiro pixel). O preço no COMPORTAMENTO (o
// link do checkout, o valor da conversão) vai por `varianteDePreco()`, que só
// roda em handler e em efeito — depois da hidratação, quando o atributo já
// está no <html>. Misturar os dois é o caminho da piscada.

export const EXP_PRECO = "preco";

// `Plano` mudou de dono: agora vive em `experimentos.ts`, junto com
// `ExperimentoConfig` (a config que vem do banco — ver a nota lá sobre o
// ciclo que isso evita). Reexportado daqui pra não quebrar quem já importa
// `Plano` de `preco.ts`.
export type { Plano } from "@/lib/experimentos";

/**
 * Um plano por variante, por idioma.
 *
 * A chave TEM que bater com `variantes` do experimento `preco` em
 * `experimentos.ts`. Variante sem plano cai no controle, que é feio mas nunca
 * cobra errado.
 */
export const PLANOS: Record<Locale, Record<string, Plano>> = {
  pt: {
    // A = CONTROLE. É o preço e o link que já estavam vendendo, e é ele que
    // aparece pra quem não foi sorteado, pra quem está sem JavaScript e pro
    // servidor. Não mexer nele durante o teste: é a régua.
    A: {
      texto: MOEDA.pt.texto,
      valor: MOEDA.pt.valor,
      ancora: MOEDA.pt.ancora,
      checkout: "https://go.perfectpay.com.br/PPU38CQER4D",
    },
    // OS QUATRO PREÇOS EM TESTE.
    //
    // Todos são PLANOS DO MESMO PRODUTO na Perfect Pay, não produtos novos, e
    // isso não é detalhe de cadastro: `reconhecerOferta` (creditos.ts) tem um
    // fallback que reconhece upsell POR VALOR, com R$ 28, R$ 67 e R$ 24,90
    // cadastrados. Um PRODUTO novo cujo preço caísse num desses seria
    // classificado como compra de crédito, sairia cedo no webhook e nunca
    // entregaria a música. Como o `product.code` continua sendo o principal,
    // a checagem devolve null antes de chegar no fallback.
    //
    // Os cinco valores foram conferidos ABRINDO o checkout, não pelo painel:
    // o "Total Hoje" de cada tela bate com o `texto` daqui. É a única prova
    // que interessa, porque é a que o comprador vê.
    B: {
      texto: "R$ 19",
      valor: 19,
      ancora: MOEDA.pt.ancora,
      checkout: "https://go.perfectpay.com.br/PPU38CQFF7H",
    },
    C: {
      texto: "R$ 9",
      valor: 9,
      // ÂNCORA MENOR SÓ AQUI, e não é capricho de design.
      //
      // R$ 97 riscado contra R$ 9 é 91% de desconto na tela. O CLAUDE.md
      // registra que o Google Ads é rígido com alegação, e desconto desse
      // tamanho é o tipo de número que chama revisão — além de soar a golpe
      // pra quem lê. R$ 49,90 mantém a ancoragem de pé sem a alegação
      // absurda.
      //
      // Consequência pra leitura do teste: este braço tem UMA variável a mais
      // que os outros quatro (preço E âncora). Se ele vencer, não dá pra
      // creditar o resultado só ao preço.
      ancora: "R$ 49,90",
      checkout: "https://go.perfectpay.com.br/PPU38CQFF7I",
    },
    D: {
      texto: "R$ 29",
      valor: 29,
      ancora: MOEDA.pt.ancora,
      checkout: "https://go.perfectpay.com.br/PPU38CQFF7J",
    },
    E: {
      texto: "R$ 54,90",
      valor: 54.9,
      ancora: MOEDA.pt.ancora,
      checkout: "https://go.perfectpay.com.br/PPU38CQFF7K",
    },
  },
  // O ESPANHOL FICA DE FORA DO TESTE, de propósito.
  //
  // Volume pequeno e problema próprio (507 leads e uma venda em três dias):
  // dividir esse tráfego em dois não produz número legível, só atrasa as duas
  // leituras. Um plano só, que é o de hoje.
  es: {
    A: {
      texto: MOEDA.es.texto,
      valor: MOEDA.es.valor,
      ancora: MOEDA.es.ancora,
      checkout: "https://go.centerpag.com/PPU38CQF4HJ",
    },
  },
};

// ── A CONFIG VIVA, NÃO O CATÁLOGO EM CÓDIGO ───────────────────────
//
// Até aqui `PLANOS` era a única fonte: código, deploy pra mudar um preço.
// A Task 4 já publica o plano de cada variante dentro de `window.__SRN_CFG__`
// (ver `Variante.plano` e `projetarParaPublico` em `experimentos.ts`) — não
// existe um segundo canal a criar aqui, `configAtual()` já é isomórfica
// (servidor lê o snapshot do banco, cliente lê o que o servidor plantou) e
// já é a MESMA função que `RootShell` usa pra gerar `scriptExperimentos` e
// `cssExperimentos`. Ler qualquer coisa diferente disto aqui reabriria o
// defeito que a Task 4 fechou: dois lugares afirmando "isto é o experimento
// preco" e podendo divergir.

/**
 * O experimento `preco`, tal como a config viva o publicou — ativo ou não,
 * com plano em cada variante ou não. Não filtra nada por conta própria:
 * é a MESMA leitura que `cssExperimentos` faz (`__root.tsx` passa o mesmo
 * `configAtual()` pras duas funções). Ver `variantesComPlano` mais abaixo
 * pra por que essa igualdade importa.
 */
function experimentoPrecoDaConfig(): ExperimentoConfigPublica | undefined {
  return configAtual().find((e) => e.id === EXP_PRECO);
}

/**
 * Os planos que a config viva anexou às variantes de `preco`, indexados por
 * nome, na ordem em que a config as declara (a primeira é sempre o
 * controle).
 *
 * `null` em dois casos que se resolvem da mesma forma: nenhuma leitura de
 * banco chegou ainda — `configAtual()` caiu no `configDoCodigo()` de
 * `experimentos.ts`, que monta variante SEM `plano`, de propósito, porque o
 * array `Experimento` em código nunca teve esse campo — ou o experimento na
 * config real não tem preço cadastrado em variante nenhuma. Nos dois, o
 * catálogo em código (`PLANOS`) é a resposta certa, porque ele É o controle.
 */
function planosDaConfig(): Record<string, Plano> | null {
  const exp = experimentoPrecoDaConfig();
  if (!exp?.variantes?.length) return null;
  const out: Record<string, Plano> = {};
  for (const v of exp.variantes) if (v.plano) out[v.nome] = v.plano;
  return Object.keys(out).length ? out : null;
}

/**
 * O controle do idioma: o que vale sem sorteio, sem JavaScript e no
 * servidor.
 *
 * Em português, primeiro tenta o preço que a variante-controle tem na config
 * viva; sem isso (config ausente, ou o próprio controle sem plano
 * cadastrado — configuração incompleta, não motivo pra inventar preço), cai
 * no catálogo em código. Fora do português não há config de preço: sempre o
 * catálogo.
 */
export function planoControle(locale: Locale = LOCALE_PADRAO): Plano {
  if (locale === "pt") {
    const nomeControle = experimentoPrecoDaConfig()?.variantes[0]?.nome;
    const plano = nomeControle ? planosDaConfig()?.[nomeControle] : undefined;
    if (plano) return plano;
  }
  const doIdioma = PLANOS[locale] ?? PLANOS.pt;
  return doIdioma.A;
}

/** O plano de uma variante nomeada. Desconhecida cai no controle. */
export function planoDe(locale: Locale, variante: string): Plano {
  if (locale === "pt") {
    const daConfig = planosDaConfig();
    if (daConfig) return daConfig[variante] ?? planoControle(locale);
  }
  const doIdioma = PLANOS[locale] ?? PLANOS.pt;
  return doIdioma[variante] ?? doIdioma.A;
}

/**
 * As variantes que renderizam preço na tela.
 *
 * Lê a MESMA config que `cssExperimentos` usa pra decidir o que esconder —
 * as duas passam por `configAtual()` (`experimentos.ts`), então a lista de
 * `<Variante>` que esta função autoriza a aparecer nunca fica maior que a
 * lista de regras `display:none` que o CSS escreveu: qualquer nome que saia
 * daqui já teve sua regra de esconder gerada a partir da mesma leitura.
 *
 * Antes desta task as duas listas vinham de lugares diferentes — esta função
 * do array `EXPERIMENTOS` em código, `cssExperimentos` da config do banco —
 * e só coincidiam enquanto ninguém mexesse numa sem mexer na outra. Foi
 * esse desalinhamento (uma variante declarada de um lado e não do outro)
 * que publicou um braço pra 100% do tráfego ao desligar um experimento, em
 * 10/08. Ler a mesma fonte fecha essa classe de bug de vez — não tem mais
 * "esquecer de manter as duas em sincronia" possível, porque não há duas.
 *
 * Ainda cruza com "tem plano": variante que a config declarou mas ainda não
 * precificou não vira bloco na tela — melhor não renderizar do que
 * renderizar sem preço. Sem config viva, cai no cruzamento equivalente
 * feito em cima do catálogo em código, que é o que sempre existiu aqui.
 */
export function variantesComPlano(locale: Locale): string[] {
  if (locale === "pt") {
    const daConfig = planosDaConfig();
    if (daConfig) return Object.keys(daConfig);
  }
  const planos = PLANOS[locale] ?? PLANOS.pt;
  const exp = EXPERIMENTOS.find((e) => e.id === EXP_PRECO);
  if (!exp) return ["A"];
  return exp.variantes.filter((v) => planos[v]);
}

/**
 * A variante DESTA pessoa, já com as duas exceções aplicadas.
 *
 * `temCupom` é a primeira: quem chega pelo e-mail de recuperação vem com um
 * cupom que a Perfect Pay só conhece no produto do controle, e o e-mail já
 * prometeu um número exato ("de R$ 38 por R$ 28"). Mandar essa pessoa pro
 * produto em teste quebraria o cupom no caixa ou entregaria um desconto
 * diferente do prometido. São poucas pessoas (285 e-mails, 3 vendas), e vale
 * mais tirá-las do teste do que arriscar o único caminho que já tem promessa
 * escrita.
 *
 * O idioma é a segunda: fora do português não há segundo plano.
 *
 * NO SERVIDOR devolve o controle, sempre. Ver a nota no topo do arquivo.
 */
export function varianteDePreco(
  locale: Locale = LOCALE_PADRAO,
  opcoes?: { temCupom?: boolean },
): string {
  if (locale !== "pt") return "A";
  if (opcoes?.temCupom) return "A";
  const v = varianteDe(EXP_PRECO);
  return PLANOS.pt[v] ? v : "A";
}

/** O plano completo desta pessoa. É por aqui que checkout e conversão passam. */
export function meuPlano(locale: Locale = LOCALE_PADRAO, opcoes?: { temCupom?: boolean }): Plano {
  return planoDe(locale, varianteDePreco(locale, opcoes));
}
