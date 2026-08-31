import { describe, it, expect } from "vitest";
import { zDiferenca } from "../../inngest/functions/vigiaExperimento";

// A CONTA QUE PODE DESLIGAR UM EXPERIMENTO SOZINHA.
//
// Ela mexe em produção sem ninguém olhando, então o que ela precisa provar
// não é que acerta o caso bom — é que ela CALA A BOCA quando não sabe. Um
// desligamento errado num domingo de madrugada apaga o teste e some com o
// motivo junto.

describe("z da vigia de experimento", () => {
  it("não opina com amostra pequena, por maior que pareça a diferença", () => {
    // 0 de 3 contra 2 de 2 parece catástrofe e não é nada: é uma madrugada
    // calma. Foi exatamente esta leitura que apareceu na primeira hora do
    // `zap_previa` (B com 0%), e ela não pode virar desligamento.
    expect(zDiferenca(2, 2, 0, 3)).toBeNull();
    expect(zDiferenca(50, 100, 5, 100)).toBeNull();
  });

  it("exige amostra nos DOIS braços, não na soma", () => {
    // Um braço enorme não compra o direito de julgar o outro.
    expect(zDiferenca(400, 1000, 0, 10)).toBeNull();
    expect(zDiferenca(4, 10, 300, 1000)).toBeNull();
  });

  it("é negativo quando o braço testado converte pior", () => {
    const z = zDiferenca(180, 1000, 100, 1000);
    expect(z).not.toBeNull();
    expect(z!).toBeLessThan(-2.5);
  });

  it("é positivo quando o braço testado converte melhor, e nunca desliga", () => {
    const z = zDiferenca(100, 1000, 180, 1000);
    expect(z!).toBeGreaterThan(0);
  });

  it("fica perto de zero quando os dois são iguais", () => {
    expect(Math.abs(zDiferenca(150, 1000, 150, 1000)!)).toBeLessThan(0.01);
  });

  it("não devolve NaN quando ninguém converteu nos dois lados", () => {
    // Sem nenhuma conversão a proporção combinada é 0 e o erro padrão vira 0.
    // Dividir por ele daria NaN, e `NaN < -2.5` é falso — funcionaria por
    // acidente. Aqui a resposta é `null` de propósito, que é "não sei".
    expect(zDiferenca(0, 500, 0, 500)).toBeNull();
  });
});
