// DE QUAL CANAL VEIO A VENDA, nos quatro baldes do cartão do painel (08/10):
// Google, TikTok, e-mail e orgânico. Os quatro somam o cartão "Vendas".
//
// ── POR QUE O CUPOM VENCE O PRIMEIRO TOQUE ───────────────────────
//
// A atribuição da casa é first-touch (`canalDe`): quem chegou por anúncio e
// comprou dias depois pelo e-mail continua contando pro anúncio. Lido assim,
// o e-mail daria quase zero, porque quase toda a base chegou por anúncio.
// Decisão do dono: venda com cupom conta pro e-mail, porque todo código de
// `cupom.ts` só existe dentro de e-mail (SRN27/SRN7 da recuperação, MUSICA10
// da campanha). `pedidos.cupom` só existe desde 07/10; o SRN27 de antes disso
// segue no canal de origem.
//
// O e-mail da régua SEM cupom não leva utm no link e continua no canal de
// origem. Só `utm_source` de e-mail (campanha, lembrete de data) conta.

import { canalDe, type Atribuicao } from "./resumo-diario";

export type CanalVenda = "google" | "tiktok" | "email" | "organico";

const FONTES_DE_EMAIL = new Set(["email", "lembrete_data"]);

export function canalDaVenda(atribuicao: Atribuicao, cupom: string | null | undefined): CanalVenda {
  if (String(cupom ?? "").trim()) return "email";
  const canal = canalDe(atribuicao);
  if (canal === "Google") return "google";
  if (canal === "TikTok") return "tiktok";
  if (FONTES_DE_EMAIL.has(String(atribuicao?.utm_source ?? "").toLowerCase())) return "email";
  return "organico";
}

export function contarPorCanal(
  vendas: { atribuicao: Atribuicao; cupom: string | null | undefined }[],
): Record<CanalVenda, number> {
  const n: Record<CanalVenda, number> = { google: 0, tiktok: 0, email: 0, organico: 0 };
  for (const v of vendas) n[canalDaVenda(v.atribuicao, v.cupom)]++;
  return n;
}
