import { useEffect, useMemo, useState } from "react";
import { carregarAutomacoes, previewEmail } from "@/lib/admin-dados";
import {
  FASES,
  REMETENTES,
  type Automacao,
  type EstatisticaTemplate,
  type Fase,
  type PainelAutomacoes,
  type PreviewEmail,
} from "@/lib/automacoes";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";

// AS AUTOMAÇÕES DE E-MAIL, NO PAINEL.
//
// ── O QUE ESTA TELA RESPONDE ────────────────────────────────────
//
// Três perguntas que antes exigiam ler doze arquivos e uma tabela:
//
//   1. QUAIS réguas estão rodando, pra quem e quando cada e-mail sai.
//   2. QUANTO cada e-mail rende — não a régua inteira num balaio, cada degrau.
//   3. O QUE a pessoa recebe, do jeito que chega na caixa dela.
//
// A aba E-mail continua existindo e responde outra coisa (a saúde do domínio,
// por pessoa). Esta é por ENVIO e por RÉGUA. Ver `automacoes.server.ts`.
//
// ── O PREVIEW É O TEMPLATE DE VERDADE ───────────────────────────
//
// O HTML vem do servidor, renderizado pela mesma função que o job chama, e
// entra num iframe com `sandbox` vazio: sem script, sem formulário, sem
// navegação. Os links são de mentira de propósito (ver EXEMPLO no servidor).

type Args = { dias?: number; de?: string; ate?: string };

const brl = (v: number) =>
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pct(parte: number, total: number): string {
  if (!total) return "–";
  return `${Math.round((parte / total) * 100)}%`;
}

const VAZIA: Omit<EstatisticaTemplate, "template"> = {
  enviados: 0,
  entregues: 0,
  abriram: 0,
  clicaram: 0,
  voltaram: 0,
  descadastros: 0,
  vendas: 0,
  receita: 0,
};

function somar(linhas: Array<Omit<EstatisticaTemplate, "template">>) {
  const t = { ...VAZIA };
  for (const l of linhas) {
    t.enviados += l.enviados;
    t.entregues += l.entregues;
    t.abriram += l.abriram;
    t.clicaram += l.clicaram;
    t.voltaram += l.voltaram;
    t.descadastros += l.descadastros;
    t.vendas += l.vendas;
    t.receita += l.receita;
  }
  return t;
}

export function AbaAutomacoes({ args }: { args: Args }) {
  const [dados, setDados] = useState<PainelAutomacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    carregarAutomacoes({ data: args })
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "não deu pra carregar"));
    return () => {
      vivo = false;
    };
    // `args` é um objeto novo a cada render do pai; comparar pelo conteúdo
    // evita recarregar a aba (e o banco) sem o período ter mudado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.dias, args.de, args.ate]);

  const porTemplate = useMemo(() => {
    const m = new Map<string, EstatisticaTemplate>();
    for (const l of dados?.estatisticas ?? []) m.set(l.template, l);
    return m;
  }, [dados]);

  if (erro) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {erro}
      </div>
    );
  }
  if (!dados) return <p className="text-sm text-[var(--tinta-suave)]">apurando...</p>;

  const total = somar(dados.estatisticas);
  const porFase = (f: Fase) => dados.automacoes.filter((a) => a.fase === f);

  return (
    <div className="space-y-8">
      {/* ── O TOTAL DO PERÍODO ───────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>
            Automações de e-mail
          </h2>
          <p className="text-xs text-[var(--tinta-suave)]">
            {dados.automacoes.length} réguas ativas ·{" "}
            {dados.automacoes.reduce((n, a) => n + a.emails.length, 0)} e-mails diferentes. Por
            envio, no período do seletor. Venda é o último e-mail antes do pagamento, em até 30
            dias.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Cartao
            rotulo="Enviados"
            valor={String(total.enviados)}
            apoio={`${total.entregues} entregues`}
          />
          <Cartao
            rotulo="Abriram"
            valor={pct(total.abriram, total.entregues)}
            apoio={`${total.abriram} envios`}
          />
          <Cartao
            rotulo="Clicaram"
            valor={pct(total.clicaram, total.entregues)}
            apoio={`${total.clicaram} envios`}
          />
          <Cartao
            rotulo="Vendas"
            valor={String(total.vendas)}
            apoio={brl(total.receita)}
            destaque
          />
          <Cartao
            rotulo="Voltaram"
            valor={String(total.voltaram)}
            apoio={pct(total.voltaram, total.enviados) + " dos envios"}
            alerta={total.enviados > 0 && total.voltaram > total.enviados * 0.02}
          />
          <Cartao
            rotulo="Saíram"
            valor={String(total.descadastros)}
            apoio="descadastros"
            alerta={total.entregues > 0 && total.descadastros > total.entregues * 0.005}
          />
        </div>
      </section>

      {dados.avisos.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
            O que esta tela ainda não sabe
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

      {/* ── AS RÉGUAS, NA ORDEM EM QUE A PESSOA AS ENCONTRA ── */}
      {(["antes", "compra", "depois"] as Fase[]).map((fase) => (
        <section key={fase} className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tinta-suave)]">
            {FASES[fase]}
          </h3>
          <div className="space-y-4">
            {porFase(fase).map((a) => (
              <CartaoAutomacao
                key={a.id}
                automacao={a}
                porTemplate={porTemplate}
                aberto={aberto}
                setAberto={setAberto}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ── O QUE SAIU E O MAPA NÃO CONHECE ──────────────────
          Régua nova sem entrada no catálogo. Fica visível de propósito: é
          o jeito de descobrir que alguém criou um e-mail e não o mapeou. */}
      {dados.desconhecidos.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Saíram no período, mas o catálogo não conhece
          </h3>
          <TabelaEmails
            linhas={dados.desconhecidos.map((d) => ({
              template: d.template,
              nome: d.template,
              quando: "sem entrada em automacoes.server.ts",
              est: d,
            }))}
            aberto={aberto}
            setAberto={setAberto}
            semPreview
          />
        </section>
      )}
    </div>
  );
}

// ── UMA RÉGUA ────────────────────────────────────────────────────

function CartaoAutomacao({
  automacao: a,
  porTemplate,
  aberto,
  setAberto,
}: {
  automacao: Automacao;
  porTemplate: Map<string, EstatisticaTemplate>;
  aberto: string | null;
  setAberto: (t: string | null) => void;
}) {
  const linhas = a.emails.map((e) => ({
    template: e.template,
    nome: e.nome,
    quando: e.quando,
    est: porTemplate.get(e.template) ?? { template: e.template, ...VAZIA },
  }));
  const t = somar(linhas.map((l) => l.est));
  const rem = REMETENTES[a.remetente];

  return (
    <div className="rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)]">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h4 style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-lg)" }}>
              {a.nome}
            </h4>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                a.remetente === "recuperacao"
                  ? "bg-[var(--acento)]/10 text-[var(--acento)]"
                  : "bg-[var(--tinta-fraca)]/30 text-[var(--tinta-suave)]",
              )}
              title={rem.endereco}
            >
              {rem.rotulo}
            </span>
            <span className="text-[11px] text-[var(--tinta-suave)]">{a.gatilho}</span>
          </div>
          <p className="text-[13px] leading-snug">{a.quemRecebe}</p>
          {a.quemNao && (
            <p className="text-[12px] leading-snug text-[var(--tinta-suave)]">
              Não recebe: {a.quemNao}
            </p>
          )}
          <p className="font-mono text-[11px] text-[var(--tinta-suave)]">
            {a.id} · {a.arquivo}
          </p>
        </div>

        {/* Os totais da régua, pra comparar régua com régua sem somar de cabeça. */}
        <div className="grid shrink-0 grid-cols-4 gap-x-4 gap-y-1 text-right tabular-nums md:grid-cols-4">
          <Mini rotulo="enviados" valor={String(t.enviados)} />
          <Mini rotulo="abriram" valor={pct(t.abriram, t.entregues)} />
          <Mini rotulo="clicaram" valor={pct(t.clicaram, t.entregues)} />
          <Mini
            rotulo="vendas"
            valor={t.vendas ? `${t.vendas} · ${brl(t.receita)}` : "0"}
            destaque
          />
        </div>
      </div>

      <TabelaEmails linhas={linhas} aberto={aberto} setAberto={setAberto} />
    </div>
  );
}

function Mini({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[var(--tinta-suave)]">{rotulo}</p>
      <p className={cn("whitespace-nowrap text-sm", destaque && "text-[var(--acento)]")}>{valor}</p>
    </div>
  );
}

// ── OS E-MAILS DE UMA RÉGUA ─────────────────────────────────────

type Linha = { template: string; nome: string; quando: string; est: EstatisticaTemplate };

function TabelaEmails({
  linhas,
  aberto,
  setAberto,
  semPreview,
}: {
  linhas: Linha[];
  aberto: string | null;
  setAberto: (t: string | null) => void;
  semPreview?: boolean;
}) {
  const cab = ["E-mail", "Enviados", "Abriram", "Clicaram", "Vendas", "Receita", "Saíram", ""];
  return (
    <div className="overflow-x-auto border-t border-[var(--tinta-fraca)]/30">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-[var(--tinta-suave)]">
          <tr>
            {cab.map((c, i) => (
              <th
                key={c || "acao"}
                className={cn(
                  "px-3 py-2 text-[11px] font-medium uppercase tracking-wider",
                  i === 0 ? "text-left" : "text-right",
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--tinta-fraca)]/25">
          {linhas.map((l) => {
            const e = l.est;
            const estaAberto = aberto === l.template;
            return (
              <FragmentoLinha key={l.template}>
                <tr className={cn(estaAberto && "bg-[var(--papel)]")}>
                  <td className="px-3 py-2.5">
                    <p className="leading-snug">{l.nome}</p>
                    <p className="text-[11px] leading-snug text-[var(--tinta-suave)]">{l.quando}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {e.enviados}
                    {e.voltaram > 0 && (
                      <span
                        className={cn(
                          "ml-1 text-[11px]",
                          e.voltaram > e.enviados * 0.02
                            ? "text-amber-600"
                            : "text-[var(--tinta-suave)]",
                        )}
                        title="voltaram (bounce)"
                      >
                        ↩{e.voltaram}
                      </span>
                    )}
                  </td>
                  <Taxa parte={e.abriram} total={e.entregues} />
                  <Taxa parte={e.clicaram} total={e.entregues} />
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right tabular-nums",
                      e.vendas > 0 && "text-[var(--acento)]",
                    )}
                  >
                    {e.vendas}
                    {e.enviados > 0 && e.vendas > 0 && (
                      <span className="ml-1 text-[11px] text-[var(--tinta-suave)]">
                        {((100 * e.vendas) / e.enviados).toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {e.receita ? brl(e.receita) : "–"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right tabular-nums",
                      e.descadastros > e.entregues * 0.005 &&
                        e.descadastros > 0 &&
                        "text-amber-600",
                    )}
                  >
                    {e.descadastros || "–"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!semPreview && (
                      <button
                        onClick={() => setAberto(estaAberto ? null : l.template)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          estaAberto
                            ? "border-[var(--acento)] bg-[var(--acento)] text-white"
                            : "border-[var(--tinta-fraca)]/50 text-[var(--tinta-suave)] hover:text-[var(--tinta)]",
                        )}
                      >
                        {estaAberto ? "fechar" : "ver"}
                      </button>
                    )}
                  </td>
                </tr>
                {estaAberto && (
                  <tr>
                    <td colSpan={cab.length} className="bg-[var(--papel)] p-0">
                      <Preview template={l.template} />
                    </td>
                  </tr>
                )}
              </FragmentoLinha>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// `<>` não aceita `key`; um componente vazio aceita.
function FragmentoLinha({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Taxa({ parte, total }: { parte: number; total: number }) {
  return (
    <td className="px-3 py-2.5 text-right tabular-nums">
      {pct(parte, total)}
      {total > 0 && <span className="ml-1 text-[11px] text-[var(--tinta-suave)]">{parte}</span>}
    </td>
  );
}

// ── O PREVIEW ────────────────────────────────────────────────────

function Preview({ template }: { template: string }) {
  const [locale, setLocale] = useState<"pt" | "es">("pt");
  const [p, setP] = useState<PreviewEmail | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setP(null);
    setErro(null);
    previewEmail({ data: { template, locale } })
      .then((r) => vivo && setP(r))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "não deu pra renderizar"));
    return () => {
      vivo = false;
    };
  }, [template, locale]);

  return (
    <div className="space-y-3 border-t border-[var(--tinta-fraca)]/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">Assunto</p>
          <p className="truncate text-sm">{p?.assunto || (erro ? "—" : "renderizando...")}</p>
        </div>
        <div className="flex w-fit gap-1 rounded-full border border-[var(--tinta-fraca)]/40 p-1 text-xs">
          {(["pt", "es"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={cn(
                "rounded-full px-3 py-1 uppercase transition-colors",
                locale === l
                  ? "bg-[var(--acento)] text-white"
                  : "text-[var(--tinta-suave)] hover:text-[var(--tinta)]",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {(erro || p?.aviso) && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          {erro ?? p?.aviso}
        </p>
      )}

      {p?.html && (
        // `sandbox` VAZIO: nada roda, nada navega, nada envia. É HTML nosso,
        // mas a regra é a mesma de qualquer HTML que entra num iframe do
        // painel — e o custo de manter a regra é zero.
        <iframe
          title={`preview ${template} ${locale}`}
          srcDoc={p.html}
          sandbox=""
          className="h-[720px] w-full rounded-xl border border-[var(--tinta-fraca)]/40 bg-white"
        />
      )}
      <p className="text-[11px] text-[var(--tinta-suave)]">
        Renderizado agora pelo mesmo template que o job usa, com dados de exemplo (Maria). Os links
        são de mentira.
      </p>
    </div>
  );
}

// ── CARTÃO ───────────────────────────────────────────────────────

function Cartao({
  rotulo,
  valor,
  apoio,
  destaque,
  alerta,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-4",
        alerta
          ? "border-amber-500/40 bg-amber-500/5"
          : destaque
            ? "border-[var(--acento)]/40 bg-[var(--acento)]/5"
            : "border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)]",
      )}
    >
      <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">{rotulo}</p>
      <p
        className={cn(
          "mt-1 tabular-nums",
          destaque && !alerta && "text-[var(--acento)]",
          alerta && "text-amber-700",
        )}
        style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-xl)" }}
      >
        {valor}
      </p>
      {apoio && <p className="mt-1.5 text-xs text-[var(--tinta-suave)]">{apoio}</p>}
    </div>
  );
}
