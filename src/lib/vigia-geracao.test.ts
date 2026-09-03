import { describe, expect, it } from "vitest";
import { lerOsSinais } from "../../inngest/functions/vigiaGeracao";

// QUANDO O VIGIA ACORDA O DONO.
//
// Este alerta existe pra uma decisão específica e cara: pausar as campanhas.
// Enquanto elas rodam com a geração quebrada, cada lead que entra vira música
// que não sai, e comprador que paga por algo que não existe — a única regra
// que este projeto não quebra.
//
// Então os dois erros custam:
//   não avisar  = dinheiro comprando lead que não vai ser atendido
//   avisar à toa = alerta que mente uma vez deixa de ser lido, e aí o próximo
//                  de verdade também não é
//
// O terceiro sinal (`provedor-recusando`) nasceu em 03/09, na véspera de uma
// atualização anunciada do provedor. Os dois que já existiam tinham um ponto
// cego: os dois olhavam pra música PRESA, e provedor que muda de contrato não
// prende nada — ele faz a música FALHAR.

const nada = { letrasNovas: 0, prontasNaJanela: 0, totalPresas: 0, falhas: 0 };

describe("lerOsSinais", () => {
  it("madrugada vazia não é falha", () => {
    expect(lerOsSinais(nada).avisar).toBe(false);
  });

  it("funil rodando normal não acorda ninguém", () => {
    expect(lerOsSinais({ ...nada, letrasNovas: 12, prontasNaJanela: 11 }).avisar).toBe(false);
  });

  it("tem gente escrevendo letra e não saiu música: acorda", () => {
    const r = lerOsSinais({ ...nada, letrasNovas: 8, prontasNaJanela: 0 });
    expect(r).toEqual({ avisar: true, motivo: "nada-saiu" });
  });

  it("fila presa grande demais pra ser soluço: acorda", () => {
    expect(lerOsSinais({ ...nada, totalPresas: 15 }).motivo).toBe("fila-grande");
  });

  // ── O PONTO CEGO QUE ESTE SINAL FECHA ────────────────────────────

  it("provedor recusando metade, com o resto saindo: acorda", () => {
    // O formato exato de quem mudou o contrato da API. Antes de 03/09 isto
    // passava inteiro: nada fica preso (então `fila-grande` não vê), e alguma
    // coisa ainda sai (então `nada-saiu` não vê).
    const r = lerOsSinais({ letrasNovas: 10, prontasNaJanela: 4, totalPresas: 0, falhas: 6 });
    expect(r).toEqual({ avisar: true, motivo: "provedor-recusando" });
  });

  it("uma ou duas falhas soltas não acordam ninguém", () => {
    // Música que dá azar existe e sempre existiu. Gritar com isso queima o
    // alerta pro dia em que ele importa.
    expect(lerOsSinais({ ...nada, letrasNovas: 20, prontasNaJanela: 18, falhas: 2 }).avisar).toBe(false);
  });

  it("três falhas com o dobro de prontas ainda é operação normal", () => {
    expect(lerOsSinais({ letrasNovas: 12, prontasNaJanela: 9, totalPresas: 0, falhas: 3 }).avisar).toBe(false);
  });

  it("empate entre falhas e prontas já conta como quebra", () => {
    // Metade das músicas falhando não é azar, é o provedor. E meia venda
    // perdida é venda perdida.
    expect(lerOsSinais({ letrasNovas: 8, prontasNaJanela: 3, totalPresas: 0, falhas: 3 }).motivo).toBe(
      "provedor-recusando",
    );
  });

  it("recusa do provedor tem prioridade sobre os outros sinais", () => {
    // Quando os três acendem juntos, o motivo que vai no assunto do e-mail
    // tem que ser o que diz O QUE FAZER: "o provedor está recusando" manda
    // olhar o provedor; "fila grande" manda olhar a nossa fila.
    const r = lerOsSinais({ letrasNovas: 9, prontasNaJanela: 0, totalPresas: 20, falhas: 9 });
    expect(r.motivo).toBe("provedor-recusando");
  });
});
