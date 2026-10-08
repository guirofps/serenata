import { describe, expect, it } from "vitest";
import { familiaDoNavegador } from "@/lib/familia-navegador";

describe("familiaDoNavegador", () => {
  it("navegador de app ganha do Safari/Chrome que ele também declara", () => {
    expect(
      familiaDoNavegador(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.22.109",
      ),
    ).toBe("instagram");
    expect(
      familiaDoNavegador(
        "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0]",
      ),
    ).toBe("facebook");
  });

  it("Safari do iPhone, Chrome do Android e Samsung", () => {
    expect(
      familiaDoNavegador(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("safari-ios");
    expect(
      familiaDoNavegador(
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("chrome-android");
    expect(
      familiaDoNavegador(
        "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36",
      ),
    ).toBe("samsung");
  });

  it("WebView do Android e vazio", () => {
    expect(
      familiaDoNavegador(
        "Mozilla/5.0 (Linux; Android 13; moto g; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36",
      ),
    ).toBe("webview-android");
    expect(familiaDoNavegador("")).toBe("outro");
    expect(familiaDoNavegador(undefined)).toBe("outro");
  });
});
