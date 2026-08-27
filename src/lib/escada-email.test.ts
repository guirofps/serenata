import { describe, expect, it } from "vitest";
import { assuntoEscada, emailEscada } from "../../emails/escada";

// O DEGRAU 2 NÃO PODE MENTIR.
//
// O texto padrão afirma que a gravação ficou pronta DEPOIS que a pessoa saiu.
// Pra quem tocou a prévia isso não aconteceu — e é 81% de quem recebe. Um
// e-mail que conta uma história que a pessoa sabe que é falsa perde a única
// vantagem que ele tem sobre qualquer concorrente: falar de algo que ela
// viveu dez minutos antes.
describe("degrau 2 da escada", () => {
  const base = {
    numero: 2 as const,
    nome: "Isabela",
    link: "https://exemplo/checkout",
    linkDescadastro: "https://exemplo/sair",
  };

  it("pra quem NÃO ouviu, mantém o texto de sempre", () => {
    const html = emailEscada({ ...base, ouviu: false });
    expect(html).toContain("foi embora antes da última parte");
    expect(assuntoEscada(2, "Isabela", false)).toContain("está pronta");
  });

  it("pra quem OUVIU, não afirma que ela saiu antes da gravação", () => {
    const html = emailEscada({ ...base, ouviu: true });
    expect(html).not.toContain("foi embora antes");
    expect(html).not.toContain("ficou pronta alguns minutos depois");
    // O argumento passa a ser o que ela ainda não ouviu.
    expect(html).toContain("refrão");
    expect(html).toContain("DUAS gravações");
  });

  it("o assunto muda junto — senão os dois textos abrem igual", () => {
    expect(assuntoEscada(2, "Isabela", true)).not.toBe(assuntoEscada(2, "Isabela", false));
    expect(assuntoEscada(2, "Isabela", true)).toContain("Isabela");
  });

  it("o sinal só vale no degrau 2; os outros ignoram", () => {
    for (const n of [3, 4] as const) {
      expect(emailEscada({ ...base, numero: n, ouviu: true })).toBe(
        emailEscada({ ...base, numero: n, ouviu: false }),
      );
    }
  });

  it("sem o sinal, o comportamento é o de antes", () => {
    expect(emailEscada(base)).toBe(emailEscada({ ...base, ouviu: false }));
  });
});
