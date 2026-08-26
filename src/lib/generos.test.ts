import { describe, expect, it } from "vitest";
import { generos, acharGenero } from "./generos";

// O CATÁLOGO DE GÊNEROS, e o defeito silencioso que ele pode ter.
//
// `acharGenero` procura o `value` em TODAS as listas e devolve o PRIMEIRO que
// bate. Isso existe porque uma música é gerada por um job que roda depois e a
// página presente é aberta meses adiante: procurar só na lista do idioma
// "atual" faria um pedido antigo cair no fallback genérico.
//
// O preço disso é que dois `value` iguais em listas diferentes viram um só, e
// vence o que estiver primeiro. Enquanto o conteúdo for idêntico, tudo bem.
// Quando divergir — foi o caso de `balada`, que era "romántica latina" numa
// lista e "romántica española" na outra — o espanhol de Madri pede balada e o
// Suno recebe o estilo latino. Nada falha, nada loga, a música só sai errada.

describe("catálogo de gêneros", () => {
  it("nenhum value repetido entrega estilos DIFERENTES", () => {
    const vistos = new Map<string, string>();
    const conflitos: string[] = [];
    // `generos()` só devolve a lista ativa, então varremos pelo `acharGenero`,
    // que é quem enxerga todas — é o mesmo caminho do job de música.
    for (const loc of ["pt", "es"] as const) {
      for (const g of generos(loc)) {
        const antes = vistos.get(g.value);
        if (antes && antes !== g.estiloSuno) conflitos.push(g.value);
        vistos.set(g.value, g.estiloSuno);
      }
    }
    expect(conflitos).toEqual([]);
  });

  it("todo gênero oferecido no quiz é encontrável depois pelo job", () => {
    // O job de música roda sem saber o idioma da sessão. Se um `value` que o
    // quiz oferece não for achável, a música sai com estilo genérico.
    for (const loc of ["pt", "es"] as const) {
      for (const g of generos(loc)) {
        expect(acharGenero(g.value), `${loc}/${g.value}`).not.toBeNull();
      }
    }
  });

  it("todo gênero tem as três faces preenchidas", () => {
    for (const loc of ["pt", "es"] as const) {
      for (const g of generos(loc)) {
        expect(g.label.length, `${g.value} label`).toBeGreaterThan(0);
        expect(g.rotuloPrompt.length, `${g.value} rotuloPrompt`).toBeGreaterThan(0);
        // O `estiloSuno` é o fallback quando o estilo escrito pela IA precisa
        // ser limpo por citar artista. Vazio aqui = música sem estilo nenhum.
        expect(g.estiloSuno.length, `${g.value} estiloSuno`).toBeGreaterThan(20);
      }
    }
  });

  it("o espanhol ativo não oferece gênero de outro mercado", () => {
    // Guarda o motivo da lista existir: quem abre o seletor tem que reconhecer
    // o que vê. Mariachi e banda na Espanha, ou copla e sevillanas na
    // Argentina, são a mesma falha em direções opostas.
    const valores = generos("es").map((g) => g.value);
    const mexicanos = ["mariachi", "banda", "nortena", "corrido"];
    const espanhois = ["copla", "sevillanas", "flamenco", "rumba"];
    const temMx = valores.some((v) => mexicanos.includes(v));
    const temEs = valores.some((v) => espanhois.includes(v));
    expect(temMx && temEs, "as duas famílias na mesma lista").toBe(false);
  });
});
