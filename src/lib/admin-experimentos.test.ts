import { describe, expect, it } from "vitest";
import { decidirSalvamento } from "./admin-experimentos";
import { FORA, type Variante } from "./experimentos";

// Testa SÓ `decidirSalvamento`: é onde moram as travas, é lógica pura (sem
// banco, sem rede), e é onde um erro custa dinheiro de verdade — o teste de
// preço em produção. As duas server functions (`carregarExperimentos` e
// `salvarExperimento`) não são testadas aqui: elas são fiação (autenticar,
// ler o banco, gravar) em cima desta decisão, sem lógica própria.

const planoA: Variante = {
  nome: "A",
  peso: 1,
  plano: { texto: "R$ 37", valor: 37, ancora: "R$ 67", checkout: "https://pay/a" },
};
const planoB: Variante = {
  nome: "B",
  peso: 1,
  plano: { texto: "R$ 47", valor: 47, ancora: "R$ 67", checkout: "https://pay/b" },
};

describe("decidirSalvamento", () => {
  it("experimento inexistente no banco é recusado", () => {
    const r = decidirSalvamento(null, {
      id: "preco",
      ativo: false,
      exposicaoPct: 100,
      nota: "",
      variantes: [planoA],
    });
    expect(r).toEqual({ ok: false, erro: "experimento não existe" });
  });

  it("lista de variantes vazia é recusada", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA] },
      { id: "preco", ativo: false, exposicaoPct: 100, nota: "", variantes: [] },
    );
    expect(r.ok).toBe(false);
  });

  it(`variante chamada "${FORA}" é recusada — palavra reservada pra quem não entra no teste`, () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [planoA, { ...planoB, nome: FORA }],
      },
    );
    expect(r).toEqual({
      ok: false,
      erro: `\`${FORA}\` é reservado pra quem não entra no teste`,
    });
  });

  it("nomes duplicados entre variantes são recusados", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [planoA, { ...planoB, nome: "A" }],
      },
    );
    expect(r).toEqual({ ok: false, erro: "duas versões com o mesmo nome" });
  });

  // ── TRAVA 1: preço e link só-leitura enquanto ativo ──────────────────

  it("TRAVA 1: mudar preço com o experimento ATIVO no banco é RECUSADO", () => {
    const r = decidirSalvamento(
      { ativo: true, variantes: [planoA] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 100,
        nota: "",
        variantes: [{ ...planoA, plano: { ...planoA.plano!, valor: 99 } }],
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/desligue o teste/);
  });

  it("TRAVA 1: mudar preço com o experimento DESLIGADO no banco é ACEITO", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [{ ...planoA, plano: { ...planoA.plano!, valor: 99 } }],
      },
    );
    expect(r).toEqual({ ok: true });
  });

  it("TRAVA 1: mesmo preço, mesmas variantes, ativo continua true — ACEITO (só mexeu na nota/exposição)", () => {
    const r = decidirSalvamento(
      { ativo: true, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 50,
        nota: "nota nova",
        variantes: [planoA, planoB],
      },
    );
    expect(r).toEqual({ ok: true });
  });

  it("O FURO DO PAYLOAD: mandar ativo:false junto com preço novo, quando o BANCO diz ativo:true, é RECUSADO", () => {
    // Se a comparação usasse `entrada.ativo` (o que o clique mandou) em vez
    // de `banco.ativo` (o que a linha diz agora), bastaria mandar
    // `ativo:false` pra Trava 1 nem rodar. Aqui `banco.ativo` é `true` e
    // `entrada.ativo` é `false` — a trava tem que olhar pro banco.
    const r = decidirSalvamento(
      { ativo: true, variantes: [planoA] },
      {
        id: "preco",
        ativo: false, // <- o furo: tenta "desligar" no mesmo request que muda o preço
        exposicaoPct: 100,
        nota: "",
        variantes: [{ ...planoA, plano: { ...planoA.plano!, valor: 1 } }],
      },
    );
    expect(r.ok).toBe(false);
  });

  // ── TRAVA 2: sem dois checkouts iguais ao ligar ──────────────────────

  it("TRAVA 2: ligar com dois checkouts iguais é RECUSADO", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 100,
        nota: "",
        variantes: [planoA, { ...planoB, plano: { ...planoB.plano!, checkout: planoA.plano!.checkout } }],
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/mesmo link/);
  });

  it("TRAVA 2: checkouts diferentes ao ligar é ACEITO", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, planoB] },
    );
    expect(r).toEqual({ ok: true });
  });

  it("TRAVA 2: NÃO se aplica com o experimento desligado — dois checkouts iguais passam se `ativo:false`", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [planoA, { ...planoB, plano: { ...planoB.plano!, checkout: planoA.plano!.checkout } }],
      },
    );
    expect(r).toEqual({ ok: true });
  });

  // ── TRAVA 3: variante sem plano completo não liga ────────────────────

  it("TRAVA 3: ligar com uma variante sem checkout é RECUSADO", () => {
    const semCheckout: Variante = { nome: "C", peso: 1, plano: { texto: "R$ 9", valor: 9, ancora: "R$ 19", checkout: "" } };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, semCheckout] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, semCheckout] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/sem preço ou link/);
  });

  it("TRAVA 3: ligar com uma variante sem `plano` nenhum é RECUSADO", () => {
    const semPlano: Variante = { nome: "C", peso: 1 };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, semPlano] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, semPlano] },
    );
    expect(r.ok).toBe(false);
  });

  it("TRAVA 3: ligar com uma variante com valor não-finito (NaN) é RECUSADO", () => {
    const valorRuim: Variante = {
      nome: "C",
      peso: 1,
      plano: { texto: "R$ ?", valor: NaN, ancora: "R$ 19", checkout: "https://pay/c" },
    };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, valorRuim] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, valorRuim] },
    );
    expect(r.ok).toBe(false);
  });

  it("TRAVA 3: NÃO se aplica com o experimento desligado — variante incompleta passa se `ativo:false`", () => {
    const semPlano: Variante = { nome: "C", peso: 1 };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, semPlano] },
      { id: "preco", ativo: false, exposicaoPct: 100, nota: "", variantes: [planoA, semPlano] },
    );
    expect(r).toEqual({ ok: true });
  });
});
