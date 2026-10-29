import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// OS MERCADOS NOVOS DA BALLAD (29/10): o país do acesso escolhe o espanhol,
// e cada país lê a sua moeda. Carregado com a marca Ballad (o `/es` da
// Serenata é a Argentina e não muda nada por país; o fim do arquivo confere).

const VOSOTROS = [/\bvosotros\b/i, /\bvuestr[oa]s?\b/i, /\bos\b/, /\bhab[ée]is\b/, /\bten[ée]is\b/];

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

describe("na Ballad, o país do acesso escolhe o espanhol e a moeda", () => {
  type M = {
    mercadoEs: typeof import("./mercado-es");
    mercados: typeof import("./mercados");
    letra: typeof import("./letra-prompt");
    letraEs: typeof import("./letra-prompt-es");
    generos: typeof import("./generos");
    textos: typeof import("./textos");
    textosPresente: typeof import("./textos-presente");
    i18n: typeof import("./i18n");
    oferta: typeof import("../components/quiz/oferta-es-eua");
    emailMercado: typeof import("../../emails/mercado-email");
    presente: typeof import("../../emails/presente-pronto");
    sequencia: typeof import("../../emails/sequencia");
    video: typeof import("../../emails/video-oferta");
  };
  let m: M;

  beforeAll(async () => {
    vi.stubEnv("VITE_MARCA", "ballad");
    vi.resetModules();
    m = {
      mercadoEs: await import("./mercado-es"),
      mercados: await import("./mercados"),
      letra: await import("./letra-prompt"),
      letraEs: await import("./letra-prompt-es"),
      generos: await import("./generos"),
      textos: await import("./textos"),
      textosPresente: await import("./textos-presente"),
      i18n: await import("./i18n"),
      oferta: await import("../components/quiz/oferta-es-eua"),
      emailMercado: await import("../../emails/mercado-email"),
      presente: await import("../../emails/presente-pronto"),
      sequencia: await import("../../emails/sequencia"),
      video: await import("../../emails/video-oferta"),
    };
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** Roda `f` como se a requisição viesse de `pais` (a fonte que o servidor liga). */
  function noPais<T>(pais: string | null, f: () => T): T {
    m.mercadoEs.definirFontePais(() => pais);
    try {
      return f();
    } finally {
      m.mercadoEs.definirFontePais(() => null);
    }
  }

  it("cada país cai no seu espanhol; o resto do mundo segue nos EUA", () => {
    const { mercadoEs } = m.mercadoEs;
    expect(mercadoEs("US")).toBe("eua");
    expect(mercadoEs("MX")).toBe("mexico");
    expect(mercadoEs("ES")).toBe("espanha");
    expect(mercadoEs("CO")).toBe("latam");
    expect(mercadoEs("CL")).toBe("latam");
    expect(mercadoEs("PE")).toBe("latam");
    expect(mercadoEs("AR")).toBe("eua");
    expect(mercadoEs("BR")).toBe("eua");
    expect(mercadoEs(null)).toBe("eua");
    // Sem argumento, pergunta à fonte (o cabeçalho no servidor, o `<html>` no navegador).
    expect(noPais("ES", () => mercadoEs())).toBe("espanha");
    expect(noPais("mx", () => mercadoEs())).toBe("mexico");
    expect(noPais(null, () => mercadoEs())).toBe("eua");
    // Fonte que explode não derruba a página: vale o padrão.
    m.mercadoEs.definirFontePais(() => {
      throw new Error("fora de requisição");
    });
    expect(mercadoEs()).toBe("eua");
    m.mercadoEs.definirFontePais(() => null);
  });

  it("o México herda os EUA; a Espanha e a LatAm não", () => {
    const { herdaEua, ehEua, ehMexico } = m.mercadoEs;
    expect(herdaEua("MX")).toBe(true);
    expect(herdaEua("US")).toBe(true);
    expect(herdaEua("ES")).toBe(false);
    expect(herdaEua("CO")).toBe(false);
    expect(ehEua("MX")).toBe(false);
    expect(ehMexico("MX")).toBe(true);
  });

  it("o prompt da letra: vosotros na Espanha, proibido na LatAm, sem spanglish no México", () => {
    const { systemDaLetra } = m.letra;
    const espanha = systemDaLetra("es", "ES");
    expect(espanha).toBe(m.letraEs.LETRA_SYSTEM_ES_ESPANHA);
    expect(espanha).toMatch(/vosotros/);

    for (const p of ["CO", "CL", "PE"]) {
      const latam = systemDaLetra("es", p);
      expect(latam, p).toBe(m.letraEs.LETRA_SYSTEM_ES_LATAM);
      expect(latam, p).toContain("Usa ustedes, nunca vosotros");
      // A gíria mexicana do exemplo saiu, e mais nada mudou.
      expect(latam, p).not.toMatch(/\brola\b/);
      expect(latam.length).toBe(m.letraEs.LETRA_SYSTEM_ES.length + "canción".length - "rola".length);
    }

    const mexico = systemDaLetra("es", "MX");
    expect(mexico).toBe(m.letraEs.LETRA_SYSTEM_ES);
    expect(mexico).not.toMatch(/Estados Unidos/);

    // Os EUA não mudaram.
    expect(systemDaLetra("es", "US")).toBe(m.letraEs.LETRA_SYSTEM_ES_EUA);
    expect(systemDaLetra("es", null)).toBe(m.letraEs.LETRA_SYSTEM_ES_EUA);
    // O inglês não olha país.
    expect(systemDaLetra("en", "ES")).toBe(systemDaLetra("en", "US"));
  });

  it("o gênero do país vai na frente; os EUA e o México ficam com a lista de hoje", () => {
    const primeiros = (pais: string) => noPais(pais, () => m.generos.generos("es").map((g) => g.value));
    expect(primeiros("CO")[0]).toBe("vallenato");
    expect(primeiros("CL").slice(0, 2)).toEqual(["cueca", "cumbia"]);
    expect(primeiros("PE")[0]).toBe("huayno");
    expect(primeiros("ES")[0]).toBe("balada_esp");
    expect(primeiros("MX")).toEqual(primeiros("US"));
    expect(primeiros("US")[0]).toBe("mariachi");
    // Reordenar não perde nem duplica gênero.
    const co = primeiros("CO");
    expect(new Set(co).size).toBe(co.length);
    // A lista neutra inteira, só em outra ordem.
    const neutra = m.generos.acharGenero("vallenato") ? primeiros("CL") : [];
    expect([...co].sort()).toEqual([...neutra].sort());
  });

  it("a moldura e a página: vosotros na Espanha, nunca na LatAm; WhatsApp fora dos EUA", () => {
    const quizEs = textoDe(m.textos.t("es", "ES"));
    expect(quizEs).toContain("vuestras fotos");
    expect(quizEs).toContain("WhatsApp");
    expect(quizEs).not.toContain("Serenata");
    const presenteEs = textoDe(m.textosPresente.tp("es", "ES"));
    expect(presenteEs).toContain("vosotros dos");
    expect(presenteEs).toContain("ordenador");

    for (const p of ["CO", "CL", "PE", "MX", "US"]) {
      const tudo = textoDe(m.textos.t("es", p)) + textoDe(m.textosPresente.tp("es", p));
      for (const v of VOSOTROS) expect(tudo, `${p}: ${v}`).not.toMatch(v);
      expect(tudo, p).not.toContain("Serenata");
      // O voseo da base (escrito pra Argentina) não escapa em nenhum país da Ballad.
      expect(tudo, p).not.toMatch(/Respondé|Completá|Escribí|Tocá/);
      expect(tudo, p).not.toMatch(/\busá\b/);
    }
    expect(m.textos.t("es", "CO").comoVaiChegar).toContain("WhatsApp");
    expect(m.textos.t("es", "US").comoVaiChegar).toContain("por mensaje");
    expect(m.textos.t("es", "MX").comoVaiChegar).toContain("por mensaje");
    expect(m.textos.t("es", "CO").naoLembro).not.toContain("ahorita");
  });

  it("a oferta: cada país lê a sua moeda, e nenhum mercado fora do dólar lê 'dólares'", () => {
    const { MERCADOS } = m.mercados;
    // Os EUA continuam idênticos.
    expect(m.oferta.ofertaEsDoMercado("eua", MERCADOS.US)).toBe(m.oferta.OFERTA_ES_EUA);

    for (const p of ["MX", "ES", "CO", "CL", "PE"] as const) {
      const mercado = MERCADOS[p];
      const o = m.oferta.ofertaEsDoMercado(mercado.conteudo, mercado);
      const tudo = textoDe(o);
      expect(tudo, p).not.toMatch(/d[óo]lar/i);
      expect(tudo, p).not.toContain("USD");
      expect(tudo, p).not.toContain("US$");
      if (p !== "MX") {
        expect(o.conversao, p).toBe(m.mercados.fraseDaMoeda(mercado));
        expect(o.conversaoOxxo, p).toBe("");
      }
    }
    // O México fica com a redação de master (29/10), e o OXXO à parte, pro `.so-oxxo-mx`.
    const omx = m.oferta.ofertaEsDoMercado("mexico", MERCADOS.MX);
    expect(omx.conversao).toBe(
      "El precio es en pesos mexicanos (MXN) y es el total: no se suma nada al pagar. Pagas con tarjeta.",
    );
    expect(omx.conversaoOxxo).toContain("OXXO");
    expect(omx.creditoValor).toBe("$0 MXN");
    expect(omx.duvidas.find((d) => d.p === "¿Cómo aparece el cargo en mi tarjeta?")?.r).toBe(
      "Como STRIPEONLI* BALLADGIFT. Es un solo cargo en pesos mexicanos (MXN) a través de Stripe, nuestro procesador de pagos, sin suscripción.",
    );
    expect(m.oferta.ofertaEsDoMercado("espanha", MERCADOS.ES).conversao).toContain("IVA incluido");
    const es = textoDe(m.oferta.ofertaEsDoMercado("espanha", MERCADOS.ES));
    expect(es).toContain("móvil");
    expect(es).toContain("WhatsApp");
    const mx = textoDe(m.oferta.ofertaEsDoMercado("mexico", MERCADOS.MX));
    expect(mx).toContain("pesos mexicanos");
    expect(mx).not.toContain("WhatsApp");
  });

  it("o <html lang> e o ditado seguem o país no espanhol da Ballad", () => {
    expect(noPais("ES", () => m.i18n.tagIdioma("es"))).toBe("es-ES");
    expect(noPais("CO", () => m.i18n.tagIdioma("es"))).toBe("es-CO");
    expect(noPais("MX", () => m.i18n.tagIdioma("es"))).toBe("es-MX");
    expect(noPais(null, () => m.i18n.tagIdioma("es"))).toBe("es-US");
    expect(noPais("ES", () => m.i18n.tagIdioma("en"))).toBe("en-US");
  });

  it("o e-mail em espanhol: vosotros e WhatsApp na Espanha, WhatsApp na LatAm, nada muda nos EUA", () => {
    const { adaptarAoPais } = m.emailMercado;
    const html = m.presente.emailPresentePronto({
      nome: "Lupita",
      titulo: "El Mandil Azul",
      linkEditor: "https://www.balladgift.com/editar/abc",
      linkPresente: "https://www.balladgift.com/p/abc",
      locale: "es",
      temVideoPraGerar: true,
    });
    expect(html).toMatch(/ustedes|por mensaje/);
    const espanha = adaptarAoPais(html, "es", "ES");
    expect(espanha).not.toMatch(/\bustedes\b/);
    expect(espanha).not.toContain("por mensaje");
    expect(espanha).toContain("WhatsApp");
    const latam = adaptarAoPais(html, "es", "CO");
    for (const v of VOSOTROS) expect(latam).not.toMatch(v);
    expect(latam).not.toContain("por mensaje");
    expect(adaptarAoPais(html, "es", "US")).toBe(html);
    expect(adaptarAoPais(html, "es", "MX")).toBe(html);
    expect(adaptarAoPais(html, "es", null)).toBe(html);
    expect(adaptarAoPais(html, "en", "ES")).toBe(html);

    for (const numero of [2, 3, 4] as const) {
      const seq = m.sequencia.emailSequencia({
        numero,
        nome: "Lupita",
        link: "https://www.balladgift.com/retomar?s=x",
        linkDescadastro: "https://www.balladgift.com/api/descadastro?e=x",
        locale: "es",
        verso: "un verso",
      });
      expect(adaptarAoPais(seq, "es", "ES"), `sequência ${numero}`).not.toMatch(/\bustedes\b/);
    }
  });

  it("o preço do vídeo no e-mail sai na moeda da compra", () => {
    const { precoDoVideoNoEmail } = m.video;
    expect(precoDoVideoNoEmail("es", "ab12", "eur")).toBe("12 €");
    expect(precoDoVideoNoEmail("es", "ab12", "cop")).toBe("$25.900 COP");
    expect(precoDoVideoNoEmail("es", "ab12", "clp")).toBe("$6.490 CLP");
    expect(precoDoVideoNoEmail("es", "ab12", "pen")).toBe("S/ 25");
    expect(precoDoVideoNoEmail("es", "ab12", "mxn")).toBe("$129 MXN");
    expect(precoDoVideoNoEmail("es", "ab12", true)).toBe("$129 MXN");
    expect(precoDoVideoNoEmail("es", "ab12", "usd")).toBe("US$ 12");
    expect(precoDoVideoNoEmail("en", "ab12", null)).toBe("$12");
  });
});

describe("na Serenata, o país não muda o espanhol", () => {
  beforeAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("a Argentina continua sendo o mercado, em qualquer país", async () => {
    const mercadoEs = await import("./mercado-es");
    const letra = await import("./letra-prompt");
    const letraEs = await import("./letra-prompt-es");
    const emailMercado = await import("../../emails/mercado-email");
    for (const p of ["ES", "MX", "CO", null]) {
      expect(mercadoEs.mercadoEs(p)).toBe("argentina");
      expect(letra.systemDaLetra("es", p)).toBe(letraEs.LETRA_SYSTEM_ES_AR);
      expect(emailMercado.adaptarAoPais("las fotos de ustedes por mensaje", "es", p)).toBe(
        "las fotos de ustedes por mensaje",
      );
    }
  });
});
