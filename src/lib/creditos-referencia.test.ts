import { describe, expect, it } from "vitest";
import { ofertaDaReferencia } from "./creditos";

// A referência do upsell é o que decide se o pagamento vira crédito ou quadro.
// Até 15/09/2026 o webhook do Asaas não olhava pra ela, e 11 compras pagas
// ficaram sem nada liberado.

describe("ofertaDaReferencia", () => {
  it("reconhece a referência crua, como o Asaas devolve no externalReference", () => {
    expect(ofertaDaReferencia("up:extra:65137e27-1101-4e67-904e-e7638a360b31")?.id).toBe("extra");
    expect(ofertaDaReferencia("up:quadro:e11b500d-8cd6-437f-8200-c01d4a041771")?.id).toBe("quadro");
  });

  it("reconhece o payment_id com prefixo de gateway, como o vigia lê do banco", () => {
    expect(ofertaDaReferencia("asaas:up:extra:65137e27-1101-4e67-904e-e7638a360b31")?.id).toBe("extra");
    expect(ofertaDaReferencia("woovi:up:quadro:0fea18ec-0ddf-46f0-865a-af7f2afe2962")?.id).toBe("quadro");
  });

  it("não inventa oferta", () => {
    expect(ofertaDaReferencia("up:bonus:abc")).toBeNull();
    expect(ofertaDaReferencia("serenata:7a827838-a6e6-4b2f-8930-f5b2aea7c4cd")).toBeNull();
    expect(ofertaDaReferencia("asaas:pay_wai9mclocoppreyl")).toBeNull();
    expect(ofertaDaReferencia("")).toBeNull();
  });
});
