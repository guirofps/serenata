// src/lib/ler-criativos-google.ts
// A LEITURA DAS RESPOSTAS DA API DO GOOGLE ADS (REST v25, chaves em camelCase,
// número inteiro como string). Pura e sem imports: o job grava o que sai daqui
// e o teste prende o formato. Os nomes de campo de vídeo mudam entre versões
// da API; se o Google renomear, o teste com a resposta gravada acusa.

export type Linha = Record<string, unknown>;

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function texto(v: unknown): string | null {
  return v === undefined || v === null || v === "" ? null : String(v);
}

export function idDoAnuncio(recurso: string | null | undefined): string | null {
  const m = /\/adGroupAds\/\d+~(\d+)$/.exec(String(recurso ?? ""));
  return m ? m[1] : null;
}

export type Clique = {
  gclid: string;
  anuncioId: string | null;
  grupoId: string | null;
  campanhaId: string | null;
  tipoCampanha: string | null;
  dia: string | null;
};

export function lerClique(r: Linha): Clique | null {
  const cv = obj(r.clickView);
  const gclid = texto(cv.gclid);
  if (!gclid) return null;
  return {
    gclid,
    anuncioId: idDoAnuncio(texto(cv.adGroupAd)),
    grupoId: texto(obj(r.adGroup).id),
    campanhaId: texto(obj(r.campaign).id),
    tipoCampanha: texto(obj(r.campaign).advertisingChannelType),
    dia: texto(obj(r.segments).date),
  };
}
