// TESTE `preco_video` (11/10): o vídeo-presente a R$ 24,90 (A, como era) × R$ 19,90 (B). Só Serenata, em real.
//
// Leitura de 01 a 09/10 (2.635 compradores): 77,5% veem a prévia do vídeo no
// editor, 12,8% abrem o pagamento e 95% de quem abre paga. O vídeo não se
// perde no pagamento, perde-se na DECISÃO entre ver a prévia e abrir a folha,
// que é onde preço pesa. Mede RECEITA DE VÍDEO POR COMPRADOR, não conversão:
// R$ 19,90 precisa vender 25% a mais só pra empatar.
//
// O BRAÇO SAI DO TOKEN DO EDITOR (último caractere, par = A). Não do sorteio
// do navegador: o preço é lido em seis lugares (a tela do editor, a folha do
// PIX, o PIX, o cartão, o webhook e os dois e-mails do vídeo), e o token é a
// única coisa que todos eles têm. Mesmo token, mesmo preço, em qualquer
// aparelho e em qualquer e-mail. Recalculável na leitura.
//
// ENCERRAR: trocar `LIGADO` por false fixa o A pra todos; ganhando o B, trocar
// o `precoBrl` do vídeo em `creditos.ts` e desligar aqui.

import type { SupabaseClient } from "@supabase/supabase-js";

export const VIDEO_A_CENTAVOS = 2490;
export const VIDEO_B_CENTAVOS = 1990;
const LIGADO = true;

export type BracoPrecoVideo = "A" | "B";

export function bracoPrecoVideo(tokenEdicao: string | null | undefined): BracoPrecoVideo {
  if (!LIGADO || !tokenEdicao) return "A";
  const c = tokenEdicao.trim().slice(-1);
  const n = parseInt(c, 16);
  return Number.isNaN(n) || n % 2 === 0 ? "A" : "B";
}

/** O preço de catálogo do vídeo DESTA música, em centavos (antes de cupom). */
export function centavosDoVideo(tokenEdicao: string | null | undefined): number {
  return bracoPrecoVideo(tokenEdicao) === "B" ? VIDEO_B_CENTAVOS : VIDEO_A_CENTAVOS;
}

/** "R$ 24,90" / "R$ 19,90". */
export function textoPrecoVideo(tokenEdicao: string | null | undefined): string {
  return `R$ ${(centavosDoVideo(tokenEdicao) / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * O mesmo preço a partir do ID da música, pra quem tem a música e não o token
 * (as cobranças e o webhook). Sem música ou erro de leitura: o preço de
 * sempre, que é o maior; o webhook confere o valor pago contra ISTO, então
 * errar pra cima recusa a liberação e avisa, nunca libera por menos.
 */
export async function centavosDoVideoDaMusica(
  db: SupabaseClient,
  musicaId: string | null | undefined,
): Promise<number> {
  if (!musicaId) return VIDEO_A_CENTAVOS;
  const { data, error } = await db.from("musicas").select("token_edicao").eq("id", musicaId).maybeSingle();
  if (error || !data) return VIDEO_A_CENTAVOS;
  return centavosDoVideo(data.token_edicao as string | null);
}
