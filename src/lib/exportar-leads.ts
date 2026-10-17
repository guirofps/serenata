// A BASE DE LEADS PRA FORA: Omnisend (campanha) e Google (público-alvo).
//
// Quem deixou e-mail no quiz, comprando ou não, um endereço por linha. Puro:
// o painel lê as linhas (`admin-leads.ts`) e monta o arquivo no navegador.
//
// ── QUEM NUNCA SAI DAQUI (dono, 17/10) ───────────────────────────
//
// Descadastrado, e-mail que voltou e excluído à mão (`bloqueados`, a mesma
// lista de `inngest/lib/emails-mortos.ts` com `incluirExcluidos`). Campanha
// pra quem pediu pra sair é problema de LGPD, e endereço morto derruba a
// entrega do Omnisend na primeira campanha. O Omnisend não sabe nada do nosso
// descadastro: se a pessoa entrar no arquivo, ela recebe.
import { emailPlausivel } from "./email-limpo";

export type LinhaQuiz = {
  id: string;
  email: string | null;
  whatsapp: string | null;
  locale: string | null;
  created_at: string;
};

export type Lead = { email: string; telefone: string | null; comprou: boolean; entrouEm: string };

export type Apoio = {
  /** Só quizzes neste idioma (quiz sem idioma conta como ele): a campanha vai num idioma só. */
  idioma: string;
  compradoresEmail: Set<string>;
  compradoresQuiz: Set<string>;
  /** Em minúsculas. */
  bloqueados: Set<string>;
};

/** Dígitos com DDI e `+` na frente, como o Google pede. Fora do formato, nada. */
export function telefoneInternacional(bruto: string | null, ddi: string): string | null {
  const d = (bruto ?? "").replace(/\D/g, "");
  if (d.startsWith(ddi) && d.length >= ddi.length + 10 && d.length <= ddi.length + 11) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+${ddi}${d}`;
  return null;
}

export function montarLeads(
  linhas: LinhaQuiz[],
  apoio: Apoio,
  ddi = "55",
): { leads: Lead[]; bloqueados: number } {
  const porEmail = new Map<string, Lead>();
  const fora = new Set<string>();
  for (const l of linhas) {
    const email = (l.email ?? "").trim().toLowerCase();
    if (!email || !emailPlausivel(email)) continue;
    if ((l.locale ?? apoio.idioma) !== apoio.idioma) continue;
    if (apoio.bloqueados.has(email)) {
      fora.add(email);
      continue;
    }
    const comprou = apoio.compradoresEmail.has(email) || apoio.compradoresQuiz.has(l.id);
    const telefone = telefoneInternacional(l.whatsapp, ddi);
    const ja = porEmail.get(email);
    if (!ja) {
      porEmail.set(email, { email, telefone, comprou, entrouEm: l.created_at });
      continue;
    }
    if (l.created_at < ja.entrouEm) ja.entrouEm = l.created_at;
    ja.telefone ??= telefone;
    ja.comprou ||= comprou;
  }
  const leads = [...porEmail.values()].sort((a, b) => (a.entrouEm < b.entrouEm ? -1 : 1));
  return { leads, bloqueados: fora.size };
}

const celula = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const linha = (cs: string[]) => cs.map(celula).join(",") + "\n";

/** A data de entrada no horário de Brasília (o dia em que a pessoa viu o quiz). */
function diaBrasilia(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** O modelo do Customer Match: só Email, Phone e Country, senão o Google recusa o arquivo. */
export function csvGoogle(leads: Lead[], pais: string): string {
  return linha(["Email", "Phone", "Country"]) + leads.map((l) => linha([l.email, l.telefone ?? "", pais])).join("");
}

/** Tags separa comprador de lead pra segmentar a campanha no Omnisend. */
export function csvOmnisend(leads: Lead[]): string {
  return (
    linha(["Email", "Phone", "Tags", "Entrou em"]) +
    leads.map((l) => linha([l.email, l.telefone ?? "", l.comprou ? "comprador" : "lead", diaBrasilia(l.entrouEm)])).join("")
  );
}
