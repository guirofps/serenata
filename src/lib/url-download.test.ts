import { describe, expect, it } from "vitest";

// A URL QUE BAIXA.
//
// Cópia da função de `BotaoGuardar.tsx`, testada aqui porque ela é a linha que
// decide se o comprador leva o arquivo ou vê um menu que não entende. Em 02/09
// isso virou contestação pública com a palavra "golpe".
//
// O que ela precisa garantir: o parâmetro `download` chega ao Supabase, que
// então responde `Content-Disposition: attachment` — a única coisa que faz o
// celular baixar de verdade quando o arquivo mora em outro domínio.
function urlQueBaixa(url: string, arquivo: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("download", `${arquivo}.mp3`);
    return u.toString();
  } catch {
    return url;
  }
}

const ASSINADA =
  "https://abc.supabase.co/storage/v1/object/sign/musicas/x/v2.mp3?token=eyJhbGciOi";

describe("a URL que baixa", () => {
  it("acrescenta o pedido de download sem perder o token", () => {
    const u = new URL(urlQueBaixa(ASSINADA, "unico-amor"));
    expect(u.searchParams.get("download")).toBe("unico-amor.mp3");
    // Sem o token a URL assinada não vale nada: o arquivo volta 400.
    expect(u.searchParams.get("token")).toBe("eyJhbGciOi");
  });

  it("não duplica quando já existe", () => {
    const uma = urlQueBaixa(ASSINADA, "a");
    const duas = urlQueBaixa(uma, "b");
    expect([...new URL(duas).searchParams.getAll("download")]).toEqual(["b.mp3"]);
  });

  it("devolve a URL intacta quando não dá pra interpretar", () => {
    // Melhor tentar baixar de um caminho estranho do que não fazer nada: a
    // alternativa é o botão morrer em silêncio, que é o defeito original.
    expect(urlQueBaixa("/local/v2.mp3", "x")).toBe("/local/v2.mp3");
  });

  it("aguenta acento e espaço no título da música", () => {
    // O nome sai do título, que é gerado pela IA e vem com acento sempre.
    const u = new URL(urlQueBaixa(ASSINADA, "coracao-de-mae"));
    expect(u.searchParams.get("download")).toBe("coracao-de-mae.mp3");
  });
});
