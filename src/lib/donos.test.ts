import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { DONOS, donosMais } from "./donos";

describe("DONOS", () => {
  it("o Guilherme está na lista", () => {
    expect(DONOS).toContain("guilhermerojasiqueira@gmail.com");
  });

  it("o Ralph saiu dos alertas por e-mail (02/10, a pedido: chegava demais)", () => {
    expect(DONOS).not.toContain("nosfer@gmail.com");
  });

  it("ninguém repetido — Resend cobra e duplica o e-mail recebido", () => {
    expect(new Set(DONOS).size).toBe(DONOS.length);
  });
});

describe("donosMais", () => {
  it("SOMA ao terceiro, nunca substitui — silenciar a agência seria invisível", () => {
    const r = donosMais("agenciarocketfy@gmail.com");
    expect(r).toContain("agenciarocketfy@gmail.com");
    for (const d of DONOS) expect(r).toContain(d);
  });

  it("não repete quem já é dono", () => {
    const r = donosMais("guilhermerojasiqueira@gmail.com");
    expect(r.filter((e) => e === "guilhermerojasiqueira@gmail.com")).toHaveLength(1);
  });

  it("env var ausente não vira destinatário em branco", () => {
    // `process.env.EMAIL_DONO ?? algo` pode chegar aqui como undefined ou "",
    // e `to: [""]` faz a Resend recusar o envio INTEIRO — o alerta morre
    // calado, que é o pior jeito de um alerta falhar.
    expect(donosMais(undefined, null, "", "   ")).toEqual([...DONOS]);
  });
});

// ── O GUARD QUE IMPEDE A REINCIDÊNCIA ────────────────────────────
//
// O defeito de 27/09 não foi o endereço estar errado: foi ser POSSÍVEL
// escrever um alerta novo que vai pra uma caixa só. A letra parou, o alerta
// disparou, e o dono do funil descobriu olhando a própria tela.
//
// Um teste que só checasse `DONOS` não pegaria isso — o próximo vigia
// continuaria livre pra escrever `to: ["fulano@..."]` e passar verde. Este
// aqui lê o REPOSITÓRIO e recusa endereço cravado em destinatário, que é a
// forma que o defeito tem.
describe("nenhum alerta escreve destinatário na mão", () => {
  it("todo `to:` com e-mail literal tem que passar por donos.ts", () => {
    let saida = "";
    try {
      saida = execFileSync(
        "grep",
        [
          "-rnE",
          'to:\\s*\\[\\s*"[^"]*@',
          "--include=*.ts",
          "--include=*.tsx",
          "src",
          "inngest",
          "api",
          "emails",
        ],
        { encoding: "utf-8", cwd: process.cwd() },
      );
    } catch {
      saida = ""; // grep sai 1 quando não acha nada: é o caso verde.
    }
    const infratores = saida
      .split("\n")
      .filter(Boolean)
      .filter((l) => !l.startsWith("src/lib/donos."));

    expect(
      infratores,
      "destinatário cravado na mão — importe DONOS/donosMais de src/lib/donos.ts",
    ).toEqual([]);
  });
});
