import { useEffect, useState } from "react";
import { CalendarHeart, Check, Loader2, X } from "lucide-react";
import {
  listarDatas,
  removerData,
  salvarData,
  type DataEspecial,
  type TipoData,
} from "@/lib/datas-especiais";
import { trackEvent } from "@/lib/track";

// DATAS QUE ELA NÃO PODE ESQUECER, no editor, depois da entrega.
//
// É o motivo pra voltar. A compra hoje é uma só: ela faz a música, entrega e
// some. Com as datas cadastradas, o `lembrarDatas` avisa 10 dias antes de
// cada uma, com o caminho pra fazer a próxima música.
//
// Vem preenchido com quem ganhou ESTE presente: é a data que ela mais
// provavelmente sabe de cabeça, e começar com um campo já pronto derruba o
// "depois eu faço".

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TIPOS: { v: TipoData; rotulo: string }[] = [
  { v: "aniversario", rotulo: "Aniversário" },
  { v: "namoro", rotulo: "Namoro ou casamento" },
  { v: "outra", rotulo: "Outra data" },
];

export function DatasEspeciais({
  tokenEdicao,
  nomeSugerido,
}: {
  tokenEdicao: string;
  nomeSugerido?: string;
}) {
  const [datas, setDatas] = useState<DataEspecial[] | null>(null);
  const [nome, setNome] = useState(nomeSugerido ?? "");
  const [tipo, setTipo] = useState<TipoData>("aniversario");
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    listarDatas({ data: { tokenEdicao } })
      .then(setDatas)
      .catch(() => setDatas([]));
  }, [tokenEdicao]);

  const pronto = nome.trim() && dia && mes;

  async function salvar() {
    if (!pronto) return;
    setSalvando(true);
    setAviso(null);
    try {
      const r = await salvarData({
        data: { tokenEdicao, nome, tipo, dia: Number(dia), mes: Number(mes) },
      });
      setDatas(r.datas);
      if (r.ok) {
        trackEvent("data_especial_salva", { tipo, total: r.datas.length });
        setNome("");
        setDia("");
        setMes("");
        setTipo("aniversario");
      } else {
        setAviso(
          r.erro === "invalida"
            ? "Confere o dia e o mês."
            : r.erro === "limite"
              ? "Chegou no limite de 20 datas."
              : "Não consegui salvar agora.",
        );
      }
    } finally {
      setSalvando(false);
    }
  }

  if (datas === null) return null;
  const campo =
    "h-11 rounded-xl border border-[var(--tinta-fraca)] bg-[var(--papel)] px-3 outline-none focus:border-[var(--acento)]";

  return (
    <section className="rounded-3xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-6">
      <h2 className="flex items-center gap-2 font-medium" style={{ fontSize: "var(--t-lg)" }}>
        <CalendarHeart className="h-5 w-5 text-[var(--acento)]" /> Datas que você não pode esquecer
      </h2>
      <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
        A gente te avisa 10 dias antes, pra dar tempo de fazer a música de quem você ama.
      </p>

      {datas.length > 0 && (
        <ul className="mt-4 space-y-2">
          {datas.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-[var(--papel)] px-3 py-2"
              style={{ fontSize: "var(--t-sm)" }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-[var(--acento)]" />
                <span className="truncate">
                  <strong className="font-medium">{d.nome}</strong>
                  <span className="text-[var(--tinta-suave)]">
                    {" "}
                    · {TIPOS.find((t) => t.v === d.tipo)?.rotulo.toLowerCase()} · {d.dia}{" "}
                    {MESES[d.mes - 1]}
                  </span>
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remover ${d.nome}`}
                onClick={() => void removerData({ data: { tokenEdicao, id: d.id } }).then(setDatas)}
                className="shrink-0 p-1 text-[var(--tinta-suave)] hover:text-[var(--acento)]"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2" style={{ fontSize: "var(--t-sm)" }}>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (ex.: minha mãe)"
          maxLength={40}
          className={`${campo} col-span-2`}
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoData)}
          className={`${campo} col-span-2`}
        >
          {TIPOS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.rotulo}
            </option>
          ))}
        </select>
        <select
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className={campo}
          aria-label="Dia"
        >
          <option value="">Dia</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className={campo}
          aria-label="Mês"
        >
          <option value="">Mês</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {aviso && (
        <p className="mt-2 text-[var(--acento)]" style={{ fontSize: "var(--t-xs)" }}>
          {aviso}
        </p>
      )}
      <button
        type="button"
        disabled={!pronto || salvando}
        onClick={() => void salvar()}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full cta px-6 font-medium disabled:opacity-50"
        style={{ fontSize: "var(--t-sm)" }}
      >
        {salvando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CalendarHeart className="h-4 w-4" />
        )}
        {datas.length ? "Salvar mais uma data" : "Me avise nessa data"}
      </button>
    </section>
  );
}
