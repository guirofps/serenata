import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// O ESPANHOL DA BALLAD GIFT (hispanos dos EUA, `/es` no balladgift.com).
//
// O mesmo código serve a Serenata, que no `/es` vende pra ARGENTINA em voseo,
// pela Perfect Pay, a US$ 9,90. Este arquivo cobra as duas pontas:
//
//   1. montado como o deploy da Ballad monta (env `VITE_MARCA=ballad` ANTES
//      de importar, com os módulos zerados, o padrão de `emails-ballad.test`):
//      `tú`, Stripe, US$ 19, e nada de Serenata, real, PIX, Perfect Pay,
//      Centerpag, WhatsApp ou travessão em nada que o cliente lê;
//   2. sem a env (a Serenata): tudo exatamente como era.
//
// `MARCA_ATIVA`, `LOCALE_PADRAO` e as copys são decididos na CARGA do módulo.
// Sem zerar os módulos, o teste veria a Serenata vestida de Ballad, que é um
// site que não existe.

const SITE = "https://www.balladgift.com";

// O que o cliente da Ballad nunca pode ler, em espanhol.
const PROIBIDOS = [
  "—",
  "R$",
  "PIX",
  "Pix",
  "WhatsApp",
  "Serenata",
  "serenatagift",
  "Perfect Pay",
  "Centerpag",
];

// Formas que só existem em voseo. Possessivo (`tu`, `tuya`) é igual nos dois.
const VOSEO = [
  /\bvos\b/i,
  /\bsos\b/i,
  /quer[ée]s\b/,
  /\bcontás/,
  /\bpod[ée]s\b/,
  /\bten[ée]s\b/,
  /\bmandás/,
  /\beleg[íi]s\b/,
  /\bescrib[íi]s\b/,
  /\brecib[íi]s\b/,
  /\bped[íi]s\b/,
  /\bprefer[íi]s\b/,
  /Escuchá/,
  /Guardá/,
  /Entrás/,
  // `\b` não enxerga letra acentuada como letra: depois do "á" vai lookahead.
  /\btocá(?=[\s.,;!?]|$)/i,
  /Respondé/,
  /Completá/,
  /\bcelu\b/,
  /\bacá(?=[\s.,;!?]|$)/,
  /\bllamás/,
];

function semProibidos(texto: string, onde: string) {
  for (const p of PROIBIDOS) expect(texto, `${onde}: não pode ter "${p}"`).not.toContain(p);
}

function semVoseo(texto: string, onde: string) {
  for (const v of VOSEO) expect(texto, `${onde}: voseo ${v}`).not.toMatch(v);
}

/** Tudo o que é texto dentro de um objeto de copy (strings e funções chamadas). */
function textoDe(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (typeof valor === "function") {
    try {
      return String((valor as (...a: unknown[]) => unknown)("Lupita", "Lupita"));
    } catch {
      return "";
    }
  }
  if (Array.isArray(valor)) return valor.map(textoDe).join("\n");
  if (valor && typeof valor === "object") return Object.values(valor).map(textoDe).join("\n");
  return "";
}

function linksDaBallad(html: string) {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) {
    expect(h.startsWith(`${SITE}/`) || h.startsWith("mailto:support@balladgift.com"), h).toBe(true);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 1. A BALLAD
// ─────────────────────────────────────────────────────────────────────

describe("na Ballad, o /es é dos hispanos dos EUA", () => {
  type M = {
    marca: typeof import("./marca-identidade");
    mercado: typeof import("./mercado-es");
    i18n: typeof import("./i18n");
    preco: typeof import("./preco");
    cupom: typeof import("./cupom");
    valor: typeof import("./valor-conversao");
    generos: typeof import("./generos");
    letra: typeof import("./letra-prompt");
    textos: typeof import("./textos");
    textosPresente: typeof import("./textos-presente");
    quiz: typeof import("./quiz-flow");
    seo: typeof import("./seo");
    oferta: typeof import("../components/quiz/oferta-es-eua");
    exemplos: typeof import("./exemplos-es-us");
    letraPronta: typeof import("../../emails/letra-pronta");
    sequencia: typeof import("../../emails/sequencia");
    presente: typeof import("../../emails/presente-pronto");
    producao: typeof import("../../emails/entrega-em-producao");
    lembrete: typeof import("../../emails/lembrete-presente");
    guarde: typeof import("../../emails/guarde-o-link");
    quase: typeof import("../../emails/quase-comprou");
    acesso: typeof import("../../emails/acesso");
    video: typeof import("../../emails/video-pronto");
  };
  let m: M;

  beforeAll(async () => {
    vi.stubEnv("VITE_MARCA", "ballad");
    vi.resetModules();
    m = {
      marca: await import("./marca-identidade"),
      mercado: await import("./mercado-es"),
      i18n: await import("./i18n"),
      preco: await import("./preco"),
      cupom: await import("./cupom"),
      valor: await import("./valor-conversao"),
      generos: await import("./generos"),
      letra: await import("./letra-prompt"),
      textos: await import("./textos"),
      textosPresente: await import("./textos-presente"),
      quiz: await import("./quiz-flow"),
      seo: await import("./seo"),
      oferta: await import("../components/quiz/oferta-es-eua"),
      exemplos: await import("./exemplos-es-us"),
      letraPronta: await import("../../emails/letra-pronta"),
      sequencia: await import("../../emails/sequencia"),
      presente: await import("../../emails/presente-pronto"),
      producao: await import("../../emails/entrega-em-producao"),
      lembrete: await import("../../emails/lembrete-presente"),
      guarde: await import("../../emails/guarde-o-link"),
      quase: await import("../../emails/quase-comprou"),
      acesso: await import("../../emails/acesso"),
      video: await import("../../emails/video-pronto"),
    };
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("a marca e o mercado: Ballad, EUA", () => {
    expect(m.marca.ehBallad()).toBe(true);
    expect(m.mercado.mercadoEs()).toBe("eua");
    expect(m.mercado.ehArgentina()).toBe(false);
  });

  it("o /es é espanhol (antes a Ballad tratava tudo como inglês), com tag es-US", () => {
    expect(m.i18n.localeDaRota("/es")).toBe("es");
    expect(m.i18n.localeDaRota("/es/criar")).toBe("es");
    expect(m.i18n.localeDaRota("/criar")).toBe("en");
    expect(m.i18n.localeDaRota("/estilos")).toBe("en");
    expect(m.i18n.caminho("/criar", "es")).toBe("/es/criar");
    expect(m.i18n.caminho("/criar", "en")).toBe("/criar");
    expect(m.i18n.tagIdioma("es")).toBe("es-US");
    expect(m.i18n.tagIdioma("en")).toBe("en-US");
  });

  it("o preço da tela é o do Stripe: US$ 19, o mesmo plano do inglês", () => {
    expect(m.i18n.moeda("es").texto).toBe("US$ 19");
    expect(m.i18n.moeda("es").valor).toBe(19);
    const controle = m.preco.planoControle("es");
    expect(controle.texto).toBe("US$ 19");
    expect(controle.valor).toBe(m.preco.planoControle("en").valor);
    expect(controle.checkout).toBe("stripe");
    for (const v of m.preco.variantesComPlano("es")) {
      const p = m.preco.planoDe("es", v);
      expect(p.texto.startsWith("US$ "), p.texto).toBe(true);
      expect(p.checkout).not.toContain("centerpag");
    }
    // O cobrável (o que o Stripe cobra) é o mesmo número da tela.
    expect(m.preco.meuPlanoCobravel("es").valor).toBe(19);
  });

  it("sem cupom: o SRN7 da Serenata não existe no Stripe", () => {
    const dentroDaValidade = new Date("2026-10-10T12:00:00Z");
    expect(m.cupom.cupomAtivo("es", dentroDaValidade)).toBeNull();
    expect(m.cupom.descontoNaTela("SRN7", "es", 1900, "musica", dentroDaValidade)).toBeNull();
  });

  it("a conversão reporta o que o Stripe cobrou, não o plano da tela", () => {
    expect(
      m.valor.valorDoCheckout({ locale: "es", valorDaTela: 24, valorCobravel: 19 }),
    ).toBe(19);
    expect(
      m.valor.valorDaCompra({ locale: "es", pedido: { valorCentavos: 1900, gateway: "stripe" }, reserva: 0 }),
    ).toBe(19);
  });

  it("os gêneros: regional mexicano na frente, nada de tango nem vallenato", () => {
    const lista = m.generos.generos("es").map((g) => g.value);
    expect(lista.slice(0, 3)).toEqual(["mariachi", "banda", "nortena"]);
    for (const v of ["regional_romantico", "corrido", "bolero", "bachata", "cumbia", "salsa", "pop_latino", "reggaeton", "cristiana"]) {
      expect(lista).toContain(v);
    }
    for (const fora of ["tango", "vallenato", "cueca", "huayno", "cuarteto", "copla"]) {
      expect(lista).not.toContain(fora);
    }
    // O job de música acha todos, inclusive o novo.
    for (const v of lista) expect(m.generos.acharGenero(v), v).not.toBeNull();
  });

  it("o prompt da letra: latino em tú, com a regra do inglês/spanglish", () => {
    const s = m.letra.systemDaLetra("es");
    expect(s).toContain("Usa tú, nunca vos");
    expect(s).toContain("spanglish");
    expect(s).toContain("Escribe la letra SIEMPRE en español");
    expect(s).not.toContain("Escribís");
  });

  it("a moldura do quiz e da página presente: tú, sem WhatsApp", () => {
    const quiz = textoDe(m.textos.t("es"));
    semVoseo(quiz, "textos.ts");
    expect(quiz).not.toContain("Serenata");
    const presente = textoDe(m.textosPresente.tp("es"));
    semVoseo(presente, "textos-presente.ts");
    expect(presente).not.toContain("WhatsApp");
    const perguntas = textoDe(
      m.quiz.quizFlow("es").map((p) => ({ ...p, options: undefined, mostrarSe: undefined })),
    );
    semVoseo(perguntas, "quiz-flow-es");
  });

  it("a oferta: tú, Stripe (Apple Pay, fatura), e nada da Serenata", () => {
    const tudo = textoDe(m.oferta.OFERTA_ES_EUA);
    semProibidos(tudo, "oferta-es-eua");
    semVoseo(tudo, "oferta-es-eua");
    expect(tudo).toContain("STRIPEONLI* BALLADGIFT");
    expect(m.oferta.OFERTA_ES_EUA.gateway).toContain("Apple Pay");
    expect(tudo).not.toContain("moneda de tu país");
  });

  it("hreflang: o par en-US / es-US da própria Ballad, padrão em inglês", () => {
    const links = m.seo.linksDeIdioma("es", "criar");
    expect(links).toContainEqual({ rel: "canonical", href: `${SITE}/es/criar` });
    expect(links).toContainEqual({ rel: "alternate", hrefLang: "es-US", href: `${SITE}/es/criar` });
    expect(links).toContainEqual({ rel: "alternate", hrefLang: "en-US", href: `${SITE}/criar` });
    expect(links).toContainEqual({ rel: "alternate", hrefLang: "x-default", href: `${SITE}/criar` });
    const en = m.seo.linksDeIdioma("en");
    expect(en).toContainEqual({ rel: "alternate", hrefLang: "es-US", href: `${SITE}/es` });
    expect(JSON.stringify(m.seo.linksDeIdioma("es"))).not.toContain("serenatagift");
  });

  it("os exemplos nascem vazios, e o que é exemplo da Serenata não vaza", () => {
    expect(m.exemplos.exemplosEsUsProntos()).toEqual([]);
    expect(m.exemplos.audioDoExemploEsUs("es-us-esposa")).not.toContain("ouwijepgctgtfzrrwpvt");
  });

  describe("os e-mails em espanhol", () => {
    const verso = "Tu risa en la cocina a las seis,\nel café frío y tú todavía aquí";
    const links = {
      linkEditor: `${SITE}/editar/tok-edicao`,
      linkPresente: `${SITE}/p/tok-presente`,
    };

    function confere(html: string, onde: string) {
      expect(html, onde).toContain('lang="es"');
      expect(html, onde).toContain("Ballad Gift · una canción hecha de la historia de quien tú quieres");
      semProibidos(html, onde);
      semVoseo(html, onde);
      linksDaBallad(html);
    }

    it("a letra (o 1º da régua)", () => {
      const html = m.letraPronta.emailLetraPronta({
        nome: "Lupita",
        titulo: "El Mandil Azul",
        letra: "[Verse 1]\nHoy le canto a mi Lupita",
        linkPrevia: `${SITE}/retomar?s=sessao`,
        linkDescadastro: `${SITE}/descadastrar?s=sessao&lang=es`,
        locale: "es",
      });
      confere(html, "letra-pronta");
      expect(m.letraPronta.assuntoLetraPronta("Lupita", "es")).toBe("La letra que escribiste para Lupita");
    });

    it("a régua: 2 (e o 2 de quem ouviu), 3 e 4", () => {
      const base = {
        nome: "Lupita",
        link: `${SITE}/retomar?s=sessao`,
        linkDescadastro: `${SITE}/descadastrar?s=sessao&lang=es`,
        locale: "es" as const,
        verso,
      };
      for (const numero of [2, 3, 4] as const) {
        confere(m.sequencia.emailSequencia({ ...base, numero }), `sequencia ${numero}`);
        semProibidos(m.sequencia.assuntoSequencia(numero, "Lupita", "es"), `assunto ${numero}`);
      }
      const ouviu = m.sequencia.emailSequencia({ ...base, numero: 2, ouviu: true });
      confere(ouviu, "sequencia 2 ouviu");
      expect(ouviu).toContain("DOS grabaciones");
      expect(m.sequencia.assuntoSequencia(2, "Lupita", "es", true)).toBe("El resto de la canción de Lupita");
      expect(m.sequencia.emailSequencia({ ...base, numero: 3 })).toContain("por mensaje");
    });

    it("a entrega: socorro por e-mail, a linha da fatura, sem pacote em real", () => {
      const html = m.presente.emailPresentePronto({ nome: "Lupita", titulo: "El Mandil Azul", ...links, locale: "es" });
      confere(html, "presente-pronto");
      expect(html).toContain("BALLAD GIFT");
      expect(html).toContain("STRIPEONLI* BALLADGIFT");
      expect(html).toContain("mailto:support@balladgift.com");
      const comVideo = m.presente.emailPresentePronto({
        nome: "Lupita",
        titulo: "El Mandil Azul",
        ...links,
        locale: "es",
        temVideoPraGerar: true,
      });
      expect(comVideo).toContain("Tu video ya está pagado");
      expect(comVideo).not.toContain("O seu vídeo");
    });

    it("pagamento confirmado com a música ainda gravando", () => {
      confere(m.producao.emailEmProducao({ nome: "Lupita", linkEditor: links.linkEditor, locale: "es" }), "em-producao");
    });

    it("lembrete, guarde o link e quase comprou, com o texto puro em espanhol", () => {
      confere(
        m.lembrete.emailLembretePresente({ nome: "Lupita", titulo: "El Mandil Azul", linkEditor: links.linkEditor, locale: "es" }),
        "lembrete",
      );
      confere(m.guarde.emailGuardeOLink({ nome: "Lupita", titulo: "El Mandil Azul", ...links, locale: "es" }), "guarde");
      expect(m.guarde.emailGuardeOLink({ nome: "Lupita", titulo: "x", ...links, locale: "es" })).toContain(
        "Guarda este correo.",
      );
      confere(
        m.quase.emailQuaseComprou({ nome: "Lupita", titulo: "El Mandil Azul", link: `${SITE}/retomar?s=sessao`, locale: "es" }),
        "quase-comprou",
      );
      for (const [onde, t] of [
        ["texto lembrete", m.lembrete.textoLembreteEsEua({ nome: "Lupita", linkEditor: links.linkEditor })],
        ["texto guarde", m.guarde.textoGuardeOLinkEsEua({ nome: "Lupita", ...links })],
        ["texto quase", m.quase.textoQuaseComprouEsEua({ nome: "Lupita", link: `${SITE}/retomar?s=sessao` })],
      ] as const) {
        semProibidos(t, onde);
        semVoseo(t, onde);
      }
    });

    it("o acesso à conta e o vídeo pronto", () => {
      const acesso = m.acesso.emailAcesso({ link: `${SITE}/auth/callback?x=1`, locale: "es" });
      expect(acesso).toContain("Ballad Gift · una canción hecha de la historia de quien tú quieres");
      semProibidos(acesso, "acesso");
      semVoseo(acesso, "acesso");
      expect(m.acesso.assuntoAcesso("es")).toBe("Tu acceso a Ballad Gift");
      const video = m.video.emailVideoPronto({ titulo: "El Mandil Azul", linkVideo: `${SITE}/editar/tok#video`, locale: "es" });
      expect(video).toContain("BALLAD");
      semProibidos(video, "video-pronto");
      semVoseo(video, "video-pronto");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. A SERENATA, que não pode mudar nada
// ─────────────────────────────────────────────────────────────────────

describe("na Serenata, o /es continua argentino", () => {
  it("mercado, rota, tag e preço de sempre", async () => {
    vi.resetModules();
    const { ehBallad } = await import("./marca-identidade");
    const { mercadoEs } = await import("./mercado-es");
    const i18n = await import("./i18n");
    const preco = await import("./preco");
    const cupom = await import("./cupom");
    const valor = await import("./valor-conversao");
    expect(ehBallad()).toBe(false);
    expect(mercadoEs()).toBe("argentina");
    expect(i18n.localeDaRota("/es/criar")).toBe("es");
    expect(i18n.localeDaRota("/criar")).toBe("pt");
    expect(i18n.tagIdioma("es")).toBe("es-MX");
    expect(i18n.moeda("es").texto).toBe("US$ 9,90");
    const controle = preco.planoControle("es");
    expect(controle.texto).toBe("US$ 9,90");
    expect(controle.checkout).toContain("centerpag");
    // O espanhol da Serenata segue fora do teste de preço e com o seu cupom.
    expect(preco.varianteDePreco("es")).toBe("A");
    expect(cupom.cupomAtivo("es", new Date("2026-10-10T12:00:00Z"))?.codigo).toBe("SRN7");
    expect(valor.valorDoCheckout({ locale: "es", valorDaTela: 9.9, valorCobravel: 19 })).toBe(9.9);
    expect(
      valor.valorDaCompra({ locale: "es", pedido: { valorCentavos: 5000, gateway: "stripe" }, reserva: 9.9 }),
    ).toBe(9.9);
  });

  it("letra, gêneros e copy em voseo, e a marca Serenata nos e-mails", async () => {
    vi.resetModules();
    const { systemDaLetra } = await import("./letra-prompt");
    const { generos } = await import("./generos");
    const { t } = await import("./textos");
    const seq = await import("../../emails/sequencia");
    const presente = await import("../../emails/presente-pronto");
    expect(systemDaLetra("es")).toContain("rioplatense");
    expect(systemDaLetra("es")).not.toContain("spanglish");
    expect(generos("es").map((g) => g.value)).not.toContain("regional_romantico");
    expect(t("es").faltaResponder).toBe("Respondé esta para continuar");
    const html = seq.emailSequencia({
      numero: 3,
      nome: "Sole",
      link: "https://www.serenatagift.com/retomar?s=x",
      linkDescadastro: "https://www.serenatagift.com/descadastrar?s=x",
      locale: "es",
    });
    expect(html).toContain("Serenata · una canción hecha de la historia de quien vos querés");
    expect(html).toContain("WhatsApp");
    // E o detector de voseo do bloco da Ballad enxerga o voseo de verdade:
    // sem isto, um detector quebrado passaria em silêncio.
    expect(VOSEO.some((v) => v.test(html))).toBe(true);
    const quizAr = JSON.stringify(t("es"));
    expect(VOSEO.some((v) => v.test(quizAr))).toBe(true);
    const entrega = presente.emailPresentePronto({
      nome: "Sole",
      titulo: "Mate",
      linkEditor: "https://www.serenatagift.com/editar/x",
      linkPresente: "https://www.serenatagift.com/p/x",
      locale: "es",
    });
    expect(entrega).toContain("R$ 28");
  });

  it("hreflang da Serenata: pt-BR ↔ es, padrão em português", async () => {
    vi.resetModules();
    const { linksDeIdioma } = await import("./seo");
    const links = linksDeIdioma("es");
    expect(links).toContainEqual({ rel: "alternate", hrefLang: "es", href: "https://www.serenatagift.com/es" });
    expect(links).toContainEqual({ rel: "alternate", hrefLang: "x-default", href: "https://www.serenatagift.com/" });
    expect(JSON.stringify(links)).not.toContain("es-US");
  });
});
