import { describe, expect, it } from "vitest";
import { bracoPixGateway, gatewayDoTeste } from "./pix-gateway-ab";

describe("pix_gateway", () => {
  it("par é A (Woovi), ímpar é B (Asaas)", () => {
    expect(bracoPixGateway("3f2a1c9e-0000-4000-8000-00000000000a")).toBe("A");
    expect(bracoPixGateway("3f2a1c9e-0000-4000-8000-000000000000")).toBe("A");
    expect(bracoPixGateway("3f2a1c9e-0000-4000-8000-00000000000b")).toBe("B");
    expect(bracoPixGateway("3f2a1c9e-0000-4000-8000-00000000000F")).toBe("B");
  });

  it("sessão estranha cai no controle", () => {
    expect(bracoPixGateway("")).toBe("A");
    expect(bracoPixGateway(null)).toBe("A");
    expect(bracoPixGateway("ssr")).toBe("A");
  });

  it("divide perto de meio a meio", () => {
    let b = 0;
    for (let i = 0; i < 1600; i++) if (bracoPixGateway(`x-${i.toString(16)}`) === "B") b++;
    expect(b).toBeGreaterThan(700);
    expect(b).toBeLessThan(900);
  });

  it("o interruptor da Vercel devolve o gateway de sempre", () => {
    const s = "abc-1";
    expect(gatewayDoTeste(s, {})).toBe("asaas");
    expect(gatewayDoTeste("abc-2", {})).toBe("woovi");
    expect(gatewayDoTeste(s, { PIX_GATEWAY_AB_OFF: "1" })).toBeNull();
    expect(gatewayDoTeste(s, { PIX_GATEWAY_AB_OFF: "1\r" })).toBeNull();
  });
});
