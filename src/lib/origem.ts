// DE ONDE VEM o lead e a venda, na tabela "De onde vem" do painel. Pela
// atribuição first-touch gravada no quiz.
//
// A CAMPANHA ACOMPANHA EM TODO CAMINHO (09/10): o link da influenciadora
// saiu só com `utm_campaign=gleysi`, sem `utm_source`, e caía no site de
// origem (`l.instagram.com`) ou em "direto / orgânico" com a campanha
// jogada fora. O dado estava no banco; a leitura é que perdia.

export function chaveOrigem(attr: unknown): { origem: string; campanha: string | null } {
  const a = (attr ?? {}) as Record<string, string | undefined>;
  const campanha = a.utm_campaign || null;
  if (a.utm_source) return { origem: a.utm_source, campanha };
  if (a.gclid) return { origem: "google (gclid)", campanha };
  if (a.fbclid) return { origem: "meta (fbclid)", campanha };
  if (a.referrer && !String(a.referrer).includes("serenatagift")) {
    try {
      return { origem: new URL(String(a.referrer)).hostname, campanha };
    } catch {
      return { origem: "referência", campanha };
    }
  }
  return { origem: "direto / orgânico", campanha };
}
