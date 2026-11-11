// O VÍDEO DA TV NO PAINEL (10/11/2026): visitas, letras e vendas de quem
// chegou pelo QR code do comercial de 20s (`criativos/tv-20s`), que aponta pra
// `serenatagift.com/?utm_source=tv&utm_medium=qrcode`.
//
// Pelo PRIMEIRO TOQUE, a régua do painel inteiro (`origem.ts`, `canal-venda.ts`):
// quem já tinha entrado no site antes por outro caminho e depois aponta o
// celular pra TV continua contando pro primeiro caminho, porque a atribuição
// nunca é sobrescrita (`captureFirstTouchAttribution`). Então o card mede quem
// CONHECEU a Serenata pela TV, e é um piso, não o efeito total do comercial.
//
// Puro: `admin-dados.ts` passa as listas que já leu.

export type ResumoTv = {
  /** Sessões distintas com `page_view` e primeiro toque da TV. `null` = a leitura falhou. */
  visitas: number | null;
  leads: number;
  letras: number;
  vendas: number;
  receitaBrl: number;
  /** Vendas ÷ visitas. `null` sem visita lida. */
  conversaoPct: number | null;
};

/** O link do QR leva `utm_source=tv`. Sem diferenciar maiúscula. */
export function ehDaTv(attribution: unknown): boolean {
  const a = (attribution ?? {}) as Record<string, unknown>;
  return String(a.utm_source ?? "").trim().toLowerCase() === "tv";
}

export function resumoTv(entrada: {
  /** `session_id` dos `page_view` da TV na janela (pode repetir). `null` = falhou. */
  sessoesVisita: string[] | null;
  leads: { id: string; attribution: unknown }[];
  comMusica: Set<string | null>;
  /** Vendas já filtradas por `ehVenda`, com a receita já em real. */
  vendas: { quiz_response_id: string | null; receitaBrl: number }[];
}): ResumoTv {
  const daTv = new Set(entrada.leads.filter((l) => ehDaTv(l.attribution)).map((l) => l.id));
  let letras = 0;
  for (const id of daTv) if (entrada.comMusica.has(id)) letras++;
  let vendas = 0;
  let receitaBrl = 0;
  for (const v of entrada.vendas) {
    if (v.quiz_response_id && daTv.has(v.quiz_response_id)) {
      vendas++;
      receitaBrl += v.receitaBrl;
    }
  }
  const visitas = entrada.sessoesVisita ? new Set(entrada.sessoesVisita).size : null;
  return {
    visitas,
    leads: daTv.size,
    letras,
    vendas,
    receitaBrl,
    conversaoPct: visitas ? (vendas / visitas) * 100 : null,
  };
}
