import { describe, expect, it } from "vitest";
import { alvoDaOcasiao, compraMaisRecentePorEmail } from "./fila-ocasiao";

const CRIANCAS = { exigeCampo: "filhos" as const, pulaSeJaFezPara: ["filho", "filha"] };
const NATAL = { exigeCampo: null, pulaSeJaFezPara: [] };

describe("compraMaisRecentePorEmail", () => {
  const desde = "2026-04-01T00:00:00Z";

  it("uma linha por pessoa, com a compra mais recente, em minúsculas", () => {
    const fila = compraMaisRecentePorEmail(
      [
        { email: "Ana@Gmail.com", quiz_response_id: "q1", paid_at: "2026-05-01T00:00:00Z", dinheiro_entrou: true },
        { email: "ana@gmail.com ", quiz_response_id: "q2", paid_at: "2026-09-01T00:00:00Z", dinheiro_entrou: null },
      ],
      desde,
    );
    expect(fila).toEqual([{ email: "ana@gmail.com", quizId: "q2", paidAt: "2026-09-01T00:00:00Z" }]);
  });

  it("quem comprou por último vem primeiro", () => {
    const fila = compraMaisRecentePorEmail(
      [
        { email: "a@x.com", quiz_response_id: "q1", paid_at: "2026-05-01T00:00:00Z", dinheiro_entrou: true },
        { email: "b@x.com", quiz_response_id: "q2", paid_at: "2026-09-01T00:00:00Z", dinheiro_entrou: true },
        { email: "c@x.com", quiz_response_id: "q3", paid_at: "2026-07-01T00:00:00Z", dinheiro_entrou: true },
      ],
      desde,
    );
    expect(fila.map((f) => f.email)).toEqual(["b@x.com", "c@x.com", "a@x.com"]);
  });

  it("resgate de crédito, pedido sem quiz e compra fora da janela ficam de fora", () => {
    const fila = compraMaisRecentePorEmail(
      [
        { email: "credito@x.com", quiz_response_id: "q1", paid_at: "2026-09-01T00:00:00Z", dinheiro_entrou: false },
        { email: "semquiz@x.com", quiz_response_id: null, paid_at: "2026-09-01T00:00:00Z", dinheiro_entrou: true },
        { email: "velho@x.com", quiz_response_id: "q3", paid_at: "2026-03-01T00:00:00Z", dinheiro_entrou: true },
        { email: null, quiz_response_id: "q4", paid_at: "2026-09-01T00:00:00Z", dinheiro_entrou: true },
      ],
      desde,
    );
    expect(fila).toEqual([]);
  });
});

describe("alvoDaOcasiao", () => {
  it("Dia das Crianças: o primeiro nome escrito no campo filhos", () => {
    expect(alvoDaOcasiao({ relacao: "esposa", filhos: "Sara e Isaque", nome: "Ana" }, "pt", CRIANCAS)).toEqual({
      filho: "Sara",
      nomeMusica: "Ana",
      locale: "pt",
    });
  });

  it("memorial, louvor e quem já fez pro filho nunca recebem", () => {
    expect(alvoDaOcasiao({ ocasiao: "memorial", filhos: "João" }, "pt", CRIANCAS)).toBeNull();
    expect(alvoDaOcasiao({ relacao: "deus", filhos: "João" }, "pt", CRIANCAS)).toBeNull();
    expect(alvoDaOcasiao({ relacao: "filha", filhos: "João" }, "pt", CRIANCAS)).toBeNull();
  });

  it("sem nome limpo, fora", () => {
    expect(alvoDaOcasiao({ relacao: "esposa", filhos: "-" }, "pt", CRIANCAS)).toBeNull();
    expect(alvoDaOcasiao({ relacao: "esposa" }, "pt", CRIANCAS)).toBeNull();
    expect(alvoDaOcasiao({ relacao: "esposa", nome: "  " }, "pt", NATAL)).toBeNull();
  });

  it("sem campo exigido, o nome é o do homenageado; espanhol com texto próprio", () => {
    expect(alvoDaOcasiao({ relacao: "mae", nome: " Rosa " }, "es", NATAL)).toEqual({
      filho: "Rosa",
      nomeMusica: "Rosa",
      locale: "es",
    });
    expect(alvoDaOcasiao({ relacao: "esposa", filhos: "Lia" }, "es", CRIANCAS)?.nomeMusica).toBe("esa persona");
  });
});
