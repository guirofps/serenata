// DE ONDE VEM o lead e a venda, na tabela "De onde vem" do painel. Pela
// atribuição first-touch gravada no quiz.
//
// A CAMPANHA ACOMPANHA EM TODO CAMINHO (09/10): o link da influenciadora
// saiu só com `utm_campaign=gleysi`, sem `utm_source`, e caía no site de
// origem (`l.instagram.com`) ou em "direto / orgânico" com a campanha
// jogada fora. O dado estava no banco; a leitura é que perdia.

import { canalDoUltimoClique } from "./clique-recente";

export function chaveOrigem(attr: unknown): { origem: string; campanha: string | null } {
  const a = (attr ?? {}) as Record<string, string | undefined>;
  const campanha = a.utm_campaign || null;
  if (a.utm_source) return { origem: a.utm_source, campanha };
  if (a.gclid) return { origem: "google (gclid)", campanha };
  // iPhone (16/10): o clique do Google chega com `gbraid`/`wbraid` no lugar
  // do `gclid`, e essa linha caía em "direto / orgânico".
  if (a.gbraid || a.wbraid) return { origem: "google (gbraid/wbraid)", campanha };
  if (a.fbclid) return { origem: "meta (fbclid)", campanha };
  // Primeiro toque sem fonte nem clique: vale o ÚLTIMO clique de anúncio, a
  // mesma régua do `canalDe` (o cartão de canal e esta tabela contam igual).
  // Antes do referrer, que no `canalDe` também não decide canal.
  const ultimo = canalDoUltimoClique(attr as Record<string, unknown> | null);
  if (ultimo === "Google") return { origem: "google (último clique)", campanha };
  if (ultimo === "TikTok") return { origem: "tiktok (último clique)", campanha };
  if (a.referrer && !String(a.referrer).includes("serenatagift")) {
    try {
      return { origem: new URL(String(a.referrer)).hostname, campanha };
    } catch {
      return { origem: "referência", campanha };
    }
  }
  return { origem: "direto / orgânico", campanha };
}
