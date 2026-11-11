import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contaDaAssinatura, contasDlocal, ErroDlocal, lerPagamentoDlocal, type ContaDlocal } from "../../api/lib/dlocalgo";

// 11/11: a cobrança nova nasce na conta nova (CNPJ novo); a antiga continua aceita
// enquanto houver ficha dela viva. O aviso vem assinado pela conta que criou a
// cobrança, e só ela responde o GET do pagamento.

const NOVA: ContaDlocal = { nome: "nova", chave: "chave-nova", segredo: "segredo-nova" };
const ANTIGA: ContaDlocal = { nome: "antiga", chave: "chave-antiga", segredo: "segredo-antiga" };
const assina = (c: ContaDlocal, corpo: string) =>
  `V2-HMAC-SHA256, Signature: ${createHmac("sha256", c.segredo).update(c.chave + corpo).digest("hex")}`;

describe("contasDlocal", () => {
  it("a nova vem primeiro, a antiga só se as duas chaves dela existirem", () => {
    expect(contasDlocal({ DLOCALGO_API_KEY: "a", DLOCALGO_SECRET_KEY: "b" }).map((c) => c.nome)).toEqual(["nova"]);
    expect(
      contasDlocal({ DLOCALGO_API_KEY: "a", DLOCALGO_SECRET_KEY: "b", DLOCALGO_API_KEY_ANTIGA: "c", DLOCALGO_SECRET_KEY_ANTIGA: "d" }).map((c) => c.nome),
    ).toEqual(["nova", "antiga"]);
    expect(contasDlocal({ DLOCALGO_API_KEY: "a", DLOCALGO_SECRET_KEY: "b", DLOCALGO_API_KEY_ANTIGA: "c" }).map((c) => c.nome)).toEqual(["nova"]);
    expect(contasDlocal({})).toEqual([]);
  });
});

describe("contaDaAssinatura", () => {
  const corpo = '{"payment_id":"DP-123"}';
  it("reconhece o aviso da conta nova e o da antiga", () => {
    expect(contaDaAssinatura(assina(NOVA, corpo), corpo, [NOVA, ANTIGA])?.nome).toBe("nova");
    expect(contaDaAssinatura(assina(ANTIGA, corpo), corpo, [NOVA, ANTIGA])?.nome).toBe("antiga");
  });
  it("recusa aviso de chave desconhecida, corpo mexido ou sem cabeçalho", () => {
    const estranha: ContaDlocal = { nome: "nova", chave: "x", segredo: "y" };
    expect(contaDaAssinatura(assina(estranha, corpo), corpo, [NOVA, ANTIGA])).toBeNull();
    expect(contaDaAssinatura(assina(NOVA, corpo), '{"payment_id":"DP-124"}', [NOVA, ANTIGA])).toBeNull();
    expect(contaDaAssinatura(undefined, corpo, [NOVA, ANTIGA])).toBeNull();
    expect(contaDaAssinatura(assina(ANTIGA, corpo), corpo, [NOVA])).toBeNull();
  });
});

describe("lerPagamentoDlocal", () => {
  afterEach(() => vi.unstubAllGlobals());
  const resposta = (status: number, corpo: unknown) => ({ ok: status < 300, status, json: async () => corpo });

  it("acha na nova sem perguntar à antiga", async () => {
    const f = vi.fn(async () => resposta(200, { id: "DP-1", status: "PAID" }));
    vi.stubGlobal("fetch", f);
    expect((await lerPagamentoDlocal("DP-1", [NOVA, ANTIGA])).status).toBe("PAID");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("cobrança da conta antiga: a nova diz 404, a antiga responde", async () => {
    const f = vi.fn(async (_url: string, init: { headers: Record<string, string> }) =>
      init.headers.Authorization.includes("chave-antiga")
        ? resposta(200, { id: "DP-2", status: "PAID" })
        : resposta(404, { code: 4000, message: "Payment not found." }),
    );
    vi.stubGlobal("fetch", f);
    expect((await lerPagamentoDlocal("DP-2", [NOVA, ANTIGA])).status).toBe("PAID");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("cobrança da conta antiga do jeito que a dLocal responde de verdade: 403 na nova", async () => {
    const f = vi.fn(async (_url: string, init: { headers: Record<string, string> }) =>
      init.headers.Authorization.includes("chave-antiga")
        ? resposta(200, { id: "DP-9052404", status: "PENDING" })
        : resposta(403, { code: 3001, message: "Invalid Credentials." }),
    );
    vi.stubGlobal("fetch", f);
    expect((await lerPagamentoDlocal("DP-9052404", [NOVA, ANTIGA])).status).toBe("PENDING");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("erro que não é 403/404 sobe na hora, sem tentar a outra conta", async () => {
    const f = vi.fn(async () => resposta(500, { message: "internal" }));
    vi.stubGlobal("fetch", f);
    await expect(lerPagamentoDlocal("DP-3", [NOVA, ANTIGA])).rejects.toBeInstanceOf(ErroDlocal);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("não existe em nenhuma: devolve o 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(404, { message: "Payment not found." })));
    await expect(lerPagamentoDlocal("DP-4", [NOVA, ANTIGA])).rejects.toMatchObject({ status: 404 });
  });
});
