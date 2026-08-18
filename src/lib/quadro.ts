import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// O QUADRO: a página presente virando uma folha A4 pra imprimir e emoldurar.
//
// É o produto que transforma digital em físico sem nenhuma logística nossa, a
// mesma jogada do QR Code na caixa de bombom que está no CLAUDE.md, só que na
// versão que fica na parede.
//
// POR QUE NÃO GERAR IMAGEM. A saída óbvia seria rasterizar a tela num canvas e
// empacotar como PDF. Não: aí o texto vira pixel e sai serrilhado no papel,
// justamente na letra, que é o que a pessoa vai ler emoldurado. Esta rota é
// uma folha A4 de verdade em CSS de impressão, então o texto continua vetorial
// e sai nítido em qualquer tamanho, e a foto entra na resolução original que
// ela subiu. O "salvar como PDF" é do próprio navegador.

export type Quadro = {
  locale: "pt" | "es";
  titulo: string;
  nome: string;
  /** A letra JÁ SEM as marcações de estrutura. Ver `limparLetra`. */
  letra: string;
  dedicatoria: string | null;
  fotoUrl: string | null;
  corDestaque: string | null;
  /** Link da página presente, que vira o QR Code no rodapé. */
  linkPresente: string;
};

/**
 * Tira o andaime da letra.
 *
 * `[Verse 1]`, `[Chorus]`, `[Short Intro - máx 8s]` são instruções PRO SUNO,
 * não texto de música. Na tela do presente elas já não aparecem; num quadro
 * na parede seriam o detalhe que denuncia que aquilo saiu de uma máquina.
 */
function limparLetra(bruta: string): string {
  return bruta
    .split("\n")
    .filter((l) => !/^\s*\[.*\]\s*$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const carregarQuadro = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<Quadro | null> => {
    const db = supabaseAdmin();

    // O TOKEN DE EDIÇÃO é a credencial, como no resto do pós-compra: quem tem
    // o link é o dono. Sem sessão, sem login, e por isso funciona no celular
    // da pessoa direto do e-mail.
    const { data: m } = await db
      .from("musicas")
      .select("titulo, letra, dedicatoria, foto_path, cor_destaque, token, quiz_response_id, locale")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.letra) return null;

    const { data: q } = await db
      .from("quiz_responses")
      .select("respostas")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    const nome = ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ?? "";

    // A foto por URL assinada LONGA (7 dias): a pessoa pode montar hoje e
    // imprimir na semana que vem, e link vencido no meio da impressão é o
    // tipo de falha que ela descobre no papel.
    let fotoUrl: string | null = null;
    if (m.foto_path) {
      const { data: u } = await db.storage
        .from("fotos")
        .createSignedUrl(m.foto_path, 60 * 60 * 24 * 7);
      fotoUrl = u?.signedUrl ?? null;
    }

    return {
      locale: m.locale === "es" ? "es" : "pt",
      titulo: m.titulo ?? "",
      nome,
      letra: limparLetra(m.letra),
      dedicatoria: m.dedicatoria,
      fotoUrl,
      corDestaque: m.cor_destaque,
      linkPresente: `https://www.serenatagift.com/p/${m.token}`,
    };
  });
