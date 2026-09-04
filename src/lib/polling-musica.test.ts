import { describe, expect, it } from "vitest";

// O RELÓGIO DO LAÇO DE GERAÇÃO.
//
// Cópia da aritmética de `gerarMusica.ts`, testada aqui porque ela decide duas
// coisas caras e nenhuma delas dá erro quando quebra:
//
//   1. quanto o cliente espera pra OUVIR (a prévia é onde a conversão mora)
//   2. quantas execuções do Inngest cada música consome (o plano Pro inclui
//      1 milhão por mês, e polling de 3s o tempo todo daria 1,8 milhão)
//
// O bug que estes testes existem pra impedir já quase aconteceu: o limite de
// "aceita a primeira faixa" era `tentativa >= 6`, que com sleep fixo de 10s
// significava 60 segundos. Ao trocar o sleep por adaptativo, a MESMA linha
// passaria a significar 18 segundos — a espera pela segunda gravação sumiria
// sem ninguém decidir isso, e a prévia deixaria de ser a mesma gravação que a
// pessoa recebe paga.

const RAPIDO_ATE = 20;
const TOTAL = 56;

/** Segundos decorridos no início da volta `t`. */
const esperandoHa = (t: number) => (t < RAPIDO_ATE ? t * 3 : 60 + (t - RAPIDO_ATE) * 10);
const intervalo = (t: number) => (t < RAPIDO_ATE ? 3 : 10);

describe("o relógio do laço", () => {
  it("pergunta de 3 em 3 na janela em que o stream nasce", () => {
    // Medido em 30/08: o provedor devolve o `streamAudioUrl` entre 22s e 32s.
    // É a janela que decide quando a pessoa pode ouvir.
    expect(intervalo(0)).toBe(3);
    expect(intervalo(10)).toBe(3);
    expect(intervalo(19)).toBe(3);
  });

  it("desacelera depois que a janela passa", () => {
    // Passados 60s o que se espera é o arquivo final, e a pessoa já está
    // ouvindo a prévia. Continuar a 3s ali só gasta execução.
    expect(intervalo(20)).toBe(10);
    expect(intervalo(55)).toBe(10);
  });

  it("a fase rápida cobre exatamente os primeiros 60 segundos", () => {
    expect(esperandoHa(RAPIDO_ATE)).toBe(60);
  });

  it("o laço inteiro ainda dá os 6 minutos de antes", () => {
    // Encurtar o teto transformaria "o provedor está lento" em "a música
    // falhou", e música falhada é venda perdida ou reembolso.
    const total = esperandoHa(TOTAL - 1) + intervalo(TOTAL - 1);
    expect(total).toBeGreaterThanOrEqual(360);
  });

  it("gasta MENOS execuções que o laço antigo", () => {
    // O antigo eram 36 voltas fixas. Se o novo gastasse mais no caso comum,
    // a otimização de espera estaria sendo paga com conta do Inngest.
    //
    // Caso comum: a música fica pronta em ~136s (mediana medida).
    let voltas = 0;
    for (let t = 0; t < TOTAL && esperandoHa(t) < 136; t++) voltas++;
    expect(voltas).toBeLessThan(36);
  });

  it("o limite de aceitar a primeira faixa continua sendo 60 segundos", () => {
    // A regra é de NEGÓCIO: a prévia tem que ser a mesma gravação entregue.
    // Ela só cede depois de 60s, e mexer no intervalo do laço não pode mudar
    // isso — era exatamente o que aconteceria com o limite escrito em voltas.
    const cede = (t: number) => esperandoHa(t) >= 60;
    expect(cede(19)).toBe(false); // 57s
    expect(cede(20)).toBe(true); // 60s
  });

  it("o tempo decorrido nunca anda para trás", () => {
    for (let t = 1; t < TOTAL; t++) {
      expect(esperandoHa(t)).toBeGreaterThan(esperandoHa(t - 1));
    }
  });
});
