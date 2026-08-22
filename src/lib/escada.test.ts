import { describe, expect, it } from "vitest";
import {
  DEGRAUS,
  ESPERA_H,
  OFERTA,
  assuntoEscada,
  emailEscada,
  linkDeCompra,
  type DegrauEscada,
} from "../../emails/escada";

// A ESCADA DE RECUPERAÇÃO, testada onde ela erra sem avisar.
//
// Nada aqui quebra em produção de um jeito visível: um degrau com preço maior
// que o anterior, um `{nome}` vazando cru pro cliente, ou um checkout sem o
// `src` — os três SAEM, chegam na caixa da pessoa, e só aparecem quando alguém
// lê o e-mail recebido ou vai atrás de um pagamento órfão.
//
// O primeiro caso não é hipotético: a primeira versão da escada que eu propus
// tinha 28 depois de 29, ou seja, o preço SUBIA no meio da campanha.

const dinheiro = (texto: string) => Number(texto.replace(/[^\d,]/g, "").replace(",", "."));

describe("a escada de preço", () => {
  it("são dez degraus, do 2 ao 11 (o 1 é a letra)", () => {
    expect(DEGRAUS).toHaveLength(10);
    expect(DEGRAUS[0]).toBe(2);
    expect(DEGRAUS[DEGRAUS.length - 1]).toBe(11);
  });

  it("começa em R$ 38 e termina em R$ 9, como pedido", () => {
    expect(dinheiro(OFERTA[2].texto)).toBe(38);
    expect(dinheiro(OFERTA[11].texto)).toBe(9);
  });

  it("O PREÇO NUNCA SOBE — o teste que pega a escada montada errada", () => {
    for (let i = 1; i < DEGRAUS.length; i++) {
      const antes = dinheiro(OFERTA[DEGRAUS[i - 1]].texto);
      const agora = dinheiro(OFERTA[DEGRAUS[i]].texto);
      expect(agora, `degrau ${DEGRAUS[i]} depois do ${DEGRAUS[i - 1]}`).toBeLessThanOrEqual(antes);
    }
  });

  it("o preço cheio segura os primeiros e-mails — descontar no dia seguinte ensina a esperar", () => {
    expect(dinheiro(OFERTA[2].texto)).toBe(38);
    expect(dinheiro(OFERTA[3].texto)).toBe(38);
    expect(dinheiro(OFERTA[4].texto)).toBe(38);
    expect(dinheiro(OFERTA[5].texto)).toBeLessThan(38);
  });

  it("todo degrau tem link https da Perfect Pay", () => {
    for (const n of DEGRAUS) {
      expect(OFERTA[n].checkout, `degrau ${n}`).toMatch(/^https:\/\//);
    }
  });

  it("a régua inteira leva ~30 dias, dentro da janela de 45 da fila", () => {
    const horas = DEGRAUS.reduce((s, n) => s + ESPERA_H[n], 0);
    expect(horas / 24).toBeGreaterThan(20);
    expect(horas / 24).toBeLessThan(45);
  });

  it("a espera nunca encolhe — dois e-mails colados é o que faz virar spam", () => {
    for (let i = 1; i < DEGRAUS.length; i++) {
      expect(ESPERA_H[DEGRAUS[i]]).toBeGreaterThanOrEqual(ESPERA_H[DEGRAUS[i - 1]]);
    }
  });
});

describe("linkDeCompra — a ponte com o webhook", () => {
  it("SEMPRE carrega o `src`: sem ele a compra vira 'pago sem música casada'", () => {
    for (const n of DEGRAUS) {
      const u = new URL(linkDeCompra(n, "sessao-abc", "a@b.com"));
      expect(u.searchParams.get("src"), `degrau ${n}`).toBe("sessao-abc");
    }
  });

  it("leva o e-mail preenchido, que é um campo a menos no formulário", () => {
    const u = new URL(linkDeCompra(5, "s1", "maria@gmail.com"));
    expect(u.searchParams.get("email")).toBe("maria@gmail.com");
  });

  it("sem e-mail não inventa o parâmetro vazio", () => {
    const u = new URL(linkDeCompra(5, "s1", ""));
    expect(u.searchParams.has("email")).toBe(false);
  });

  it("escapa o que precisa ser escapado", () => {
    const u = new URL(linkDeCompra(2, "a b&c=d", "x+y@z.com"));
    expect(u.searchParams.get("src")).toBe("a b&c=d");
    expect(u.searchParams.get("email")).toBe("x+y@z.com");
  });

  it("cada degrau aponta pro checkout do próprio preço", () => {
    for (const n of DEGRAUS) {
      expect(linkDeCompra(n, "s", "").startsWith(OFERTA[n].checkout)).toBe(true);
    }
  });
});

describe("a copy de cada degrau", () => {
  const monta = (n: DegrauEscada, verso: string | null = "Duas linhas\nda letra dela") =>
    emailEscada({
      numero: n,
      nome: "Camila",
      link: linkDeCompra(n, "s1", "a@b.com"),
      linkDescadastro: "https://x/descadastrar?s=s1",
      verso,
    });

  it("NENHUM placeholder vaza cru pro cliente", () => {
    for (const n of DEGRAUS) {
      const html = monta(n);
      expect(html, `degrau ${n}`).not.toMatch(/\{nome\}|\{preco\}|\{verso\}/);
      expect(assuntoEscada(n, "Camila"), `assunto ${n}`).not.toMatch(/\{\w+\}/);
    }
  });

  it("o nome da pessoa homenageada aparece, e o preço do degrau também", () => {
    const html = monta(7);
    expect(html).toContain("Camila");
    expect(html).toContain("R$ 19");
  });

  it("todo e-mail tem o link de compra e o de descadastro", () => {
    for (const n of DEGRAUS) {
      const html = monta(n);
      expect(html, `compra ${n}`).toContain(OFERTA[n].checkout.replace(/^https:\/\//, ""));
      expect(html, `descadastro ${n}`).toContain("descadastrar");
    }
  });

  it("assuntos são todos diferentes — dez vezes o mesmo assunto é marcar spam", () => {
    const assuntos = DEGRAUS.map((n) => assuntoEscada(n, "Camila"));
    expect(new Set(assuntos).size).toBe(DEGRAUS.length);
  });

  it("o degrau do verso mostra a letra dela quando existe", () => {
    expect(monta(4)).toContain("Duas linhas");
  });

  it("e cai num texto que faz sentido quando a letra não veio", () => {
    const html = monta(4, null);
    expect(html).not.toContain("Duas linhas");
    expect(html).toContain("guardada");
  });

  it("nome vazio não produz saudação quebrada", () => {
    const html = emailEscada({
      numero: 3,
      nome: "",
      link: "https://x",
      linkDescadastro: "https://y",
    });
    expect(html).toContain("essa pessoa");
    expect(html).not.toMatch(/de\s*<\/h1>|de\s*\./);
  });
});
