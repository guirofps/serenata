import { describe, expect, it, beforeAll } from "vitest";
import { assinarOferta, conferirOferta } from "./oferta-assinada";

// O QUE ESTE TESTE SEGURA
//
// O degrau da escada DECIDE O PREÇO: 38, 29, 19 ou 9. Enquanto o link ia pro
// checkout hospedado, o preço morava lá e não havia o que adulterar. Com o
// checkout próprio, um token forjável significa que a primeira pessoa que
// reparar compra tudo a R$ 9 — e conta pros outros.
//
// Então o teste não confere só "assina e confere": ele tenta QUEBRAR.

beforeAll(() => {
  process.env.RECUPERACAO_SECRET = "chave-de-teste-nao-usada-em-producao";
});

const SESSAO = "9f0a1b2c-3d4e-5f60-7182-93a4b5c6d7e8";

describe("oferta assinada", () => {
  it("vai e volta", () => {
    const t = assinarOferta(SESSAO, 9)!;
    expect(conferirOferta(t)).toEqual({ sessao: SESSAO, degrau: 9 });
  });

  it("RECUSA trocar o degrau por um mais barato", () => {
    // O ataque óbvio: pegar o próprio link de R$ 38 e virar R$ 9.
    const t = assinarOferta(SESSAO, 2)!;
    const forjado = t.replace(`${SESSAO}.2.`, `${SESSAO}.11.`);
    expect(conferirOferta(forjado)).toBeNull();
  });

  it("RECUSA usar o token de outra pessoa", () => {
    // Sem a sessão dentro da assinatura, um token de R$ 9 legítimo serviria
    // pra qualquer um, e bastaria passar adiante.
    const t = assinarOferta(SESSAO, 11)!;
    const outra = "00000000-0000-0000-0000-000000000000";
    expect(conferirOferta(t.replace(SESSAO, outra))).toBeNull();
  });

  it("RECUSA assinatura mexida, token cortado e lixo", () => {
    const t = assinarOferta(SESSAO, 5)!;
    expect(conferirOferta(t.slice(0, -1))).toBeNull();
    expect(conferirOferta(t + "x")).toBeNull();
    expect(conferirOferta(`${SESSAO}.5.`)).toBeNull();
    expect(conferirOferta(`${SESSAO}.5`)).toBeNull();
    expect(conferirOferta("")).toBeNull();
    expect(conferirOferta("a.b.c")).toBeNull();
  });

  it("RECUSA degrau que não é inteiro", () => {
    // `9.5` viraria três partes e confundiria o parser; `NaN` viraria preço
    // indefinido lá na frente.
    expect(conferirOferta(`${SESSAO}.9.5.assinatura`)).toBeNull();
    expect(conferirOferta(`${SESSAO}.abc.assinatura`)).toBeNull();
  });

  it("SEM CHAVE não assina nem aceita", () => {
    // O modo de falha que importa: sem segredo configurado, o certo é não
    // emitir link nenhum — nunca "então segue sem assinatura".
    const antes = process.env.RECUPERACAO_SECRET;
    delete process.env.RECUPERACAO_SECRET;
    expect(assinarOferta(SESSAO, 9)).toBeNull();
    expect(conferirOferta(`${SESSAO}.9.qualquercoisa`)).toBeNull();
    process.env.RECUPERACAO_SECRET = antes;
  });

  it("chave diferente não valida token de outra chave", () => {
    const t = assinarOferta(SESSAO, 7)!;
    const antes = process.env.RECUPERACAO_SECRET;
    process.env.RECUPERACAO_SECRET = "outra-chave";
    expect(conferirOferta(t)).toBeNull();
    process.env.RECUPERACAO_SECRET = antes;
  });
});
