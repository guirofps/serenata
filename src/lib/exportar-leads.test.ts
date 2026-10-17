import { describe, expect, it } from "vitest";
import { csvGoogle, csvOmnisend, montarLeads, telefoneInternacional, type LinhaQuiz } from "./exportar-leads";

const q = (p: Partial<LinhaQuiz> & { email: string | null }): LinhaQuiz => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  whatsapp: null,
  locale: "pt",
  created_at: "2026-10-01T12:00:00Z",
  ...p,
});
const vazio = { idioma: "pt", compradoresEmail: new Set<string>(), compradoresQuiz: new Set<string>(), bloqueados: new Set<string>() };

describe("montarLeads", () => {
  it("um endereço aparece uma vez só, com a data do primeiro quiz", () => {
    const { leads } = montarLeads(
      [
        q({ email: "Ana@Gmail.com ", created_at: "2026-10-05T00:00:00Z" }),
        q({ email: "ana@gmail.com", created_at: "2026-09-01T00:00:00Z" }),
      ],
      vazio,
    );
    expect(leads).toEqual([{ email: "ana@gmail.com", telefone: null, comprou: false, entrouEm: "2026-09-01T00:00:00Z" }]);
  });

  it("descadastrado, morto e excluído ficam de fora, e são contados", () => {
    const r = montarLeads([q({ email: "sai@x.com" }), q({ email: "fica@x.com" })], {
      ...vazio,
      bloqueados: new Set(["sai@x.com"]),
    });
    expect(r.leads.map((l) => l.email)).toEqual(["fica@x.com"]);
    expect(r.bloqueados).toBe(1);
  });

  it("bloqueio vale mesmo com maiúscula no quiz", () => {
    const r = montarLeads([q({ email: "SAI@x.com" })], { ...vazio, bloqueados: new Set(["sai@x.com"]) });
    expect(r.leads).toEqual([]);
  });

  it("comprou por e-mail ou pelo quiz pago", () => {
    const { leads } = montarLeads(
      [q({ email: "a@x.com" }), q({ id: "quiz-pago", email: "b@x.com" }), q({ email: "c@x.com" })],
      { ...vazio, compradoresEmail: new Set(["a@x.com"]), compradoresQuiz: new Set(["quiz-pago"]) },
    );
    expect(leads.map((l) => [l.email, l.comprou])).toEqual([
      ["a@x.com", true],
      ["b@x.com", true],
      ["c@x.com", false],
    ]);
  });

  it("um quiz pago de outra vez marca o endereço inteiro como comprador", () => {
    const { leads } = montarLeads(
      [q({ id: "velho", email: "a@x.com" }), q({ id: "pago", email: "a@x.com" })],
      { ...vazio, compradoresQuiz: new Set(["pago"]) },
    );
    expect(leads[0].comprou).toBe(true);
  });

  it("só o idioma da marca; quiz sem idioma conta como o da marca", () => {
    const { leads } = montarLeads(
      [q({ email: "pt@x.com" }), q({ email: "es@x.com", locale: "es" }), q({ email: "nulo@x.com", locale: null })],
      vazio,
    );
    expect(leads.map((l) => l.email).sort()).toEqual(["nulo@x.com", "pt@x.com"]);
  });

  it("endereço sem forma de e-mail não entra", () => {
    const { leads } = montarLeads([q({ email: "teste" }), q({ email: "" }), q({ email: null })], vazio);
    expect(leads).toEqual([]);
  });

  it("guarda o telefone de qualquer um dos quizzes do endereço", () => {
    const { leads } = montarLeads(
      [q({ email: "a@x.com" }), q({ email: "a@x.com", whatsapp: "5511912345678" })],
      vazio,
    );
    expect(leads[0].telefone).toBe("+5511912345678");
  });
});

describe("telefoneInternacional", () => {
  it("com DDI gravado", () => expect(telefoneInternacional("5511912345678", "55")).toBe("+5511912345678"));
  it("sem DDI, só DDD e número", () => expect(telefoneInternacional("(11) 91234-5678", "55")).toBe("+5511912345678"));
  it("lixo vira nada", () => {
    expect(telefoneInternacional("123", "55")).toBeNull();
    expect(telefoneInternacional(null, "55")).toBeNull();
  });
});

describe("os arquivos", () => {
  const leads = [
    { email: "a@x.com", telefone: "+5511912345678", comprou: true, entrouEm: "2026-09-01T03:00:00Z" },
    { email: "b@x.com", telefone: null, comprou: false, entrouEm: "2026-10-02T15:00:00Z" },
  ];

  it("Google: só as colunas do modelo do Customer Match", () => {
    expect(csvGoogle(leads, "BR")).toBe("Email,Phone,Country\na@x.com,+5511912345678,BR\nb@x.com,,BR\n");
  });

  it("Omnisend: etiqueta de comprador ou lead e a data de entrada", () => {
    expect(csvOmnisend(leads)).toBe(
      "Email,Phone,Tags,Entrou em\na@x.com,+5511912345678,comprador,2026-09-01\nb@x.com,,lead,2026-10-02\n",
    );
  });
});
