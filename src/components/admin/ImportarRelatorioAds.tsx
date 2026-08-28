import { useState } from "react";
import { importarRelatorioAds, type ResultadoImportacao } from "@/lib/admin-relatorio-ads";

// A CAIXA QUE TRAZ O CUSTO PRA DENTRO.
//
// A receita por campanha o painel já mostrava em tempo real. Sem o custo, ela
// era faturamento — e faturamento não decide nada. R$ 437 numa campanha é
// ótimo ou péssimo dependendo de ter custado R$ 200 ou R$ 900.
//
// ── COLAR, E NÃO SUBIR ARQUIVO ───────────────────────────────────
//
// O Google baixa o relatório como .csv, e o caminho mais curto entre o
// download e aqui é abrir e colar. Upload exigiria leitura de arquivo,
// tratamento de encoding e um estado a mais de erro, pra economizar um
// Ctrl+A Ctrl+C.
//
// ── E POR QUE O AVISO É TÃO INSISTENTE ───────────────────────────
//
// O relatório padrão do Google vem SOMADO no período. Importar isso sem a
// coluna de dia criaria um custo diário que nunca existiu, e o ROAS ficaria
// bonito e errado — o pior tipo de número. O parser recusa, mas é melhor
// avisar antes de a pessoa exportar errado.

export function ImportarRelatorioAds() {
  const [csv, setCsv] = useState("");
  // Só entra em jogo quando o arquivo não tem coluna de dia E o cabeçalho
  // dele não diz o período. Vazio é o normal.
  const [dia, setDia] = useState("");
  const [indo, setIndo] = useState(false);
  const [r, setR] = useState<ResultadoImportacao | null>(null);

  async function importar() {
    setIndo(true);
    setR(null);
    try {
      setR(await importarRelatorioAds({ data: { csv, dia: dia || null } }));
    } catch (err) {
      setR({
        ok: false,
        linhas: 0,
        campanhas: 0,
        dias: [],
        custoBrl: 0,
        avisos: [err instanceof Error ? err.message : "Falhou."],
      });
    } finally {
      setIndo(false);
    }
  }

  return (
    <section className="mt-8 rounded-[var(--raio)] border border-[var(--tinta-fraca)]/30 p-4">
      <h3 className="font-medium">Carregar custo do Google Ads</h3>
      <p className="mt-1 text-[13px] leading-snug text-[var(--tinta-suave)]">
        No Google Ads, abra <strong>Campanhas</strong>, escolha o período, e em{" "}
        <strong>Segmentar</strong> marque <strong>Dia</strong>. As colunas precisam
        incluir <strong>ID da campanha</strong> e <strong>Custo</strong>. Baixe o CSV,
        abra, e cole aqui.
      </p>
      <p className="mt-1 text-[13px] leading-snug text-[var(--tinta-suave)]">
        Se o relatório for de <strong>um dia só</strong>, não precisa segmentar: a data
        é lida do cabeçalho do próprio arquivo.
      </p>
      <p className="mt-1 text-[13px] leading-snug text-amber-700">
        Relatório somado em VÁRIOS dias é recusado, mesmo com data escolhida abaixo:
        o custo diário sairia inventado.
      </p>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-[var(--tinta-suave)]">
        <span>Dia (só se o arquivo não disser)</span>
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className="rounded-md border border-[var(--tinta-fraca)]/40 px-2 py-1 text-[13px]"
        />
      </label>

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={5}
        placeholder="Cole o conteúdo do CSV aqui..."
        className="mt-3 w-full resize-y rounded-lg border border-[var(--tinta-fraca)]/40 bg-[var(--papel)] p-2.5 font-mono text-[11px]"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={indo || csv.trim().length < 40}
          onClick={importar}
          className="cta inline-flex h-10 items-center justify-center rounded-full border-0 px-5 text-sm font-medium disabled:opacity-40"
        >
          {indo ? "Importando..." : "Importar"}
        </button>
        {csv && (
          <button
            type="button"
            onClick={() => {
              setCsv("");
              setR(null);
            }}
            className="text-sm text-[var(--tinta-suave)] underline underline-offset-4"
          >
            limpar
          </button>
        )}
      </div>

      {r && (
        <div
          className={
            "mt-3 rounded-lg border p-3 text-[13px] " +
            (r.ok
              ? "border-emerald-500/40 bg-emerald-50"
              : "border-amber-500/40 bg-amber-50")
          }
        >
          {r.ok && (
            <p className="font-medium">
              {r.linhas} linhas · {r.campanhas} campanhas ·{" "}
              {r.dias.length === 1 ? r.dias[0] : `${r.dias[0]} a ${r.dias[r.dias.length - 1]}`} ·
              custo total R${" "}
              {r.custoBrl.toFixed(2).replace(".", ",")}
            </p>
          )}
          {/* OS AVISOS APARECEM SEMPRE, inclusive quando deu certo:
              importação que ignora linha em silêncio é como o custo some sem
              ninguém notar. */}
          {r.avisos.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[var(--tinta-suave)]">
              {r.avisos.slice(0, 8).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
              {r.avisos.length > 8 && <li>… e mais {r.avisos.length - 8}.</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
