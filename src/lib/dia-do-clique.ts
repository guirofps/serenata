// src/lib/dia-do-clique.ts
// O DIA DO CLIQUE, no fuso da conta de anúncios. O `click_view` do Google só
// aceita UM dia por consulta (`segments.date = '...'`) e só alcança 90 dias.
// O dia vem de `attribution.captured_at`, gravado segundos depois do clique:
// perto da meia-noite pode cair no dia seguinte, por isso o job tenta também
// `diaAnterior`. Sem imports: roda no Inngest e no teste.

export const DIAS_CLICK_VIEW = 89;

export function diaNoFuso(iso: string, fuso: string): string | null {
  const t = Date.parse(iso);
  if (!iso || Number.isNaN(t)) return null;
  // en-CA escreve AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

export function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type VendaComClique = { gclid: string; capturadoEm: string | null };

export function planejarConsultas(
  vendas: VendaComClique[],
  fuso: string,
  agora: Date,
  maxDias = 30,
): { dia: string; gclids: string[] }[] {
  const limite = diaNoFuso(new Date(agora.getTime() - DIAS_CLICK_VIEW * 86400000).toISOString(), fuso) ?? "";
  const porDia = new Map<string, Set<string>>();
  for (const v of vendas) {
    if (!v.gclid || !v.capturadoEm) continue;
    const dia = diaNoFuso(v.capturadoEm, fuso);
    if (!dia || dia < limite) continue;
    const s = porDia.get(dia) ?? new Set<string>();
    s.add(v.gclid);
    porDia.set(dia, s);
  }
  return [...porDia.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, maxDias)
    .map(([dia, s]) => ({ dia, gclids: [...s] }));
}
