import { describe, it, expect } from "vitest";
import { decidirAjuste, pedeLetra } from "./refacao-decisao";

// "MANTER A LETRA COMO ESTÁ" É PEDIDO DE SOM, NÃO DE LETRA.
//
// 22/10, suporte: "Refazer em sertanejo romântico moderno... Manter a letra
// como está.", com o chip Sertanejo escolhido. O "letra" do "manter a letra"
// fazia o `pedeLetra` responder sim, a letra voltava igual (como pedido) e o
// ajuste saía `vago`. As regras gerais da refação estão em
// `refacao-vago.test.ts`; aqui fica só a fronteira manter × mudar.

const LETRA = [
  "[Verse 1]",
  "Ainda não provei o bolo de fubá que você faz",
  "E a casa inteira cheira a café quando você chega",
  "[Chorus]",
  "Simon, meu neto, meu presente de Deus",
  "Simon, você é o sol dos dias meus",
].join("\n");

describe("pedeLetra: manter / não mexer não conta como pedido de letra", () => {
  it.each([
    "Refazer em sertanejo romântico moderno, com voz masculina. Manter a letra como está.",
    "mantém a letra",
    "Mantenha a mesma letra, só muda o ritmo",
    "mantendo toda a letra, quero mais animada",
    "deixa a letra como está",
    "deixar a letra igual, só trocar o estilo",
    "pode deixar a letra do jeito que está",
    "só muda o ritmo, deixa a letra.",
    "a letra pode ficar igual",
    "a letra fica a mesma",
    "a letra pode continuar como está",
    "sem mudar a letra",
    "sem mexer na letra, só a voz",
    "sem mudar nada na letra",
    "sem alteração na letra",
    "não mexer no nome",
    "não mudar a letra",
    "Não precisa mexer na letra",
    "não quero mudar nada da letra",
    "não mexe em nada da letra, quero voz feminina",
    "com a mesma letra, mas em forró",
    "a letra está perfeita, só quero mais lenta",
    "gostei muito da letra, só queria em pagode",
  ])("%s", (pedido) => {
    expect(pedeLetra(pedido)).toBe(false);
  });
});

describe("pedeLetra: pedido de mudar a letra continua valendo", () => {
  it.each([
    "troca o nome da Ana",
    "incluir o nome dos filhos",
    "corrigir a pronúncia do nome Simon",
    "tira a parte da salsicha",
    "quero mudar o refrão",
    "a letra está errada no segundo verso",
    "o nome saiu errado",
    "deixa o refrão igual ao primeiro verso",
    "colocar a palavra vovó no começo",
  ])("%s", (pedido) => {
    expect(pedeLetra(pedido)).toBe(true);
  });

  it("som de fora: 'mudar a voz' segue sem pedir letra", () => {
    expect(pedeLetra("quero mudar a voz para masculina")).toBe(false);
  });
});

describe("pedeLetra: manter uma parte e mudar outra", () => {
  it.each([
    "mantém o refrão e troca o nome da Ana",
    "manter a letra, mas corrigir a pronúncia de Eloah",
    "não mexe no refrão, só tira o verso do cachorro",
    "a letra está ótima, só queria incluir o nome do Pedro",
    "gostei da letra mas o nome está errado",
    "sem mudar o refrão, coloca o nome da vó no primeiro verso",
  ])("%s", (pedido) => {
    expect(pedeLetra(pedido)).toBe(true);
  });
});

describe("decidirAjuste com 'manter a letra'", () => {
  it("o pedido de 22/10 regrava só o som", () => {
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: LETRA },
      pedido: "Refazer em sertanejo romântico moderno... Manter a letra como está.",
      mudaSom: true,
    });
    expect(d).toEqual({ tipo: "so-som" });
  });

  it("manter uma parte e mudar o nome, com a letra intacta: segue recusando", () => {
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: LETRA, falta: "Qual nome entra no lugar?" },
      pedido: "mantém o refrão e troca o nome da Ana",
      mudaSom: true,
    });
    expect(d).toEqual({ tipo: "vago", falta: "Qual nome entra no lugar?" });
  });
});
