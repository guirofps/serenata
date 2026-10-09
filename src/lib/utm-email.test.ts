import { describe, expect, it } from "vitest";
import { comUtm, comUtmEmail } from "./utm-email";

describe("comUtm (cliente do Resend)", () => {
  const link = '<a href="https://www.serenatagift.com/criar">x</a>';
  function falso() {
    const enviados: unknown[] = [];
    const r = {
      emails: { send: async (p: unknown) => (enviados.push(p), { data: { id: "1" }, error: null }) },
      batch: { send: async (ps: unknown[]) => (enviados.push(...ps), { data: null, error: null }) },
    };
    return { r: comUtm(r), enviados };
  }
  it("o send leva a utm com o template da tag", async () => {
    const { r, enviados } = falso();
    await r.emails.send({ html: link, tags: [{ name: "template", value: "pix_nao_pago" }] });
    expect((enviados[0] as { html: string }).html).toContain("utm_campaign=pix_nao_pago");
  });
  it("sem tag, a campanha é 'email'; sem html, nada muda", async () => {
    const { r, enviados } = falso();
    await r.emails.send({ html: link });
    await r.emails.send({ text: "oi" });
    expect((enviados[0] as { html: string }).html).toContain("utm_campaign=email");
    expect(enviados[1]).toEqual({ text: "oi" });
  });
  it("o batch também", async () => {
    const { r, enviados } = falso();
    await r.batch.send([{ html: link, tags: [{ name: "template", value: "a" }] }, { html: link }]);
    expect((enviados[0] as { html: string }).html).toContain("utm_campaign=a");
    expect((enviados[1] as { html: string }).html).toContain("utm_campaign=email");
  });
});

const UTM = "utm_source=email&amp;utm_medium=email&amp;utm_campaign=letra_pronta";

describe("comUtmEmail", () => {
  it("põe a utm nos links do nosso domínio", () => {
    expect(comUtmEmail('<a href="https://www.serenatagift.com/criar">x</a>', "letra_pronta")).toBe(
      `<a href="https://www.serenatagift.com/criar?${UTM}">x</a>`,
    );
    expect(comUtmEmail('<a href="https://balladgift.com/p/abc">x</a>', "letra_pronta")).toBe(
      `<a href="https://balladgift.com/p/abc?${UTM}">x</a>`,
    );
  });
  it("junta com a query que já existe e mantém o #", () => {
    expect(
      comUtmEmail('<a href="https://www.serenatagift.com/editar/t?de=x&amp;y=1#outra">x</a>', "letra_pronta"),
    ).toBe(`<a href="https://www.serenatagift.com/editar/t?de=x&amp;y=1&amp;${UTM}#outra">x</a>`);
  });
  it("não mexe em link de fora, mailto nem descadastro", () => {
    const fora = '<a href="https://wa.me/551199">x</a><a href="mailto:a@b.com">y</a>';
    expect(comUtmEmail(fora, "c")).toBe(fora);
    const desc = '<a href="https://www.serenatagift.com/descadastrar?e=abc">sair</a>';
    expect(comUtmEmail(desc, "c")).toBe(desc);
  });
  it("não duplica utm_source que já existe", () => {
    const ja = '<a href="https://www.serenatagift.com/criar?cupom=MUSICA10&amp;utm_source=email&amp;utm_campaign=musica10">x</a>';
    expect(comUtmEmail(ja, "c")).toBe(ja);
  });
  it("o nome da campanha vai escapado", () => {
    expect(comUtmEmail('<a href="https://www.serenatagift.com/">x</a>', "a b&c")).toBe(
      '<a href="https://www.serenatagift.com/?utm_source=email&amp;utm_medium=email&amp;utm_campaign=a%20b%26c">x</a>',
    );
  });
});
