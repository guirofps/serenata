import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { carregarPainel, type Painel } from "@/lib/admin-dados";
import { entrarAdmin, sairAdmin } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Painel da plataforma. Todo dado vem de server function autenticada —
// nada sensível no bundle (erro herdado: rota admin exposta no cliente).

export const Route = createFileRoute("/admin")({
  validateSearch: z.object({ dias: z.coerce.number().optional() }),
  component: Admin,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const seg = (n: number | null) => (n == null ? "—" : `${Math.round(n)}s`);

function Admin() {
  const { dias } = Route.useSearch();
  const [dados, setDados] = useState<Painel | null>(null);
  const [precisaLogin, setPrecisaLogin] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const periodo = dias ?? 30;

  async function carregar() {
    setCarregando(true);
    try {
      const d = await carregarPainel({ data: { dias: periodo } });
      setDados(d);
      setPrecisaLogin(false);
    } catch {
      setPrecisaLogin(true);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (precisaLogin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <form
          className="w-full max-w-sm space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            const r = await entrarAdmin({ data: { senha } });
            if (r.ok) {
              setSenha("");
              carregar();
            } else {
              setErro("Senha inválida.");
            }
          }}
        >
          <h1 className="text-xl font-bold">Painel</h1>
          <Input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha do painel"
            autoFocus
          />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </main>
    );
  }

  if (carregando || !dados) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  const t = dados.topo;
  const conclusao = t.leads ? Math.round((t.completaram / t.leads) * 100) : 0;
  // Sobre quem VIU a letra: é aí que a decisão de compra acontece.
  const taxaFake = t.chegaramNaLetra
    ? Math.round((t.fakeDoorCliques / t.chegaramNaLetra) * 100)
    : 0;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Painel</h1>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <a
              key={d}
              href={`/admin?dias=${d}`}
              className={cn(
                "rounded-full border-2 px-3 py-1 text-sm",
                d === periodo ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground",
              )}
            >
              {d}d
            </a>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await sairAdmin();
              setPrecisaLogin(true);
            }}
          >
            Sair
          </Button>
        </div>
      </header>

      {/* Topo */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card titulo="Leads" valor={String(t.leads)} />
        <Card titulo="Completaram" valor={`${t.completaram}`} sub={`${conclusao}% do total`} />
        <Card titulo="Letras" valor={String(t.letrasGeradas)} />
        <Card titulo="Músicas prontas" valor={String(t.musicasProntas)} />
        <Card
          titulo="Fake door"
          valor={String(t.fakeDoorCliques)}
          sub={`${taxaFake}% de quem viu a letra`}
          destaque
        />
        <Card titulo="Custo total" valor={brl(t.custoTotalBrl)} sub={`${brl(t.custoPorLeadBrl)}/lead`} />
      </section>

      {/* Funil */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Funil por passo
        </h2>
        <div className="space-y-1.5 rounded-2xl border bg-card p-4">
          {dados.funil.map((f) => {
            const pct = dados.funil[0]?.alcancaram
              ? (f.alcancaram / dados.funil[0].alcancaram) * 100
              : 0;
            return (
              <div key={f.id} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 truncate text-muted-foreground">{f.rotulo}</span>
                <div className="h-6 flex-1 overflow-hidden rounded bg-secondary">
                  <div
                    className="flex h-full items-center justify-end rounded bg-primary/70 px-2 text-xs font-medium text-primary-foreground transition-all"
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  >
                    {f.alcancaram}
                  </div>
                </div>
                <span
                  className={cn(
                    "w-14 shrink-0 text-right text-xs tabular-nums",
                    f.queda >= 30 ? "font-semibold text-destructive" : "text-muted-foreground",
                  )}
                >
                  {f.queda > 0 ? `-${f.queda}%` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Produção */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Produção de músicas
          </h2>
          <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {Object.entries(dados.producao.porStatus).map(([s, n]) => (
                <span
                  key={s}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    s === "pronta"
                      ? "bg-primary/15 text-foreground"
                      : s === "falhou"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {s}: {n}
                </span>
              ))}
              {!Object.keys(dados.producao.porStatus).length && (
                <span className="text-muted-foreground">nenhuma no período</span>
              )}
            </div>
            <div className="flex gap-6 border-t pt-3">
              <div>
                <p className="text-xs text-muted-foreground">Tempo médio</p>
                <p className="font-semibold">{seg(dados.producao.tempoMedioS)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">p95</p>
                <p className="font-semibold">{seg(dados.producao.tempoP95S)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo/música</p>
                <p className="font-semibold">{brl(t.custoPorMusicaBrl)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Custos */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Custos
          </h2>
          <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
            {dados.custos.porTipo.map((c) => (
              <div key={c.tipo} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {c.tipo} <span className="text-xs">({c.n}×)</span>
                </span>
                <span className="font-semibold tabular-nums">{brl(c.brl)}</span>
              </div>
            ))}
            {!dados.custos.porTipo.length && (
              <p className="text-muted-foreground">nenhum custo registrado no período</p>
            )}
            {dados.custos.porDia.length > 1 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs text-muted-foreground">Por dia</p>
                <div className="flex h-16 items-end gap-1">
                  {dados.custos.porDia.map((d) => {
                    const max = Math.max(...dados.custos.porDia.map((x) => x.brl), 0.01);
                    return (
                      <div
                        key={d.dia}
                        title={`${d.dia}: ${brl(d.brl)}`}
                        className="flex-1 rounded-t bg-primary/60"
                        style={{ height: `${Math.max((d.brl / max) * 100, 4)}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Qualidade */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Comportamento
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card titulo="Refações" valor={String(dados.qualidade.refacoes)} />
          <Card titulo="Usou ditado" valor={String(dados.qualidade.usouAudio)} />
          <Card titulo="Deu play" valor={String(dados.qualidade.karaokePlay)} />
          <Card titulo="Ouviu até o fim do preview" valor={String(dados.qualidade.previewFim)} />
        </div>
      </section>

      {/* Recentes */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sessões recentes
        </h2>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Homenageado</th>
                <th className="px-4 py-2">Relação</th>
                <th className="px-4 py-2">Estilo</th>
                <th className="px-4 py-2">Passo</th>
                <th className="px-4 py-2">Música</th>
                <th className="px-4 py-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {dados.recentes.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{r.nome ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.relacao ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.estilo ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{r.passo ?? 0}</td>
                  <td className="px-4 py-2">
                    {r.musica ? (
                      <span className="text-xs">
                        {r.musica}{" "}
                        <span
                          className={cn(
                            r.status === "pronta" ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          ({r.status})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(r.quando).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Card({
  titulo,
  valor,
  sub,
  destaque,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        destaque && "border-primary/40 bg-primary/5",
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{valor}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
