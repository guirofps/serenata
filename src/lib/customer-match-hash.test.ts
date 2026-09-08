import { describe, expect, it } from "vitest";
import { hashEmail } from "../../api/customer-match";

// O HASH QUE O GOOGLE CASA, E SÓ ELE.
//
// Customer Match falha do jeito mais caro que existe: o Google ACEITA o
// arquivo, responde "processando", e 48 horas depois a lista aparece com
// zero correspondências. Não há mensagem de erro em lugar nenhum, e o
// arquivo continua parecendo certo quando você abre.
//
// Todos os modos de errar abaixo produzem um arquivo que passa em qualquer
// inspeção visual. Por isso o teste, e não a leitura.
describe("hash de e-mail para Customer Match", () => {
  it("normaliza caixa e espaço antes de hashear", () => {
    // "  Teste@Exemplo.COM  " e "teste@exemplo.com" são a MESMA pessoa. Sem
    // normalizar, viram dois membros diferentes na lista e nenhum dos dois
    // casa com o que o Google tem guardado.
    const a = hashEmail("  Teste@Exemplo.COM  ");
    const b = hashEmail("teste@exemplo.com");
    expect(a).toBe(b);
  });

  it("devolve 64 caracteres hexadecimais MINÚSCULOS", () => {
    const h = hashEmail("teste@exemplo.com");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    // Explícito, porque `digest("hex")` do Node já sai minúsculo mas um
    // `.toUpperCase()` bem-intencionado em algum refactor mataria a lista
    // inteira em silêncio.
    expect(h).toBe(h?.toLowerCase());
  });

  it("é o mesmo hash que o parceiro produz (mesma normalização)", () => {
    // A lista da Cantoria chega já hasheada. Se as duas pontas normalizarem
    // diferente, a mesma pessoa entra duas vezes e a deduplicação da união
    // não funciona. Este teste trava a nossa metade do contrato.
    expect(hashEmail("TESTE@exemplo.com")).toBe(hashEmail("teste@exemplo.com "));
  });

  it("recusa o que não é endereço, antes de virar hash", () => {
    // Depois de hasheado não dá mais pra inspecionar: lixo dentro da lista
    // só derruba a taxa de correspondência, que é justamente o número que a
    // gente usa pra julgar se a lista deu certo.
    expect(hashEmail("")).toBeNull();
    expect(hashEmail("   ")).toBeNull();
    expect(hashEmail("semarroba")).toBeNull();
    expect(hashEmail("a@b")).toBeNull();
  });

  it("não remove ponto de endereço do gmail", () => {
    // O Google documenta a remoção de ponto no gmail como OPCIONAL e faz a
    // normalização do lado dele. Fazer só de um lado é o que cria hash que
    // não casa, então as duas formas têm que sair diferentes daqui.
    expect(hashEmail("jo.ao@gmail.com")).not.toBe(hashEmail("joao@gmail.com"));
  });
});
