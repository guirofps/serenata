import { describe, expect, it } from "vitest";
import { decidirSalvamento, formatoValido, nomesComPlanoAlterado } from "./admin-experimentos";
import { FORA, type Variante } from "./experimentos";

// Testa SÓ `decidirSalvamento` e `formatoValido`: são onde moram as travas e
// a guarda de forma, é lógica pura (sem banco, sem rede), e é onde um erro
// custa dinheiro de verdade — o teste de preço em produção. As duas server
// functions (`carregarExperimentos` e `salvarExperimento`) não são testadas
// aqui: elas são fiação (autenticar, ler o banco, gravar) em cima desta
// decisão, sem lógica própria.

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

  it('"FORA" maiúsculo e " fora " com espaço também são recusados — o script do <head> compara em minúsculas', () => {
    for (const variante of ["FORA", " fora ", "FoRa"]) {
      const r = decidirSalvamento(
        { ativo: false, variantes: [planoA] },
        {
          id: "preco",
          ativo: false,
          exposicaoPct: 100,
          nota: "",
          variantes: [planoA, { ...planoB, nome: variante }],
        },
      );
      expect(r.ok, `variante "${variante}" deveria ser recusada`).toBe(false);
    }
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

  it("nome de variante vazio (ou só espaço) é recusado — sorteia valor falsy e reabre o sorteio a cada visita", () => {
    for (const nome of ["", "   "]) {
      const r = decidirSalvamento(
        { ativo: false, variantes: [planoA] },
        {
          id: "preco",
          ativo: false,
          exposicaoPct: 100,
          nota: "",
          variantes: [planoA, { ...planoB, nome }],
        },
      );
      expect(r).toEqual({ ok: false, erro: "toda versão precisa de um nome" });
    }
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
    expect(r).toEqual({
      ok: true,
      variantes: [{ ...planoA, plano: { ...planoA.plano!, valor: 99 } }],
    });
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
    expect(r).toEqual({ ok: true, variantes: [planoA, planoB] });
  });

  it("TRAVA 1: REORDENAR as mesmas duas variantes (mesmo conteúdo, ordem trocada) com o teste ATIVO é RECUSADO", () => {
    // A primeira variante é sempre o controle — trocar a ordem troca QUEM é
    // o controle, mesmo sem mudar preço nenhum. Comparação é por posição, de
    // propósito (ver o comentário de `variantesIguaisParaTrava1`).
    const r = decidirSalvamento(
      { ativo: true, variantes: [planoA, planoB] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoB, planoA] },
    );
    expect(r.ok).toBe(false);
  });

  it("TRAVA 1: adicionar uma variante A MAIS com o teste ATIVO é RECUSADO", () => {
    const planoC: Variante = {
      nome: "C",
      peso: 1,
      plano: { texto: "R$ 9", valor: 9, ancora: "R$ 19", checkout: "https://pay/c" },
    };
    const r = decidirSalvamento(
      { ativo: true, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 100,
        nota: "",
        variantes: [planoA, planoB, planoC],
      },
    );
    expect(r.ok).toBe(false);
  });

  it("TRAVA 1: remover uma variante (A MENOS) com o teste ATIVO é RECUSADO", () => {
    const r = decidirSalvamento(
      { ativo: true, variantes: [planoA, planoB] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA] },
    );
    expect(r.ok).toBe(false);
  });

  it("TRAVA 1: mesmo nome, plano DIFERENTE (checkout trocado) com o teste ATIVO é RECUSADO", () => {
    const r = decidirSalvamento(
      { ativo: true, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 100,
        nota: "",
        variantes: [
          planoA,
          { ...planoB, plano: { ...planoB.plano!, checkout: "https://pay/outro" } },
        ],
      },
    );
    expect(r.ok).toBe(false);
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

  // ── TRAVA (pesos): não liga com tudo zerado ──────────────────────────

  it("TRAVA pesos: ligar com TODOS os pesos zerados é RECUSADO", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 100,
        nota: "",
        variantes: [
          { ...planoA, peso: 0 },
          { ...planoB, peso: 0 },
        ],
      },
    );
    expect(r).toEqual({
      ok: false,
      erro: "pelo menos uma versão precisa ter peso maior que zero",
    });
  });

  it("TRAVA pesos: ligar com UM peso zerado e outro positivo é ACEITO (zerar um braço isolado é válido)", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 100,
        nota: "",
        variantes: [{ ...planoA, peso: 0 }, planoB],
      },
    );
    expect(r.ok).toBe(true);
  });

  it("TRAVA pesos: NÃO se aplica com o experimento desligado", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [
          { ...planoA, peso: 0 },
          { ...planoB, peso: 0 },
        ],
      },
    );
    expect(r.ok).toBe(true);
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
        variantes: [
          planoA,
          { ...planoB, plano: { ...planoB.plano!, checkout: planoA.plano!.checkout } },
        ],
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
    expect(r).toEqual({ ok: true, variantes: [planoA, planoB] });
  });

  it("TRAVA 2: checkouts iguais só na aparência (um com espaço nas pontas) é RECUSADO — o navegador ignora o espaço", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 100,
        nota: "",
        variantes: [
          planoA,
          { ...planoB, plano: { ...planoB.plano!, checkout: `${planoA.plano!.checkout} ` } },
        ],
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/mesmo link/);
  });

  it("TRAVA 2: checkout salvo fica TRIMADO — não vaza o espaço sujo pro banco", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [{ ...planoA, plano: { ...planoA.plano!, checkout: "  https://pay/a  " } }],
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.variantes[0].plano?.checkout).toBe("https://pay/a");
  });

  it("TRAVA 2: NÃO se aplica com o experimento desligado — dois checkouts iguais passam se `ativo:false`", () => {
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [
          planoA,
          { ...planoB, plano: { ...planoB.plano!, checkout: planoA.plano!.checkout } },
        ],
      },
    );
    expect(r).toEqual({
      ok: true,
      variantes: [
        planoA,
        { ...planoB, plano: { ...planoB.plano!, checkout: planoA.plano!.checkout } },
      ],
    });
  });

  // ── TRAVA 3: variante sem plano completo (juiz: planoCompleto de preco.ts) ──

  it("TRAVA 3: ligar com uma variante sem checkout é RECUSADO", () => {
    const semCheckout: Variante = {
      nome: "C",
      peso: 1,
      plano: { texto: "R$ 9", valor: 9, ancora: "R$ 19", checkout: "" },
    };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, semCheckout] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, semCheckout] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/sem preço ou link/);
  });

  it("TRAVA 3: ligar com uma variante com `ancora` vazia é RECUSADO — a checagem antiga não pegava isso", () => {
    // Sondado na revisão: a versão anterior desta trava não exigia `ancora`
    // preenchida. Com `ancora:""`, `planoCompleto` (de preco.ts) rejeita a
    // variante — e é ELE quem decide, em runtime, quem entra em
    // `variantesComPlano`. Se esta trava deixasse passar o que o runtime
    // rejeita, o experimento ligaria com uma variante sorteada e SEM bloco
    // de preço na tela.
    const semAncora: Variante = {
      nome: "C",
      peso: 1,
      plano: { texto: "R$ 9", valor: 9, ancora: "", checkout: "https://pay/c" },
    };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, semAncora] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, semAncora] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/sem preço ou link/);
  });

  it("TRAVA 3: ligar com `texto` ou `checkout` só de espaço em branco é RECUSADO — a checagem antiga não fazia trim", () => {
    const soEspaco: Variante = {
      nome: "C",
      peso: 1,
      plano: { texto: "   ", valor: 9, ancora: "R$ 19", checkout: "   " },
    };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, soEspaco] },
      { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, soEspaco] },
    );
    expect(r.ok).toBe(false);
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

  it("TRAVA 3: ligar com valor ZERO ou NEGATIVO é RECUSADO — conversão sem sentido pro Google Ads", () => {
    for (const valor of [0, -10]) {
      const ruim: Variante = {
        nome: "C",
        peso: 1,
        plano: { texto: "R$ 0", valor, ancora: "R$ 19", checkout: "https://pay/c" },
      };
      const r = decidirSalvamento(
        { ativo: false, variantes: [planoA, ruim] },
        { id: "preco", ativo: true, exposicaoPct: 100, nota: "", variantes: [planoA, ruim] },
      );
      expect(r.ok, `valor ${valor} deveria ser recusado`).toBe(false);
    }
  });

  it("TRAVA 3: NÃO se aplica com o experimento desligado — variante incompleta passa se `ativo:false`", () => {
    const semPlano: Variante = { nome: "C", peso: 1 };
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, semPlano] },
      { id: "preco", ativo: false, exposicaoPct: 100, nota: "", variantes: [planoA, semPlano] },
    );
    expect(r).toEqual({ ok: true, variantes: [planoA, semPlano] });
  });
});

describe("formatoValido", () => {
  const base = {
    id: "preco",
    ativo: true,
    exposicaoPct: 100,
    nota: "",
    variantes: [planoA],
  };

  it("payload bem formado é aceito", () => {
    expect(formatoValido(base)).toBe(true);
  });

  it("null e não-objeto são recusados", () => {
    expect(formatoValido(null)).toBe(false);
    expect(formatoValido(undefined)).toBe(false);
    expect(formatoValido("string")).toBe(false);
    expect(formatoValido(42)).toBe(false);
  });

  it("`variantes` faltando é recusado — sem isto, decidirSalvamento estouraria em .length", () => {
    const { variantes: _variantes, ...semVariantes } = base;
    expect(formatoValido(semVariantes)).toBe(false);
  });

  it("`variantes` que não é array é recusado", () => {
    expect(formatoValido({ ...base, variantes: "não é array" })).toBe(false);
    expect(formatoValido({ ...base, variantes: { 0: planoA } })).toBe(false);
  });

  it("`ativo` que não é boolean é recusado", () => {
    expect(formatoValido({ ...base, ativo: "true" })).toBe(false);
  });

  it("`exposicaoPct` que não é número finito é recusado", () => {
    expect(formatoValido({ ...base, exposicaoPct: "100" })).toBe(false);
    expect(formatoValido({ ...base, exposicaoPct: NaN })).toBe(false);
  });

  it("`id` vazio é recusado", () => {
    expect(formatoValido({ ...base, id: "" })).toBe(false);
    expect(formatoValido({ ...base, id: "   " })).toBe(false);
  });

  it("variante com `plano` de tipo errado (campo numérico onde é string) é recusado", () => {
    const ruim = {
      ...base,
      variantes: [{ nome: "A", peso: 1, plano: { ...planoA.plano, texto: 123 } }],
    };
    expect(formatoValido(ruim)).toBe(false);
  });

  it("variante sem `plano` (undefined) é aceito no formato — a completude é regra de negócio, não de forma", () => {
    expect(formatoValido({ ...base, variantes: [{ nome: "A", peso: 1 }] })).toBe(true);
  });
});

// ── TRAVA 2: NOME APOSENTADO, NUNCA RECICLADO ────────────────────
//
// A Trava 1 impede que dois preços apareçam debaixo do mesmo rótulo AGORA. Sem
// esta, o mesmo dano acontece NO TEMPO: desligar, trocar o preço do `B` de
// R$ 19 pra R$ 24, religar — e os dias em cada preço viram uma média só, sem
// jeito de separar depois.

const planoB24: Variante = {
  ...planoB,
  plano: { texto: "R$ 24", valor: 24, ancora: "R$ 67", checkout: "https://pay/b24" },
};

describe("nomesComPlanoAlterado", () => {
  it("nada mudou: lista vazia, e o servidor não vai ao banco de leads", () => {
    expect(
      nomesComPlanoAlterado(
        { ativo: false, variantes: [planoA, planoB] },
        {
          id: "preco",
          ativo: false,
          exposicaoPct: 50,
          nota: "outra nota",
          variantes: [planoA, planoB],
        },
      ),
    ).toEqual([]);
  });

  it("preço trocado no mesmo nome entra na lista", () => {
    expect(
      nomesComPlanoAlterado(
        { ativo: false, variantes: [planoA, planoB] },
        { id: "preco", ativo: false, exposicaoPct: 100, nota: "", variantes: [planoA, planoB24] },
      ),
    ).toEqual(["B"]);
  });

  it("nome que não existia entra na lista — é o caso do nome RECICLADO", () => {
    expect(
      nomesComPlanoAlterado(
        { ativo: false, variantes: [planoA] },
        {
          id: "preco",
          ativo: false,
          exposicaoPct: 100,
          nota: "",
          variantes: [planoA, { ...planoB24, nome: "B" }],
        },
      ),
    ).toEqual(["B"]);
  });

  it("mexer só em peso não conta como mudança de plano", () => {
    expect(
      nomesComPlanoAlterado(
        { ativo: false, variantes: [planoA, planoB] },
        {
          id: "preco",
          ativo: false,
          exposicaoPct: 100,
          nota: "",
          variantes: [planoA, { ...planoB, peso: 7 }],
        },
      ),
    ).toEqual([]);
  });
});

describe("decidirSalvamento — Trava 2", () => {
  const trocarPrecoDoB = (nomesComLead: string[]) =>
    decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      { id: "preco", ativo: false, exposicaoPct: 100, nota: "", variantes: [planoA, planoB24] },
      nomesComLead,
    );

  it("recusa trocar o preço de um nome que já tem lead carimbado, mesmo DESLIGADO", () => {
    const r = trocarPrecoDoB(["B"]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("já tem lead carimbado");
    expect(r.ok === false && r.erro).toContain("B");
  });

  it("aceita a mesma troca quando o nome é NOVO (B vira B2)", () => {
    // O ciclo que a spec prescreve, inteiro: aposenta `B`, cria `B2` com o
    // preço novo. `B` continua com lead carimbado, mas ninguém está mexendo
    // no plano dele.
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA, planoB] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [planoA, { ...planoB24, nome: "B2" }],
      },
      ["A", "B"],
    );
    expect(r.ok).toBe(true);
  });

  it("aceita quando o nome ainda não carimbou ninguém", () => {
    expect(trocarPrecoDoB(["A"]).ok).toBe(true);
  });

  it("recusa RECICLAR um nome aposentado: `B` volta com outro preço", () => {
    // `B` saiu da config (ficou só o A), e o histórico dele continua no
    // `attribution` de quem foi sorteado. Trazê-lo de volta com outro preço é
    // exatamente o que a trava existe pra impedir.
    const r = decidirSalvamento(
      { ativo: false, variantes: [planoA] },
      {
        id: "preco",
        ativo: false,
        exposicaoPct: 100,
        nota: "",
        variantes: [planoA, { ...planoB24, nome: "B" }],
      },
      ["B"],
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("já tem lead carimbado");
  });

  it("sem lista de nomes carimbados, a decisão não inventa: quem lê o banco é o chamador", () => {
    // O padrão vazio existe pra os testes das outras travas e pro caso em que
    // nenhum plano mudou. O fail-closed de verdade (consulta que falhou) mora
    // em `salvarExperimento`, que nem chega a chamar isto.
    expect(trocarPrecoDoB([]).ok).toBe(true);
  });
});
