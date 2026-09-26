import { useEffect, useState } from "react";
import {
  carregarIndicacoes,
  resolverSaque,
  type ComissaoAdmin,
  type PainelIndicacoes,
  type SaqueAdmin,
} from "@/lib/admin-indicacoes";
import { reaisDeCentavos } from "@/lib/indicacao";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";

// A ABA DE INDICAÇÕES: quanto o programa custou e a fila de saques.
//
// Como a Financeira, carrega a própria leitura e não usa `dados`: não tem
// nada a ver com o período do seletor, e pendurar isto no núcleo seria mais
// uma consulta no caminho da tela que mais importa.
//
// O saque é pago À MÃO. A ordem é: fazer o PIX no banco, e SÓ DEPOIS tocar em
// "paguei". Marcar antes e o PIX falhar deixaria a pessoa com saldo zerado e
// sem dinheiro.

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const quando = (iso: string) => QUANDO.format(new Date(iso));

export function AbaIndicacoes() {
  const [dados, setDados] = useState<PainelIndicacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      setDados(await carregarIndicacoes());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu pra carregar");
    }
  }
  useEffect(() => {
    void carregar();
  }, []);

  if (erro) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {erro}
      </div>
    );
  }
  if (!dados) return <p className="text-sm text-[var(--tinta-suave)]">carregando...</p>;

  const abertos = dados.saques.filter((s) => s.status === "solicitado");
  const resolvidos = dados.saques.filter((s) => s.status !== "solicitado");

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Cartao rotulo="Links criados" valor={String(dados.codigos)} />
        <Cartao rotulo="Compras por convite" valor={String(dados.comprasComConvite)} />
        <Cartao rotulo="Desconto dado" valor={reaisDeCentavos(dados.descontoDadoCentavos)} />
        <Cartao rotulo="Comissão a liberar" valor={reaisDeCentavos(dados.aLiberarCentavos)} />
        <Cartao rotulo="Comissão liberada" valor={reaisDeCentavos(dados.liberadoCentavos)} />
        <Cartao rotulo="Pago em saques" valor={reaisDeCentavos(dados.pagoEmSaquesCentavos)} />
      </section>

      <section className="space-y-3">
        <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>
          Saques pra pagar{" "}
          {abertos.length > 0 && <span className="text-[var(--acento)]">({abertos.length})</span>}
        </h2>
        {abertos.length === 0 ? (
          <p className="text-sm text-[var(--tinta-suave)]">Nenhum saque esperando.</p>
        ) : (
          <div className="space-y-3">
            {abertos.map((s) => (
              <SaqueAberto key={s.id} saque={s} aoResolver={carregar} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>
          Compras por convite
        </h2>
        <TabelaComissoes linhas={dados.recentes} />
      </section>

      {resolvidos.length > 0 && (
        <section className="space-y-3">
          <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}>
            Saques resolvidos
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">
            <table className="w-full text-sm">
              <tbody>
                {resolvidos.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--tinta-fraca)]/20 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{quando(s.quando)}</td>
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2 tabular-nums">{reaisDeCentavos(s.valorCentavos)}</td>
                    <td
                      className={cn(
                        "px-3 py-2",
                        s.status === "recusado" && "text-[var(--tinta-suave)]",
                      )}
                    >
                      {s.status}
                      {s.nota ? ` · ${s.nota}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function SaqueAberto({
  saque,
  aoResolver,
}: {
  saque: SaqueAdmin;
  aoResolver: () => Promise<void>;
}) {
  const [nota, setNota] = useState("");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function resolver(status: "pago" | "recusado") {
    const pergunta =
      status === "pago"
        ? `Você JÁ FEZ o PIX de ${reaisDeCentavos(saque.valorCentavos)} pra ${saque.chavePix}?`
        : `Recusar o saque de ${saque.email}? O valor volta pro saldo dele.`;
    if (!window.confirm(pergunta)) return;
    setIndo(true);
    try {
      const r = await resolverSaque({ data: { id: saque.id, status, nota } });
      if (!r.ok) setErro(r.erro ?? "não salvou");
      else await aoResolver();
    } finally {
      setIndo(false);
    }
  }

  // O sinal que interessa pro antifraude: o mesmo nome pagando dos dois lados.
  const mesmoNome = (a: string | null, b: string | null) =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const suspeitas = saque.comissoes.filter((c) =>
    mesmoNome(c.pagador, saque.pagadorDoIndicador),
  ).length;

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[var(--acento)]/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{saque.email}</p>
        <p className="text-sm text-[var(--tinta-suave)]">pedido em {quando(saque.quando)}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--tinta-suave)]">Valor</p>
          <p className="text-lg font-semibold tabular-nums">
            {reaisDeCentavos(saque.valorCentavos)}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-[var(--tinta-suave)]">Chave PIX</p>
          <p className="break-all font-mono text-sm select-all">{saque.chavePix}</p>
        </div>
      </div>
      <p className="text-xs text-[var(--tinta-suave)]">
        Nome no PIX de quem indica: {saque.pagadorDoIndicador ?? "sem registro"}
      </p>
      {suspeitas > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {suspeitas} {suspeitas === 1 ? "compra foi paga" : "compras foram pagas"} pelo MESMO nome
          de quem indica. Pode ser a pessoa indicando a si mesma com outro e-mail.
        </p>
      )}
      <TabelaComissoes linhas={saque.comissoes} semIndicador />
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="nota (opcional): ex. motivo da recusa"
        className="h-9 w-full rounded-lg border border-[var(--tinta-fraca)]/50 bg-white px-3 text-sm"
      />
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          disabled={indo}
          onClick={() => resolver("pago")}
          className="rounded-full bg-[var(--acento)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Já paguei
        </button>
        <button
          disabled={indo}
          onClick={() => resolver("recusado")}
          className="rounded-full border border-[var(--tinta-fraca)]/60 px-4 py-2 text-sm disabled:opacity-50"
        >
          Recusar
        </button>
      </div>
    </div>
  );
}

function TabelaComissoes({
  linhas,
  semIndicador,
}: {
  linhas: ComissaoAdmin[];
  semIndicador?: boolean;
}) {
  if (linhas.length === 0)
    return <p className="text-sm text-[var(--tinta-suave)]">Nenhuma ainda.</p>;
  const agora = Date.now();
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-[var(--tinta-suave)]">
          <tr>
            <th className="px-3 py-2 font-normal">Quando</th>
            {!semIndicador && <th className="px-3 py-2 font-normal">Quem indicou</th>}
            <th className="px-3 py-2 font-normal">Quem comprou</th>
            <th className="px-3 py-2 font-normal">Nome no PIX</th>
            <th className="px-3 py-2 font-normal">Pagou</th>
            <th className="px-3 py-2 font-normal">Comissão</th>
            <th className="px-3 py-2 font-normal">Estado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c, i) => {
            const estornada = c.statusPedido !== "pago";
            const liberada = !estornada && new Date(c.liberaEm).getTime() <= agora;
            return (
              <tr key={i} className="border-t border-[var(--tinta-fraca)]/20">
                <td className="px-3 py-2 whitespace-nowrap">{quando(c.quando)}</td>
                {!semIndicador && <td className="px-3 py-2">{c.indicador}</td>}
                <td className="px-3 py-2">{c.indicado}</td>
                <td className="px-3 py-2">{c.pagador ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{reaisDeCentavos(c.pagoCentavos)}</td>
                <td
                  className={cn(
                    "px-3 py-2 tabular-nums",
                    estornada && "text-[var(--tinta-suave)] line-through",
                  )}
                >
                  {reaisDeCentavos(c.valorCentavos)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {estornada
                    ? c.statusPedido
                    : liberada
                      ? "liberada"
                      : `libera ${quando(c.liberaEm).slice(0, 5)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cartao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-4">
      <p className="text-xs text-[var(--tinta-suave)]">{rotulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
