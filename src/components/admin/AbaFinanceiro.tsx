import { useEffect, useState } from "react";
import { apurarFinanceiro, lancarCustoFixo } from "@/lib/admin-dados";
import type { Financeiro } from "@/lib/financeiro";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";

// O FINANCEIRO DA OPERAÇÃO, NO PAINEL.
//
// ── POR QUE ISTO SAIU DA PLANILHA ───────────────────────────────
//
// A primeira versão foi um script de terminal, e ela tinha os dois defeitos
// que toda planilha manual tem: alguém precisava lembrar de rodar, e o número
// só existia enquanto a janela do terminal estivesse aberta.
//
// Pior que isso: ela lia só o que já estava no banco, e o gasto de mídia de
// julho e agosto NÃO estava (o cron do Google só guarda desde 26/08). O lucro
// que ela mostrava era R$ 41 mil maior que o real. Número errado numa tela
// bonita é pior que número nenhum, porque ele vira decisão — e neste caso
// vira divisão entre dois sócios.
//
// ── A REGRA DE OURO DESTA TELA ──────────────────────────────────
//
// Ela mostra o que FALTA com o mesmo destaque com que mostra o que tem. Um
// painel financeiro que esconde as próprias lacunas produz confiança sem
// produzir exatidão.

const brl = (v: number) =>
  "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const mesNome = (m: string) => {
  if (m === "total") return "TOTAL";
  const [a, mm] = m.split("-");
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(mm) - 1] + "/" + a.slice(2);
};

function Numero({ valor, negativo }: { valor: number; negativo?: boolean }) {
  return (
    <span className={cn("tabular-nums", negativo && "text-[var(--tinta-suave)]")}>
      {negativo && valor > 0 ? "− " : ""}
      {brl(valor)}
    </span>
  );
}

export function AbaFinanceiro() {
  const [dados, setDados] = useState<Financeiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    dia: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
    categoria: "assinatura",
    fornecedor: "",
    descricao: "",
    valor: "",
    recorrente: true,
  });

  async function carregar() {
    try {
      setDados(await apurarFinanceiro());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu pra apurar");
    }
  }
  useEffect(() => {
    void carregar();
  }, []);

  async function salvar() {
    const valor = Number(String(form.valor).replace(/\./g, "").replace(",", "."));
    if (!form.fornecedor.trim() || !Number.isFinite(valor) || valor <= 0) return;
    setSalvando(true);
    try {
      const r = await lancarCustoFixo({
        data: {
          dia: form.dia,
          categoria: form.categoria,
          fornecedor: form.fornecedor.trim(),
          descricao: form.descricao.trim() || undefined,
          valor,
          recorrente: form.recorrente,
        },
      });
      if (r.ok) {
        setForm({ ...form, fornecedor: "", descricao: "", valor: "" });
        await carregar();
      } else {
        setErro(r.erro ?? "não salvou");
      }
    } finally {
      setSalvando(false);
    }
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {erro}
      </div>
    );
  }
  if (!dados) return <p className="text-sm text-[var(--tinta-suave)]">apurando...</p>;

  const t = dados.total;
  const noVermelho = t.liquido < 0;

  return (
    <div className="space-y-8">
      {/* ── O RESULTADO ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>
          Resultado desde o início
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">Faturamento</p>
            <p className="mt-1 tabular-nums" style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-xl)" }}>
              {brl(t.receita)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--tinta-suave)]">{t.vendas} vendas</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">Custos</p>
            <p className="mt-1 tabular-nums text-[var(--tinta-suave)]" style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-xl)" }}>
              {brl(t.taxa + t.ia + t.midiaGoogle + t.custosFixos)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--tinta-suave)]">
              {((100 * (t.taxa + t.ia + t.midiaGoogle + t.custosFixos)) / t.receita).toFixed(0)}% do faturamento
            </p>
          </div>
          <div
            className={cn(
              "min-w-0 rounded-2xl border p-4",
              noVermelho ? "border-amber-500/40 bg-amber-500/5" : "border-[var(--acento)]/40 bg-[var(--acento)]/5",
            )}
          >
            <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">Lucro líquido</p>
            <p
              className={cn("mt-1 tabular-nums", !noVermelho && "text-[var(--acento)]")}
              style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-xl)" }}
            >
              {noVermelho ? "− " : ""}
              {brl(t.liquido)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--tinta-suave)]">
              margem de {((100 * t.liquido) / t.receita).toFixed(1)}%
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">Por sócio</p>
            <p className="mt-1 tabular-nums" style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-xl)" }}>
              {dados.porSocio < 0 ? "− " : ""}
              {brl(dados.porSocio)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--tinta-suave)]">metade do líquido</p>
          </div>
        </div>
      </section>

      {/* ── O QUE FALTA ──────────────────────────────────────────
          Fica ACIMA das tabelas, não num rodapé. Quem abre esta aba está
          decidindo quanto dividir; a lacuna precisa aparecer antes do número
          e não depois dele. */}
      {dados.avisos.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
            O que este número ainda não sabe
          </p>
          <ul className="mt-2 space-y-1">
            {dados.avisos.map((a) => (
              <li key={a} className="text-[13px] leading-snug text-amber-900">
                · {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── MÊS A MÊS ────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>Mês a mês</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[var(--papel-fundo)] text-[var(--tinta-suave)]">
              <tr>
                {["Mês", "Vendas", "Receita", "Taxa", "IA e música", "Mídia", "Fixos", "Líquido"].map((c, i) => (
                  <th
                    key={c}
                    className={cn(
                      "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider",
                      i === 0 ? "text-left" : "text-right",
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--tinta-fraca)]/25">
              {[...dados.meses, t].map((l) => (
                <tr key={l.mes} className={cn(l.mes === "total" && "bg-[var(--papel-fundo)] font-semibold")}>
                  <td className="px-3 py-2.5">{mesNome(l.mes)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.vendas}</td>
                  <td className="px-3 py-2.5 text-right"><Numero valor={l.receita} /></td>
                  <td className="px-3 py-2.5 text-right"><Numero valor={l.taxa} negativo /></td>
                  <td className="px-3 py-2.5 text-right"><Numero valor={l.ia} negativo /></td>
                  <td className="px-3 py-2.5 text-right"><Numero valor={l.midiaGoogle} negativo /></td>
                  <td className="px-3 py-2.5 text-right"><Numero valor={l.custosFixos} negativo /></td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right tabular-nums font-semibold",
                      l.liquido < 0 ? "text-amber-700" : "text-[var(--acento)]",
                    )}
                  >
                    {l.liquido < 0 ? "− " : ""}
                    {brl(l.liquido)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── OS CUSTOS QUE SÃO LANÇADOS À MÃO ─────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>
            Custos lançados à mão
          </h2>
          <p className="text-xs text-[var(--tinta-suave)]">
            Receita, taxa, IA e mídia do Google entram sozinhos. Aqui é só o que não tem API:
            assinatura, TikTok, prestador, avulso.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-[var(--papel-fundo)] text-[var(--tinta-suave)]">
              <tr>
                {["Fornecedor", "Categoria", "Total"].map((c, i) => (
                  <th
                    key={c}
                    className={cn(
                      "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider",
                      i === 2 ? "text-right" : "text-left",
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--tinta-fraca)]/25">
              {dados.porFornecedor.map((f) => (
                <tr key={f.fornecedor}>
                  <td className="px-3 py-2.5">{f.fornecedor}</td>
                  <td className="px-3 py-2.5 text-[var(--tinta-suave)]">{f.categoria}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{brl(f.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* O formulário de lançamento. Curto de propósito: quanto mais campo,
            menos gente lança, e custo não lançado é lucro que não existe. */}
        <div className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-4">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">
            Lançar custo
          </p>
          <div className="grid gap-2 sm:grid-cols-6">
            <input
              type="date"
              value={form.dia}
              onChange={(e) => setForm({ ...form, dia: e.target.value })}
              className="h-11 rounded-xl border border-[var(--tinta-fraca)]/40 bg-transparent px-3 text-sm"
            />
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="h-11 rounded-xl border border-[var(--tinta-fraca)]/40 bg-transparent px-3 text-sm"
            >
              <option value="assinatura">assinatura</option>
              <option value="midia">mídia</option>
              <option value="prestador">prestador</option>
              <option value="avulso">avulso</option>
            </select>
            <input
              placeholder="Fornecedor"
              value={form.fornecedor}
              onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
              className="h-11 rounded-xl border border-[var(--tinta-fraca)]/40 bg-transparent px-3 text-sm sm:col-span-2"
            />
            <input
              placeholder="R$ 0,00"
              inputMode="decimal"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              className="h-11 rounded-xl border border-[var(--tinta-fraca)]/40 bg-transparent px-3 text-sm tabular-nums"
            />
            <button
              onClick={() => void salvar()}
              disabled={salvando || !form.fornecedor.trim() || !form.valor}
              className="h-11 rounded-xl bg-[var(--acento)] px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              {salvando ? "..." : "Lançar"}
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-[var(--tinta-suave)]">
            <input
              type="checkbox"
              checked={form.recorrente}
              onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
            />
            É assinatura que se repete todo mês
          </label>
        </div>
      </section>
    </div>
  );
}
