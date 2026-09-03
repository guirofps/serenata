import { describe, expect, it } from "vitest";
import { estiloParaSuno, acharGenero } from "@/lib/generos";

// O GÊNERO QUE A PESSOA ESCOLHEU TEM QUE CHEGAR NO SUNO.
//
// O `estilo_suno` que ia pro provedor era escrito pelo modelo junto com a
// letra, e derrapava. Medido em 14 dias: dos 46 pagodes, 23 saíram com
// "violão de nylon", acompanhado de "suave", "leve", "clima intimista e
// caseiro", "andamento moderado".
//
// Isso descreve balada acústica, e o Suno obedece à descrição e não à palavra
// "pagode" que abre a frase. Foi assim que uma música pedida em pagode saiu
// soando sertanejo, num teste do próprio dono.
//
// A escolha do gênero foi da PESSOA, num campo do quiz. Nenhum texto gerado
// pode contradizer isso, e é o que estes testes seguram.

// O caso real que abriu o problema, copiado do banco.
const DERRAPOU =
  "pagode romântico, voz masculina suave, cavaquinho e violão de nylon, " +
  "batida leve de pandeiro, clima intimista e caseiro, andamento moderado";

describe("estiloParaSuno", () => {
  it("o pagode volta a ser pagode, sem o violão que o trai", () => {
    const r = estiloParaSuno({ genero: "pagode", estiloDoModelo: DERRAPOU, voz: "masculina" });
    expect(r).toContain("cavaquinho");
    expect(r).toContain("pandeiro");
    expect(r.toLowerCase()).not.toContain("nylon");
    // Os amaciadores são o veneno: um pagode "intimista", de "andamento
    // moderado" e pandeiro "discreto" é uma balada com cavaquinho.
    expect(r.toLowerCase()).not.toContain("intimista");
    expect(r.toLowerCase()).not.toContain("andamento moderado");
  });

  it("o texto curado do catálogo vem PRIMEIRO", () => {
    // O Suno pesa o começo da string. Gênero no fim é gênero ignorado.
    const r = estiloParaSuno({ genero: "pagode", estiloDoModelo: DERRAPOU, voz: "masculina" });
    expect(r.startsWith(acharGenero("pagode")!.estiloSuno)).toBe(true);
  });

  it("guarda o timbre que o modelo escolheu, e só ele", () => {
    const r = estiloParaSuno({
      genero: "pagode",
      estiloDoModelo: "pagode romântico, voz masculina grave e emotiva, violão de nylon",
      voz: "masculina",
    });
    expect(r).toContain("voz masculina grave e emotiva");
    expect(r.toLowerCase()).not.toContain("nylon");
  });

  it("sem timbre no texto do modelo, ainda diz o sexo da voz", () => {
    const r = estiloParaSuno({ genero: "forro", estiloDoModelo: "forró animado", voz: "feminina" });
    expect(r).toContain("voz feminina");
  });

  it("voz surpresa não vira texto nenhum", () => {
    // "surpresa" é o cliente deixando o provedor decidir. Escrever a palavra
    // no estilo faria o Suno tentar cantar a surpresa.
    const r = estiloParaSuno({ genero: "mpb", estiloDoModelo: "mpb", voz: "surpresa" });
    expect(r.toLowerCase()).not.toContain("surpresa");
    expect(r).toBe(acharGenero("mpb")!.estiloSuno);
  });

  it("gênero fora do catálogo cai no texto do modelo em vez de sumir", () => {
    // Valor antigo ou escrito à mão. Melhor o texto do modelo do que uma
    // string vazia, que faria o Suno escolher o gênero sozinho.
    const r = estiloParaSuno({ genero: "bossa-esquisita", estiloDoModelo: "bossa nova suave" });
    expect(r).toBe("bossa nova suave");
  });

  it("nunca passa do limite que o provedor aceita", () => {
    // `iniciarGeracao` corta em 190; cortar aqui evita frase pela metade.
    const r = estiloParaSuno({
      genero: "pagode",
      estiloDoModelo: "voz masculina " + "muito ".repeat(80),
      voz: "masculina",
    });
    expect(r.length).toBeLessThanOrEqual(190);
  });

  it("todo gênero do catálogo produz um estilo não vazio", () => {
    for (const v of ["sertanejo", "sertanejo_univ", "pagode", "mpb", "forro", "piseiro"]) {
      const r = estiloParaSuno({ genero: v, estiloDoModelo: null, voz: null });
      expect(r.length).toBeGreaterThan(10);
    }
  });
});
