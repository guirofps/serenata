import { describe, expect, it } from "vitest";
import { decidirEstado } from "./admin-estado";

const naoAutorizado = new Error("nao-autorizado");
const tempoEsgotado = new Error("canceling statement due to statement timeout");

describe("decidirEstado — quem manda na tela quando são quatro consultas", () => {
  it("nada falhou: mostra o painel", () => {
    expect(decidirEstado({ nucleo: null, acessorios: [] })).toEqual({ tela: "painel" });
  });

  it("núcleo falhou por tempo: tela de falha, com a mensagem do banco", () => {
    expect(decidirEstado({ nucleo: tempoEsgotado, acessorios: [] })).toEqual({
      tela: "falha",
      mensagem: "canceling statement due to statement timeout",
    });
  });

  it("qualquer nao-autorizado pede senha, venha de onde vier", () => {
    // O cookie expira pro painel inteiro de uma vez. Não importa qual das
    // quatro consultas notou primeiro.
    expect(decidirEstado({ nucleo: naoAutorizado, acessorios: [] })).toEqual({ tela: "login" });
    expect(decidirEstado({ nucleo: null, acessorios: [naoAutorizado] })).toEqual({ tela: "login" });
  });

  it("login vence falha, porque digitar a senha é o que resolve", () => {
    // Sessão expirada faz TUDO falhar, e as acessórias podem estourar por
    // motivo próprio no mesmo instante. Mandar pra tela de erro faria a
    // pessoa clicar em "tentar de novo" pra sempre.
    expect(decidirEstado({ nucleo: naoAutorizado, acessorios: [tempoEsgotado] })).toEqual({
      tela: "login",
    });
  });

  // ── A REGRA QUE ESTA MUDANÇA CRIOU ────────────────────────────
  //
  // Antes havia UMA consulta: ela falhava, a tela caía. Agora o saldo do
  // provedor e o resumo de e-mail falham por conta própria — o kie.ai fora do
  // ar, a RPC de e-mail passando dos 13,6s no banco. Nenhum dos dois pode
  // tomar a tela: é a regra que `admin-dados` já defende por escrito, de que
  // não saber a taxa de abertura é ruim e não ver o faturamento é pior.
  it("acessória falhando NÃO derruba o painel", () => {
    expect(decidirEstado({ nucleo: null, acessorios: [tempoEsgotado] })).toEqual({
      tela: "painel",
    });
  });

  it("mensagem vazia não vira tela de falha em branco", () => {
    expect(decidirEstado({ nucleo: new Error(""), acessorios: [] })).toEqual({
      tela: "falha",
      mensagem: "erro desconhecido",
    });
  });

  it("o que foi lançado pode não ser Error", () => {
    expect(decidirEstado({ nucleo: "nao-autorizado", acessorios: [] })).toEqual({ tela: "login" });
    expect(decidirEstado({ nucleo: { qualquer: "coisa" }, acessorios: [] })).toEqual({
      tela: "falha",
      mensagem: "[object Object]",
    });
  });

  it("ignora as acessórias que não falharam", () => {
    expect(decidirEstado({ nucleo: null, acessorios: [null, undefined, null] })).toEqual({
      tela: "painel",
    });
  });
});
