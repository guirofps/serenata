import { useEffect, useState } from "react";
import { carregarLinksIndicacao, type PainelLinks } from "@/lib/admin-indicacoes";
import { reaisDeCentavos } from "@/lib/indicacao";
import { FONTES } from "@/lib/marca";

// O FUNIL DE CADA LINK: clique -> quiz -> letra -> venda.
//
// A aba de saques responde quanto o programa custou. Esta responde se ele está
// acontecendo. Uma venda em 193 links pode ser um programa que não converte ou
// um programa que ninguém divulgou; as duas leituras pedem o oposto uma da
// outra, e sem clique não dá pra separar.

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Percentual só quando há denominador. 0/0 não é "0%", é "não dá pra dizer". */
function pct(parte: number, todo: number): string {
  if (todo <= 0) return "—";
  return `${((parte / todo) * 100).toFixed(1).replace(".", ",")}%`;
}

export function AbaIndicacaoLinks() {
  const [dados, setDados] = useState<PainelLinks | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setDados(await carregarLinksIndicacao());
      } catch (e) {
        setErro(e instanceof Error ? e.message : "não deu pra carregar");
      }
    })();
  }, []);

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!dados) return <p className="text-sm text-[var(--tinta-suave)]">carregando...</p>;
  if (dados.erro) {
    return (
      <Aviso>
        A consulta dos links ainda não existe no banco. Aplique a migration{" "}
        <code>20260929100000_indicacao_links.sql</code> no Supabase.
        <br />
        <span className="opacity-70">{dados.erro}</span>
      </Aviso>
    );
  }

  const t = dados.links.reduce(
    (a, l) => ({
      cliques: a.cliques + l.cliques,
      pessoas: a.pessoas + l.pessoas,
      quizzes: a.quizzes + l.quizzes,
      letras: a.letras + l.letras,
      pagos: a.pagos + l.pagos,
      receita: a.receita + l.receitaCentavos,
      comissao: a.comissao + l.comissaoCentavos,
    }),
    { cliques: 0, pessoas: 0, quizzes: 0, letras: 0, pagos: 0, receita: 0, comissao: 0 },
  );

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Cartao
          rotulo="Links com movimento"
          valor={`${dados.links.length} de ${dados.totalCodigos}`}
          nota="os outros nunca foram usados"
        />
        <Cartao rotulo="Cliques" valor={String(t.cliques)} nota="desde 29/09" />
        <Cartao rotulo="Pessoas" valor={String(t.pessoas)} nota="histórico completo" />
        <Cartao
          rotulo="Começaram o quiz"
          valor={String(t.quizzes)}
          nota={pct(t.quizzes, t.pessoas)}
        />
        <Cartao
          rotulo="Chegaram na letra"
          valor={String(t.letras)}
          nota={pct(t.letras, t.quizzes)}
        />
        <Cartao
          rotulo="Compraram"
          valor={String(t.pagos)}
          nota={`${pct(t.pagos, t.pessoas)} de quem chegou`}
        />
      </section>

      <section className="space-y-3">
        <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>
          Por link
        </h2>
        {dados.links.length === 0 ? (
          <p className="text-sm text-[var(--tinta-suave)]">
            Nenhum link foi clicado ainda. Os {dados.totalCodigos} códigos existem porque o e-mail
            de convite cria o link antes de mandar — código criado não é link divulgado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-[var(--tinta-suave)]">
                <tr>
                  <th className="px-3 py-2 font-normal">Link</th>
                  <th className="px-3 py-2 font-normal">Cliques</th>
                  <th className="px-3 py-2 font-normal">Pessoas</th>
                  <th className="px-3 py-2 font-normal">Quiz</th>
                  <th className="px-3 py-2 font-normal">Letra</th>
                  <th className="px-3 py-2 font-normal">Comprou</th>
                  <th className="px-3 py-2 font-normal">Receita</th>
                  <th className="px-3 py-2 font-normal">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {dados.links.map((l) => (
                  <tr key={l.codigo} className="border-t border-[var(--tinta-fraca)]/20">
                    <td className="px-3 py-2">
                      <span className="font-mono font-medium">{l.codigo}</span>
                      <span className="block text-xs text-[var(--tinta-suave)]">
                        {l.dono} · {QUANDO.format(new Date(l.criadoEm))}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{l.cliques || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{l.pessoas || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{l.quizzes || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{l.letras || "—"}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">{l.pagos || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {l.receitaCentavos ? reaisDeCentavos(l.receitaCentavos) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {l.comissaoCentavos ? reaisDeCentavos(l.comissaoCentavos) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* As duas colunas de clique NÃO se somam, e quem lê a tela precisa
            saber por quê antes de comparar uma com a outra. */}
        <p className="text-xs leading-relaxed text-[var(--tinta-suave)]">
          <strong>Cliques</strong> conta toda chegada pelo link, e só existe a partir de 29/09.{" "}
          <strong>Pessoas</strong> é reconstruído do histórico inteiro e conta gente diferente, não
          visitas: o navegador só registra o convite quando o código muda, então quem abre o mesmo
          link dez vezes aparece uma. Link que vendeu aparece aqui mesmo sem clique registrado —
          bloqueador de anúncio derruba o evento, não o pedido.
        </p>
      </section>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {children}
    </div>
  );
}

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-4">
      <p className="text-xs text-[var(--tinta-suave)]">{rotulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-[var(--tinta-suave)]">{nota}</p>}
    </div>
  );
}
