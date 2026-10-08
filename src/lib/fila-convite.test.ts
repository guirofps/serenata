import { describe, expect, it } from "vitest";
import { loteDaVez, montarFila, type PedidoPago } from "./fila-convite";

// A FILA DO DISPARO ÚNICO, testada onde ela erra sem avisar.
//
// Os quatro defeitos possíveis aqui SAEM, chegam na caixa de alguém e não
// acendem nada: mandar pra quem se descadastrou, mandar duas vezes pra mesma
// pessoa, mandar de novo pra quem já recebeu, e prometer comissão a quem
// comprou em dólar (onde a trigger nunca vai comissionar).

const pedido = (o: Partial<PedidoPago> = {}): PedidoPago => ({
  email: "a@b.com",
  nome_pagador: "MARIA DAS DORES",
  quiz_response_id: "q1",
  created_at: "2026-09-01T00:00:00Z",
  ...o,
});

const base = { bloqueados: [], codigos: [], quizNaoPt: new Set<string>(), lote: 100 };

describe("montarFila", () => {
  it("um convite por pessoa, mesmo quem comprou três vezes", () => {
    const fila = montarFila({
      ...base,
      pagos: [
        pedido({ created_at: "2026-09-01T00:00:00Z" }),
        pedido({ created_at: "2026-09-05T00:00:00Z" }),
        pedido({ created_at: "2026-09-09T00:00:00Z" }),
      ],
    });
    expect(fila).toHaveLength(1);
  });

  it("NÃO manda pra quem se descadastrou, ignorando caixa e espaço", () => {
    const fila = montarFila({
      ...base,
      pagos: [pedido({ email: "Fulano@Gmail.com" })],
      bloqueados: ["  FULANO@gmail.com "],
    });
    expect(fila).toEqual([]);
  });

  it("NÃO manda de novo pra quem já recebeu", () => {
    const fila = montarFila({
      ...base,
      pagos: [pedido({ email: "a@b.com" })],
      codigos: [{ email: "a@b.com", codigo: "K7M2QX", convite_enviado_em: "2026-09-27T10:00:00Z" }],
    });
    expect(fila).toEqual([]);
  });

  it("mas manda pra quem tem código e ainda não recebeu — e reaproveita o código", () => {
    const fila = montarFila({
      ...base,
      pagos: [pedido({ email: "a@b.com" })],
      codigos: [{ email: "a@b.com", codigo: "K7M2QX", convite_enviado_em: null }],
    });
    expect(fila).toHaveLength(1);
    // Gerar um código novo pra quem já tem invalidaria o link que ela
    // porventura já tenha mandado pra alguém.
    expect(fila[0].codigo).toBe("K7M2QX");
  });

  it("quem ainda não tem código sai com `null` — o job cria antes de mandar", () => {
    const fila = montarFila({ ...base, pagos: [pedido()] });
    expect(fila[0].codigo).toBeNull();
  });

  it("endereço impossível não entra na fila e não ocupa a vaga de ninguém (08/10)", () => {
    // Os de verdade, vistos nos logs: o Resend recusava, nada marcava, e eles
    // voltavam na frente a cada rodada até encher o lote.
    const fila = montarFila({
      ...base,
      pagos: [
        pedido({ email: "x@gmail..com", created_at: "2026-09-01T00:00:00Z" }),
        pedido({ email: "x@gmail.comj9", created_at: "2026-09-02T00:00:00Z" }),
        pedido({ email: "bom@gmail.com", created_at: "2026-09-03T00:00:00Z" }),
      ],
      lote: 1,
    });
    expect(fila.map((c) => c.email)).toEqual(["bom@gmail.com"]);
  });

  it("respeita o lote", () => {
    const pagos = Array.from({ length: 50 }, (_, i) => pedido({ email: `p${i}@b.com` }));
    expect(montarFila({ ...base, pagos, lote: 7 })).toHaveLength(7);
  });

  it("lote zero ou negativo não manda nada (em vez de mandar tudo)", () => {
    const pagos = [pedido()];
    expect(montarFila({ ...base, pagos, lote: 0 })).toEqual([]);
    expect(montarFila({ ...base, pagos, lote: -5 })).toEqual([]);
  });

  it("o nome vem do pedido MAIS RECENTE, e sai tratado", () => {
    const fila = montarFila({
      ...base,
      pagos: [
        pedido({ nome_pagador: "JOAO", created_at: "2026-09-01T00:00:00Z" }),
        pedido({ nome_pagador: "MARIA DAS DORES", created_at: "2026-09-09T00:00:00Z" }),
      ],
    });
    expect(fila[0].nome).toBe("Maria");
  });

  it("pedido novo SEM nome não apaga o nome que o anterior trouxe", () => {
    // O gateway preenche `nome_pagador` em 99% dos pedidos. O 1% que falta não
    // pode transformar "Maria, você já fez..." em "Você já fez...".
    const fila = montarFila({
      ...base,
      pagos: [
        pedido({ nome_pagador: "MARIA", created_at: "2026-09-01T00:00:00Z" }),
        pedido({ nome_pagador: null, created_at: "2026-09-09T00:00:00Z" }),
      ],
    });
    expect(fila[0].nome).toBe("Maria");
  });

  it("pedido sem e-mail não vira linha vazia na fila", () => {
    expect(montarFila({ ...base, pagos: [pedido({ email: null }), pedido({ email: "  " })] })).toEqual([]);
  });
});

describe("o funil espanhol sai ANTES do corte", () => {
  it("quem comprou em espanhol não entra na fila", () => {
    // Lá o preço é em DÓLAR e a trigger da comissão recusa `locale <> 'pt'`:
    // o convite prometeria uma comissão que o banco nunca vai creditar.
    const fila = montarFila({
      ...base,
      pagos: [pedido({ email: "es@b.com", quiz_response_id: "q-es" })],
      quizNaoPt: new Set(["q-es"]),
    });
    expect(fila).toEqual([]);
  });

  it("pedido sem quiz vinculado FICA — o funil espanhol nasceu depois", () => {
    const fila = montarFila({
      ...base,
      pagos: [pedido({ quiz_response_id: null })],
      quizNaoPt: new Set(["q-es"]),
    });
    expect(fila).toHaveLength(1);
  });

  // ── O TESTE QUE TERIA PEGADO O BUG DE PRODUÇÃO ────────────────
  //
  // A primeira versão cortava em `lote` e só DEPOIS tirava o espanhol. Cada
  // teste isolado passava: a fila saía sem espanhol, o lote era respeitado,
  // tudo verde. O defeito só existe ao longo de VÁRIAS rodadas — o espanhol
  // descartado nunca era marcado como enviado, voltava a ocupar a vaga, e
  // eles se acumulavam na cabeça.
  //
  // Em produção a vazão caiu 4, 4, 4, 3, 3, 2, 2, 2, 2, 2 — rumo a zero, onde
  // o disparo pararia sozinho sem nada falhar e sem nada no log.
  //
  // Um teste de uma rodada não pega isso. Este simula a campanha inteira.
  it("a fila DRENA: todo brasileiro elegível acaba recebendo", () => {
    const LOTE = 5;
    // Espanhóis logo no começo, que é onde eles realmente estão: a fila é
    // ordenada do comprador mais antigo pro mais novo.
    const pagos = [
      ...Array.from({ length: 3 }, (_, i) =>
        pedido({ email: `es${i}@b.com`, quiz_response_id: `q-es${i}`, created_at: `2026-08-0${i + 1}T00:00:00Z` }),
      ),
      ...Array.from({ length: 40 }, (_, i) =>
        pedido({ email: `br${i}@b.com`, quiz_response_id: `q-br${i}`, created_at: `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z` }),
      ),
    ];
    const quizNaoPt = new Set(["q-es0", "q-es1", "q-es2"]);

    const enviados = new Set<string>();
    const porRodada: number[] = [];
    for (let r = 0; r < 20; r++) {
      const fila = montarFila({
        pagos,
        bloqueados: [],
        quizNaoPt,
        lote: LOTE,
        codigos: [...enviados].map((email) => ({
          email,
          codigo: "K7M2QX",
          convite_enviado_em: "2026-09-28T12:00:00Z",
        })),
      });
      porRodada.push(fila.length);
      for (const c of fila) enviados.add(c.email);
      if (!fila.length) break;
    }

    // A VAZÃO NÃO DEGRADA: toda rodada com gente na fila manda o lote cheio.
    const comTrabalho = porRodada.filter((n) => n > 0);
    expect(comTrabalho.slice(0, -1).every((n) => n === LOTE), `vazão por rodada: ${porRodada.join(", ")}`).toBe(true);

    // E TODO MUNDO RECEBE: 40 brasileiros, nenhum espanhol.
    expect(enviados.size).toBe(40);
    expect([...enviados].some((e) => e.startsWith("es"))).toBe(false);
  });
});

describe("a rampa do disparo", () => {
  it("começa pequeno: os primeiros 200 saem a 5 por rodada", () => {
    // ~110/dia sobre os ~380/dia que o domínio já manda. Entrar com 440
    // dobraria o volume de marketing de uma hora pra outra.
    expect(loteDaVez(0)).toBe(5);
    expect(loteDaVez(199)).toBe(5);
  });

  it("sobe em degraus, medidos pelo que JÁ SAIU e não por data", () => {
    // Por contagem e não por data: não depende de ninguém lembrar de mexer, e
    // se o job ficar parado um dia ela retoma de onde estava em vez de pular
    // pro fim.
    expect(loteDaVez(200)).toBe(10);
    expect(loteDaVez(699)).toBe(10);
    expect(loteDaVez(700)).toBe(20);
    expect(loteDaVez(4000)).toBe(20);
  });

  it("nunca passa do lote cheio, por maior que fique a base", () => {
    expect(loteDaVez(999_999)).toBe(20);
  });

  it("o override do painel VENCE a rampa, inclusive pra baixo", () => {
    expect(loteDaVez(4000, 3)).toBe(3);
    expect(loteDaVez(0, 50)).toBe(50);
  });

  it("override ZERO pausa — é o freio que não precisa de deploy", () => {
    // O caso que importa: reclamação de spam subindo às 21h de um sábado.
    expect(loteDaVez(4000, 0)).toBe(0);
  });

  it("override ausente ou lixo cai na rampa, não em zero", () => {
    // `Number(undefined)` é NaN, e NaN virando 0 pausaria o disparo pra
    // sempre por causa de uma linha que ninguém criou em config_operacao.
    expect(loteDaVez(0, null)).toBe(5);
    expect(loteDaVez(0, undefined)).toBe(5);
    expect(loteDaVez(0, Number("abc"))).toBe(5);
  });

  it("override negativo não vira lote negativo", () => {
    expect(loteDaVez(0, -7)).toBe(0);
  });
});

// Teste `limite_frequencia` (08/10): no braço B, o convite espera 24h depois
// da última compra, e quem espera sai ANTES do corte do lote.
describe("montarFila com espera depois da compra", () => {
  const agora = Date.parse("2026-10-08T15:00:00Z");
  const horasAtras = (h: number) => new Date(agora - h * 3600000).toISOString();
  const espera = { agora, horas: (q: string | null) => (q === "qB" ? 24 : 0) };

  it("o B espera 24h depois da última compra; o A não espera", () => {
    const fila = montarFila({
      ...base,
      esperaAposCompra: espera,
      pagos: [
        pedido({ email: "b@x.com", quiz_response_id: "qB", created_at: horasAtras(2) }),
        pedido({ email: "a@x.com", quiz_response_id: "qA", created_at: horasAtras(2) }),
        pedido({ email: "b2@x.com", quiz_response_id: "qB", created_at: horasAtras(25) }),
      ],
    });
    expect(fila.map((c) => c.email).sort()).toEqual(["a@x.com", "b2@x.com"]);
  });

  it("conta a ÚLTIMA compra da pessoa", () => {
    const fila = montarFila({
      ...base,
      esperaAposCompra: espera,
      pagos: [
        pedido({ email: "b@x.com", quiz_response_id: "qB", created_at: horasAtras(100) }),
        pedido({ email: "b@x.com", quiz_response_id: "qB", created_at: horasAtras(3) }),
      ],
    });
    expect(fila).toHaveLength(0);
  });

  it("quem espera não ocupa a vaga do lote", () => {
    const fila = montarFila({
      ...base,
      lote: 1,
      esperaAposCompra: espera,
      pagos: [
        pedido({ email: "b@x.com", quiz_response_id: "qB", created_at: horasAtras(30) }),
        pedido({ email: "b@x.com", quiz_response_id: "qB", created_at: horasAtras(1) }),
        pedido({ email: "a@x.com", quiz_response_id: "qA", created_at: horasAtras(1) }),
      ],
    });
    expect(fila.map((c) => c.email)).toEqual(["a@x.com"]);
  });

  it("sem o campo, ninguém espera (como era)", () => {
    const fila = montarFila({
      ...base,
      pagos: [pedido({ email: "b@x.com", quiz_response_id: "qB", created_at: horasAtras(1) })],
    });
    expect(fila).toHaveLength(1);
  });
});
