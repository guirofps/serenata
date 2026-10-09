// src/components/admin/AbaCriativos.tsx
// A ABA "CRIATIVOS" (08/10). Como a de Automações, carrega a própria consulta
// no período do seletor e NÃO usa `dados`. Spec:
// docs/superpowers/specs/2026-10-08-aba-criativos-design.md
import { useEffect, useState, type ReactNode } from "react";
import { carregarAbaCriativos } from "@/lib/admin-dados";
import type { Criativos, LinhaGoogle, LinhaVenda } from "@/lib/criativos";
import { cn } from "@/lib/utils";

type Args = { dias?: number; de?: string; ate?: string };
type Dados = Criativos & { atualizadoEm: string | null };

const brl = (v: number | null) =>
  v === null ? "—" : "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (v: number | null) => (v === null ? "—" : Math.round(v).toLocaleString("pt-BR"));
const pc = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const PRIMEIROS = 20;

function Miniatura({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <div className="h-9 w-16 shrink-0 rounded bg-[var(--tinta-fraca)]/30" />;
  return (
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer"
      className="h-9 w-16 shrink-0 rounded object-cover" />
  );
}

function Secao({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="text-xs text-[var(--tinta-suave)]">{sub}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">{children}</div>
    </section>
  );
}

function useLista<T>(linhas: T[]) {
  const [todos, setTodos] = useState(false);
  return { visiveis: todos ? linhas : linhas.slice(0, PRIMEIROS), sobra: linhas.length - PRIMEIROS, todos, setTodos };
}

function VerTodos({ sobra, todos, alternar }: { sobra: number; todos: boolean; alternar: () => void }) {
  if (sobra <= 0) return null;
  return (
    <button onClick={alternar} className="w-full px-3 py-2 text-xs text-[var(--acento)]">
      {todos ? "mostrar só os 20 primeiros" : `ver todos (+${sobra})`}
    </button>
  );
}

const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

function TabelaVenda({ linhas, vazio }: { linhas: LinhaVenda[]; vazio: string }) {
  const l = useLista(linhas);
  return (
    <>
      <table className="w-full text-sm">
        <thead className="text-xs text-[var(--tinta-suave)]">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Criativo</th>
            <th className={th}>Vendas</th><th className={th}>Receita</th><th className={th}>Gasto</th>
            <th className={th}>CPA</th><th className={th}>ROAS</th><th className={th}>Impr.</th>
            <th className={th}>Cliques</th><th className={th}>CTR</th><th className={th}>Views</th>
            <th className={th}>Assistido 25/50/75/100</th>
          </tr>
        </thead>
        <tbody>
          {l.visiveis.length === 0 ? (
            <tr><td colSpan={11} className="px-3 py-6 text-center text-[var(--tinta-suave)]">{vazio}</td></tr>
          ) : (
            l.visiveis.map((x) => (
              <tr key={x.id} className={cn("border-t border-[var(--tinta-fraca)]/25", x.vendas > 0 && "bg-[var(--acento)]/5")}>
                <td className="px-3 py-2">
                  <div className="flex min-w-[220px] items-center gap-2">
                    <div className="flex gap-1">
                      {(x.miniaturas.length ? x.miniaturas.slice(0, 3) : [null]).map((m, i) => (
                        <Miniatura key={i} src={m} alt={x.titulo} />
                      ))}
                    </div>
                    <div className="min-w-0">
                      {x.link ? (
                        <a href={x.link} target="_blank" rel="noreferrer noopener" className="font-medium underline-offset-2 hover:underline">{x.titulo}</a>
                      ) : (
                        <span className="font-medium">{x.titulo}</span>
                      )}
                      {x.extra && <span className="block text-[11px] text-[var(--tinta-suave)]">{x.extra}</span>}
                    </div>
                  </div>
                </td>
                <td className={cn(td, "font-medium")}>{x.vendas}</td>
                <td className={td}>{brl(x.receitaBrl)}</td>
                <td className={td}>{brl(x.gastoBrl)}</td>
                <td className={td}>{brl(x.cpaBrl)}</td>
                <td className={cn(td, x.roas !== null && x.roas < 1 && "text-red-600")}>{x.roas === null ? "—" : `${x.roas.toFixed(2)}x`}</td>
                <td className={td}>{n(x.impressoes)}</td>
                <td className={td}>{n(x.cliques)}</td>
                <td className={td}>{pc(x.ctr)}</td>
                <td className={td}>{n(x.views)}</td>
                <td className={td}>
                  {x.assistido
                    ? [x.assistido.p25, x.assistido.p50, x.assistido.p75, x.assistido.p100].map((v) => `${Math.round(v * 100)}`).join(" / ")
                    : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <VerTodos sobra={l.sobra} todos={l.todos} alternar={() => l.setTodos(!l.todos)} />
    </>
  );
}

function TabelaGoogle({ linhas, imagem }: { linhas: LinhaGoogle[]; imagem?: boolean }) {
  const l = useLista(linhas);
  return (
    <>
      <table className="w-full text-sm">
        <thead className="text-xs text-[var(--tinta-suave)]">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{imagem ? "Imagem" : "Texto"}</th>
            <th className={th}>Conv. Google</th><th className={th}>Valor conv.</th><th className={th}>Gasto</th>
            <th className={th}>Custo/conv.</th><th className={th}>Impr.</th><th className={th}>Cliques</th><th className={th}>CTR</th>
          </tr>
        </thead>
        <tbody>
          {l.visiveis.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--tinta-suave)]">Nada no período.</td></tr>
          ) : (
            l.visiveis.map((x) => (
              <tr key={`${x.id}|${x.campo}`} className="border-t border-[var(--tinta-fraca)]/25">
                <td className="px-3 py-2">
                  <div className="flex min-w-[220px] items-center gap-2">
                    {imagem && <Miniatura src={x.miniatura} alt={x.titulo} />}
                    <span className={cn(!imagem && "font-medium")}>{x.titulo}</span>
                    {x.longo && <span className="text-[10px] uppercase tracking-wide opacity-60">longo</span>}
                  </div>
                </td>
                <td className={cn(td, "font-medium")}>{x.conversoes === null ? "—" : x.conversoes.toFixed(1)}</td>
                <td className={td}>{brl(x.valorConv)}</td>
                <td className={td}>{brl(x.gastoBrl)}</td>
                <td className={td}>{brl(x.custoPorConv)}</td>
                <td className={td}>{n(x.impressoes)}</td>
                <td className={td}>{n(x.cliques)}</td>
                <td className={td}>{pc(x.ctr)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <VerTodos sobra={l.sobra} todos={l.todos} alternar={() => l.setTodos(!l.todos)} />
    </>
  );
}

export function AbaCriativos({ args }: { args: Args }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro(null);
    carregarAbaCriativos({ data: args })
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "não deu pra carregar"));
    return () => {
      vivo = false;
    };
    // `args` é objeto novo a cada render do pai: compara pelo conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.dias, args.de, args.ate]);

  if (erro) {
    return <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">{erro}</div>;
  }
  if (!dados) return <p className="text-sm text-[var(--tinta-suave)]">Carregando os criativos…</p>;

  const venda = "Venda real: pedido pago ligado ao anúncio clicado (gclid). Venda com cupom ou que voltou por e-mail conta pro anúncio que trouxe a pessoa.";
  const google = "Conversão do Google, não venda real: o clique não diz qual título ou imagem apareceu.";
  return (
    <div className="space-y-8">
      <p className="text-xs text-[var(--tinta-suave)]">
        Google Ads, PMAX fora (medida por grupo em "De onde vem").
        {dados.atualizadoEm && ` Coletado às ${new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.`}
      </p>
      <Secao titulo="Vídeos" sub={`${venda} Só anúncios com um vídeo só.`}>
        <TabelaVenda linhas={dados.videos} vazio="Nenhum vídeo com impressão ou venda no período." />
      </Secao>
      <Secao titulo="Anúncios" sub={venda}>
        <TabelaVenda linhas={dados.anuncios} vazio="Nenhum anúncio com impressão ou venda no período." />
        {dados.semAnuncio > 0 && (
          <p className="border-t border-[var(--tinta-fraca)]/25 px-3 py-2 text-xs text-[var(--tinta-suave)]">
            {dados.semAnuncio} {dados.semAnuncio === 1 ? "venda" : "vendas"} do Google sem anúncio identificado (clique com mais de 90 dias, ainda não consultado ou não encontrado).
          </p>
        )}
      </Secao>
      <Secao titulo="Títulos" sub={google}><TabelaGoogle linhas={dados.titulos} /></Secao>
      <Secao titulo="Descrições" sub={google}><TabelaGoogle linhas={dados.descricoes} /></Secao>
      <Secao titulo="Imagens" sub={google}><TabelaGoogle linhas={dados.imagens} imagem /></Secao>
    </div>
  );
}
