import { describe, expect, it } from "vitest";
import { ocasiaoDeHoje, primeiroNome, templateDaOcasiao } from "./ocasioes";

// A JANELA DE DISPARO E O NOME QUE VAI NO ASSUNTO.
//
// As duas coisas que quebram em silêncio numa régua de calendário:
//
//   a JANELA, que se errada dispara no dia errado do ano e só se descobre
//   quando o e-mail já saiu;
//   o NOME, que vem de campo livre e onde a pessoa escreveu de tudo —
//   "João Myguell", "Sara e Isaque", "-", "nao tenho". Um assunto dizendo
//   "e o - ainda não tem a música dele" é pior que não mandar nada.
describe("janela da ocasião", () => {
  const em = (iso: string) => new Date(iso + "T15:00:00Z");

  it("abre 21 dias antes do Dia das Crianças", () => {
    // 12/10 menos 21 dias = 21/09.
    expect(ocasiaoDeHoje(em("2026-09-21"))?.ocasiao.slug).toBe("criancas");
  });

  it("não abre 22 dias antes", () => {
    expect(ocasiaoDeHoje(em("2026-09-20"))?.ocasiao.slug).not.toBe("criancas");
  });

  it("fecha 3 dias antes, e não manda na véspera", () => {
    expect(ocasiaoDeHoje(em("2026-10-09"))?.ocasiao.slug).toBe("criancas");
    expect(ocasiaoDeHoje(em("2026-10-11"))?.ocasiao.slug).not.toBe("criancas");
    // No próprio dia, nada: presente que chega no dia já perdeu a função.
    expect(ocasiaoDeHoje(em("2026-10-12"))?.ocasiao.slug).not.toBe("criancas");
  });

  it("fora de qualquer janela, não devolve ocasião", () => {
    // Fim de julho: longe de crianças (12/10), Natal (25/12) e mães (10/05).
    expect(ocasiaoDeHoje(em("2026-07-28"))).toBeNull();
  });

  it("enxerga a data do ANO QUE VEM quando ela está mais perto", () => {
    // 20/04 está a 20 dias do Dia das Mães de 2026 — dentro dos 21.
    const r = ocasiaoDeHoje(em("2026-04-20"));
    expect(r?.ocasiao.slug).toBe("maes");
    expect(r?.ano).toBe(2026);
  });

  it("quando duas janelas se cruzam, ganha a mais próxima", () => {
    // 25/11: Natal está a 30 dias (dentro da janela). Nenhuma outra abre.
    expect(ocasiaoDeHoje(em("2026-11-25"))?.ocasiao.slug).toBe("natal");
  });
});

describe("template com o ano dentro", () => {
  it("separa temporadas, pra mesma pessoa poder receber no ano seguinte", () => {
    expect(templateDaOcasiao("criancas", 2026)).toBe("ocasiao_criancas_2026");
    expect(templateDaOcasiao("criancas", 2026)).not.toBe(templateDaOcasiao("criancas", 2027));
  });
});

describe("nome do filho, vindo de campo livre", () => {
  it("pega o primeiro nome de uma lista", () => {
    expect(primeiroNome("Sara e Isaque")).toBe("Sara");
    expect(primeiroNome("Jennefer e kauã")).toBe("Jennefer");
    expect(primeiroNome("Ana, Pedro")).toBe("Ana");
    expect(primeiroNome("Ana / Pedro")).toBe("Ana");
  });

  it("usa só a primeira palavra do nome composto", () => {
    expect(primeiroNome("João Myguell ")).toBe("João");
  });

  it("normaliza a caixa, porque o campo vem como a pessoa digitou", () => {
    expect(primeiroNome("kauã")).toBe("Kauã");
  });

  // ── OS TRÊS QUE O ENSAIO DE 08/09 PEGOU ──────────────────────
  //
  // A primeira versão ia mandar, pra gente de verdade:
  //   "Filhos ainda não tem uma música"   (campo: "Filhos Marianne, Gabriela e P")
  //   "Filha ainda não tem uma música"    (campo: "Filha mais velha: Denize, e o")
  //
  // Muita gente ROTULA o campo antes de responder, e o rótulo vinha como
  // nome. Foi o ensaio que mostrou; nenhum teste teria adivinhado esses
  // formatos sozinho.
  it("pula o rótulo que a pessoa escreveu antes do nome", () => {
    expect(primeiroNome("Filhos Marianne , Gabriela e P")).toBe("Marianne");
    expect(primeiroNome("Filha mais velha: Denize, e o ")).toBe("Denize");
    expect(primeiroNome("meus filhos são Ana e Pedro")).toBe("Ana");
    expect(primeiroNome("Nome: Kaleb")).toBe("Kaleb");
  });

  it("recusa o que não é nome, e aí a pessoa fica fora da leva", () => {
    // Um assunto com "e o - ainda não tem música" é pior que não mandar.
    for (const lixo of ["", "   ", "-", "1", "x", "nao", "não tenho", "n/a"]) {
      expect(primeiroNome(lixo)).toBeNull();
    }
  });
});
