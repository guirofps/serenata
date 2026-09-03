import { describe, expect, it } from "vitest";
import { ESTILO_PADRAO, limitarFoco, posicaoDaFoto, type Estilo } from "@/lib/quadro-estilo";

// O ENQUADRAMENTO DA FOTO DO QUADRO.
//
// Duas funções pequenas que decidem uma coisa cara: que pedaço da foto sai
// impresso. Até 03/09 quem decidia era um palpite fixo (`center 22%`), e
// quando ele errava cortava a cara das pessoas — no quadro de "Encontro no
// Golandim" a testa dela saiu raspada e a cabeça dele ficou de fora.
//
// Estão testadas porque o modo de falhar delas é silencioso: nada quebra,
// nada avisa, e o erro só aparece no papel depois de a pessoa pagar a
// impressão numa gráfica.

const com = (foco?: { x: number; y: number }): Estilo => ({ ...ESTILO_PADRAO, foco });

describe("limitarFoco", () => {
  it("deixa passar o que está dentro", () => {
    expect(limitarFoco(30, 70)).toEqual({ x: 30, y: 70 });
  });

  it("trava nas bordas em vez de deixar a foto sair do quadro", () => {
    // Arrastar sem limite empurraria a imagem pra fora e deixaria faixa vazia
    // dentro da moldura, que na impressão vira papel branco no meio da foto.
    expect(limitarFoco(-40, 180)).toEqual({ x: 0, y: 100 });
  });

  it("cai no meio quando a conta não dá número", () => {
    // O arrasto divide pela largura da moldura. Moldura de largura zero (o
    // instante antes de o layout existir) produz NaN, e `objectPosition:
    // NaN% NaN%` é declaração inválida: o navegador descarta e a foto pula
    // pro centro sem ninguém entender por quê.
    //
    // Infinito cai no meio JUNTO COM O NaN, e isso é de propósito. Ele não
    // quer dizer "arrastou até o fim", quer dizer que a divisão foi por zero
    // — tratar como 100% seria fingir que houve um gesto que não houve.
    expect(limitarFoco(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ x: 50, y: 50 });
  });
});

describe("posicaoDaFoto", () => {
  it("sem ajuste, puxa a foto deitada pro terço de cima, onde ficam os rostos", () => {
    expect(posicaoDaFoto(com(), "paisagem")).toBe("center 22%");
    expect(posicaoDaFoto(com(), "quadrada")).toBe("center 22%");
  });

  it("sem ajuste, centraliza a foto em pé", () => {
    // Em pé o bloco já respeita a proporção, então não há o que compensar.
    expect(posicaoDaFoto(com(), "retrato")).toBe("center center");
  });

  it("o ajuste da pessoa vence o palpite, em qualquer formato", () => {
    expect(posicaoDaFoto(com({ x: 50, y: 8 }), "paisagem")).toBe("50% 8%");
    expect(posicaoDaFoto(com({ x: 20, y: 90 }), "retrato")).toBe("20% 90%");
  });

  it("o topo da foto é alcançável", () => {
    // `y: 0` é falsy. Um `estilo.foco.y || padrao` em qualquer ponto do
    // caminho jogaria de volta pros 22% justamente quem arrastou até o topo,
    // que é o gesto de quem tem a cabeça cortada.
    expect(posicaoDaFoto(com({ x: 0, y: 0 }), "paisagem")).toBe("0% 0%");
  });
});
