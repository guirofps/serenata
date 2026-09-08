import { describe, expect, it } from "vitest";
import { emailValido, hashEmail, normalizaEmail } from "../../inngest/lib/publicos-google";

// O HASH QUE O GOOGLE CASA, E SÓ ELE.
//
// Customer Match falha do jeito mais caro que existe: o Google ACEITA o
// arquivo, responde "processando", e 48 horas depois a lista aparece com
// zero correspondências. Não há mensagem de erro em lugar nenhum, e o
// arquivo continua parecendo certo quando você abre.
//
// Todos os modos de errar abaixo produzem um arquivo que passa em qualquer
// inspeção visual. Por isso o teste, e não a leitura.
//
// Este teste guarda a implementação CANÔNICA (`inngest/lib/publicos-google`),
// que é a que alimenta as três listas. Em 08/09 eu escrevi um segundo
// endpoint com uma segunda implementação de hash e de segmento, sem ter
// procurado se já existia — duas verdades sobre quem é comprador. O gêmeo
// foi apagado; o teste ficou apontado pra cá de propósito.
describe("hash de e-mail para Customer Match", () => {
  it("normaliza caixa e espaço antes de hashear", () => {
    // "  Teste@Exemplo.COM  " e "teste@exemplo.com" são a MESMA pessoa. Sem
    // normalizar, viram dois membros diferentes na lista e nenhum dos dois
    // casa com o que o Google tem guardado.
    expect(hashEmail("  Teste@Exemplo.COM  ")).toBe(hashEmail("teste@exemplo.com"));
  });

  it("normaliza ANTES do hash, nunca depois", () => {
    // Se a normalização acontecesse depois, ela cairia sobre o hexadecimal
    // e não sobre o endereço, e o hash de "A@x.com" continuaria diferente do
    // de "a@x.com". É o erro que não dá pra ver lendo o arquivo.
    expect(normalizaEmail("  A@X.COM ")).toBe("a@x.com");
    expect(hashEmail("A@X.COM")).toBe(hashEmail("a@x.com"));
  });

  it("devolve 64 caracteres hexadecimais MINÚSCULOS", () => {
    const h = hashEmail("teste@exemplo.com");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    // Explícito, porque `digest("hex")` do Node já sai minúsculo mas um
    // `.toUpperCase()` bem-intencionado em algum refactor mataria a lista
    // inteira em silêncio.
    expect(h).toBe(h.toLowerCase());
  });

  it("é o mesmo hash que o parceiro produz (mesma normalização)", () => {
    // A lista da Cantoria chega já hasheada e a união depende das duas
    // pontas normalizarem igual: se não, a mesma pessoa entra duas vezes.
    expect(hashEmail("TESTE@exemplo.com")).toBe(hashEmail("teste@exemplo.com "));
  });

  it("recusa o que não é endereço, antes de virar hash", () => {
    // Depois de hasheado não dá mais pra inspecionar: lixo dentro da lista
    // só derruba a taxa de correspondência, que é justamente o número que a
    // gente usa pra julgar se a lista deu certo.
    expect(emailValido("")).toBe(false);
    expect(emailValido("   ")).toBe(false);
    expect(emailValido("semarroba")).toBe(false);
    expect(emailValido("a@b")).toBe(false);
    expect(emailValido("joao@gmail.com")).toBe(true);
  });

  it("não remove ponto de endereço do gmail", () => {
    // O Google documenta a remoção de ponto no gmail como OPCIONAL e faz a
    // normalização do lado dele. Fazer só de um lado é o que cria hash que
    // não casa, então as duas formas têm que sair diferentes daqui.
    expect(hashEmail("jo.ao@gmail.com")).not.toBe(hashEmail("joao@gmail.com"));
  });
});
