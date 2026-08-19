import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { carregarPainel, lancarGasto, type Painel, type FunilFiltro } from "@/lib/admin-dados";
import { PRECOS } from "@/lib/custos";
import { entrarAdmin, sairAdmin } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { AbaTestes } from "@/components/admin/AbaTestes";
import { RefreshCw, LogOut, TrendingDown, AlertTriangle, ExternalLink, Calendar } from "lucide-react";

// PAINEL DA OPERAÇÃO.
//
// Responde, em ordem: está entrando dinheiro? de onde vem? onde a pessoa
// desiste? Todo dado vem de server function autenticada — nada sensível no
// bundle do cliente (erro herdado dos repos antigos: rota admin exposta).

export const Route = createFileRoute("/admin")({
  validateSearch: z.object({
    dias: z.coerce.number().optional(),
    de: z.string().optional(),
    ate: z.string().optional(),
    funil: z.enum(["todos", "pt", "es"]).optional(),
    // A ABA na URL, como os campos acima: reload e botão voltar funcionam, e
    // dá pra mandar o link direto pra alguém já na aba certa.
    aba: z.enum(["operacao", "testes"]).optional(),
  }),
  head: () => ({
    meta: [{ title: `Painel · ${MARCA.nome}` }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Admin,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
// O dólar do funil espanhol. Formatado com o símbolo à vista, pra ninguém
// ler 9 como nove reais.
const usd = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const pc = (n: number) => `${n.toFixed(1)}%`;
const seg = (n: number | null) => (n == null ? "—" : n < 90 ? `${Math.round(n)}s` : `${(n / 60).toFixed(1)}min`);
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ── blocos visuais ──────────────────────────────────────────────
function Cartao({
  rotulo,
  valor,
  apoio,
  destaque,
  alerta,
  atual,
  anterior,
  unidade,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  destaque?: boolean;
  alerta?: boolean;
  /** O par que alimenta a setinha de variação. Sem os dois, ela não aparece. */
  atual?: number;
  anterior?: number;
  unidade?: "relativa" | "pontos";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        destaque
          ? "border-[var(--acento)]/40 bg-[var(--acento)]/5"
          : alerta
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)]",
      )}
    >
      <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">{rotulo}</p>
      {/* `flex items-baseline`: a variação assenta na linha de base do número
          em vez de centralizar na altura dele, que é o que a deixa parecendo
          nota de rodapé e não um segundo valor competindo com o primeiro. */}
      <div className="mt-1 flex items-baseline">
        <p
          className={cn("tabular-nums leading-none", destaque && "text-[var(--acento)]")}
          style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-2xl)" }}
        >
          {valor}
        </p>
        {atual !== undefined && <Variacao atual={atual} anterior={anterior} unidade={unidade} />}
      </div>
      {apoio && <p className="mt-1.5 text-xs text-[var(--tinta-suave)]">{apoio}</p>}
    </div>
  );
}

/**
 * A VARIAÇÃO CONTRA O MESMO RECORTE DE UM PERÍODO ATRÁS.
 *
 * "Hoje até agora" é comparado com "ontem até esta mesma hora", nunca com o
 * dia de ontem inteiro (a janela é cortada no servidor, em `janelaAnterior`).
 *
 * SEM VERDE E SEM VERMELHO, de propósito. Subir é boa notícia em Vendas e má
 * notícia em Custo de produção, e o mesmo componente serve os dois. Cor daria
 * um veredito errado em metade dos cartões; a seta diz a direção e quem lê
 * sabe o que quer de cada número. É também o que a Shopify faz.
 *
 * DUAS UNIDADES, porque comparar porcentagem com porcentagem tem armadilha:
 *   - `relativa` (padrão): quanto o número cresceu. 15 vendas contra 12 = +25%.
 *   - `pontos`: para métricas que JÁ SÃO porcentagem. De 21,5% pra 14,4% é uma
 *     queda de 7,1 PONTOS; dizer "-33%" ali é tecnicamente certo e péssimo de
 *     ler, porque some com a escala do número que se está olhando.
 *
 * Não desenha nada quando não há base (os dois períodos em zero): 0 -> 0 não é
 * estabilidade, é ausência de dado, e "0%" pareceria medido.
 */
function Variacao({
  atual,
  anterior,
  unidade = "relativa",
}: {
  atual: number;
  anterior: number | undefined;
  unidade?: "relativa" | "pontos";
}) {
  if (anterior === undefined) return null;
  if (!anterior && !atual) return null;

  // Saiu do zero: não existe porcentagem de aumento sobre nada. "novo" é a
  // única leitura honesta, e some quando a base aparecer.
  if (!anterior) {
    return <span className="ml-2 whitespace-nowrap text-[11px] text-[var(--tinta-suave)]">novo</span>;
  }

  const delta = unidade === "pontos" ? atual - anterior : ((atual - anterior) / anterior) * 100;
  const arredondado = Math.abs(delta) >= 10 ? Math.round(delta) : Math.round(delta * 10) / 10;
  if (arredondado === 0) {
    return <span className="ml-2 whitespace-nowrap text-[11px] text-[var(--tinta-suave)]">=</span>;
  }
  const sobe = arredondado > 0;
  return (
    <span className="ml-2 whitespace-nowrap text-[11px] tabular-nums text-[var(--tinta-suave)]">
      {sobe ? "↗" : "↘"} {Math.abs(arredondado).toLocaleString("pt-BR")}
      {unidade === "pontos" ? " pts" : "%"}
    </span>
  );
}

/** "34%" ou "-" quando nao ha base. Evita 0% que parece medido e nao e. */
function pctTxt(parte: number, total: number): string {
  if (!total) return "-";
  return `${Math.round((parte / total) * 100)}%`;
}

function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>{titulo}</h2>
        {sub && <p className="text-xs text-[var(--tinta-suave)]">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Tabela({ cabecalho, children }: { cabecalho: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-[var(--papel-fundo)] text-[var(--tinta-suave)]">
          <tr>
            {cabecalho.map((c, i) => (
              <th key={c} className={cn("px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider", i === 0 ? "text-left" : "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--tinta-fraca)]/25">{children}</tbody>
      </table>
    </div>
  );
}

// Data de hoje em "YYYY-MM-DD" no fuso do Brasil (não em UTC, senão de
// madrugada o painel abriria no dia errado).
function hojeBr(deslocaDias = 0): string {
  const d = new Date(Date.now() - 3 * 3600000 + deslocaDias * 86400000);
  return d.toISOString().slice(0, 10);
}

function Admin() {
  const { dias, de, ate, funil, aba } = Route.useSearch();
  const navigate = useNavigate();
  const [dados, setDados] = useState<Painel | null>(null);
  const [precisaLogin, setPrecisaLogin] = useState(false);
  // Falha que NÃO é de autenticação. Separada de `precisaLogin` de propósito:
  // ver "deu erro, tentar de novo" e ver a tela de login levam a pessoa a
  // fazer coisas diferentes.
  const [falha, setFalha] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Rascunho do seletor de datas (só aplica quando clica em "ver").
  const [rDe, setRDe] = useState(de ?? hojeBr(-6));
  const [rAte, setRAte] = useState(ate ?? hojeBr());

  const periodo = dias ?? 30;
  const filtro: FunilFiltro = funil ?? "todos";
  const usandoDatas = Boolean(de);

  // FALHAR NÃO É O MESMO QUE NÃO ESTAR LOGADO.
  //
  // Este catch já mandou TODA falha pra tela de login. O efeito, quando a
  // consulta do painel passou a estourar o tempo (180 mil eventos por
  // abertura, em agosto/26), foi este: a pessoa digitava a senha certa, o
  // cookie era gravado, `carregar()` rodava, estourava, e ela voltava pra
  // tela de login SEM mensagem nenhuma. Da cadeira dela, "o admin não loga".
  //
  // Só `nao-autorizado`, que é o que `exigirAdmin` lança, pede login. Erro de
  // rede, tempo esgotado ou falha do banco pedem "tentar de novo", e precisam
  // aparecer como erro, senão ninguém conserta o que está quebrado.
  async function carregar() {
    setCarregando(true);
    try {
      const args = usandoDatas ? { de, ate, funil: filtro } : { dias: periodo, funil: filtro };
      setDados(await carregarPainel({ data: args }));
      setPrecisaLogin(false);
      setFalha(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/nao-autorizado/.test(msg)) {
        setPrecisaLogin(true);
        setFalha(null);
      } else {
        setFalha(msg || "erro desconhecido");
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [periodo, de, ate, filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  if (precisaLogin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--papel)] px-4" style={TEMA_CLARO}>
        <form
          className="w-full max-w-sm space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            const r = await entrarAdmin({ data: { senha } });
            if (r.ok) {
              setSenha("");
              carregar();
            } else setErro("Senha inválida.");
          }}
        >
          <div className="flex justify-center">
            <Logo tamanho="md" />
          </div>
          <p className="text-center text-sm text-[var(--tinta-suave)]">Painel da operação</p>
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" autoFocus />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" className="cta w-full rounded-full border-0">
            Entrar
          </Button>
        </form>
      </div>
    );
  }

  // Logado, mas a consulta falhou. Antes isso caía na tela de login e parecia
  // senha errada; agora diz o que houve e oferece a saída que resolve na hora,
  // que é encurtar o período (o custo da consulta é proporcional a ele).
  if (!carregando && falha) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--papel)] px-4" style={TEMA_CLARO}>
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="flex justify-center">
            <Logo tamanho="md" />
          </div>
          <p className="text-[var(--tinta)]">Não consegui carregar o painel.</p>
          <p className="break-words text-xs text-[var(--tinta-suave)]">{falha}</p>
          <Button onClick={() => carregar()} className="cta w-full rounded-full border-0">
            Tentar de novo
          </Button>
          <button
            type="button"
            onClick={() => navigate({ to: "/admin", search: { dias: 7 } })}
            className="w-full text-sm text-[var(--tinta-suave)] underline"
          >
            Ver só os últimos 7 dias
          </button>
        </div>
      </div>
    );
  }

  if (carregando || !dados) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--papel)]" style={TEMA_CLARO}>
        <p className="text-[var(--tinta-suave)]">Carregando…</p>
      </div>
    );
  }

  const t = dados.topo;
  // O topo do período anterior. `undefined` quando o comparativo não veio, e
  // aí toda `Variacao` se cala sozinha — nenhum cartão precisa saber disso.
  const a = dados.comparativo?.topo;
  const antesDoFunil = dados.comparativo?.funil;
  // O topo do funil e' o primeiro degrau que sobrou, e nao mais o total de
  // sessoes do site. E' a escala das barras.
  const topoDoFunil = dados.funil[0]?.alcancaram ?? 0;
  // O aviso dizia "maior perda" e mostrava a SEGUNDA: o índice era `[1]`.
  // Medido no painel de 17/08 — a maior perda era "Nome" (881 pessoas, 41,5%)
  // e o aviso apontava "Começou o quiz" (565). Justamente o degrau que a
  // pessoa é mandada olhar primeiro, apontando pro lugar errado.
  // `[0]` é seguro: o primeiro degrau tem `perdidos` 0 por construção (não há
  // degrau anterior de onde perder), então ele nunca ganha essa ordenação.
  const maiorQueda = [...dados.funil].filter((f) => f.alcancaram > 0).sort((a, b) => b.perdidos - a.perdidos)[0];

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <header className="sticky top-0 z-20 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo tamanho="sm" />
            <span className="hidden text-xs text-[var(--tinta-suave)] sm:inline">painel</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* Atalhos. "Hoje" e "Ontem" usam data exata, o resto é janela. */}
            {[
              { r: "Hoje", de: hojeBr(), ate: hojeBr() },
              { r: "Ontem", de: hojeBr(-1), ate: hojeBr(-1) },
            ].map((a) => (
              <Link
                key={a.r}
                to="/admin"
                search={{ de: a.de, ate: a.ate }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  de === a.de && ate === a.ate
                    ? "bg-[var(--acento)] font-medium text-white"
                    : "border border-[var(--tinta-fraca)] text-[var(--tinta-suave)] hover:border-[var(--acento)]/50",
                )}
              >
                {a.r}
              </Link>
            ))}
            {/* QUAL FUNIL. Sem isto o painel soma R$ com US$ e mostra um
                faturamento que não existe em lugar nenhum. */}
            <div className="mr-1 flex items-center gap-1 rounded-full border border-[var(--tinta-fraca)] p-0.5">
              {([
                { v: "todos", r: "os dois" },
                { v: "pt", r: "🇧🇷 BR" },
                { v: "es", r: "🇲🇽 MX" },
              ] as const).map((f) => (
                <Link
                  key={f.v}
                  to="/admin"
                  search={(s) => ({ ...s, funil: f.v })}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs transition-colors",
                    filtro === f.v
                      ? "bg-[var(--acento)] font-medium text-white"
                      : "text-[var(--tinta-suave)] hover:text-[var(--tinta)]",
                  )}
                >
                  {f.r}
                </Link>
              ))}
            </div>

            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                to="/admin"
                search={(s) => ({ ...s, dias: d, de: undefined, ate: undefined })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  !usandoDatas && periodo === d
                    ? "bg-[var(--acento)] font-medium text-white"
                    : "border border-[var(--tinta-fraca)] text-[var(--tinta-suave)] hover:border-[var(--acento)]/50",
                )}
              >
                {d}d
              </Link>
            ))}

            {/* Período livre: qualquer intervalo. */}
            <div className="flex items-center gap-1 rounded-full border border-[var(--tinta-fraca)] px-2 py-1">
              <Calendar className="h-3.5 w-3.5 text-[var(--tinta-suave)]" />
              <input
                type="date"
                value={rDe}
                max={rAte}
                onChange={(e) => setRDe(e.target.value)}
                className="w-[110px] bg-transparent text-xs outline-none"
              />
              <span className="text-xs text-[var(--tinta-suave)]">até</span>
              <input
                type="date"
                value={rAte}
                min={rDe}
                max={hojeBr()}
                onChange={(e) => setRAte(e.target.value)}
                className="w-[110px] bg-transparent text-xs outline-none"
              />
              <button
                onClick={() => navigate({ to: "/admin", search: { de: rDe, ate: rAte } })}
                className="rounded-full bg-[var(--acento)] px-2.5 py-0.5 text-[11px] font-medium text-white"
              >
                ver
              </button>
            </div>

            <button onClick={carregar} className="rounded-full border border-[var(--tinta-fraca)] p-1.5 hover:border-[var(--acento)]/50" title="Atualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={async () => {
                await sairAdmin();
                setPrecisaLogin(true);
              }}
              className="rounded-full border border-[var(--tinta-fraca)] p-1.5 hover:border-[var(--acento)]/50"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {/* AS ABAS na URL, como `dias` e `funil` já estão: reload e botão
            voltar funcionam, e dá pra mandar o link direto pra alguém. */}
        <div className="flex gap-1 rounded-full border border-[var(--tinta-fraca)]/40 p-1 text-sm">
          {(
            [
              ["operacao", "Operação"],
              ["testes", "Testes A/B"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => navigate({ search: (s) => ({ ...s, aba: id }) as never })}
              className={cn(
                "rounded-full px-4 py-1.5 transition-colors",
                (aba ?? "operacao") === id
                  ? "bg-[var(--acento)] text-white"
                  : "text-[var(--tinta-suave)] hover:text-[var(--tinta)]",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

      {(aba ?? "operacao") === "operacao" && (
        <>
        {/* ── DINHEIRO ─────────────────────────────────────────── */}
        <Secao
          titulo="O dinheiro"
          sub={`Últimos ${dados.periodoDias} dias · ${
            dados.filtro === "es" ? "funil espanhol" : dados.filtro === "pt" ? "funil português" : "os dois funis"
          }${
            // Dizer CONTRA O QUE a setinha compara, com a hora à vista. Sem
            // isso "↘ 24%" é um número sem régua, e a régua aqui não é óbvia:
            // "hoje" é comparado com ontem até esta MESMA hora, não com o dia
            // de ontem fechado.
            dados.comparativo
              ? ` · ↗↘ contra ${quando(dados.comparativo.de)} – ${quando(dados.comparativo.ate)}`
              : ""
          }`}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Cartao rotulo="Vendas" valor={String(t.vendas)} destaque apoio={`${pc(t.taxaGeral)} de quem abriu o quiz`} atual={t.vendas} anterior={a?.vendas} />
            {/* RECEITA: nunca um número só quando há duas moedas.
                O funil brasileiro cobra em real, o espanhol cobra em dólar na
                Perfect Pay. Somar os dois produz um total que não existe no
                extrato de lugar nenhum. */}
            {t.receitaUsd > 0 && t.receitaBrl > 0 ? (
              <Cartao
                rotulo="Receita"
                valor={`${brl(t.receitaBrl)} + ${usd(t.receitaUsd)}`}
                destaque
                apoio="duas moedas, não somadas"
              />
            ) : t.receitaUsd > 0 ? (
              <Cartao
                rotulo="Receita"
                valor={usd(t.receitaUsd)}
                destaque
                atual={t.receitaUsd}
                anterior={a?.receitaUsd}
                apoio={`ticket ${usd(t.receitaUsd / Math.max(1, t.vendas))}`}
              />
            ) : (
              <Cartao rotulo="Receita" valor={brl(t.receitaBrl)} destaque apoio={`ticket ${brl(t.ticketMedioBrl)}`} atual={t.receitaBrl} anterior={a?.receitaBrl} />
            )}
            <Cartao rotulo="Custo de produção" valor={brl(t.custoTotalBrl)} apoio={`${brl(t.custoPorVendaBrl)} por venda`} atual={t.custoTotalBrl} anterior={a?.custoTotalBrl} />
            <Cartao
              rotulo="Margem bruta"
              valor={brl(t.margemBrl)}
              alerta={t.margemBrl < 0}
              atual={t.margemBrl}
              anterior={a?.margemBrl}
              apoio={
                t.receitaConvertidaBrl > 0
                  ? `${pc((t.margemBrl / t.receitaConvertidaBrl) * 100)} da receita`
                  : "sem receita ainda"
              }
            />
            <Cartao rotulo="Visitantes" valor={String(t.visitantes)} apoio={`${t.quizIniciados} começaram o quiz`} atual={t.visitantes} anterior={a?.visitantes} />
            <Cartao rotulo="Letras entregues" valor={String(t.letrasGeradas)} apoio={`${t.leads} deixaram e-mail`} atual={t.letrasGeradas} anterior={a?.letrasGeradas} />
          </div>
          {/* ── MÍDIA: a conta que decide se a operação vive ──────
              Margem bruta sem CPA não diz nada: R$ 209 pode ser lucro ou
              prejuízo, depende do que se gastou pra trazer as vendas. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cartao
              rotulo="Gasto em anúncio"
              valor={t.gastoAdsBrl > 0 ? brl(t.gastoAdsBrl) : "—"}
              apoio={t.gastoAdsBrl > 0 ? "lançado à mão" : "lance abaixo pra ver o CPA"}
              atual={t.gastoAdsBrl > 0 ? t.gastoAdsBrl : undefined}
              anterior={a?.gastoAdsBrl}
            />
            <Cartao
              rotulo="CPA"
              valor={t.cpaBrl > 0 ? brl(t.cpaBrl) : "—"}
              destaque={t.cpaBrl > 0}
              atual={t.cpaBrl > 0 ? t.cpaBrl : undefined}
              anterior={a?.cpaBrl}
              alerta={t.cpaBrl > 0 && t.cpaBrl > t.ticketMedioBrl}
              apoio={t.cpaBrl > 0 ? `ticket ${brl(t.ticketMedioBrl)}` : "precisa do gasto"}
            />
            <Cartao
              rotulo="ROAS"
              valor={t.roas > 0 ? `${t.roas.toFixed(2)}x` : "—"}
              alerta={t.roas > 0 && t.roas < 1}
              atual={t.roas > 0 ? t.roas : undefined}
              anterior={a?.roas}
              apoio={t.roas > 0 ? (t.roas < 1 ? "abaixo de 1 é prejuízo" : "receita ÷ gasto") : "precisa do gasto"}
            />
            <Cartao
              rotulo="Lucro"
              valor={t.gastoAdsBrl > 0 ? brl(t.lucroBrl) : "—"}
              alerta={t.gastoAdsBrl > 0 && t.lucroBrl < 0}
              atual={t.gastoAdsBrl > 0 ? t.lucroBrl : undefined}
              anterior={a?.lucroBrl}
              apoio="receita − produção − mídia"
            />
          </div>

          <LancarGasto aoSalvar={carregar} gastos={dados.gastos} />

          <p className="text-xs text-[var(--tinta-suave)]">
            Custo de produção é o que a gente gasta pra fazer (Claude + Suno). O gasto de anúncio é digitado por você (o Google Ads exige OAuth aprovado, que leva dias). A taxa do gateway continua fora, no painel deles.
            {t.receitaUsd > 0 && (
              <>
                {" "}A margem converte o dólar a R$ {PRECOS.cambioUsdBrl.toFixed(2)} (o mesmo câmbio dos custos).
                A receita acima não é convertida.
              </>
            )}
          </p>
        </Secao>

        {/* ── TAXAS DE PASSAGEM ────────────────────────────────── */}
        <Secao
          titulo="Onde converte"
          sub="A passagem de cada etapa pra próxima. A base é quem ABRIU O QUIZ, não quem abriu qualquer página do site — presenteado abrindo o presente é entrega, não visita."
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Cartao rotulo="Abriu → começou" valor={pc(t.taxaAbriuComecou)} atual={t.taxaAbriuComecou} anterior={a?.taxaAbriuComecou} unidade="pontos" />
            <Cartao rotulo="Quiz → letra" valor={pc(t.taxaQuizLetra)} atual={t.taxaQuizLetra} anterior={a?.taxaQuizLetra} unidade="pontos" />
            <Cartao rotulo="Letra → checkout" valor={pc(t.taxaLetraCheckout)} atual={t.taxaLetraCheckout} anterior={a?.taxaLetraCheckout} unidade="pontos" />
            <Cartao rotulo="Checkout → pagou" valor={pc(t.taxaCheckoutVenda)} destaque atual={t.taxaCheckoutVenda} anterior={a?.taxaCheckoutVenda} unidade="pontos" />
            <Cartao rotulo="Abriu → venda" valor={pc(t.taxaGeral)} apoio="conversão geral" atual={t.taxaGeral} anterior={a?.taxaGeral} unidade="pontos" />
          </div>
        </Secao>

        {/* ── FUNIL COMPLETO ───────────────────────────────────── */}
        <Secao
          titulo="O funil, passo a passo"
          sub="Onde as pessoas desistem. Começa em quem abriu /criar — quem só abriu a página presente ou o editor não é topo de funil, é entrega. A barra é sobre o primeiro degrau."
        >
          {maiorQueda && maiorQueda.perdidos > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Maior perda em <strong>{maiorQueda.rotulo}</strong>: {maiorQueda.perdidos} pessoas ({pc(maiorQueda.quedaPct)} de quem chegou lá).
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            {dados.funil.map((f) => {
              // A barra e' sobre o PRIMEIRO DEGRAU, nao sobre os visitantes do
              // site. Desde 18/08 o funil comeca em "Abriu o quiz"; manter a
              // escala no total de sessoes deixaria a barra cheia sempre
              // faltando, medindo contra um numero que saiu da tela.
              const largura = topoDoFunil > 0 ? Math.max(1.5, (f.alcancaram / topoDoFunil) * 100) : 0;
              const cor =
                f.etapa === "venda"
                  ? "bg-[var(--acento)]"
                  : f.etapa === "entrega"
                    ? "bg-[oklch(0.72_0.12_82)]"
                    : f.etapa === "quiz"
                      ? "bg-[oklch(0.62_0.06_60)]"
                      : "bg-[var(--tinta-fraca)]";
              return (
                <div key={f.id} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-xs text-[var(--tinta-suave)] sm:w-44">{f.rotulo}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-md bg-[var(--tinta-fraca)]/15">
                    <div
                      className={cn("flex h-full items-center rounded-md px-2 transition-all", cor)}
                      style={{ width: `${largura}%` }}
                    >
                      <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-white/95">
                        {f.alcancaram}
                      </span>
                    </div>
                  </div>
                  <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-[var(--tinta-suave)]">
                    {f.conversao < 100 && <>{pc(f.conversao)}</>}
                    {f.perdidos > 0 && <span className="ml-1 text-red-600/70">-{f.perdidos}</span>}
                  </span>
                  {/* A variação de QUANTA GENTE chegou neste degrau, contra o
                      mesmo recorte de um período atrás. Coluna própria, e não
                      espremida na de cima, porque ali já convivem a taxa de
                      passagem e os perdidos — três números disputando 24px
                      viram tarja, não informação. */}
                  <span className="hidden w-16 shrink-0 text-right sm:block">
                    <Variacao atual={f.alcancaram} anterior={antesDoFunil?.[f.id]} />
                  </span>
                </div>
              );
            })}
          </div>
        </Secao>

        {/* ── ATRIBUIÇÃO ───────────────────────────────────────── */}
        {/* ── QUAL PORTA CONVERTE ──────────────────────────────
            Agrupa pela PRIMEIRA página da sessão. Hoje o tráfego entra por
            duas portas diferentes (a home e o quiz direto), e sem isto não dá
            pra saber qual das duas paga melhor. */}
        <Secao
          titulo="Qual página converte"
          sub="Pela primeira página que a sessão abriu. Cada visitante conta uma vez só."
        >
          <Tabela cabecalho={["Página de entrada", "Visitantes", "Quiz", "Letras", "Vendas", "Conv."]}>
            {dados.porEntrada.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--tinta-suave)]">
                  Nenhuma visita no período.
                </td>
              </tr>
            ) : (
              dados.porEntrada.map((e) => (
                <tr key={e.caminho} className="border-t border-[var(--tinta-fraca)]/25">
                  <td className="px-3 py-2.5 font-medium">{e.caminho}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{e.visitantes}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{e.quiz}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{e.letras}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{e.vendas}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right tabular-nums",
                      e.vendas > 0 ? "text-[var(--acento)]" : "text-[var(--tinta-suave)]",
                    )}
                  >
                    {pc(e.conversaoPct)}
                  </td>
                </tr>
              ))
            )}
          </Tabela>
        </Secao>

        <Secao titulo="De onde vêm as vendas" sub="Atribuição pela captura first-touch (utm, gclid, fbclid ou referência)">
          <Tabela cabecalho={["Origem", "Campanha", "Leads", "Letras", "Vendas", "Receita", "Conv."]}>
            {dados.porOrigem.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--tinta-suave)]">
                  Nenhum lead no período.
                </td>
              </tr>
            ) : (
              dados.porOrigem.map((o) => (
                <tr key={`${o.origem}|${o.campanha}`} className={cn(o.vendas > 0 && "bg-[var(--acento)]/5")}>
                  <td className="px-3 py-2.5 font-medium">{o.origem}</td>
                  <td className="px-3 py-2.5 text-right text-[var(--tinta-suave)]">{o.campanha ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.leads}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.letras}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{o.vendas}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.receitaBrl > 0 ? brl(o.receitaBrl) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--tinta-suave)]">{pc(o.conversaoPct)}</td>
                </tr>
              ))
            )}
          </Tabela>
        </Secao>

        {/* ── VENDAS ───────────────────────────────────────────── */}
        <Secao titulo="Vendas" sub="As mais recentes">
          <Tabela cabecalho={["Quando", "E-mail", "Música", "Origem", "Valor"]}>
            {dados.vendas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--tinta-suave)]">
                  Nenhuma venda ainda no período.
                </td>
              </tr>
            ) : (
              dados.vendas.map((v, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--tinta-suave)]">{quando(v.quando)}</td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-right">{v.email ?? "—"}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-right">{v.musica ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-[var(--tinta-suave)]">{v.origem ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-[var(--acento)]">{brl(v.valorBrl)}</td>
                </tr>
              ))
            )}
          </Tabela>
        </Secao>

        {/* ── PRODUÇÃO ─────────────────────────────────────────── */}
        <Secao titulo="A máquina" sub="Se isto quebrar, a venda vira reembolso">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Cartao rotulo="Tempo médio" valor={seg(dados.producao.tempoMedioS)} apoio="da letra à música" />
            <Cartao rotulo="Pior caso (p95)" valor={seg(dados.producao.tempoP95S)} />
            <Cartao rotulo="Prontas" valor={String(dados.producao.porStatus["pronta"] ?? 0)} />
            <Cartao rotulo="Falharam" valor={String(dados.producao.falhas)} alerta={dados.producao.falhas > 0} />
            {/* O SALDO DO PROVEDOR. Em 08/08 ele zerou e o pipeline parou 13h em
                silêncio — 38 músicas presas, 7 já pagas. O painel mostrava
                "gerando" como se fosse normal. Agora o número que causa isso
                fica na mesma tela do sintoma. */}
            <Cartao
              rotulo="Crédito kie.ai"
              valor={
                dados.producao.creditoKie === null
                  ? "não li"
                  : `${dados.producao.musicasQueCabem} músicas`
              }
              alerta={(dados.producao.musicasQueCabem ?? 99) < 20}
              apoio={
                dados.producao.creditoKie === null
                  ? "provedor não respondeu"
                  : `${dados.producao.creditoKie} créditos · recarregue abaixo de 20 músicas`
              }
            />
            <Cartao rotulo="Travadas" valor={String(dados.producao.travadas)} alerta={dados.producao.travadas > 0} apoio="gerando há +15min" />
            <Cartao rotulo="Presentes montados" valor={String(dados.qualidade.presentesMontados)} apoio="usaram o editor" />
          </div>
          {(dados.producao.falhas > 0 || dados.producao.travadas > 0) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>Tem música que não chegou ao cliente. Verifique antes que vire pedido de reembolso.</span>
            </div>
          )}
        </Secao>

        {/* ── E-MAIL ────────────────────────────────────────────────
            O funil media ate a venda e parava ali. O e-mail, que e o que traz
            de volta quem abandonou, era invisivel: dava pra contar envio e
            nada mais.

            Conta PESSOA, nao evento: o Resend dispara opened/clicked a cada
            reabertura, e taxa por evento cru passa de 100%. E agrupa por
            MODELO, nao por assunto, porque o assunto carrega o nome do
            presenteado ("pra Maria") e quebraria o dado em centenas de baldes
            de seis pessoas. */}
        <Secao
          titulo="E-mail"
          sub="Por pessoa, não por evento. Clique pode passar a abertura: quem bloqueia imagem não registra abertura, mas o clique conta."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cartao
              rotulo="Entregues"
              valor={String(dados.emails.entregues)}
              apoio={`${dados.emails.enviadosLetra + dados.emails.enviadosSequencia} disparados`}
            />
            <Cartao
              rotulo="Abriram"
              valor={`${pctTxt(dados.emails.abriram, dados.emails.entregues)}`}
              apoio={`${dados.emails.abriram} pessoas`}
            />
            <Cartao
              rotulo="Clicaram"
              valor={`${pctTxt(dados.emails.clicaram, dados.emails.entregues)}`}
              apoio={`${dados.emails.clicaram} pessoas`}
            />
            <Cartao
              rotulo="Voltaram"
              valor={`${pctTxt(dados.emails.voltaram, dados.emails.entregues + dados.emails.voltaram)}`}
              // Acima de 2% o provedor comeca a punir o dominio inteiro, e o
              // proximo e-mail bom cai no spam de quem nunca deu problema.
              alerta={
                dados.emails.voltaram >
                (dados.emails.entregues + dados.emails.voltaram) * 0.02
              }
              apoio={`${dados.emails.voltaram} endereços ruins`}
            />
          </div>

          <Tabela cabecalho={["Modelo", "Entregues", "Abriram", "Clicaram", "Voltaram"]}>
            {dados.emails.porModelo.map((m) => (
              <tr key={m.modelo} className="border-t border-[var(--tinta-fraca)]/30">
                <td className="p-3">{m.modelo}</td>
                <td className="p-3 tabular-nums">{m.entregues}</td>
                <td className="p-3 tabular-nums">
                  {m.abriram} <span className="text-[var(--tinta-suave)]">{pctTxt(m.abriram, m.entregues)}</span>
                </td>
                <td className="p-3 tabular-nums">
                  {m.clicaram} <span className="text-[var(--tinta-suave)]">{pctTxt(m.clicaram, m.entregues)}</span>
                </td>
                <td className={`p-3 tabular-nums ${m.voltaram > m.entregues * 0.02 ? "text-amber-600" : ""}`}>
                  {m.voltaram}
                </td>
              </tr>
            ))}
            {dados.emails.porModelo.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-[var(--tinta-suave)]">
                  Nenhum e-mail no período.
                </td>
              </tr>
            )}
          </Tabela>
        </Secao>

        {/* ── PREFERÊNCIAS ─────────────────────────────────────── */}
        <Secao titulo="O que o público escolhe" sub="Serve pra mirar anúncio e criar exemplo novo">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { titulo: "Pra quem", itens: dados.preferencias.porRelacao },
              { titulo: "Estilo", itens: dados.preferencias.porEstilo },
              { titulo: "Ocasião", itens: dados.preferencias.porOcasiao },
            ].map((g) => {
              const total = g.itens.reduce((s, i) => s + i.n, 0);
              return (
                <div key={g.titulo} className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">{g.titulo}</p>
                  <ul className="mt-3 space-y-1.5">
                    {g.itens.slice(0, 6).map((i) => (
                      <li key={i.valor} className="flex items-center gap-2 text-sm">
                        <span className="w-24 shrink-0 truncate">{i.valor}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--tinta-fraca)]/20">
                          <div className="h-full rounded-full bg-[var(--acento)]/60" style={{ width: `${pct(i.n, total)}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs tabular-nums text-[var(--tinta-suave)]">{i.n}</span>
                      </li>
                    ))}
                    {g.itens.length === 0 && <li className="text-sm text-[var(--tinta-suave)]">sem dados</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </Secao>

        {/* ── CUSTOS ───────────────────────────────────────────── */}
        <Secao titulo="Custo x receita por dia">
          <Tabela cabecalho={["Dia", "Custo", "Vendas", "Receita", "Margem"]}>
            {dados.custos.porDia.slice(-14).reverse().map((d) => (
              <tr key={d.dia}>
                <td className="px-3 py-2 text-[var(--tinta-suave)]">{d.dia.slice(5)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(d.brl)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{d.vendas || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{d.receitaBrl ? brl(d.receitaBrl) : "—"}</td>
                <td className={cn("px-3 py-2 text-right font-medium tabular-nums", d.receitaBrl - d.brl < 0 ? "text-red-600" : "text-[var(--acento)]")}>
                  {brl(d.receitaBrl - d.brl)}
                </td>
              </tr>
            ))}
            {dados.custos.porDia.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--tinta-suave)]">
                  Sem movimento no período.
                </td>
              </tr>
            )}
          </Tabela>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dados.custos.porTipo.map((c) => (
              <Cartao key={c.tipo} rotulo={c.tipo} valor={brl(c.brl)} apoio={`${c.n} chamadas`} />
            ))}
          </div>
        </Secao>

        {/* ── QUEM PASSOU ──────────────────────────────────────── */}
        <Secao titulo="Quem passou por aqui" sub="Os últimos, e até onde cada um foi">
          <Tabela cabecalho={["Quando", "Pra quem", "Parou em", "Origem", "Música", "Comprou"]}>
            {dados.recentes.map((r, i) => (
              <tr key={i} className={cn(r.comprou && "bg-[var(--acento)]/5")}>
                <td className="whitespace-nowrap px-3 py-2 text-[var(--tinta-suave)]">{quando(r.quando)}</td>
                <td className="px-3 py-2 text-right">
                  {r.nome ?? "—"}
                  {r.relacao && <span className="ml-1 text-xs text-[var(--tinta-suave)]">({r.relacao})</span>}
                </td>
                <td className="px-3 py-2 text-right text-[var(--tinta-suave)]">{r.passoRotulo}</td>
                <td className="px-3 py-2 text-right text-xs text-[var(--tinta-suave)]">{r.origem}</td>
                <td className="max-w-[160px] truncate px-3 py-2 text-right">{r.musica ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.comprou ? "✅" : ""}</td>
              </tr>
            ))}
          </Tabela>
        </Secao>

        <footer className="flex items-center justify-between border-t border-[var(--tinta-fraca)]/30 pt-4 text-xs text-[var(--tinta-suave)]">
          <span>Atualizado {quando(dados.geradoEm)}</span>
          <a href="/" className="inline-flex items-center gap-1 hover:text-[var(--tinta)]">
            ver o site <ExternalLink className="h-3 w-3" />
          </a>
        </footer>
        </>
      )}

      {aba === "testes" && <AbaTestes resultados={dados.porExperimento} />}
      </main>
    </div>
  );
}

const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

// Lançamento do gasto de mídia. Um campo por dia e canal, sobrescrevendo o
// que já existe — o Google ajusta o gasto retroativamente, e o certo é sempre
// o último número.
function LancarGasto({
  aoSalvar,
  gastos,
}: {
  aoSalvar: () => void;
  gastos: Painel["gastos"];
}) {
  const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const [dia, setDia] = useState(hoje);
  const [origem, setOrigem] = useState("google");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const brl = Number(valor.replace(",", "."));
    if (!Number.isFinite(brl)) return;
    setSalvando(true);
    await lancarGasto({ data: { dia, origem, brl } });
    setValor("");
    setSalvando(false);
    aoSalvar();
  }

  return (
    <div className="rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
      <p className="text-xs font-medium">Lançar gasto de anúncio</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className="rounded-full border border-[var(--tinta-fraca)] bg-[var(--papel)] px-3 py-1.5 text-xs"
        />
        <select
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          className="rounded-full border border-[var(--tinta-fraca)] bg-[var(--papel)] px-3 py-1.5 text-xs"
        >
          <option value="google">google</option>
          <option value="meta">meta</option>
          <option value="outro">outro</option>
        </select>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
          placeholder="R$ do dia"
          inputMode="decimal"
          className="w-28 rounded-full border border-[var(--tinta-fraca)] bg-[var(--papel)] px-3 py-1.5 text-xs"
        />
        <button
          onClick={salvar}
          disabled={salvando || !valor}
          className="rounded-full bg-[var(--acento)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {salvando ? "salvando…" : "salvar"}
        </button>
        <span className="text-[10px] text-[var(--tinta-suave)]">
          zero apaga o lançamento
        </span>
      </div>

      {gastos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {gastos.map((g) => (
            <span
              key={`${g.dia}-${g.origem}`}
              className="rounded-full border border-[var(--tinta-fraca)]/60 px-2.5 py-1 text-[10px] text-[var(--tinta-suave)]"
            >
              {g.dia.slice(8, 10)}/{g.dia.slice(5, 7)} · {g.origem} · {brl(g.brl)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
