import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFERTAS } from "./creditos";
import {
  CARENCIA_DIAS,
  MUSICA_COM_SALDO_CENTAVOS,
  PCT_COMISSAO,
  PCT_DESCONTO,
  SAQUE_MINIMO_CENTAVOS,
  chavePixAceitavel,
  comissaoDe,
  descontoDoConvite,
  gerarCodigo,
  linkDoConvite,
  normalizarCodigo,
  reaisDeCentavos,
} from "./indicacao";

describe("indicação: os números combinados com o dono", () => {
  // Estes quatro também existem em SQL (a trigger da comissão). Se um teste
  // daqui quebrar porque o número mudou, mude a migração junto.
  it("10% pro convidado, 30% pra quem indica, 30 dias, saque a partir de R$ 100", () => {
    expect(PCT_DESCONTO).toBe(10);
    expect(PCT_COMISSAO).toBe(30);
    expect(CARENCIA_DIAS).toBe(30);
    expect(SAQUE_MINIMO_CENTAVOS).toBe(10_000);
  });

  // A troca vale o preço da música extra. Se o preço dela mudar, a troca
  // muda junto (aqui E na migração), senão o saldo compra mais barato que a
  // loja, ou mais caro.
  it("1 música custa R$ 28 do saldo, o mesmo preço da música extra", () => {
    const extra = OFERTAS.find((o) => o.id === "extra");
    expect(MUSICA_COM_SALDO_CENTAVOS).toBe(Math.round((extra?.precoBrl ?? 0) * 100));
    const sql = readFileSync(
      join(__dirname, "../../supabase/migrations/20260928000000_indicacao_troca_musica.sql"),
      "utf8",
    );
    expect(sql).toContain(`< ${MUSICA_COM_SALDO_CENTAVOS} then`);
    expect(sql).toContain(`values (v_email, ${MUSICA_COM_SALDO_CENTAVOS}, 'musica'`);
  });
});

describe("descontoDoConvite", () => {
  it("R$ 38 vira R$ 34,20", () => {
    expect(3800 - descontoDoConvite(3800)).toBe(3420);
  });
  it("arredonda pro centavo, nunca devolve fração", () => {
    expect(descontoDoConvite(2990)).toBe(299);
    expect(descontoDoConvite(3795)).toBe(380);
  });
  it("valor inválido não vira desconto", () => {
    expect(descontoDoConvite(0)).toBe(0);
    expect(descontoDoConvite(-100)).toBe(0);
    expect(descontoDoConvite(Number.NaN)).toBe(0);
  });
});

describe("comissaoDe", () => {
  it("30% do que o convidado pagou", () => {
    expect(comissaoDe(3420)).toBe(1026);
    // Com o vídeo junto: 34,20 + 19,90
    expect(comissaoDe(5410)).toBe(1623);
  });
  it("pedido de zero (crédito, cortesia) não gera comissão", () => {
    expect(comissaoDe(0)).toBe(0);
  });
});

describe("normalizarCodigo", () => {
  it("aceita o código em minúscula e com espaço em volta", () => {
    expect(normalizarCodigo(" k7m2qx ")).toBe("K7M2QX");
  });
  it("recusa os caracteres que o alfabeto tirou de propósito", () => {
    expect(normalizarCodigo("K7M2Q0")).toBeNull();
    expect(normalizarCodigo("K7M2QO")).toBeNull();
    expect(normalizarCodigo("K7M2Q1")).toBeNull();
    expect(normalizarCodigo("K7M2QI")).toBeNull();
    expect(normalizarCodigo("K7M2QL")).toBeNull();
  });
  it("recusa tamanho errado e o que não é texto", () => {
    expect(normalizarCodigo("K7M2Q")).toBeNull();
    expect(normalizarCodigo("K7M2QXX")).toBeNull();
    expect(normalizarCodigo(null)).toBeNull();
    expect(normalizarCodigo(123456)).toBeNull();
    expect(normalizarCodigo("'; drop")).toBeNull();
  });
});

describe("gerarCodigo", () => {
  it("todo código gerado passa no próprio formato", () => {
    for (let i = 0; i < 500; i++) {
      const c = gerarCodigo();
      expect(normalizarCodigo(c)).toBe(c);
    }
  });
  it("não estoura quando o aleatório devolve o limite de cima", () => {
    expect(normalizarCodigo(gerarCodigo(() => 0.9999999999))).not.toBeNull();
  });
});

describe("formatos", () => {
  it("o link aponta pra home com o ref", () => {
    expect(linkDoConvite("K7M2QX")).toBe("https://www.serenatagift.com/criar?ref=K7M2QX");
  });
  it("reais no formato do funil", () => {
    expect(reaisDeCentavos(3420)).toBe("R$ 34,20");
    expect(reaisDeCentavos(10000)).toBe("R$ 100");
    expect(reaisDeCentavos(123456)).toBe("R$ 1.234,56");
  });
});

describe("chavePixAceitavel", () => {
  it("aceita os formatos comuns sem tentar adivinhar o tipo", () => {
    expect(chavePixAceitavel(" fulano@gmail.com ")).toBe("fulano@gmail.com");
    expect(chavePixAceitavel("123.456.789-09")).toBe("123.456.789-09");
    expect(chavePixAceitavel("+5511999998888")).toBe("+5511999998888");
  });
  it("recusa o que sai quebrado no painel", () => {
    expect(chavePixAceitavel("")).toBeNull();
    expect(chavePixAceitavel("abc")).toBeNull();
    expect(chavePixAceitavel("a".repeat(141))).toBeNull();
    expect(chavePixAceitavel("chave\ncom quebra")).toBeNull();
    expect(chavePixAceitavel("<script>x</script>")).toBeNull();
  });
});

// ── O TS E O SQL TÊM QUE CONCORDAR ───────────────────────────────
//
// A comissão é calculada numa TRIGGER do banco (é o único ponto por onde os
// seis caminhos de pagamento passam), e a porcentagem existe nos dois lados:
// aqui ela manda no que a tela PROMETE, lá no que o banco PAGA.
//
// Divergir não quebra nada visivelmente: o site anuncia um número, a conta
// credita outro, e ninguém descobre até um cliente conferir na calculadora —
// numa promessa de dinheiro, que é onde ele confere mesmo. Este teste lê a
// migração mais recente da comissão e recusa a diferença.
describe("a taxa do TypeScript e a da trigger", () => {
  it("são a mesma — mudar uma sem a outra não passa daqui", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const dir = "supabase/migrations";
    const arquivos = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    // A última migração que redefine a trigger é a que está valendo.
    let sql: string | null = null;
    for (const f of arquivos) {
      const txt = await readFile(`${dir}/${f}`, "utf-8");
      if (txt.includes("create or replace function public.indicacao_comissionar()")) sql = txt;
    }
    expect(sql, "nenhuma migração define indicacao_comissionar()").not.toBeNull();

    const m = sql!.match(/round\(new\.valor_centavos \* (\d+) \/ 100\.0\)/);
    expect(m, "não achei a conta da comissão na trigger").not.toBeNull();
    expect(Number(m![1]), "a trigger paga uma porcentagem diferente da que a tela promete").toBe(
      PCT_COMISSAO,
    );
  });
});
