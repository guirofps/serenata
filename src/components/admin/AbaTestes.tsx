import { useEffect, useState } from "react";
import { carregarExperimentos, salvarExperimento } from "@/lib/admin-experimentos";
import type { ExperimentoConfig } from "@/lib/experimentos";
import type { Painel } from "@/lib/admin-dados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A ABA DE TESTES A/B.
//
// Os RESULTADOS vêm de fora, do painel que já carregou (`porExperimento`):
// aquela consulta já estourou o tempo uma vez com 180 mil eventos e não vai
// ganhar trabalho novo por causa desta tela. A CONFIG é carregada aqui,
// sozinha e sem cache — quem está editando não pode ver estado velho.
//
// SEM AUTOSAVE. Um clique errado num campo de preço que está vendendo é caro
// demais pra salvar sozinho — cada experimento tem seu próprio botão de
// salvar, explícito.

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function AbaTestes({ resultados }: { resultados: Painel["porExperimento"] }) {
  const [config, setConfig] = useState<ExperimentoConfig[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarExperimentos()
      .then(setConfig)
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, []);

  if (erro) return <p className="text-sm text-amber-800">Config não carregou: {erro}</p>;
  if (!config) return <p className="text-sm text-[var(--tinta-suave)]">Carregando…</p>;
  if (config.length === 0) {
    return <p className="text-sm text-[var(--tinta-suave)]">Nenhum experimento cadastrado.</p>;
  }

  return (
    <div className="space-y-8">
      {config.map((exp) => (
        <CartaoExperimento
          key={exp.id}
          exp={exp}
          resultado={resultados.find((r) => r.id === exp.id)}
          aoSalvar={(novo) => setConfig((c) => (c ?? []).map((e) => (e.id === novo.id ? novo : e)))}
        />
      ))}
    </div>
  );
}

function CartaoExperimento({
  exp,
  resultado,
  aoSalvar,
}: {
  exp: ExperimentoConfig;
  resultado?: Painel["porExperimento"][number];
  aoSalvar: (e: ExperimentoConfig) => void;
}) {
  const [rascunho, setRascunho] = useState(exp);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Travado enquanto NO AR. A tela repete a trava do servidor pra a pessoa
  // entender por que não consegue digitar, não pra impedir sozinha — quem
  // impede de verdade é o servidor (ver `decidirSalvamento`, Trava 1, em
  // `admin-experimentos.ts`). Sem essa trava no cliente também, o campo
  // pareceria editável e o "não deu pra salvar" só apareceria depois do
  // clique — um ciclo a mais de confusão pra quem só queria mudar um preço.
  const travado = exp.ativo;

  // Qualquer edição apaga o aviso de "salvo" anterior: com o teste no ar e
  // sem autosave, um aviso de sucesso parado na tela enquanto a pessoa mexe
  // em outra coisa é fácil de ler como "isto aqui também já foi salvo".
  const mudar = (p: Partial<ExperimentoConfig>) => {
    setAviso(null);
    setRascunho({ ...rascunho, ...p });
  };
  const mudarPeso = (nome: string, peso: number) => {
    setAviso(null);
    setRascunho({
      ...rascunho,
      variantes: rascunho.variantes.map((v) => (v.nome === nome ? { ...v, peso } : v)),
    });
  };
  const mudarPlano = (
    nome: string,
    campo: "texto" | "valor" | "ancora" | "checkout",
    valor: string,
  ) => {
    setAviso(null);
    setRascunho({
      ...rascunho,
      variantes: rascunho.variantes.map((v) =>
        v.nome === nome
          ? {
              ...v,
              plano: {
                ...(v.plano ?? { texto: "", valor: 0, ancora: "", checkout: "" }),
                [campo]: campo === "valor" ? Number(valor.replace(",", ".")) || 0 : valor,
              },
            }
          : v,
      ),
    });
  };

  async function salvar() {
    setSalvando(true);
    setAviso(null);
    const r = await salvarExperimento({ data: rascunho });
    setSalvando(false);
    if (!r.ok) {
      // O texto que a server function mandou, sem trocar por nada genérico —
      // é ele que explica qual trava recusou (preço travado, link duplicado,
      // peso todo zerado etc.), não um "erro ao salvar" que manda a pessoa
      // adivinhar.
      setAviso(r.erro ?? "não deu pra salvar");
      return;
    }
    aoSalvar(rascunho);
    setAviso("salvo — vale no site em até 1 minuto");
  }

  const somaPesos = rascunho.variantes.reduce((s, v) => s + (v.peso || 0), 0) || 1;

  return (
    <div className="space-y-5 rounded-2xl border border-[var(--tinta-fraca)]/40 p-5">
      {/* faixa 1: os botões */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{exp.id}</span>
        <button
          type="button"
          onClick={() => mudar({ ativo: !rascunho.ativo })}
          className={cn(
            "rounded-full px-3 py-1 text-xs",
            rascunho.ativo
              ? "bg-[var(--acento)] text-white"
              : "bg-[var(--tinta-fraca)]/20 text-[var(--tinta-suave)]",
          )}
        >
          {rascunho.ativo ? "no ar" : "desligado"}
        </button>
        <label className="flex items-center gap-2 text-xs text-[var(--tinta-suave)]">
          % das visitas no teste
          <Input
            className="h-8 w-20"
            type="number"
            min={0}
            max={100}
            value={rascunho.exposicaoPct}
            onChange={(e) => mudar({ exposicaoPct: Number(e.target.value) })}
          />
        </label>
      </div>

      {/* faixa 2: as versões */}
      {travado && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Preço e link estão travados porque o teste está no ar: quem já foi sorteada pra uma versão
          tem o preço dela guardado no navegador, e mudar o número agora faria dois preços
          diferentes aparecerem debaixo do mesmo rótulo. Desligue o teste pra editar, e ligue de
          novo depois.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">
            <tr>
              {["Versão", "Peso", "%", "Texto", "Valor", "Âncora", "Checkout"].map((c) => (
                <th key={c} className="px-2 py-2 text-left font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rascunho.variantes.map((v, i) => (
              <tr key={v.nome}>
                <td className="px-2 py-1.5">
                  {v.nome}
                  {i === 0 && (
                    <span className="ml-1 text-[10px] text-[var(--tinta-suave)]">controle</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    className="h-8 w-16"
                    type="number"
                    min={0}
                    value={v.peso}
                    onChange={(e) => mudarPeso(v.nome, Number(e.target.value))}
                  />
                </td>
                <td className="px-2 py-1.5 tabular-nums text-[var(--tinta-suave)]">
                  {Math.round(((v.peso || 0) / somaPesos) * 100)}%
                </td>
                {(["texto", "valor", "ancora", "checkout"] as const).map((campo) => (
                  <td key={campo} className="px-2 py-1.5">
                    <Input
                      className={cn("h-8", campo === "checkout" ? "w-72" : "w-24")}
                      disabled={travado}
                      value={String(v.plano?.[campo] ?? "")}
                      onChange={(e) => mudarPlano(v.nome, campo, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={salvando} onClick={salvar}>
          {salvando ? "salvando…" : "Salvar"}
        </Button>
        {aviso && <span className="text-xs text-[var(--tinta-suave)]">{aviso}</span>}
      </div>

      {/* faixa 3: o resultado, se já existe algum lead pra este experimento */}
      {resultado && <TabelaResultado resultado={resultado} />}
    </div>
  );
}

function TabelaResultado({ resultado }: { resultado: Painel["porExperimento"][number] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--tinta-fraca)]/40">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-[var(--papel-fundo)] text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">
          <tr>
            {["Versão", "Leads", "Vendas", "Receita", "Conv.", "R$/lead", "vs controle"].map(
              (c, i) => (
                <th
                  key={c}
                  className={cn("px-3 py-2 font-medium", i === 0 ? "text-left" : "text-right")}
                >
                  {c}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {resultado.variantes.map((v) => (
            <tr
              key={v.variante}
              className={cn(
                v.controle && "bg-[var(--tinta-fraca)]/10",
                // A linha `fora` é REFERÊNCIA, não concorrente: itálico e
                // apagada, pra não competir visualmente com as variantes que
                // estão de fato em disputa. A ordem (ela por último) já vem
                // pronta de `admin-dados.ts`.
                v.ehFora && "italic text-[var(--tinta-suave)]",
              )}
            >
              <td className="px-3 py-2">
                {v.ehFora ? "fora do teste" : v.variante}
                {v.controle && <span className="ml-2 text-[10px]">controle</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{v.leads}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.vendas}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {v.receitaBrl > 0 ? brl(v.receitaBrl) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{v.conversaoPct.toFixed(1)}%</td>
              {/* A COLUNA QUE DECIDE. Conversão sozinha mente em teste de
                  preço: o preço mais caro converte pior por definição e ainda
                  pode faturar mais — quem lê só `Conv.` e mata a variante cara
                  escolhe o preço que vende mais unidades, não o que fatura
                  mais. Cor de acento pra ficar visualmente em destaque, não
                  só mais uma coluna na tabela. */}
              <td className="px-3 py-2 text-right font-medium tabular-nums text-[var(--acento)]">
                {brl(v.receitaPorLeadBrl)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {v.variacaoVsControlePct == null
                  ? "—"
                  : `${v.variacaoVsControlePct > 0 ? "+" : ""}${v.variacaoVsControlePct.toFixed(0)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {resultado.variantes.some((v) => !v.ehFora && v.leads < 200) && (
        <p className="px-3 py-2 text-[11px] text-[var(--tinta-suave)]">
          Amostra pequena: com menos de ~200 leads por lado, a diferença ainda pode ser sorteio.
          Deixe rodar.
        </p>
      )}
    </div>
  );
}
