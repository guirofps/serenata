import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// OS E-MAILS DA BALLAD GIFT (EUA), montados como o deploy dela monta.
//
// `MARCA_ATIVA` é decidida na CARGA do módulo, pela env `VITE_MARCA`. Pra ver
// o e-mail que o cliente americano recebe (logo, rodapé, marca), a env muda
// ANTES de importar, com os módulos zerados. Sem isso o teste veria o inglês
// vestido de Serenata, que é um e-mail que nunca sai.
//
// O que se confere, em todos: nada de travessão (regra da casa pra texto que
// o cliente lê), nada de real, PIX ou WhatsApp (a Ballad não tem nenhum dos
// três), nada da Serenata, e todo link no domínio da Ballad.

const SITE = "https://www.balladgift.com";
const PROIBIDOS = ["—", "R$", "PIX", "Pix", "WhatsApp", "Serenata", "serenatagift"];

function semProibidos(t: string) {
  for (const p of PROIBIDOS) expect(t, `não pode ter "${p}"`).not.toContain(p);
}

function linksDaBallad(html: string) {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h.startsWith(`${SITE}/`), h).toBe(true);
}

type Modulos = {
  guarde: typeof import("../../emails/guarde-o-link");
  lembrete: typeof import("../../emails/lembrete-presente");
  sequencia: typeof import("../../emails/sequencia");
};
let m: Modulos;

beforeAll(async () => {
  vi.stubEnv("VITE_MARCA", "ballad");
  vi.resetModules();
  m = {
    guarde: await import("../../emails/guarde-o-link"),
    lembrete: await import("../../emails/lembrete-presente"),
    sequencia: await import("../../emails/sequencia"),
  };
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("guarde o link (en)", () => {
  const args = {
    nome: "Emily",
    titulo: "Porch Light",
    linkEditor: `${SITE}/editar/tok-edicao`,
    linkPresente: `${SITE}/p/tok-presente`,
    locale: "en" as const,
  };

  it("assunto com LINKS, pra achar na busca meses depois", () => {
    const a = m.guarde.assuntoGuardeOLink("Emily", "en");
    expect(a).toBe("Your links for Emily's song (save this email)");
    semProibidos(a);
  });

  it("os dois links, cada um com o seu dono, na marca da Ballad", () => {
    const html = m.guarde.emailGuardeOLink(args);
    expect(html).toContain('lang="en"');
    expect(html).toContain("BALLAD GIFT");
    expect(html).toContain("Save this email.");
    expect(html).toContain("download the MP3");
    expect(html).toContain("The link you SEND");
    expect(html).toContain(`href="${args.linkEditor}"`);
    expect(html).toContain(`href="${args.linkPresente}"`);
    expect(html).toContain("Ballad Gift · a song made from the story of someone you love");
    semProibidos(html);
    linksDaBallad(html);
  });

  it("o texto puro também é inglês e leva os dois links", () => {
    const t = m.guarde.textoGuardeOLinkEn(args);
    expect(t).toContain(args.linkEditor);
    expect(t).toContain(args.linkPresente);
    expect(t).toContain("Emily's song");
    semProibidos(t);
  });
});

describe("lembrete de montar o presente (en)", () => {
  const args = {
    nome: "Emily",
    titulo: "Porch Light",
    linkEditor: `${SITE}/editar/tok-edicao`,
    locale: "en" as const,
  };

  it("um botão só, pro editor, sem cobrança nem urgência falsa", () => {
    const html = m.lembrete.emailLembretePresente(args);
    expect(html).toContain('lang="en"');
    expect(html).toContain("BALLAD GIFT");
    expect(html).toContain("is ready and waiting");
    expect(html).toContain("SET UP THE GIFT");
    expect(html).toContain("the link never expires");
    expect(html.match(/href="/g)?.length).toBe(1);
    expect(html).toContain(`href="${args.linkEditor}"`);
    semProibidos(html);
    linksDaBallad(html);
  });

  it("assunto e texto puro em inglês", () => {
    expect(m.lembrete.assuntoLembrete("Emily", "en")).toBe("Emily's song is waiting for you");
    const t = m.lembrete.textoLembreteEn(args);
    expect(t).toContain(args.linkEditor);
    semProibidos(t);
  });
});

describe("régua de recuperação (en)", () => {
  const base = {
    nome: "Emily",
    link: `${SITE}/retomar?s=sessao-123`,
    linkDescadastro: `${SITE}/descadastrar?s=sessao-123&lang=en`,
    locale: "en" as const,
    verso: "Your laugh in the kitchen at 6 a.m.\nCoffee cold, and you still stay",
  };

  it("2, pra quem NÃO ouviu: a gravação ficou pronta depois que ela saiu", () => {
    const html = m.sequencia.emailSequencia({ ...base, numero: 2 });
    expect(html).toContain("has been recorded");
    expect(html).toContain("HEAR THE SUNG PREVIEW");
    expect(html).toContain("Your laugh in the kitchen");
    expect(m.sequencia.assuntoSequencia(2, "Emily", "en")).toBe(
      "The song you wrote for Emily has been recorded",
    );
    semProibidos(html);
    linksDaBallad(html);
  });

  it("2, pra quem OUVIU: não conta que ela foi embora antes (seria mentira)", () => {
    const html = m.sequencia.emailSequencia({ ...base, numero: 2, ouviu: true });
    expect(html).not.toContain("left before the recording");
    expect(html).toContain("cuts off at the chorus");
    expect(html).toContain("TWO recordings");
    expect(m.sequencia.assuntoSequencia(2, "Emily", "en", true)).toBe("The rest of Emily's song");
    semProibidos(html);
    linksDaBallad(html);
  });

  it("3: não é um arquivo, é uma página (o diferencial da Ballad)", () => {
    const html = m.sequencia.emailSequencia({ ...base, numero: 3 });
    expect(html).toContain("It's not an MP3 you send in a text.");
    expect(html).toContain("QR code");
    expect(m.sequencia.assuntoSequencia(3, "Emily", "en")).toBe("Emily's gift isn't a file");
    semProibidos(html);
    linksDaBallad(html);
  });

  it("nenhum degrau fala de desconto nem de preço", () => {
    for (const numero of [2, 3, 4] as const) {
      for (const ouviu of [false, true]) {
        const html = m.sequencia.emailSequencia({ ...base, numero, ouviu });
        expect(html).not.toMatch(/discount|coupon|\$\s?\d|%\s?off/i);
      }
    }
  });

  it("rodapé com a marca e o descadastro em inglês", () => {
    const html = m.sequencia.emailSequencia({ ...base, numero: 3 });
    expect(html).toContain('lang="en"');
    expect(html).toContain("Ballad Gift · a song made from the story of someone you love");
    expect(html).toContain(`href="${base.linkDescadastro}"`);
    expect(html).toContain(">unsubscribe</a>");
  });

  it("o verso vem do banco e é escapado antes de entrar no HTML", () => {
    const html = m.sequencia.emailSequencia({ ...base, numero: 2, verso: "you & me <3" });
    expect(html).toContain("you &amp; me &lt;3");
  });
});
