import { describe, expect, it } from "vitest";
import { contasGoogleAds } from "./contas-google-ads";

describe("contasGoogleAds", () => {
  it("Serenata: a conta nova primeiro (é onde se escreve), pela MCC Falkland", () => {
    expect(contasGoogleAds({}, "serenata")[0]).toEqual({ id: "4779586821", login: "5024394715" });
  });

  it("Serenata: a suspensa continua sendo lida, pro histórico e pros cliques antigos", () => {
    expect(contasGoogleAds({}, "serenata").map((c) => c.id)).toEqual(["4779586821", "6923198164"]);
  });

  it("Serenata: a antiga herda o login da env só se a env ainda aponta pra ela", () => {
    const velha = { GOOGLE_ADS_CUSTOMER_ID: "6923198164", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "111" };
    expect(contasGoogleAds(velha, "serenata")[1]).toEqual({ id: "6923198164", login: "111" });
    const nova = { GOOGLE_ADS_CUSTOMER_ID: "4779586821", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "5024394715" };
    expect(contasGoogleAds(nova, "serenata")[1]).toEqual({ id: "6923198164" });
  });

  it("Ballad: só a conta da env, como sempre", () => {
    expect(contasGoogleAds({ GOOGLE_ADS_CUSTOMER_ID: "1060198776", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "9" }, "ballad")).toEqual([
      { id: "1060198776", login: "9" },
    ]);
    expect(contasGoogleAds({}, "ballad")).toEqual([]);
  });
});
