import { describe, it, expect } from "vitest";
import {
  decidirAjuste,
  FALTA_PADRAO,
  pareceLetraInteira,
  pedeLetra,
  textoProCliente,
  vozDoPedido,
} from "./refacao-decisao";

// QUANDO A REFAÇÃO PODE SEGUIR, E QUANDO PARA SEM GASTAR NADA.
//
// Duas falhas opostas, as duas com nome:
//
// - Hudson, 31/08: letra voltou IDÊNTICA, foi salva como nova, direito gasto,
//   música regravada igual. Daí: letra igual nunca gasta o ajuste.
// - 36 compradores pagos, 30/09 a 07/10: pedido aplicado e recusado como
//   "vago" porque o modelo escreveu uma observação em `aviso`. Daí: a régua é
//   a letra ter mudado, não o modelo ter comentado.
//
// Este teste trava a REGRA (`decidirAjuste`), não a chamada ao modelo. O
// fluxo inteiro, com banco falso, está em `refacao.test.ts`.

const LETRA = [
  "[Verse 1]",
  "Ainda não provei o bolo de fubá que você faz",
  "E a casa inteira cheira a café quando você chega",
  "[Chorus]",
  "Simon, meu neto, meu presente de Deus",
  "Simon, você é o sol dos dias meus",
].join("\n");

const trocar = (de: string, para: string) => LETRA.replace(de, para);

describe("a refação recusa em vez de gastar o direito", () => {
  it("recusa quando a letra voltou IDÊNTICA e o pedido falava da letra", () => {
    // O caso do Hudson: disse o que não queria, o modelo não mexeu.
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: LETRA, mudou: [], falta: "O que você quer no lugar do bolo de fubá?" },
      pedido: "não gostei do trecho do bolo de fubá",
      mudaSom: false,
    });
    expect(d).toEqual({ tipo: "vago", falta: "O que você quer no lugar do bolo de fubá?" });
  });

  it("recusa mesmo com `mudou` preenchido se a letra não mudou de fato", () => {
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: LETRA, mudou: ["troquei o refrão"] },
      pedido: "troca o refrão",
      mudaSom: false,
    });
    expect(d.tipo).toBe("vago");
  });

  it("espaço e quebra de linha a mais não contam como mudança", () => {
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: LETRA.replace(/\n/g, "\n\n") + "   \n", mudou: ["x"] },
      pedido: "corrige o verso",
      mudaSom: false,
    });
    expect(d.tipo).toBe("vago");
  });

  it("sem pergunta do modelo, usa a frase padrão", () => {
    const d = decidirAjuste({ letraAtual: LETRA, resposta: { letra: LETRA }, pedido: "muda a letra", mudaSom: false });
    expect(d).toEqual({ tipo: "vago", falta: FALTA_PADRAO });
  });

  it("pedido sobre a letra + voz nova, letra intacta: recusa (não regrava só a voz)", () => {
    // Ronaldo, 01/10: "incluir o nome dos filhos" + voz nova. Regravar só a
    // voz gastaria o ajuste sem fazer o principal.
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: LETRA, falta: "Quais são os nomes?" },
      pedido: "incluir o nome dos filhos",
      mudaSom: true,
    });
    expect(d.tipo).toBe("vago");
  });

  it("lança (falhou, não vago) quando o modelo não devolve letra utilizável", () => {
    expect(() =>
      decidirAjuste({ letraAtual: LETRA, resposta: { letra: "" }, pedido: "troca x", mudaSom: false }),
    ).toThrow();
    expect(() =>
      decidirAjuste({ letraAtual: LETRA, resposta: { letra: "ok" }, pedido: "troca x", mudaSom: false }),
    ).toThrow();
  });
});

describe("a refação SEGUE quando a letra mudou", () => {
  it("troca simples de palavra", () => {
    const nova = trocar("bolo de fubá", "bolo de cenoura");
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: nova, mudou: ["fubá vira cenoura"], titulo: "Novo" },
      pedido: "Troca fubá por cenoura",
      mudaSom: false,
    });
    expect(d).toEqual({ tipo: "letra", letra: nova, titulo: "Novo" });
  });

  it("segue mesmo com `aviso` (observação sobre o que foi feito)", () => {
    // thiagothallison, 06/10: TI virou T.I, e o modelo comentou a pronúncia
    // de Eloah. Antes: recusado como vago, troca jogada fora.
    const nova = trocar("café", "T.I");
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: nova, mudou: ["TI vira T.I"], aviso: "Não sei como soa Eloah." },
      pedido: "Quando escrevi TI, substitua por T.I, e a pronúncia de Eloah saiu estranha",
      mudaSom: false,
    });
    expect(d.tipo).toBe("letra");
  });

  it("segue mesmo se o modelo esqueceu de listar `mudou`", () => {
    const nova = trocar("Simon, meu neto", "Sáimon, meu neto");
    const d = decidirAjuste({ letraAtual: LETRA, resposta: { letra: nova, mudou: undefined }, pedido: "corrigir a pronúncia do nome Simon", mudaSom: false });
    expect(d.tipo).toBe("letra");
  });

  it("segue quando a pessoa colou a letra inteira", () => {
    const colada = "[Verse 1]\nQuatro sonhos chegaram em tempos diferentes\nQuatro presentes que Deus me confiou\n[Chorus]\nGabriel, Esther, Daniel e Maria Eduarda";
    const d = decidirAjuste({ letraAtual: LETRA, resposta: { letra: colada, mudou: ["letra trocada pela do cliente"] }, pedido: colada, mudaSom: false });
    expect(d).toEqual({ tipo: "letra", letra: colada, titulo: null });
  });

  it("letra intacta + pedido só de som: regrava só o som", () => {
    const d = decidirAjuste({
      letraAtual: LETRA,
      resposta: { letra: LETRA, mudou: [], voz: "masculina" },
      pedido: "Gostaria de mudar a voz, para masculina mais grave",
      mudaSom: true,
    });
    expect(d).toEqual({ tipo: "so-som" });
  });
});

describe("as peças da decisão", () => {
  it("pedeLetra: fala da letra, e 'mudar a voz' não conta", () => {
    expect(pedeLetra("corrigir a pronúncia do nome Simon")).toBe(true);
    expect(pedeLetra("tira a parte da salsicha")).toBe(true);
    expect(pedeLetra("quero mudar a voz para masculina")).toBe(false);
  });

  it("pareceLetraInteira: letra colada sim, instrução longa não", () => {
    const carmelina = [
      "Quatro sonhos chegaram em tempos diferentes,",
      "Quatro presentes q Deus me confiou.",
      "Cada guerra foi vencida de joelhos,",
      "E em cada caminho, Deus nos sustentou.",
      "Se algum dia eu errei com vocês,",
      "Saibam: sempre existiu amor.",
      "Gabriel, meu primeiro sonho,",
      "Generoso, sonhador.",
      "Vocês são meu pedido realizado.",
      "Vocês me deram netos preciosos",
    ].join("\n");
    expect(pareceLetraInteira(carmelina)).toBe(true);
    expect(pareceLetraInteira("Troca fubá por cenoura")).toBe(false);
    expect(
      pareceLetraInteira(
        "Inclua o nosso filho Antony como um presente do criador para nós, um filho com brilho que irradia amor, paz e benção por onde sua voz ressoa, e que a gente agradece todo dia por ele ter chegado na nossa família e mudado tudo, porque antes dele a casa era silêncio e agora é festa",
      ),
    ).toBe(false);
  });

  it("textoProCliente tira travessão do que o modelo escreveu", () => {
    expect(textoProCliente("Não consigo aqui — procure o suporte")).toBe("Não consigo aqui, procure o suporte");
  });

  it("vozDoPedido aceita só os dois valores que a gravação lê", () => {
    expect(vozDoPedido({ voz: "Masculina" })).toBe("masculina");
    expect(vozDoPedido({ voz: "grave" })).toBeNull();
    expect(vozDoPedido({})).toBeNull();
  });
});
