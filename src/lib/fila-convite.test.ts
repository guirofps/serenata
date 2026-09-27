import { describe, expect, it } from "vitest";
import { montarFila, somenteBrasileiros, type PedidoPago } from "./fila-convite";

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

const base = { bloqueados: [], codigos: [], lote: 100 };

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

describe("somenteBrasileiros", () => {
  const c = (quizId: string | null) => ({ email: "a@b.com", nome: "A", quizId, codigo: null });

  it("tira quem comprou no funil espanhol", () => {
    // Lá o preço é em DÓLAR e a trigger recusa `locale <> 'pt'`: o convite
    // prometeria uma comissão que o banco nunca vai creditar.
    expect(somenteBrasileiros([c("q1")], new Map([["q1", "es"]]))).toEqual([]);
  });

  it("mantém o brasileiro", () => {
    expect(somenteBrasileiros([c("q1")], new Map([["q1", "pt"]]))).toHaveLength(1);
  });

  it("sem quiz vinculado, FICA — o funil espanhol nasceu depois", () => {
    // Os dois erros não custam o mesmo: deixar de convidar um comprador
    // legítimo é receita perdida em silêncio, que ninguém vai investigar.
    expect(somenteBrasileiros([c(null)], new Map())).toHaveLength(1);
  });

  it("quiz que não voltou na consulta também fica", () => {
    expect(somenteBrasileiros([c("sumiu")], new Map())).toHaveLength(1);
  });
});

// A JANELA DE HORÁRIO do disparo, em `conviteIndicacao.ts`.
//
// O fuso é a parte que erra em silêncio: o servidor da Vercel roda em UTC, e
// "9h" lido de `new Date().getHours()` lá seria 6h no Brasil. O e-mail sairia
// na madrugada de quem recebe, que é o horário que filtro de spam usa como
// sinal — e ninguém ia perceber olhando o código.
describe("a janela de horário", () => {
  // O import fica aqui dentro: o módulo do job puxa o cliente do Inngest, e
  // no topo do arquivo isso custaria a carga em todo teste da fila.
  const emUtc = (iso: string) => new Date(iso).getTime();

  it("não manda de madrugada no Brasil", async () => {
    const { dentroDaJanela } = await import("../../inngest/functions/conviteIndicacao");
    // 05:00 UTC = 02:00 no Brasil.
    expect(dentroDaJanela(emUtc("2026-09-28T05:00:00Z"))).toBe(false);
  });

  it("manda às 9h da manhã no Brasil, não às 9h UTC", async () => {
    const { dentroDaJanela } = await import("../../inngest/functions/conviteIndicacao");
    // 12:00 UTC = 09:00 BR: abre.
    expect(dentroDaJanela(emUtc("2026-09-28T12:00:00Z"))).toBe(true);
    // 09:00 UTC = 06:00 BR: ainda fechado. É este o caso que pega o fuso.
    expect(dentroDaJanela(emUtc("2026-09-28T09:00:00Z"))).toBe(false);
  });

  it("fecha às 20h no Brasil", async () => {
    const { dentroDaJanela } = await import("../../inngest/functions/conviteIndicacao");
    // 22:59 UTC = 19:59 BR: último minuto.
    expect(dentroDaJanela(emUtc("2026-09-28T22:59:00Z"))).toBe(true);
    // 23:00 UTC = 20:00 BR: fechou.
    expect(dentroDaJanela(emUtc("2026-09-28T23:00:00Z"))).toBe(false);
  });
});
