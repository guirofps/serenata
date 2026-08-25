import { useEffect, useState } from "react";
import { RefreshCw, Loader2, Check } from "lucide-react";
import { pedirRefacao, estadoRefacao } from "@/lib/refacao";
import { generos } from "@/lib/generos";
import { trackEvent } from "@/lib/track";
import type { Locale } from "@/lib/i18n";

// "NÃO FICOU DO MEU JEITO": o ajuste que a paywall promete.
//
// ── ONDE ELA MORA, E POR QUE AQUI ────────────────────────────────
//
// No EDITOR, não no painel. Medido em 25/08: o editor teve 1.527 sessões em
// sete dias contra 398 do painel, e 71% dos compradores montam o presente
// enquanto só 17,6% fazem login. A tela onde a pessoa já está é a tela onde a
// promessa tem que estar.
//
// ── FECHADA POR PADRÃO ───────────────────────────────────────────
//
// A ação desta página é montar o presente. Um formulário aberto de "o que você
// não gostou?" no meio dela planta a dúvida em quem estava satisfeito, e essa
// pergunta a gente não quer fazer. Quem quis mexer abre; quem não quis nem lê.
//
// ── UMA SÓ, E DITO ANTES ─────────────────────────────────────────
//
// O direito é de um ajuste (`refacoes_incluidas`). Isso está escrito ao lado
// do botão, não num rodapé: descobrir depois de enviar que era a única chance
// é o tipo de surpresa que vira ticket de suporte.

const T = {
  pt: {
    abrir: "Não ficou do seu jeito? A gente refaz",
    titulo: "Ajustar minha música",
    quantas: (n: number) => (n === 1 ? "Você tem 1 ajuste incluído" : `Você tem ${n} ajustes`),
    oQue: "O que você quer mudar?",
    dica: "Escreva do seu jeito. Ex: “não gostei do trecho que fala da viagem, queria que falasse do dia em que a gente se conheceu”.",
    estiloLabel: "Quer mudar o estilo?",
    vozLabel: "E a voz?",
    opcional: "Opcional. Sem escolher nada, mantemos o que já está.",
    manter: "Manter",
    enviar: "Refazer minha música",
    enviando: "Mandando pro estúdio...",
    aviso: "É o seu único ajuste incluído. A música anterior fica guardada, você não perde nada.",
    pronto: "Pedido enviado. A nova versão fica pronta em 1 ou 2 minutos, e a anterior continua guardada.",
    erros: {
      curto: "Escreva um pouquinho mais sobre o que mudar.",
      "sem-direito": "Você já usou o ajuste incluído nesta música.",
      gravando: "A sua música já está sendo regravada. Espere ela ficar pronta.",
      "nao-pago": "O ajuste fica disponível depois da compra.",
      "nao-encontrada": "Não achei essa música.",
      falhou: "Não deu pra enviar agora. Tente de novo daqui a pouco.",
    } as Record<string, string>,
  },
  es: {
    abrir: "¿No quedó a tu gusto? La rehacemos",
    titulo: "Ajustar mi canción",
    quantas: (n: number) => (n === 1 ? "Tienes 1 ajuste incluido" : `Tienes ${n} ajustes`),
    oQue: "¿Qué quieres cambiar?",
    dica: "Escríbelo a tu manera. Ej: “no me gustó la parte del viaje, quisiera que hablara del día en que nos conocimos”.",
    estiloLabel: "¿Quieres cambiar el estilo?",
    vozLabel: "¿Y la voz?",
    opcional: "Opcional. Si no eliges nada, mantenemos lo que ya está.",
    manter: "Mantener",
    enviar: "Rehacer mi canción",
    enviando: "Mandando al estudio...",
    aviso: "Es tu único ajuste incluido. La canción anterior queda guardada, no pierdes nada.",
    pronto: "Pedido enviado. La nueva versión queda lista en 1 o 2 minutos, y la anterior sigue guardada.",
    erros: {
      curto: "Escribe un poco más sobre lo que quieres cambiar.",
      "sem-direito": "Ya usaste el ajuste incluido en esta canción.",
      gravando: "Tu canción ya se está regrabando. Espera a que termine.",
      "nao-pago": "El ajuste está disponible después de la compra.",
      "nao-encontrada": "No encontré esa canción.",
      falhou: "No se pudo enviar ahora. Inténtalo de nuevo en un momento.",
    } as Record<string, string>,
  },
};

const VOZES = [
  { value: "feminina", label: "Voz feminina", labelEs: "Voz femenina", emoji: "👩" },
  { value: "masculina", label: "Voz masculina", labelEs: "Voz masculina", emoji: "👨" },
];

export function PedirRefacao({
  tokenEdicao,
  locale = "pt",
}: {
  tokenEdicao: string;
  locale?: Locale;
}) {
  const t = T[locale === "es" ? "es" : "pt"];
  const [estado, setEstado] = useState<{ pago: boolean; restantes: number; gravando: boolean } | null>(
    null,
  );
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState("");
  const [estilo, setEstilo] = useState("");
  const [voz, setVoz] = useState("");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    estadoRefacao({ data: { tokenEdicao } })
      .then((r) => { if (vivo) setEstado(r); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [tokenEdicao]);

  // Nada aparece pra quem não pagou, pra quem já usou, nem enquanto grava:
  // botão que não vai funcionar é pior que botão nenhum.
  if (!estado?.pago || estado.restantes < 1 || estado.gravando) return null;

  if (pronto) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-[var(--raio-lg)] border border-[var(--acento)]/40 bg-[var(--acento)]/[0.06] p-5 text-center">
        <Check className="mx-auto h-6 w-6 text-[var(--acento)]" />
        <p className="mt-2 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
          {t.pronto}
        </p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="mx-auto mt-10 max-w-md text-center">
        <button
          onClick={() => { setAberto(true); trackEvent("refacao_abriu"); }}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-5 text-[var(--tinta-suave)] transition-colors hover:border-[var(--acento)] hover:text-[var(--acento)]"
          style={{ fontSize: "var(--t-sm)" }}
        >
          <RefreshCw className="h-4 w-4" /> {t.abrir}
        </button>
      </div>
    );
  }

  const chip = (ativo: boolean) =>
    "inline-flex h-11 items-center rounded-full border px-4 transition-colors " +
    (ativo
      ? "border-[var(--acento)] bg-[var(--acento)]/10 text-[var(--acento)]"
      : "border-[var(--tinta-fraca)] text-[var(--tinta-suave)]");

  async function enviar() {
    setIndo(true);
    setErro(null);
    try {
      const r = await pedirRefacao({ data: { tokenEdicao, pedido, estilo, voz } });
      if (r.ok) {
        trackEvent("refacao_pedida", { temEstilo: Boolean(estilo), temVoz: Boolean(voz) });
        setPronto(true);
        return;
      }
      setErro(t.erros[r.erro] ?? t.erros.falhou);
    } catch {
      setErro(t.erros.falhou);
    } finally {
      setIndo(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-5 text-left">
      <p style={{ fontFamily: "var(--fonte-display)", fontSize: "var(--t-lg)", fontWeight: 500 }}>
        {t.titulo}
      </p>
      <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
        {t.quantas(estado.restantes)}
      </p>

      <label className="mt-4 block">
        <span className="block font-medium" style={{ fontSize: "var(--t-sm)" }}>{t.oQue}</span>
        <span className="mt-0.5 block text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)", lineHeight: 1.45 }}>
          {t.dica}
        </span>
        <textarea
          value={pedido}
          onChange={(e) => setPedido(e.target.value.slice(0, 800))}
          rows={4}
          className="mt-2 w-full resize-none rounded-[var(--raio)] border border-[var(--tinta-fraca)] bg-[var(--papel)] p-3 outline-none focus:border-[var(--acento)]"
          style={{ fontSize: "16px", lineHeight: 1.5 }}
        />
      </label>

      <p className="mt-4 font-medium" style={{ fontSize: "var(--t-sm)" }}>{t.estiloLabel}</p>
      <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>{t.opcional}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => setEstilo("")} className={chip(!estilo)}>{t.manter}</button>
        {generos(locale).map((g) => (
          <button key={g.value} onClick={() => setEstilo(g.value)} className={chip(estilo === g.value)}>
            {g.emoji} {g.label}
          </button>
        ))}
      </div>

      <p className="mt-4 font-medium" style={{ fontSize: "var(--t-sm)" }}>{t.vozLabel}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => setVoz("")} className={chip(!voz)}>{t.manter}</button>
        {VOZES.map((v) => (
          <button key={v.value} onClick={() => setVoz(v.value)} className={chip(voz === v.value)}>
            {v.emoji} {locale === "es" ? v.labelEs : v.label}
          </button>
        ))}
      </div>

      {erro && (
        <p className="mt-4 rounded-[var(--raio)] border border-amber-500/30 bg-amber-50 p-3 text-amber-900" style={{ fontSize: "var(--t-sm)" }}>
          {erro}
        </p>
      )}

      {/* O AVISO GRUDADO NO BOTÃO. Descobrir depois de enviar que era a única
          chance é o tipo de surpresa que vira ticket. */}
      <p className="mt-5 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)", lineHeight: 1.45 }}>
        {t.aviso}
      </p>
      <button
        onClick={enviar}
        disabled={indo || pedido.trim().length < 3}
        className="cta mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium disabled:opacity-45"
      >
        {indo ? (<><Loader2 className="h-4 w-4 animate-spin" /> {t.enviando}</>) : (<><RefreshCw className="h-4 w-4" /> {t.enviar}</>)}
      </button>
    </div>
  );
}
