import { describe, expect, it } from "vitest";
import { lerOsSinais } from "./sinais-geracao";

// O SINAL DA QUEDA DO ORQUESTRADOR.
//
// Os outros três sinais estão cobertos em `vigia-geracao.test.ts`, que
// continua valendo (a função é a mesma, só mudou de casa). Aqui é o quarto, o
// que nasceu da queda do Inngest de 04/09/2026.
//
// O formato daquela falha é o mais silencioso que existe, e por isso os três
// sinais anteriores passaram inteiros por baixo dele nos primeiros minutos:
//
//   nada FALHOU  -> `provedor-recusando` não acende
//   a fila leva tempo pra passar de 15 -> `fila-grande` não acende
//   `nada-saiu` só acende com 3+ letras E zero prontas na MESMA janela de
//       20 min, e no começo da queda ainda havia música terminando
//
// O que morre na hora exata da queda é o RELÓGIO: nenhuma música nova fica
// pronta. Este teste existe pra esse relógio não voltar a ser ignorado.

const base = { letrasNovas: 0, prontasNaJanela: 0, totalPresas: 0, falhas: 0, minutosSemProntas: null };

describe("o sinal do orquestrador mudo", () => {
  it("acende quando o relógio para com gente no funil", () => {
    // 04/09, 15h40: fila ainda pequena, nada falhando, e 29 minutos sem
    // nenhuma música ficar pronta enquanto o funil recebia gente.
    const r = lerOsSinais({ ...base, letrasNovas: 2, prontasNaJanela: 1, totalPresas: 6, minutosSemProntas: 29 });
    expect(r.avisar).toBe(true);
    expect(r.motivo).toBe("orquestrador-mudo");
  });

  it("dorme de madrugada", () => {
    // 4h da manhã: horas sem música porque não tem ninguém, não porque
    // quebrou. Alerta que acorda o dono à toa deixa de ser lido.
    const r = lerOsSinais({ ...base, letrasNovas: 0, minutosSemProntas: 240 });
    expect(r.avisar).toBe(false);
  });

  it("não confunde pico movimentado com pane", () => {
    // Fila de 10 no horário de pico, mas saindo música: é o dia bom.
    const r = lerOsSinais({ ...base, letrasNovas: 12, prontasNaJanela: 11, totalPresas: 10, minutosSemProntas: 3 });
    expect(r.avisar).toBe(false);
  });

  it("aguenta o pipeline lento sem gritar", () => {
    // O pipeline leva 84s a 110s, mediana medida de 112s. Vinte minutos é
    // lentidão, não é queda; abaixo de 25 o vigia segura.
    expect(lerOsSinais({ ...base, letrasNovas: 5, prontasNaJanela: 1, minutosSemProntas: 20 }).avisar).toBe(false);
    expect(lerOsSinais({ ...base, letrasNovas: 5, prontasNaJanela: 1, minutosSemProntas: 25 }).motivo).toBe("orquestrador-mudo");
  });

  it("sobrevive a nunca ter existido música", () => {
    // Banco novo, ou coluna vazia: `null` não pode virar alerta nem exceção.
    expect(lerOsSinais({ ...base, letrasNovas: 9, minutosSemProntas: null }).motivo).not.toBe("orquestrador-mudo");
  });

  it("é o ÚLTIMO a ser consultado, e isso é de propósito", () => {
    // Numa queda longa os sinais se sobrepõem: o relógio para, a fila
    // engorda e nada sai. Quem ganha é quem foi checado antes, e a ordem não
    // é arbitrária — ela vai do mais específico pro mais genérico.
    //
    // Uma hora de queda tem `nada-saiu` acendendo junto, e tudo bem: os dois
    // pedem a MESMA ação (pausar as campanhas). O `orquestrador-mudo` não
    // existe pra ganhar essas disputas, existe pros primeiros minutos, em que
    // ele é o único que acende.
    const queda = { ...base, letrasNovas: 9, prontasNaJanela: 0, totalPresas: 40, minutosSemProntas: 55 };
    expect(lerOsSinais(queda).motivo).toBe("nada-saiu");
    expect(lerOsSinais(queda).avisar).toBe(true);

    // E o começo da mesma queda, que é o caso que ele existe pra pegar:
    // ainda saiu música na janela, a fila ainda é pequena, nada falhou.
    const comeco = { ...base, letrasNovas: 4, prontasNaJanela: 2, totalPresas: 5, minutosSemProntas: 26 };
    expect(lerOsSinais(comeco).motivo).toBe("orquestrador-mudo");
  });
});

describe("os três sinais antigos continuam de pé", () => {
  it("não regrediram ao ganhar o campo novo", () => {
    // O campo `minutosSemProntas` é opcional: quem chama sem ele (o vigia de
    // dentro, se um dia esquecer de passar) tem que se comportar igual antes.
    expect(lerOsSinais({ letrasNovas: 5, prontasNaJanela: 0, totalPresas: 0, falhas: 0 }).motivo).toBe("nada-saiu");
    expect(lerOsSinais({ letrasNovas: 0, prontasNaJanela: 0, totalPresas: 20, falhas: 0 }).motivo).toBe("fila-grande");
    expect(lerOsSinais({ letrasNovas: 5, prontasNaJanela: 1, totalPresas: 0, falhas: 4 }).motivo).toBe("provedor-recusando");
  });
});
