import { describe, expect, it } from "vitest";
import { cookieDoToque, veioPorEmail, COOKIE_TOQUE_EMAIL } from "./toque-email";

describe("veioPorEmail", () => {
  it("lê utm_source=email da URL", () => {
    expect(veioPorEmail("https://www.serenatagift.com/criar?utm_source=email&utm_campaign=x")).toBe(true);
    expect(veioPorEmail("https://www.serenatagift.com/criar?utm_source=EMAIL")).toBe(true);
  });
  it("outras origens não contam", () => {
    expect(veioPorEmail("https://www.serenatagift.com/criar?utm_source=google")).toBe(false);
    expect(veioPorEmail("https://www.serenatagift.com/criar")).toBe(false);
    expect(veioPorEmail("não é url")).toBe(false);
  });
});

it("o cookie vale 3 dias no site inteiro", () => {
  const c = cookieDoToque();
  expect(c.startsWith(`${COOKIE_TOQUE_EMAIL}=1;`)).toBe(true);
  expect(c).toContain("Max-Age=259200");
  expect(c).toContain("Path=/");
  expect(c).toContain("SameSite=Lax");
});
