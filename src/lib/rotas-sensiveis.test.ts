import { describe, expect, it } from "vitest";
import { rotaSensivel } from "./rotas-sensiveis";
import { literalLike, termoParaOr } from "./sql-like";

describe("rotaSensivel — onde script de terceiro não entra", () => {
  it("bloqueia as rotas cujo caminho É a autorização", () => {
    expect(rotaSensivel("/p/abc123def456")).toBe(true);
    expect(rotaSensivel("/editar/abc123def456")).toBe(true);
    expect(rotaSensivel("/quadro/abc123")).toBe(true);
    expect(rotaSensivel("/retomar")).toBe(true);
    // A tela que reabre um PIX pendente: o caminho carrega a referência da
    // cobrança e a tela mostra o copia-e-cola. Nenhum dos dois tem por que
    // ser copiado pro servidor do Google.
    expect(rotaSensivel("/pix/serenata:45669d37-3985-45d8-9193-a16683c8e821")).toBe(true);
    expect(rotaSensivel("/auth/callback")).toBe(true);
  });

  it("bloqueia os painéis internos, que mostram PII de cliente", () => {
    expect(rotaSensivel("/admin")).toBe(true);
    expect(rotaSensivel("/recuperar")).toBe(true);
    expect(rotaSensivel("/dashboard")).toBe(true);
  });

  it("bloqueia também com prefixo de idioma", () => {
    expect(rotaSensivel("/es/dashboard")).toBe(true);
    expect(rotaSensivel("/es/auth/callback")).toBe(true);
  });

  it("DEIXA passar o funil — é onde a medição paga o próprio preço", () => {
    expect(rotaSensivel("/")).toBe(false);
    expect(rotaSensivel("/criar")).toBe(false);
    expect(rotaSensivel("/es")).toBe(false);
    expect(rotaSensivel("/es/criar")).toBe(false);
    // A conversão do Google Ads dispara AQUI. Se esta virar `true`, a
    // campanha para de otimizar — por isso o teste existe.
    expect(rotaSensivel("/obrigado")).toBe(false);
  });

  it("não confunde rota que só começa parecido", () => {
    // `/patrocinio` começa com `/p` mas não é `/p/`.
    expect(rotaSensivel("/patrocinio")).toBe(false);
  });
});

describe("literalLike — curinga de LIKE não é curinga", () => {
  it("neutraliza % e _, que são válidos em e-mail", () => {
    expect(literalLike("a_b@gmail.com")).toBe("a\\_b@gmail.com");
    expect(literalLike("%@gmail.com")).toBe("\\%@gmail.com");
  });

  it("escapa a barra ANTES dos curingas, senão escaparia as próprias barras", () => {
    expect(literalLike("a\\_b")).toBe("a\\\\\\_b");
  });

  it("não mexe em endereço normal", () => {
    expect(literalLike("rodrigo.santos@gmail.com")).toBe("rodrigo.santos@gmail.com");
  });
});

describe("termoParaOr — separadores do PostgREST", () => {
  it("tira vírgula e parênteses, que são sintaxe do `or`", () => {
    expect(termoParaOr("silva,id.gte.0")).toBe("silva id.gte.0");
    expect(termoParaOr("maria (santos)")).toBe("maria  santos");
  });

  it("neutraliza curinga junto", () => {
    expect(termoParaOr("100%")).toBe("100\\%");
  });
});
