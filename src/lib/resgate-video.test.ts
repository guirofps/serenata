import { describe, expect, it } from "vitest";
import { podeResgatar, RESGATES_MAX } from "./resgate-video";

const agora = Date.parse("2026-10-03T12:00:00Z");
const base = { status: "falhou", video_path: null, tentativas: 0, created_at: "2026-10-03T10:00:00Z" };

describe("podeResgatar", () => {
  it("vídeo pago que falhou há pouco volta pra fila", () => {
    expect(podeResgatar(base, agora)).toBe(true);
  });
  it("tentativas nulas contam como zero", () => {
    expect(podeResgatar({ ...base, tentativas: null }, agora)).toBe(true);
  });
  it("para no teto", () => {
    expect(podeResgatar({ ...base, tentativas: RESGATES_MAX }, agora)).toBe(false);
  });
  it("não mexe em quem já tem vídeo (atualização que falhou)", () => {
    expect(podeResgatar({ ...base, video_path: "m/v.mp4" }, agora)).toBe(false);
  });
  it("só status falhou", () => {
    expect(podeResgatar({ ...base, status: "pronto" }, agora)).toBe(false);
    expect(podeResgatar({ ...base, status: "renderizando" }, agora)).toBe(false);
  });
  it("fora da janela de 72h fica pro dono", () => {
    expect(podeResgatar({ ...base, created_at: "2026-09-29T11:00:00Z" }, agora)).toBe(false);
  });
});
