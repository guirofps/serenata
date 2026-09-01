import { describe, it, expect } from "vitest";

// O QUE O ATENDENTE VÊ QUANDO O MODELO NÃO COOPERA.
//
// Em 01/09 o painel `/recuperar` mostrou "Resposta do modelo não continha
// JSON" no meio de um atendimento, com a letra do cliente na tela. A mensagem
// não dizia o que o modelo respondeu nem o que fazer, e o texto dele (que
// costuma explicar por que não deu) era jogado fora junto.
//
// A regra aqui é: erro de parsing tem que CARREGAR a resposta.

/** Mesma lógica de `extrairJson` em `recuperacao-letra.ts`. */
function extrair<T>(texto: string): T {
  const cru = (texto ?? "").trim();
  const s = cru.indexOf("{");
  const e = cru.lastIndexOf("}");
  if (s === -1 || e === -1) {
    throw new Error(
      cru
        ? `O modelo respondeu em texto em vez de JSON. Ele disse: "${cru.slice(0, 300)}"`
        : "O modelo devolveu resposta vazia.",
    );
  }
  try {
    return JSON.parse(cru.slice(s, e + 1)) as T;
  } catch {
    throw new Error("O modelo devolveu um JSON quebrado, provavelmente cortado. Tente de novo.");
  }
}

describe("extrair o JSON da resposta do modelo", () => {
  it("lê o JSON normal", () => {
    expect(extrair<{ letra: string }>('{"letra": "abc"}').letra).toBe("abc");
  });

  it("lê JSON com prosa antes e depois", () => {
    expect(extrair<{ letra: string }>('Claro! {"letra": "abc"} Espero ter ajudado.').letra).toBe("abc");
  });

  it("lê JSON dentro de cerca markdown", () => {
    expect(extrair<{ letra: string }>('```json\n{"letra": "abc"}\n```').letra).toBe("abc");
  });

  it("quando vem só prosa, o erro CARREGA o que o modelo disse", () => {
    // Este é o caso do atendimento travado: a explicação do modelo é
    // exatamente o que resolve, e antes ela sumia.
    const dito = "Não consigo aplicar porque você não disse qual trecho trocar.";
    expect(() => extrair(dito)).toThrow(/Não consigo aplicar porque/);
  });

  it("corta a resposta longa em vez de despejar a letra inteira na tela", () => {
    const gigante = "x".repeat(2000);
    try { extrair(gigante); } catch (e) {
      expect((e as Error).message.length).toBeLessThan(360);
    }
  });

  it("resposta vazia tem mensagem própria", () => {
    expect(() => extrair("   ")).toThrow(/resposta vazia/i);
  });

  it("JSON cortado no meio avisa que foi corte, e não 'sem JSON'", () => {
    // Chave aberta, sem fechar: `lastIndexOf("}")` acha um `}` interno e o
    // parse quebra. A mensagem tem que dizer a causa certa.
    expect(() => extrair('{"letra": "abc", "mudou": ["um"}')).toThrow(/cortado/i);
  });
});
