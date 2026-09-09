import { describe, expect, it } from "vitest";
import { emailLiberado, lerListaDeAdmins } from "./admin-emails";

const LISTA = ["nosfer@gmail.com", "guilhermerojasiqueira@gmail.com"];

describe("emailLiberado — quem entra no painel pelo Google", () => {
  it("libera exatamente os dois da lista", () => {
    expect(emailLiberado("nosfer@gmail.com", LISTA)).toBe(true);
    expect(emailLiberado("guilhermerojasiqueira@gmail.com", LISTA)).toBe(true);
  });

  it("nega quem não está na lista", () => {
    expect(emailLiberado("outro@gmail.com", LISTA)).toBe(false);
  });

  // ── FAIL-CLOSED ───────────────────────────────────────────────
  //
  // Lista ausente não pode virar "libera todo mundo". É a regra que o
  // `ADMIN_SECRET` já segue, e o oposto do webhook fail-open herdado do numaya
  // (`!secretEsperado || ...`), que aceitava qualquer POST quando a env
  // faltava.
  it("sem lista, ninguém entra", () => {
    expect(emailLiberado("nosfer@gmail.com", [])).toBe(false);
  });

  it("sem e-mail, ninguém entra", () => {
    expect(emailLiberado(null, LISTA)).toBe(false);
    expect(emailLiberado(undefined, LISTA)).toBe(false);
    expect(emailLiberado("", LISTA)).toBe(false);
    expect(emailLiberado("   ", LISTA)).toBe(false);
  });

  it("ignora caixa e espaço nas duas pontas", () => {
    // O Google devolve o endereço canônico; a variável de ambiente é digitada
    // à mão, e é ali que entra o espaço depois da vírgula e o maiúsculo.
    expect(emailLiberado("Nosfer@Gmail.com", LISTA)).toBe(true);
    expect(emailLiberado("  nosfer@gmail.com  ", LISTA)).toBe(true);
    expect(emailLiberado("nosfer@gmail.com", ["  NOSFER@GMAIL.COM  "])).toBe(true);
  });

  // ── NADA DE "QUASE IGUAL" ─────────────────────────────────────
  //
  // Um domínio grudado no fim é o truque mais barato que existe, e passaria em
  // qualquer comparação que não fosse igualdade.
  it("nega o parecido", () => {
    expect(emailLiberado("nosfer@gmail.com.br", LISTA)).toBe(false);
    expect(emailLiberado("nosfer@gmail.co", LISTA)).toBe(false);
    expect(emailLiberado("xnosfer@gmail.com", LISTA)).toBe(false);
    expect(emailLiberado("nosfer@gmail.com.evil.com", LISTA)).toBe(false);
  });

  it("nega sufixo com +, mesmo caindo na mesma caixa", () => {
    // O Gmail entrega `nosfer+x@gmail.com` em `nosfer@gmail.com`, então quem
    // conseguiria usar isso já é o dono da conta. Nega de propósito: abrir a
    // exceção troca uma comparação que qualquer um entende por uma regra de
    // normalização que só vale pro Gmail, e que passaria a decidir acesso.
    expect(emailLiberado("nosfer+admin@gmail.com", LISTA)).toBe(false);
  });
});

describe("lerListaDeAdmins — o que a variável de ambiente vira", () => {
  it("separa por vírgula", () => {
    expect(lerListaDeAdmins("a@x.com,b@y.com")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("aguenta espaço, ponto-e-vírgula e quebra de linha", () => {
    // Ninguém digita uma lista de e-mails do jeito limpo na caixinha da
    // Vercel. Colar de um bloco de notas traz quebra de linha junto.
    expect(lerListaDeAdmins("a@x.com, b@y.com ; c@z.com\nd@w.com")).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
      "d@w.com",
    ]);
  });

  it("descarta pedaço vazio, em vez de virar entrada em branco", () => {
    // `"a@x.com,,"` com split cru produz `""` na lista — e uma entrada vazia
    // combinando com um e-mail vazio é exatamente como uma lista de permissão
    // vira uma porta aberta.
    expect(lerListaDeAdmins("a@x.com,,")).toEqual(["a@x.com"]);
    expect(lerListaDeAdmins(",")).toEqual([]);
  });

  it("variável ausente vira lista vazia, não erro", () => {
    // Lista vazia já significa "ninguém entra" em `emailLiberado`, então o
    // fail-closed acontece num lugar só.
    expect(lerListaDeAdmins(undefined)).toEqual([]);
    expect(lerListaDeAdmins("")).toEqual([]);
    expect(lerListaDeAdmins("   ")).toEqual([]);
  });

  it("normaliza pra minúscula na leitura", () => {
    expect(lerListaDeAdmins("Nosfer@Gmail.COM")).toEqual(["nosfer@gmail.com"]);
  });
});
