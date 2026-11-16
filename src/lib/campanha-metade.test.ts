import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { METADE_VALE_ATE } from "./cupom";
import { CONTROLE_PCT, linkContaMetade, linkCriarMetade, podeEnviarMetade } from "./campanha-metade";
import { assuntoCampanhaMetade, emailCampanhaMetade } from "../../emails/campanha-metade";
import { RESPONSAVEL } from "./empresa";
import { separarCupomDaUrl } from "./cupom-url";

describe("campanha METADE: regras", () => {
  it("os dois links levam o cupom e a utm de e-mail", () => {
    for (const l of [linkCriarMetade("https://x.com"), linkContaMetade("https://x.com")]) {
      expect(separarCupomDaUrl(l).cupom).toBe("METADE");
      expect(l).toContain("utm_source=email");
      expect(l).toContain("utm_campaign=metade");
    }
    expect(linkCriarMetade("https://x.com")).toMatch(/^https:\/\/x\.com\/criar\?/);
    expect(linkContaMetade("https://x.com")).toMatch(/^https:\/\/x\.com\/login\?/);
  });
  it("só envia com 3 dias inteiros de cupom pela frente", () => {
    const fim = Date.parse(`${METADE_VALE_ATE}T23:59:59-03:00`);
    expect(podeEnviarMetade(new Date(fim - 7 * 86_400_000))).toBe(true);
    expect(podeEnviarMetade(new Date(fim - 3 * 86_400_000))).toBe(true);
    expect(podeEnviarMetade(new Date(fim - 3 * 86_400_000 + 60_000))).toBe(false);
    expect(podeEnviarMetade(new Date(fim + 1000))).toBe(false);
  });
  it("a migration sorteia o controle pelo e-mail e nunca o deixa na fila de envio", () => {
    const sql = readFileSync("supabase/migrations/20261116000000_campanha_metade.sql", "utf8");
    expect(sql).toContain(`p_controle_pct integer default ${CONTROLE_PCT}`);
    expect(sql).toMatch(/md5\(c\.email\)[\s\S]*% 100\) < p_controle_pct then 'controle'/);
    expect(sql).toContain("join compradores b on b.email = lower(trim(q.email))");
    // O corpo vai pelo SQL Editor, que parte o texto nos `;`.
    const corpo = sql.slice(sql.indexOf("as $$") + 5, sql.lastIndexOf("$$;"));
    expect(corpo).not.toContain(";");
  });
});

describe("e-mail METADE", () => {
  const base = {
    linkCriar: "https://serenatagift.com/criar?cupom=METADE&utm_content=criar",
    linkConta: "https://serenatagift.com/login?cupom=METADE&utm_content=conta",
    linkExemplo: "https://serenatagift.com/p/533db522753f423e8b2227",
    linkDescadastro: "https://serenatagift.com/api/descadastro?e=a%40b.com&t=x",
    valeAte: "26/11",
  };
  it("tem os dois botões, cupom, validade, exemplo, descadastro e o CNPJ de hoje", () => {
    const html = emailCampanhaMetade({ ...base, nome: "Maria" });
    for (const l of [base.linkCriar, base.linkConta, base.linkDescadastro]) expect(html).toContain(l.replace(/&/g, "&amp;"));
    expect(html).toContain(base.linkExemplo);
    expect(html).toContain("METADE");
    expect(html).toContain("50%");
    expect(html).toContain("26/11");
    expect(html).toContain("Maria");
    const c = RESPONSAVEL.cnpj;
    expect(html).toContain(`${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`);
  });
  it("sem nome, não escreve null nem undefined", () => {
    expect(emailCampanhaMetade({ ...base, nome: null })).not.toMatch(/null|undefined/);
  });
  it("não cita preço em real, nem promessa de tempo, nem travessão", () => {
    const html = emailCampanhaMetade({ ...base, nome: null });
    expect(html).not.toMatch(/R\$/);
    expect(html).not.toMatch(/60 segundos|um minuto|na hora/i);
    expect(html).not.toContain("—");
    expect(assuntoCampanhaMetade("Maria") + assuntoCampanhaMetade(null)).not.toContain("—");
  });
  it("escapa o nome (vem de campo livre)", () => {
    const html = emailCampanhaMetade({ ...base, nome: "<b>Ana</b>" });
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  });
  it("assunto com e sem nome", () => {
    expect(assuntoCampanhaMetade("Maria")).toBe("🎁 Maria, A Próxima Música Sai Pela Metade");
    expect(assuntoCampanhaMetade(null)).toBe("🎁 A Sua Próxima Música Sai Pela Metade");
  });
});
