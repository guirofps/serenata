import { afterEach, describe, expect, it, vi } from "vitest";
import { GA4_ID, PROMOVIDOS, encaminharGa4, enviarEvento, montarParams } from "./ga4";

// O GA4 É O SEGUNDO DESTINO DO FUNIL. Tudo aqui é sobre o que pode e o que
// não pode sair do navegador rumo ao Google. O banco próprio (`funnel_events`)
// continua recebendo tudo; quem filtra é só este caminho.

let gtag: ReturnType<typeof vi.fn>;
function em(pathname: string) {
  gtag = vi.fn();
  vi.stubGlobal("window", { location: { pathname }, gtag });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GA4_ID", () => {
  it("na Serenata é a propriedade ligada em 01/10", () => {
    expect(GA4_ID).toBe("G-E2EKHK3RQF");
  });
});

describe("montarParams", () => {
  it("achata a atribuição em ref e utm_*, e larga o resto dela", () => {
    const p = montarParams({
      device: "mobile",
      attribution: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "24109054263",
        ref: "ANA42",
        gclid: "Cj0xyz",
      },
      step: 3,
    });
    expect(p).toEqual({
      device: "mobile",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "24109054263",
      ref: "ANA42",
      step: 3,
    });
  });

  it("nunca leva identificador do Meta nem o path", () => {
    // `fb.1.1.2` tem cara de rótulo: quem barra é a CHAVE, não o valor.
    const p = montarParams({ fbp: "fb.1.1.2", fbc: "fb.1.1.abc", _fbp: "x", path: "/criar", step: 1 });
    expect(p).toEqual({ step: 1 });
  });

  it("descarta chave com cara de dado pessoal, mesmo com valor de rótulo", () => {
    const p = montarParams({
      email: "a",
      token_edicao: "abc123",
      telefone: "11999",
      cpf: "1",
      chave_pix: "x",
      nome: "Ana",
      senha: "s",
      ok: "sim",
    });
    expect(p).toEqual({ ok: "sim" });
  });

  it("texto livre não passa, rótulo passa", () => {
    // "Para Camila" é o título de letra que nenhuma lista de chaves adivinha.
    const p = montarParams({
      titulo: "Para Camila",
      preco: "R$ 38",
      contato: "a@b.com",
      genero: "sertanejo",
      locale: "pt",
      variante: "A",
    });
    expect(p).toEqual({ genero: "sertanejo", locale: "pt", variante: "A" });
  });

  it("número finito e booleano passam; NaN, objeto e nulo não", () => {
    const p = montarParams({ n: 3, b: false, x: Number.NaN, o: { a: 1 }, z: null, u: undefined });
    expect(p).toEqual({ b: false, n: 3 });
  });

  it("device primeiro, depois os do evento em ordem alfabética, até 25", () => {
    const dados: Record<string, unknown> = { device: "mobile" };
    for (let i = 39; i >= 0; i--) dados[`k${String(i).padStart(2, "0")}`] = i;
    const chaves = Object.keys(montarParams(dados));
    expect(chaves).toHaveLength(25);
    expect(chaves.slice(0, 3)).toEqual(["device", "k00", "k01"]);
  });

  it("payload nunca injeta receita nem redireciona o destino", () => {
    const p = montarParams({
      value: 9999,
      currency: "USD",
      transaction_id: "t1",
      send_to: "AW-16919557808",
      items: "x",
      step: 2,
    });
    expect(p).toEqual({ step: 2 });
  });
});

describe("enviarEvento", () => {
  it("leva send_to fixo no GA4, e o payload não consegue trocar", () => {
    em("/criar");
    enviarEvento("x", { send_to: "AW-16919557808", a: 1 });
    expect(gtag).toHaveBeenCalledWith("event", "x", { a: 1, send_to: "G-E2EKHK3RQF" });
  });

  it("sem id da propriedade não faz nada", () => {
    em("/criar");
    enviarEvento("x", {}, null);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("sem gtag (bloqueador de anúncio) não quebra", () => {
    vi.stubGlobal("window", { location: { pathname: "/criar" } });
    expect(() => enviarEvento("x", {})).not.toThrow();
  });

  it("em rota sensível fica calado", () => {
    for (const caminho of ["/editar/abc", "/p/xyz", "/pix/ref1", "/admin", "/es/editar/abc"]) {
      em(caminho);
      enviarEvento("x", {});
      expect(gtag, caminho).not.toHaveBeenCalled();
    }
  });
});

describe("encaminharGa4", () => {
  it("encaminha evento comum com os parâmetros já filtrados", () => {
    em("/criar");
    encaminharGa4("quiz_step", {
      step: 4,
      device: "mobile",
      attribution: { utm_source: "google" },
      fbp: "fb.1.2.3",
      path: "/criar",
    });
    expect(gtag).toHaveBeenCalledWith("event", "quiz_step", {
      device: "mobile",
      utm_source: "google",
      step: 4,
      send_to: "G-E2EKHK3RQF",
    });
  });

  it("page_view nosso não vai: o GA4 já coleta e dobraria", () => {
    em("/");
    encaminharGa4("page_view", { is_landing: true });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("os promovidos não vão com o nome nosso", () => {
    expect([...PROMOVIDOS].sort()).toEqual([
      "checkout_click",
      "letra_finalizada",
      "oferta_vista",
      "pix_transparente_gerado",
    ]);
    em("/criar");
    for (const nome of PROMOVIDOS) encaminharGa4(nome, { valor: 38 });
    expect(gtag).not.toHaveBeenCalled();
  });
});
