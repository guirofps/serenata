import { Link } from "@tanstack/react-router";
import { Plus, Sparkles, Frame } from "lucide-react";
import { OFERTAS, TEXTO_OFERTA } from "@/lib/creditos";
import { novaSessao } from "@/lib/session-context";
import { useQuizStore } from "@/lib/quiz-store";
import { trackEvent } from "@/lib/track";

// O BLOCO DE CRÉDITOS, no topo do painel.
//
// Fica ACIMA da lista de músicas de propósito. A lista é o que ela já tem; o
// que faz a plataforma crescer é o que ela ainda pode fazer. E o dado apoia:
// 11 dos 290 compradores compraram uma segunda música por conta própria, sem
// oferta nenhuma, pagando o preço cheio.
//
// DOIS ESTADOS, e eles pedem coisas diferentes:
//
//   COM saldo   -> "você tem 2 créditos, use um agora". A ação é USAR.
//   SEM saldo   -> as três ofertas. A ação é COMPRAR.
//
// Misturar os dois faria quem já pagou ver vitrine em vez do que comprou.

const TXT = {
  pt: {
    tituloComSaldo: (n: number) => (n === 1 ? "Você tem 1 crédito" : `Você tem ${n} créditos`),
    subComSaldo: "Cada crédito é uma música nova e completa, pra quem você quiser, no gênero que quiser.",
    usar: "Usar um crédito agora",
    tituloSemSaldo: "Quem mais merece uma?",
    subSemSaldo: "A letra sai de graça de novo. Você só paga se quiser ouvir cantada.",
    porMusica: (v: number) => `R$ ${v.toFixed(2).replace(".", ",")} cada`,
    naoExpira: "Os créditos não expiram",
  },
  es: {
    tituloComSaldo: (n: number) => (n === 1 ? "Tienes 1 crédito" : `Tienes ${n} créditos`),
    subComSaldo: "Cada crédito es una canción nueva y completa, para quien quieras, en el género que quieras.",
    usar: "Usar un crédito ahora",
    tituloSemSaldo: "¿Quién más merece una?",
    subSemSaldo: "La letra vuelve a ser gratis. Solo pagas si quieres escucharla cantada.",
    porMusica: (v: number) => `R$ ${v.toFixed(2).replace(".", ",")} c/u`,
    naoExpira: "Los créditos no vencen",
  },
};

export function BlocoCreditos({
  saldo,
  locale,
  email,
}: {
  saldo: number;
  locale: "pt" | "es";
  /** Vai no checkout pra o webhook saber a quem creditar. */
  email: string;
}) {
  const t = TXT[locale] ?? TXT.pt;
  const o = TEXTO_OFERTA[locale] ?? TEXTO_OFERTA.pt;
  const reset = useQuizStore((s) => s.reset);

  // ── COM SALDO: a ação é usar ──────────────────────────────────
  if (saldo > 0) {
    return (
      <section className="mt-8 rounded-[var(--raio-lg)] border border-[var(--acento)]/40 bg-[var(--acento)]/5 p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)]/15 text-[var(--acento)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p style={{ fontFamily: "var(--fonte-display)", fontSize: "var(--t-lg)", fontWeight: 500 }}>
              {t.tituloComSaldo(saldo)}
            </p>
            <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}>
              {t.subComSaldo}
            </p>
          </div>
        </div>
        <Link
          to={locale === "es" ? "/es/criar" : "/criar"}
          search={{ credito: 1 } as never}
          onClick={() => {
            // Mesmas duas regras do convite de recompra, e pelos mesmos dois
            // motivos: sessão nova (senão a música nova sobrescreve o presente
            // já entregue) e store limpo (senão a `letraFinal` da compra
            // anterior aparece na revelação do quiz novo).
            trackEvent("credito_usar_click", { saldo });
            novaSessao();
            reset();
          }}
          className="cta mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 sm:w-auto sm:px-8"
        >
          <Plus className="h-4 w-4" /> {t.usar}
        </Link>
      </section>
    );
  }

  // ── SEM SALDO: a ação é comprar ───────────────────────────────
  const musica = OFERTAS.filter((x) => x.creditos > 0);
  const quadro = OFERTAS.find((x) => x.id === "quadro");

  return (
    <section className="mt-8 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-6">
      <p style={{ fontFamily: "var(--fonte-display)", fontSize: "var(--t-lg)", fontWeight: 500 }}>
        {t.tituloSemSaldo}
      </p>
      <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}>
        {t.subSemSaldo}
      </p>

      {/* Uma coluna no celular, que é onde 99% abre. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {musica.map((of) => {
          const txt = o[of.id];
          const destaque = of.id === "tres";
          return (
            <a
              key={of.id}
              href={`${of.checkout}?email=${encodeURIComponent(email)}`}
              onClick={() => trackEvent("credito_oferta_click", { oferta: of.id })}
              className={
                "relative flex flex-col rounded-[var(--raio)] border p-4 transition-colors " +
                (destaque
                  ? "border-[var(--acento)]/50 bg-[var(--acento)]/5"
                  : "border-[var(--tinta-fraca)]/40 hover:border-[var(--tinta-fraca)]")
              }
            >
              {destaque && "selo" in txt && (
                <span className="absolute -top-2 right-4 rounded-full bg-[var(--acento)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {txt.selo}
                </span>
              )}
              <p className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                {txt.titulo}
              </p>
              <p className="mt-1 flex-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.45 }}>
                {txt.sub}
              </p>
              <p className="mt-3 font-semibold text-[var(--acento)]" style={{ fontSize: "var(--t-lg)" }}>
                R$ {of.precoBrl.toFixed(2).replace(".", ",")}
                {of.creditos > 1 && (
                  <span className="ml-2 font-normal text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                    {t.porMusica(of.precoBrl / of.creditos)}
                  </span>
                )}
              </p>
            </a>
          );
        })}
      </div>

      {quadro && (
        <div className="mt-3 rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 transition-colors hover:border-[var(--tinta-fraca)]">
        <a
          href={`${quadro.checkout}?email=${encodeURIComponent(email)}`}
          onClick={() => trackEvent("credito_oferta_click", { oferta: "quadro" })}
          className="flex items-center gap-3 p-4"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--tinta-fraca)]/15 text-[var(--acento)]">
            <Frame className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium" style={{ fontSize: "var(--t-base)" }}>
              {o.quadro.titulo}
            </span>
            <span className="block text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.45 }}>
              {o.quadro.sub}
            </span>
          </span>
          <span className="shrink-0 font-semibold text-[var(--acento)]" style={{ fontSize: "var(--t-base)" }}>
            R$ {quadro.precoBrl.toFixed(2).replace(".", ",")}
          </span>
        </a>
        {/* VER ANTES DE COMPRAR. É o produto mais difícil de imaginar da lista:
            "folha A4 com a letra" não desenha nada na cabeça de ninguém. O
            exemplo usa dado inventado e a foto que já é pública na home,
            nunca o presente de um cliente. */}
        <a
          href="/quadro/exemplo"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => { e.stopPropagation(); trackEvent("quadro_exemplo_click"); }}
          className="block border-t border-[var(--tinta-fraca)]/30 px-4 py-2.5 text-center text-[var(--tinta-suave)] underline underline-offset-2"
          style={{ fontSize: "var(--t-xs)" }}
        >
          {"exemplo" in o.quadro ? o.quadro.exemplo : "ver um exemplo"}
        </a>
        </div>
      )}

      <p className="mt-4 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
        {t.naoExpira}
      </p>
    </section>
  );
}
