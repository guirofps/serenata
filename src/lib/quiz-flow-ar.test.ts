import { describe, expect, it } from "vitest";
import { quizFlow } from "@/lib/quiz-flow";
import { QUIZ_FLOW_ES } from "@/lib/quiz-flow-es";
import { comVoseo, PASSOS_AR } from "@/lib/quiz-flow-ar";
import { mercadoEs } from "@/lib/mercado-es";

// Junta todo texto visível de um passo, incluindo o que está dentro de
// `triggers`, `extra` e `extraChips` — que é justamente onde os mexicanismos
// estavam escondidos e onde ninguém olha.
function textoVisivel(passo: unknown): string {
  const partes: string[] = [];
  const anda = (v: unknown) => {
    if (typeof v === "string") partes.push(v);
    else if (Array.isArray(v)) v.forEach(anda);
    else if (v && typeof v === "object") Object.values(v).forEach(anda);
  };
  anda(passo);
  return partes.join(" | ");
}

describe("camada rioplatense do quiz", () => {
  const ar = comVoseo(QUIZ_FLOW_ES);

  it("substitui exatamente os passos declarados, e nenhum outro", () => {
    for (const passo of ar) {
      const original = QUIZ_FLOW_ES.find((p) => p.id === passo.id);
      const mudou = textoVisivel(passo) !== textoVisivel(original);
      expect(mudou).toBe(PASSOS_AR.includes(passo.id));
    }
  });

  it("não deixa nenhum mexicanismo nos passos trocados", () => {
    // Cada um destes SAIU de uma tela que um argentino ia ler.
    const proibidos = [
      "Xóchitl", "Lupita", "Chuy", "frijol", "Pedrito", "el Chino",
      "en el coro", "tontería", "manía",
    ];
    const texto = ar.filter((p) => PASSOS_AR.includes(p.id)).map(textoVisivel).join(" ");
    for (const p of proibidos) expect(texto).not.toContain(p);
  });

  it("não deixa tuteo nos passos trocados", () => {
    // Formas de `tú` que apareciam no funil mexicano. `\b` de verdade: sem
    // ele, "decís" casaria dentro de outra palavra e o teste passaria à toa.
    const tuteo = /\b(dices|quieres|cuéntame|escríbelo|escribe|prefieres|continúa|para ti|acuerdas)\b/i;
    for (const passo of ar) {
      if (!PASSOS_AR.includes(passo.id)) continue;
      expect(textoVisivel(passo)).not.toMatch(tuteo);
    }
  });

  it("preserva a regra de exibição do bloco de filhos", () => {
    // `extra` é trocado INTEIRO. Se o `mostrarSe` não vier junto, a pergunta
    // "¿Querés que la canción nombre a los hijos?" aparece pra quem está
    // fazendo a música PRO filho.
    const recado = ar.find((p) => p.id === "recado") as {
      extra?: { mostrarSe?: (r: Record<string, unknown>) => boolean };
    };
    expect(recado.extra?.mostrarSe).toBeTypeOf("function");
    expect(recado.extra?.mostrarSe?.({ relacao: "filho" })).toBe(false);
    expect(recado.extra?.mostrarSe?.({ relacao: "esposa" })).toBe(true);
  });

  it("mantém os `field` e a ordem — o banco não pode mudar de forma", () => {
    expect(ar.map((p) => p.id)).toEqual(QUIZ_FLOW_ES.map((p) => p.id));
    const campos = (f: typeof ar) =>
      f.map((p) => (p as { field?: string }).field ?? null);
    expect(campos(ar)).toEqual(campos(QUIZ_FLOW_ES));
  });

  it("o interruptor de mercado entrega o voseo em `quizFlow`", () => {
    const nome = quizFlow("es").find((p) => p.id === "nome") as { text: string };
    if (mercadoEs() === "argentina") expect(nome.text).toContain("decís");
    else expect(nome.text).toContain("dices");
  });
});
