import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  Automacao,
  EmailDaAutomacao,
  EstatisticaTemplate,
  PainelAutomacoes,
  PreviewEmail,
} from "@/lib/automacoes";
import {
  DEGRAUS,
  ESPERA_H,
  OFERTA,
  assuntoEscada,
  emailEscada,
  type DegrauEscada,
} from "../../emails/escada";
import { assuntoSequencia, emailSequencia, type NumeroDaSequencia } from "../../emails/sequencia";
import { assuntoLetraPronta, emailLetraPronta } from "../../emails/letra-pronta";
import { assuntoQuaseComprou, emailQuaseComprou } from "../../emails/quase-comprou";
import { assuntoPixNaoPago, emailPixNaoPago } from "../../emails/pix-nao-pago";
import { assuntoPresentePronto, emailPresentePronto } from "../../emails/presente-pronto";
import { assuntoEmProducao, emailEmProducao } from "../../emails/entrega-em-producao";
import { assuntoLembrete, emailLembretePresente } from "../../emails/lembrete-presente";
import { assuntoGuardeOLink, emailGuardeOLink } from "../../emails/guarde-o-link";
import { assuntoQuadro, emailQuadro } from "../../emails/quadro-na-parede";
import { assuntoVolteCriar, emailVolteCriar } from "../../emails/volte-criar";
import { assuntoQuadroParado, emailQuadroParado } from "../../emails/quadro-parado";
import { assuntoCreditoParado, emailCreditoParado } from "../../emails/credito-parado";

// O CATÁLOGO DAS AUTOMAÇÕES DE E-MAIL, do jeito que elas rodam hoje.
//
// ── POR QUE ISTO É UM ARQUIVO E NÃO UMA CONSULTA ─────────────────
//
// Nenhuma tabela sabe quais réguas existem. Cada uma é uma função do Inngest
// com o próprio cron, a própria janela e o próprio texto, espalhadas em doze
// arquivos. Quem quisesse saber "o que sai, pra quem e quando" tinha que ler
// os doze — e o painel só mostrava os e-mails que já tinham saído, sem dizer
// de qual régua eram nem em que ordem.
//
// Este arquivo é o mapa. Ele lista as réguas na ordem em que a pessoa as
// encontra (antes de comprar → na compra → depois da compra), liga cada
// e-mail à etiqueta gravada em `emails_enviados.template` — a chave que junta
// o texto ao número — e sabe renderizar cada um com dados de exemplo.
//
// ── O QUE ELE NÃO É ──────────────────────────────────────────────
//
// Não é a fonte da verdade sobre a CADÊNCIA. A verdade mora nas constantes de
// cada função (`MIN_DIAS`, `ESPERA_H`...). Este arquivo as descreve pra gente
// ler; quando alguém mexer numa constante lá, tem que mexer na frase aqui. O
// teste `automacoes.test.ts` confere ao menos que toda etiqueta que as funções
// gravam aparece neste mapa, e que todo template do mapa renderiza.
//
// ── SÓ NO SERVIDOR ───────────────────────────────────────────────
//
// O sufixo `.server` é a regra: este arquivo importa os templates de `emails/`
// e não pode entrar no bundle do cliente. A aba recebe o catálogo e o HTML já
// prontos, pela server function em `admin-dados.ts`.

/** Horas → texto curto ("24h", "3 dias"). */
function horas(h: number): string {
  if (h < 24) return `${h}h`;
  const d = h / 24;
  return Number.isInteger(d) ? `${d} dia${d > 1 ? "s" : ""}` : `${h}h`;
}

/**
 * Os dez degraus da escada, lidos da tabela que a régua usa de verdade.
 *
 * O degrau 2 tem DUAS versões (a pessoa tocou a prévia ou não), e elas são
 * duas etiquetas de propósito: o texto é outro, e o painel precisa mostrar
 * as duas em linhas separadas pra dizer qual funciona.
 */
function degrausDaEscada(): EmailDaAutomacao[] {
  const acumulado: Record<number, number> = {};
  let soma = 0;
  for (const n of DEGRAUS) {
    soma += ESPERA_H[n];
    acumulado[n] = soma;
  }
  const quando = (n: DegrauEscada) =>
    `${horas(ESPERA_H[n])} depois do anterior · ${horas(acumulado[n])} desde a letra · ${OFERTA[n].texto}`;

  const fora: EmailDaAutomacao[] = [];
  for (const n of DEGRAUS) {
    if (n === 2) {
      fora.push({
        template: "escada_2",
        nome: "2 · A música ficou pronta",
        quando: quando(2) + " · não tocou a prévia",
        idiomas: ["pt", "es"],
      });
      fora.push({
        template: "escada_2ouviu",
        nome: "2 · O resto da música (tocou a prévia)",
        quando: quando(2) + " · tocou a prévia",
        idiomas: ["pt"],
      });
      continue;
    }
    fora.push({
      template: `escada_${n}`,
      nome: `${n} · ${assuntoEscada(n, "{nome}")}`,
      quando: quando(n),
      // A escada é só em português. Em espanhol a régua para no 4, com o
      // texto de `sequencia.ts`, e usa a MESMA etiqueta — então os números de
      // `escada_3` e `escada_4` misturam os dois idiomas.
      idiomas: n <= 4 ? ["pt", "es"] : ["pt"],
    });
  }
  return fora;
}

export const AUTOMACOES: Automacao[] = [
  // ── ANTES DE COMPRAR ─────────────────────────────────────────
  {
    id: "mandar-letra",
    nome: "Letra pronta",
    fase: "antes",
    gatilho: "a cada 5 min",
    quemRecebe:
      "Quem terminou o quiz e deixou e-mail, 20 min depois. É a entrega do que o quiz prometeu, não é marketing.",
    remetente: "transacional",
    arquivo: "inngest/functions/mandarLetra.ts",
    emails: [
      {
        template: "letra_pronta",
        nome: "1 · A letra que você escreveu",
        quando: "20 min depois de terminar o quiz",
        idiomas: ["pt", "es"],
      },
    ],
  },
  {
    id: "sequencia-recuperacao",
    nome: "Escada de recuperação",
    fase: "antes",
    gatilho: "a cada 30 min",
    quemRecebe:
      "Quem recebeu a letra e não comprou, por até 45 dias. Dez degraus, de R$ 38 a R$ 9. Degrau com desconto só sai pra quem abriu ou clicou algum e-mail antes.",
    quemNao:
      "Quem comprou, quem se descadastrou, quem gerou PIX ou clicou em comprar (esses têm régua própria).",
    remetente: "recuperacao",
    arquivo: "inngest/functions/sequenciaRecuperacao.ts · emails/escada.ts",
    emails: degrausDaEscada(),
  },
  {
    id: "quase-comprou",
    nome: "Quase comprou",
    fase: "antes",
    gatilho: "de hora em hora (aos 50 min)",
    quemRecebe:
      "Quem clicou em comprar e não gerou pedido nenhum, entre 30 min e 48h depois do clique. Um só por pessoa.",
    quemNao: "Quem gerou PIX (é do 'PIX não pago'). Quem pagou.",
    remetente: "recuperacao",
    arquivo: "inngest/functions/quaseComprou.ts",
    emails: [
      {
        template: "quase_comprou",
        nome: "Você parou na porta",
        quando: "30 min depois do clique em comprar",
        idiomas: ["pt", "es"],
      },
    ],
  },
  {
    id: "pix-nao-pago",
    nome: "PIX não pago",
    fase: "antes",
    gatilho: "a cada 30 min",
    quemRecebe:
      "Quem gerou o código PIX e não pagou, 10 min depois. Um segundo toque 48h depois do primeiro. Janela de 72h, teto de dois toques.",
    remetente: "transacional",
    arquivo: "inngest/functions/pixNaoPago.ts",
    emails: [
      {
        template: "pix_nao_pago",
        nome: "Seu PIX está aqui",
        quando: "10 min depois de gerar o PIX · repete uma vez 48h depois",
        idiomas: ["pt", "es"],
      },
    ],
  },

  // ── A COMPRA ─────────────────────────────────────────────────
  {
    id: "webhook-pagamento",
    nome: "Entrega",
    fase: "compra",
    gatilho: "webhook do gateway (Woovi, Asaas, Perfect Pay)",
    quemRecebe:
      "Quem pagou. Sai no instante da confirmação. Se a música ainda está gravando, sai a versão 'em produção' e a entrega vem quando ficar pronta.",
    remetente: "transacional",
    arquivo: "api/lib/entrega.ts · src/lib/usar-credito.ts",
    emails: [
      {
        template: "entrega",
        nome: "O presente está pronto",
        quando: "no pagamento, com a música pronta",
        idiomas: ["pt", "es"],
      },
      {
        template: "entrega_em_producao",
        nome: "Pagamento confirmado, gravando",
        quando: "no pagamento, quando a música ainda não terminou",
        idiomas: ["pt", "es"],
      },
      {
        template: "entrega_credito",
        nome: "O presente está pronto (crédito)",
        quando: "quando a pessoa usa um crédito comprado antes",
        idiomas: ["pt", "es"],
      },
    ],
  },

  // ── DEPOIS DA COMPRA ─────────────────────────────────────────
  {
    id: "lembrar-presente",
    nome: "Lembrete: monte o presente",
    fase: "depois",
    gatilho: "de hora em hora",
    quemRecebe: "Quem pagou entre 3h e 96h atrás e ainda não abriu o editor. Um só.",
    quemNao: "Quem já montou (esse recebe o 'Guarde o link').",
    remetente: "transacional",
    arquivo: "inngest/functions/lembrarPresente.ts",
    emails: [
      {
        template: "lembrar_presente",
        nome: "O presente está esperando você montar",
        quando: "3h depois da compra, sem montar",
        idiomas: ["pt", "es"],
      },
    ],
  },
  {
    id: "guarde-o-link",
    nome: "Guarde o link",
    fase: "depois",
    gatilho: "de hora em hora (aos 20 min)",
    quemRecebe:
      "Quem pagou há 3 a 20 dias e MONTOU o presente. Um só, com a palavra 'links' no assunto pra achar na busca meses depois.",
    remetente: "transacional",
    arquivo: "inngest/functions/guardeOLink.ts",
    emails: [
      {
        template: "guarde_o_link",
        nome: "Seus links",
        quando: "3 dias depois da compra",
        idiomas: ["pt", "es"],
      },
    ],
  },
  {
    id: "oferta-quadro",
    nome: "Oferta do quadro",
    fase: "depois",
    gatilho: "de hora em hora, 10h–19h (aos 40 min)",
    quemRecebe:
      "Quem pagou há 7 a 30 dias e montou o presente. O link leva pro editor, não pro checkout. Teto de 6 por rodada.",
    quemNao: "Quem já comprou o quadro. Quem nunca montou.",
    remetente: "recuperacao",
    arquivo: "inngest/functions/ofertaQuadro.ts",
    emails: [
      {
        template: "oferta_quadro",
        nome: "A música na parede",
        quando: "7 dias depois da compra",
        idiomas: ["pt", "es"],
      },
    ],
  },
  {
    id: "volte-criar",
    nome: "Volte a criar",
    fase: "depois",
    gatilho: "de hora em hora, 9h–20h (aos 30 min)",
    quemRecebe:
      "Quem pagou há 5 a 30 dias. Convite pra criar a próxima música. Um só, pra sempre. Teto de 15 por rodada.",
    remetente: "recuperacao",
    arquivo: "inngest/functions/volteCriar.ts",
    emails: [
      {
        template: "volte_criar",
        nome: "A próxima música",
        quando: "5 dias depois da compra",
        idiomas: ["pt", "es"],
      },
    ],
  },
  {
    id: "quadro-parado",
    nome: "Quadro pago e não montado",
    fase: "depois",
    gatilho: "de hora em hora, 11h–20h (aos 20 min)",
    quemRecebe:
      "Quem pagou o quadro há mais de 20h e não escolheu de qual música ele é. Sete dias de silêncio por pessoa.",
    remetente: "transacional",
    arquivo: "inngest/functions/quadroParado.ts",
    emails: [
      {
        template: "quadro_parado",
        nome: "Seu quadro está esperando",
        quando: "20h depois de pagar o quadro",
        idiomas: ["pt", "es"],
      },
    ],
  },
  {
    id: "credito-parado",
    nome: "Crédito pago e não usado",
    fase: "depois",
    gatilho: "de hora em hora, 11h–20h (aos 50 min)",
    quemRecebe:
      "Quem comprou crédito há mais de 48h e não fez o quiz da próxima música. Sete dias de silêncio por pessoa.",
    remetente: "transacional",
    arquivo: "inngest/functions/creditoParado.ts",
    emails: [
      {
        template: "credito_parado",
        nome: "Seu crédito está esperando",
        quando: "48h depois de comprar o crédito",
        idiomas: ["pt", "es"],
      },
    ],
  },
];

/** Todas as etiquetas que o catálogo conhece, na ordem em que aparecem. */
export const TEMPLATES_CONHECIDOS: string[] = AUTOMACOES.flatMap((a) =>
  a.emails.map((e) => e.template),
);

// ── AS ESTATÍSTICAS ──────────────────────────────────────────────

/**
 * O que saiu e o que voltou, por template, no período.
 *
 * Nunca lança: a aba precisa desenhar o catálogo e os previews mesmo quando
 * o banco não responde, e a razão da falha vai em `avisos`, com o mesmo
 * destaque do número. Painel que esconde a própria lacuna é pior que nenhum.
 */
export async function carregarAutomacoes(janela: {
  inicio: Date;
  fim: Date;
}): Promise<PainelAutomacoes> {
  const avisos: string[] = [];
  let linhas: EstatisticaTemplate[] = [];
  try {
    const { data, error } = await supabaseAdmin().rpc("admin_automacoes_resumo", {
      p_desde: janela.inicio.toISOString(),
      p_ate: janela.fim.toISOString(),
    });
    if (error) throw new Error(error.message);
    linhas = (data ?? []) as EstatisticaTemplate[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // A função ainda não existe no banco: é a migration que falta, e a aba
    // diz isso em vez de mostrar zero como se nada tivesse saído.
    avisos.push(
      /admin_automacoes_resumo/.test(msg) && /not find|does not exist|schema cache/i.test(msg)
        ? "As estatísticas dependem da função `admin_automacoes_resumo`, que ainda não está no banco. Rode a migration `20260905000000_admin_automacoes_resumo.sql`."
        : `As estatísticas não carregaram: ${msg}`,
    );
  }

  const conhecidos = new Set(TEMPLATES_CONHECIDOS);
  return {
    automacoes: AUTOMACOES,
    estatisticas: linhas.filter((l) => conhecidos.has(l.template)),
    desconhecidos: linhas.filter((l) => !conhecidos.has(l.template)),
    avisos,
  };
}

// ── O PREVIEW ────────────────────────────────────────────────────
//
// Renderiza o template DE VERDADE, com a mesma função que o job chama, e
// dados de exemplo. Não é uma cópia do HTML guardada em algum lugar: no dia
// em que alguém melhorar a copy, o preview muda junto, porque é o mesmo
// código. Os links apontam pro site com tokens de mentira, pra ninguém
// clicar num preview e cair na conta de alguém.

const SITE = "https://www.serenatagift.com";

const EXEMPLO = {
  nome: "Maria",
  titulo: "Pra Maria, com amor",
  letra:
    "Maria, você acorda antes do sol nascer\nCafé coado, o dia já quer começar\nDomingo de almoço, a casa inteira cheia\nÉ o seu jeito de amar",
  verso: "Maria, você acorda antes do sol nascer\nCafé coado, o dia já quer começar",
  linkPrevia: `${SITE}/retomar?exemplo=1`,
  linkEditor: `${SITE}/editar/exemplo`,
  linkPresente: `${SITE}/p/exemplo`,
  linkCheckout: `${SITE}/pix/exemplo`,
  linkCriar: `${SITE}/criar?src=exemplo`,
  linkDescadastro: `${SITE}/descadastrar?e=exemplo`,
  linkCredito: `${SITE}/credito/exemplo`,
  linkQuadro: `${SITE}/quadro/exemplo`,
  codigoPix:
    "00020126580014br.gov.bcb.pix0136exemplo-de-codigo-pix-copia-e-cola5204000053039865406380.005802BR5908Serenata6009Sao Paulo62070503***6304ABCD",
};

/**
 * Renderiza um template num idioma. Devolve `aviso` (e o PT) quando o
 * template não tem versão em espanhol, em vez de fingir que tem.
 */
export function renderizarPreview(template: string, locale: "pt" | "es"): PreviewEmail {
  const E = EXEMPLO;
  const l = locale;
  const pt = (assunto: string, html: string): PreviewEmail => ({ template, locale, assunto, html });

  // ── a escada: dez degraus em PT, e a sequência de três em ES ──
  const degrau = /^escada_(\d+)(ouviu)?$/.exec(template);
  if (degrau) {
    const n = Number(degrau[1]) as DegrauEscada;
    const ouviu = Boolean(degrau[2]);
    if (!DEGRAUS.includes(n)) return desconhecido(template, locale);
    if (l === "es") {
      if (n > 4 || ouviu) {
        return {
          ...renderizarPreview(template, "pt"),
          locale: "es",
          aviso: "Este degrau só existe em português: em espanhol a régua para no 4.",
        };
      }
      const num = n as NumeroDaSequencia;
      return pt(
        assuntoSequencia(num, E.nome, "es"),
        emailSequencia({
          numero: num,
          nome: E.nome,
          link: E.linkPrevia,
          linkDescadastro: E.linkDescadastro,
          locale: "es",
          verso: E.verso,
        }),
      );
    }
    return pt(
      assuntoEscada(n, E.nome, ouviu),
      emailEscada({
        numero: n,
        nome: E.nome,
        link: E.linkCheckout,
        linkDescadastro: E.linkDescadastro,
        verso: E.verso,
        ouviu,
      }),
    );
  }

  switch (template) {
    case "letra_pronta":
      return pt(
        assuntoLetraPronta(E.nome, l),
        emailLetraPronta({
          nome: E.nome,
          titulo: E.titulo,
          letra: E.letra,
          linkPrevia: E.linkPrevia,
          linkDescadastro: E.linkDescadastro,
          locale: l,
        }),
      );
    case "quase_comprou":
      return pt(
        assuntoQuaseComprou(E.nome, l),
        emailQuaseComprou({ nome: E.nome, titulo: E.titulo, link: E.linkPrevia, locale: l }),
      );
    case "pix_nao_pago":
      return pt(
        assuntoPixNaoPago(E.nome, l),
        emailPixNaoPago({
          nome: E.nome,
          titulo: E.titulo,
          linkCheckout: E.linkCheckout,
          codigo: E.codigoPix,
          locale: l,
        }),
      );
    case "entrega":
    case "entrega_credito":
      return pt(
        assuntoPresentePronto(E.nome, l),
        emailPresentePronto({
          nome: E.nome,
          titulo: E.titulo,
          linkEditor: E.linkEditor,
          linkPresente: E.linkPresente,
          locale: l,
        }),
      );
    case "entrega_em_producao":
      return pt(
        assuntoEmProducao(E.nome, l),
        emailEmProducao({ nome: E.nome, linkEditor: E.linkEditor, locale: l }),
      );
    case "lembrar_presente":
      return pt(
        assuntoLembrete(E.nome, l),
        emailLembretePresente({
          nome: E.nome,
          titulo: E.titulo,
          linkEditor: E.linkEditor,
          locale: l,
        }),
      );
    case "guarde_o_link":
      return pt(
        assuntoGuardeOLink(E.nome, l),
        emailGuardeOLink({
          nome: E.nome,
          titulo: E.titulo,
          linkEditor: E.linkEditor,
          linkPresente: E.linkPresente,
          locale: l,
        }),
      );
    case "oferta_quadro":
      return pt(
        assuntoQuadro(E.nome, l),
        emailQuadro({ nome: E.nome, titulo: E.titulo, link: E.linkEditor, locale: l }),
      );
    case "volte_criar":
      return pt(
        assuntoVolteCriar(E.nome, l),
        emailVolteCriar({
          nome: E.nome,
          linkCriar: E.linkCriar,
          linkDescadastro: E.linkDescadastro,
          locale: l,
        }),
      );
    case "quadro_parado":
      return pt(
        assuntoQuadroParado(l),
        emailQuadroParado({ link: E.linkQuadro, titulo: E.titulo, locale: l }),
      );
    case "credito_parado":
      return pt(
        assuntoCreditoParado(l),
        emailCreditoParado({ link: E.linkCredito, saldo: 1, locale: l }),
      );
    default:
      return desconhecido(template, locale);
  }
}

function desconhecido(template: string, locale: "pt" | "es"): PreviewEmail {
  return {
    template,
    locale,
    assunto: "",
    html: "",
    aviso: `O catálogo não sabe renderizar "${template}". Se é uma régua nova, ela precisa entrar em automacoes.server.ts.`,
  };
}
