import { describe, expect, it } from "vitest";
import { assuntoIndicacao, emailIndicacao, mensagemPronta, textoIndicacao } from "../../emails/indicacao";
import {
  PCT_COMISSAO,
  PCT_DESCONTO,
  comissaoDe,
  descontoDoConvite,
  linkDoConvite,
  reaisDeCentavos,
  SAQUE_MINIMO_CENTAVOS,
} from "./indicacao";

// O E-MAIL DO CONVITE — testado onde ele mente sem quebrar.
//
// Este e-mail promete DINHEIRO pra base inteira de compradores, de uma vez. Um
// número decorado que divergisse da regra do banco não estoura em lugar
// nenhum: ele sai, chega, e só aparece quando alguém confere na calculadora —
// que, numa promessa de comissão, é exatamente o que a pessoa faz.

const link = linkDoConvite("K7M2QX");
const monta = (nome = "Camila") =>
  emailIndicacao({
    nome,
    link,
    linkPainel: "https://www.serenatagift.com/indique",
    linkDescadastro: "https://www.serenatagift.com/api/descadastro?e=a%40b.com&t=abc",
  });

describe("os números do e-mail saem das regras, nunca da mão", () => {
  const pago = 3800 - descontoDoConvite(3800);

  it("a comissão escrita é a que `comissaoDe` calcula", () => {
    // Se alguém mudar PCT_COMISSAO e esquecer a copy, é aqui que para.
    expect(monta()).toContain(reaisDeCentavos(comissaoDe(pago)));
    expect(assuntoIndicacao()).toContain(reaisDeCentavos(comissaoDe(pago)));
  });

  it("o preço do convidado é o preço COM desconto", () => {
    expect(monta()).toContain(reaisDeCentavos(pago));
    expect(monta()).toContain(`${PCT_DESCONTO}%`);
  });

  it("o piso do saque aparece no CORPO, não escondido", () => {
    // A esse valor por indicação, R$ 100 são ~10 amigos. Quem descobre isso
    // depois de juntar R$ 40 abre ticket, e com razão.
    expect(monta()).toContain(reaisDeCentavos(SAQUE_MINIMO_CENTAVOS));
  });

  it("nenhuma porcentagem antiga sobrou escrita na copy", () => {
    const html = monta();
    for (const velho of [20, 15, 25]) {
      if (velho === PCT_COMISSAO) continue;
      expect(html, `"${velho}% da comissão" não pode estar no texto`).not.toContain(
        `${velho}% do que`,
      );
    }
  });
});

describe("os links", () => {
  it("o link de convite cai no /criar, não na home", () => {
    // A home é uma tela a mais entre quem já foi vendido pelo amigo e o quiz.
    expect(link).toContain("/criar?ref=");
    expect(monta()).toContain(link);
  });

  it("o botão do WhatsApp carrega o link dentro da mensagem", () => {
    const html = monta();
    expect(html).toContain("https://wa.me/?text=");
    expect(mensagemPronta(link)).toContain(link);
    // A mensagem tem que ir escapada: um `&` cru cortaria o texto na metade.
    expect(html).toContain(encodeURIComponent(link));
  });

  it("SEMPRE tem descadastro — sem ele a saída é 'marcar como spam'", () => {
    expect(monta()).toContain("/api/descadastro");
  });

  it("e o caminho do saldo, que é o único que precisa de login", () => {
    expect(monta()).toContain("/indique");
  });
});

describe("a copy", () => {
  it("nenhum placeholder vaza cru", () => {
    for (const nome of ["Camila", ""]) {
      expect(monta(nome)).not.toMatch(/\{nome\}|\{link\}|\$\{/);
    }
    expect(assuntoIndicacao()).not.toMatch(/\{\w+\}/);
  });

  it("a headline é a oferta", () => {
    expect(monta()).toContain("Ganhe dinheiro indicando o Serenata");
  });

  it("o nome abre o corpo quando existe", () => {
    expect(monta("Camila")).toContain("Camila, você já fez uma música");
  });

  it("e sem nome a frase continua inteira", () => {
    const html = monta("");
    expect(html).toContain("Você já fez uma música");
    // O defeito clássico: "​, você já fez" com a vírgula órfã na frente.
    expect(html).not.toMatch(/>\s*,\s*você/);
  });

  it("a versão em texto puro tem o link e não é vazia", () => {
    const txt = textoIndicacao({ nome: "Camila", link });
    expect(txt).toContain(link);
    expect(txt.length).toBeGreaterThan(120);
  });
});
