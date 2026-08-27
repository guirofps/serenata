import { describe, expect, it } from "vitest";
import { EMPRESA, cnpjFormatado, temIdentificacao } from "./empresa";

// O QUE ESTE TESTE SEGURA
//
// O CNPJ aparece na tela de pagamento como prova de quem está recebendo. Um
// dígito errado ali não é erro de digitação: é a tela afirmando que a empresa
// é OUTRA, na frente de quem está prestes a transferir dinheiro sem
// chargeback. E é o tipo de erro que ninguém revisa depois, porque o número
// "parece certo" pra qualquer olho que bate.
//
// Por isso o teste não confere só o formato: confere a MATEMÁTICA. Os dois
// dígitos verificadores são calculados a partir dos doze primeiros, então um
// número inventado ou com um dígito trocado quase sempre cai aqui.

/** O algoritmo oficial da Receita: dois dígitos, pesos de 2 a 9 ciclando. */
function digitosConferem(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  // Todos iguais (00000000000000) passam na conta e não são CNPJ de ninguém.
  if (/^(\d)\1{13}$/.test(d)) return false;

  // Da DIREITA pra esquerda, peso começando em 2 e subindo até 9, então
  // voltando pro 2. Escrito assim porque é como a regra é definida; a
  // primeira versão deste teste começava o peso em `ate - 7` e reprovava um
  // CNPJ válido — o teste pegou o próprio bug antes de pegar qualquer outra
  // coisa, que é o melhor que podia ter acontecido com ele.
  const calcular = (ate: number) => {
    let peso = 2;
    let soma = 0;
    for (let i = ate - 1; i >= 0; i--) {
      soma += Number(d[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcular(12) === Number(d[12]) && calcular(13) === Number(d[13]);
}

describe("o CNPJ que vai na tela de pagamento", () => {
  it("passa nos dígitos verificadores", () => {
    expect(digitosConferem(EMPRESA.cnpj)).toBe(true);
  });

  it("o próprio verificador reprova um dígito trocado", () => {
    // Sem isto o teste acima poderia estar aprovando qualquer coisa.
    const torto = EMPRESA.cnpj.slice(0, 5) + ((Number(EMPRESA.cnpj[5]) + 1) % 10) + EMPRESA.cnpj.slice(6);
    expect(digitosConferem(torto)).toBe(false);
    expect(digitosConferem("00000000000000")).toBe(false);
    expect(digitosConferem("11111111111111")).toBe(false);
  });

  it("sai formatado do jeito que se lê", () => {
    expect(cnpjFormatado()).toBe("45.835.258/0001-46");
  });

  it("com nome e número, a tela mostra a identificação", () => {
    expect(EMPRESA.nome).not.toBe("");
    expect(temIdentificacao()).toBe(true);
  });
});
