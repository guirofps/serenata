import { useState } from "react";
import {
  letraParaAjuste,
  reescreverLetra,
  salvarLetra,
  regravarMusica,
  type LetraParaAjuste,
} from "@/lib/recuperacao-letra";
import { Loader2, Wand2, Save, Disc3, AlertTriangle } from "lucide-react";

// O painel que deixa o ATENDENTE destravar a venda sozinho.
//
// Fluxo pensado pra quem está com o cliente no WhatsApp na outra mão:
//   1. abre e lê a letra (hoje ele nem enxerga)
//   2. cola o que o cliente pediu, em português mesmo ("são 22 anos, não 16")
//   3. lê a proposta, corrige na mão o que quiser
//   4. salva
//   5. manda gravar
//
// A ordem é essa porque cada passo é reversível até o último. Só o "gravar"
// gasta dinheiro (R$ 0,32) e só ele mexe no que o cliente vai ouvir.

export function AjusteLetra({ musicaId }: { musicaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [ficha, setFicha] = useState<LetraParaAjuste | null>(null);
  const [letra, setLetra] = useState("");
  const [pedido, setPedido] = useState("");
  const [mudou, setMudou] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState<null | "abrindo" | "ia" | "salvando" | "gravando">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  // Só aparece quando o servidor recusa por ser música PAGA. Ver regravarMusica.
  const [pedeConfirmar, setPedeConfirmar] = useState(false);

  const sujo = ficha !== null && letra.trim() !== ficha.letra.trim();

  async function abrir() {
    setAberto(true);
    if (ficha) return;
    setOcupado("abrindo");
    setErro(null);
    try {
      const f = await letraParaAjuste({ data: { musicaId } });
      setFicha(f);
      setLetra(f.letra);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  }

  async function aplicar() {
    setOcupado("ia");
    setErro(null);
    setRecado(null);
    try {
      const r = await reescreverLetra({ data: { musicaId, pedido } });
      setLetra(r.letra);
      setMudou(r.mudou);
      setAviso(r.aviso);
      setPedido("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    setOcupado("salvando");
    setErro(null);
    try {
      await salvarLetra({ data: { musicaId, letra } });
      setFicha((f) => (f ? { ...f, letra } : f));
      setRecado("Letra salva. Agora dá pra gravar.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  }

  async function gravar(confirmando = false) {
    setOcupado("gravando");
    setErro(null);
    setRecado(null);
    try {
      await regravarMusica({ data: { musicaId, confirmoSubstituir: confirmando } });
      setPedeConfirmar(false);
      setFicha((f) => (f ? { ...f, status: "gerando" } : f));
      setRecado("Mandei gravar. Fica pronta em 1 a 2 minutos; recarregue a busca pra ver.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // O servidor devolve este código quando a música JÁ FOI PAGA: regravar
      // troca o áudio no mesmo link, e quem já recebeu o presente passa a
      // ouvir outra coisa. Aqui isso vira uma pergunta, não um erro.
      if (msg.includes("PRECISA_CONFIRMAR")) setPedeConfirmar(true);
      else setErro(msg);
    } finally {
      setOcupado(null);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={abrir}
        className="rounded-full border border-[var(--tinta-fraca)] px-2.5 py-1 text-[11px]"
      >
        ajustar letra
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-[var(--tinta-fraca)]/60 bg-[var(--papel)] p-3">
      {ocupado === "abrindo" && (
        <p className="flex items-center gap-2 text-[11px] text-[var(--tinta-suave)]">
          <Loader2 className="h-3 w-3 animate-spin" /> abrindo a letra…
        </p>
      )}

      {ficha && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--tinta-suave)]">
              status: <strong>{ficha.status}</strong>
              {ficha.pago ? " · JÁ PAGOU" : " · não pagou"}
              {ficha.entregue && " · presente já montado"}
            </p>
            <button onClick={() => setAberto(false)} className="text-[11px] underline">
              fechar
            </button>
          </div>

          {/* O PEDIDO EM PORTUGUÊS. O atendente não deve ter que reescrever
              verso; ele cola o que o cliente falou e confere o resultado. */}
          <div className="mt-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tinta-suave)]">
              o que o cliente pediu
            </label>
            <textarea
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              rows={2}
              placeholder='ex: "são 22 anos de casados, não 16" ou "o apelido dele é Nem"'
              className="mt-1 w-full rounded-lg border border-[var(--tinta-fraca)] bg-transparent p-2 text-sm"
            />
            <button
              onClick={aplicar}
              disabled={ocupado !== null || pedido.trim().length < 3}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-[11px] disabled:opacity-40"
            >
              {ocupado === "ia" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              aplicar na letra
            </button>
          </div>

          {mudou.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[11px] text-[var(--tinta-suave)]">
              {mudou.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          {aviso && (
            <p className="mt-2 flex items-start gap-2 text-[11px] text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {aviso}
            </p>
          )}

          {/* Editável na mão: o modelo acerta quase sempre, e quando erra o
              atendente conserta a palavra em vez de tentar explicar de novo. */}
          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[var(--tinta-suave)]">
            letra {sujo && <span className="text-amber-700">· alterada, ainda não salva</span>}
          </label>
          <textarea
            value={letra}
            onChange={(e) => setLetra(e.target.value)}
            rows={14}
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-[var(--tinta-fraca)] bg-transparent p-2 font-mono text-[12px] leading-relaxed"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={salvar}
              disabled={ocupado !== null || !sujo}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-[11px] disabled:opacity-40"
            >
              {ocupado === "salvando" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              salvar letra
            </button>
            <button
              onClick={() => gravar(false)}
              disabled={ocupado !== null || sujo}
              title={sujo ? "salve a letra antes de gravar" : undefined}
              className="cta inline-flex items-center gap-2 rounded-full border-0 px-4 py-1.5 text-[11px] disabled:opacity-40"
            >
              {ocupado === "gravando" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Disc3 className="h-3 w-3" />}
              gravar música nova
            </button>
            <span className="text-[11px] text-[var(--tinta-suave)]">custa R$ 0,32</span>
          </div>

          {/* O SEGUNDO SIM, só pra música já paga. */}
          {pedeConfirmar && (
            <div className="mt-3 rounded-lg border border-amber-500/60 bg-amber-50 p-3">
              <p className="text-[12px] text-amber-900">
                <strong>Esta música já foi paga.</strong> Gravar de novo troca o áudio no mesmo
                link. Se a pessoa já mandou o presente, quem abrir vai ouvir a versão nova. Só
                confirme se o cliente PEDIU a troca.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => gravar(true)}
                  className="rounded-full bg-amber-600 px-3 py-1.5 text-[11px] text-white"
                >
                  sim, trocar o áudio
                </button>
                <button
                  onClick={() => setPedeConfirmar(false)}
                  className="rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-[11px]"
                >
                  cancelar
                </button>
              </div>
            </div>
          )}

          {recado && <p className="mt-2 text-[11px] text-emerald-700">{recado}</p>}
          {erro && <p className="mt-2 text-[11px] text-red-600">{erro}</p>}
        </>
      )}

      {erro && !ficha && <p className="text-[11px] text-red-600">{erro}</p>}
    </div>
  );
}
