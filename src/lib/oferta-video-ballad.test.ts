import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// O E-MAIL DO VÍDEO NAS DUAS MARCAS (16/10).
//
// Até aqui o `ofertaVideo` só rodava na Serenata e só em português. Na Ballad
// o vídeo é vendido pelo Stripe, em dólar, em inglês e em espanhol, e ninguém
// recebia e-mail nenhum. Este arquivo segura as duas pontas:
//
//   1. montado como o deploy da Ballad (env antes do import, módulos zerados,
//      o padrão do `ballad-es.test`): copy em inglês e em `tú`, preço em dólar,
//      e nada de real, PIX, WhatsApp, Serenata ou travessão;
//   2. sem a env (a Serenata): o português exatamente como era.

const PROIBIDOS = ["—", "R$", "PIX", "Pix", "WhatsApp", "Serenata", "SERENATA"];
const VOSEO = [/\bpod[ée]s\b/, /\bmandás/, /\beleg[íi]s\b/, /Escuchá/, /\btocá(?=[\s.,;!?]|$)/i, /\bcelu\b/];

const ARGS = { nome: "Lupita", titulo: "Mi Lupita", link: "https://www.balladgift.com/editar/ab12?de=video#video" };

describe("na Ballad, o e-mail do vídeo sai em inglês e em espanhol, em dólar", () => {
  type M = {
    video: typeof import("../../emails/video-oferta");
    fotos: typeof import("../../emails/fotos-video");
  };
  let m: M;

  beforeAll(async () => {
    vi.stubEnv("VITE_MARCA", "ballad");
    vi.resetModules();
    m = {
      video: await import("../../emails/video-oferta"),
      fotos: await import("../../emails/fotos-video"),
    };
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("só en e es recebem, e linha sem idioma conhecido não", () => {
    expect(m.video.idiomaDaOfertaVideo("en", true)).toBe("en");
    expect(m.video.idiomaDaOfertaVideo("es", true)).toBe("es");
    expect(m.video.idiomaDaOfertaVideo("pt", true)).toBeNull();
    expect(m.video.idiomaDaOfertaVideo(null, true)).toBeNull();
  });

  it("o preço é o da folha do editor: $12 no inglês, US$ 12 no espanhol", () => {
    expect(m.video.precoDoVideoNoEmail("en", "ab12")).toBe("$12");
    expect(m.video.precoDoVideoNoEmail("es", "ab12")).toBe("US$ 12");
  });

  it("quem pagou a música em peso (México) lê o vídeo em peso, nos dois idiomas", () => {
    expect(m.video.precoDoVideoNoEmail("es", "ab12", true)).toBe("$129 MXN");
    expect(m.video.precoDoVideoNoEmail("en", "ab12", true)).toBe("$129 MXN");
  });

  for (const locale of ["en", "es"] as const) {
    it(`${locale}: as duas versões (com foto e sem foto) sem nada do Brasil`, () => {
      const preco = m.video.precoDoVideoNoEmail(locale, "ab12")!;
      const textos = [
        m.video.assuntoVideoOferta(ARGS.nome, locale),
        m.video.emailVideoOferta({ ...ARGS, preco, locale }),
        m.video.textoVideoOferta({ ...ARGS, preco, locale }),
        m.fotos.assuntoFotosVideo(ARGS.nome, locale),
        m.fotos.emailFotosVideo({ ...ARGS, preco, locale }),
        m.fotos.textoFotosVideo({ ...ARGS, preco, locale }),
      ];
      for (const t of textos) {
        for (const p of PROIBIDOS) expect(t, `não pode ter "${p}"`).not.toContain(p);
        if (locale === "es") for (const v of VOSEO) expect(t, `voseo ${v}`).not.toMatch(v);
      }
      // O preço aparece no HTML e no texto puro: o e-mail diz o que a tela cobra.
      expect(textos[1]).toContain(preco);
      expect(textos[2]).toContain(preco);
      expect(textos[4]).toContain(preco);
      expect(textos[5]).toContain(preco);
      expect(textos[1]).toContain("BALLAD");
      expect(textos[1]).toContain(`lang="${locale}"`);
    });
  }

  it("sem o preço de quem chama, cai no dólar do catálogo, nunca no real", () => {
    expect(m.video.textoVideoOferta({ ...ARGS, locale: "en" })).toContain("$12");
    expect(m.fotos.textoFotosVideo({ ...ARGS, locale: "es" })).toContain("US$ 12");
  });
});

describe("na Serenata, o e-mail do vídeo é o de sempre", () => {
  it("só português, e o espanhol argentino continua de fora", async () => {
    vi.resetModules();
    const v = await import("../../emails/video-oferta");
    expect(v.idiomaDaOfertaVideo("es", false)).toBeNull();
    expect(v.idiomaDaOfertaVideo("pt", false)).toBe("pt");
    // Sem quiz (ou sem locale no quiz) sempre recebeu, em português.
    expect(v.idiomaDaOfertaVideo(null, false)).toBe("pt");
  });

  it("o português não mudou uma vírgula", async () => {
    vi.resetModules();
    const v = await import("../../emails/video-oferta");
    const f = await import("../../emails/fotos-video");
    expect(v.assuntoVideoOferta("Ana")).toBe("A página de Ana virou vídeo");
    expect(f.assuntoFotosVideo("Ana")).toBe("Coloque as fotos de vocês na música de Ana");
    const html = v.emailVideoOferta({ nome: "Ana", titulo: "T", link: "https://x" });
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain(">SERENATA<");
    expect(html).toContain("são R$ 24,90, pagamento único.");
    expect(v.textoVideoOferta({ nome: "Ana", link: "L" })).toBe(
      "A página de Ana virou vídeo.\n\n" +
        "As fotos que você escolheu, passando no ritmo da música, com a letra acendendo palavra por palavra. " +
        "Já está montado: é só abrir e dar o play.\n\nL\n\n" +
        "Assistir não custa nada. Pra baixar em HD e mandar no WhatsApp, são R$ 24,90.",
    );
    // Teste `preco_video` encerrado em 31/10: todo token paga R$ 24,90.
    expect(v.precoDoVideoNoEmail("pt", "abc2")).toBe("R$ 24,90");
    expect(v.precoDoVideoNoEmail("pt", "abc3")).toBe("R$ 24,90");
  });
});
