import { describe, it, expect } from "vitest";

// QUANDO A REFAÇÃO NÃO PODE SER APLICADA.
//
// O `SYSTEM_AJUSTE` promete devolver a letra intacta e explicar o que falta
// quando o pedido é vago demais. Até 01/09 o chamador lia só `letra` e
// `titulo`, então essa promessa era ignorada: letra idêntica salva como nova,
// direito gasto, música regravada igual. Custou R$ 38 a um cliente que refez
// tudo do zero achando que era jeito.
//
// Este teste trava a REGRA da decisão, não a chamada ao modelo: dado o que o
// JSON traz, a refação deve ou seguir ou parar sem gastar nada.

/** A mesma decisão que `refacao.ts` toma depois de ler o JSON do modelo. */
function recusa(j: { letra?: string; mudou?: string[]; aviso?: string }, atual: string) {
  const nova = (j.letra ?? "").trim();
  const aviso = (j.aviso ?? "").trim();
  const mudou = Array.isArray(j.mudou) ? j.mudou.filter((x) => String(x).trim()) : [];
  const igual = nova === atual.trim();
  return Boolean(aviso || !mudou.length || igual);
}

const LETRA = "[Verse 1]\nAinda não provei o bolo de fubá que você faz";

describe("a refação recusa em vez de gastar o direito", () => {
  it("recusa quando o modelo avisou que faltou informação", () => {
    // O caso do Hudson: disse o que não queria, não disse o que queria.
    expect(recusa({ letra: LETRA, mudou: [], aviso: "Não sei o que colocar no lugar do bolo de fubá." }, LETRA)).toBe(true);
  });

  it("recusa quando a letra voltou IDÊNTICA, mesmo sem aviso", () => {
    // Sem aviso e com `mudou` preenchido, mas nada mudou de fato: regravar
    // seria cobrar o direito por uma música igual à que ela já tem.
    expect(recusa({ letra: LETRA, mudou: ["troquei o refrão"], aviso: "" }, LETRA)).toBe(true);
  });

  it("recusa quando o modelo não listou nenhuma mudança", () => {
    expect(recusa({ letra: LETRA + "\noutra linha", mudou: [], aviso: "" }, LETRA)).toBe(true);
  });

  it("recusa quando `mudou` só tem string vazia", () => {
    expect(recusa({ letra: LETRA + "\nx", mudou: ["", "   "], aviso: "" }, LETRA)).toBe(true);
  });

  it("SEGUE quando mudou de verdade e não houve aviso", () => {
    // O segundo pedido do Hudson, que dizia o que entrava no lugar.
    const nova = "[Verse 1]\nAinda lembro do dia em que a gente se conheceu";
    expect(recusa({ letra: nova, mudou: ["troquei o verso do bolo de fubá"], aviso: "" }, LETRA)).toBe(false);
  });

  it("recusa quando o modelo devolve `mudou` fora do formato", () => {
    // Resposta malformada não pode virar "pode seguir" por acidente.
    expect(recusa({ letra: LETRA + "\nx", mudou: undefined, aviso: "" }, LETRA)).toBe(true);
  });
});
