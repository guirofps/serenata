// "BAIXAR A BASE": quem deixou e-mail no quiz, comprando ou não, num arquivo
// pro Omnisend (campanha) ou pro Google (público-alvo). Regras em
// `exportar-leads.ts`; leitura em pedaços em `admin-leads.ts`.
//
// A base é lida UMA vez por visita ao painel: o segundo botão reaproveita.
import { useRef, useState } from "react";
import { lerLeadsPagina, listasDosLeads } from "@/lib/admin-leads";
import { csvGoogle, csvOmnisend, montarLeads, type Lead, type LinhaQuiz } from "@/lib/exportar-leads";
import { LOCALE_PADRAO } from "@/lib/i18n";
import { MARCA_ATIVA } from "@/lib/marca-identidade";
import type { Cursor } from "@/lib/ler-janela";

const BALLAD = MARCA_ATIVA.chave === "ballad";
const DDI = BALLAD ? "1" : "55";
const PAIS = BALLAD ? "US" : "BR";

type Base = { leads: Lead[]; bloqueados: number };

function salvar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function BaixarLeads() {
  const base = useRef<Base | null>(null);
  const [lendo, setLendo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Base | null>(null);

  async function carregar(): Promise<Base> {
    if (base.current) return base.current;
    setLendo(0);
    const apoio = await listasDosLeads();
    const linhas: LinhaQuiz[] = [];
    let cursor: Cursor | null = null;
    do {
      const r: { linhas: LinhaQuiz[]; cursor: Cursor | null } = await lerLeadsPagina({ data: { cursor } });
      linhas.push(...r.linhas);
      cursor = r.cursor;
      setLendo(linhas.length);
    } while (cursor);
    const r = montarLeads(
      linhas,
      {
        idioma: LOCALE_PADRAO,
        compradoresEmail: new Set(apoio.compradoresEmail),
        compradoresQuiz: new Set(apoio.compradoresQuiz),
        bloqueados: new Set(apoio.bloqueados),
      },
      DDI,
    );
    base.current = r;
    setResumo(r);
    return r;
  }

  async function baixar(destino: "omnisend" | "google") {
    setErro(null);
    try {
      const { leads } = await carregar();
      const hoje = new Date().toISOString().slice(0, 10);
      salvar(
        `emails-${destino}-${MARCA_ATIVA.chave}-${hoje}.csv`,
        destino === "google" ? csvGoogle(leads, PAIS) : csvOmnisend(leads),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu pra montar o arquivo");
    } finally {
      setLendo(null);
    }
  }

  const compradores = resumo?.leads.filter((l) => l.comprou).length ?? 0;
  const ocupado = lendo !== null;
  const botao =
    "rounded-full border border-[var(--tinta-fraca)] px-4 py-2 text-sm transition-colors hover:border-[var(--acento)] disabled:opacity-50";

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--tinta-fraca)]/40 p-4">
      <div>
        <h2 className="text-base font-medium">Baixar a base de e-mails</h2>
        <p className="text-sm text-[var(--tinta-suave)]">
          Todo mundo que deixou e-mail no quiz, comprando ou não, um endereço por linha. Ficam de
          fora quem se descadastrou ou reclamou de spam, os e-mails que voltaram e os excluídos à
          mão.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={botao} disabled={ocupado} onClick={() => void baixar("omnisend")}>
          Baixar para o Omnisend
        </button>
        <button className={botao} disabled={ocupado} onClick={() => void baixar("google")}>
          Baixar para o Google
        </button>
      </div>
      {ocupado && (
        <p className="text-sm text-[var(--tinta-suave)]">
          lendo a base… {lendo.toLocaleString("pt-BR")} cadastros
        </p>
      )}
      {resumo && !ocupado && (
        <p className="text-sm text-[var(--tinta-suave)]">
          {resumo.leads.length.toLocaleString("pt-BR")} e-mails ({compradores.toLocaleString("pt-BR")}{" "}
          compradores, {(resumo.leads.length - compradores).toLocaleString("pt-BR")} leads) ·{" "}
          {resumo.bloqueados.toLocaleString("pt-BR")} ficaram de fora pelo bloqueio
        </p>
      )}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </section>
  );
}
