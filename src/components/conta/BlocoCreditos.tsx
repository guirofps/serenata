import { Link } from "@tanstack/react-router";
import { Sparkles, Frame, ArrowRight } from "lucide-react";
import { OFERTAS, TEXTO_OFERTA, PRECO_CHEIO } from "@/lib/creditos";
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
// UM BLOCO SÓ, NÃO DOIS ESTADOS. A primeira versão escondia as ofertas de
// quem tinha saldo e escondia o saldo de quem não tinha. Isso punia justo o
// melhor cliente: quem comprou o pacote de três parava de ver que existe
// quadro. Agora o saldo é uma faixa EM CIMA das ofertas, e as ofertas ficam
// sempre no ar.
//
// O DESCONTO É ANCORADO NO PREÇO REAL, não num preço inventado pra riscar. A
// música avulsa custa R$ 38 no funil hoje; é esse número que aparece riscado,
// e é por isso que ele pode aparecer. O quadro não tem preço anterior, então
// não ganha selo: selo de desconto sem desconto é o tipo de coisa que derruba
// conta no Google Ads.

const TXT = {
  pt: {
    saldo: (n: number) => (n === 1 ? "Você tem 1 crédito" : `Você tem ${n} créditos`),
    saldoSub: "Uma música nova e completa, pra quem você quiser, no gênero que quiser.",
    usar: (n: number) => (n === 1 ? "Usar meu crédito agora" : `Usar 1 dos meus ${n} créditos`),
    titulo: "Quem mais merece uma?",
    sub: "A letra sai de graça de novo. Você só paga se quiser ouvir cantada.",
    porMusica: (v: number) => `${brl(v)} cada`,
    naoExpira: "Os créditos não expiram",
    off: (p: number) => `${p}% off`,
  },
  es: {
    saldo: (n: number) => (n === 1 ? "Tienes 1 crédito" : `Tienes ${n} créditos`),
    saldoSub: "Una canción nueva y completa, para quien quieras, en el género que quieras.",
    usar: (n: number) => (n === 1 ? "Usar mi crédito ahora" : `Usar 1 de mis ${n} créditos`),
    titulo: "¿Quién más merece una?",
    sub: "La letra vuelve a ser gratis. Solo pagas si quieres escucharla cantada.",
    porMusica: (v: number) => `${brl(v)} c/u`,
    naoExpira: "Los créditos no vencen",
    off: (p: number) => `${p}% off`,
  },
};

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

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
  const musica = OFERTAS.filter((x) => x.creditos > 0);
  // A ancora so vale no BR: no ES a compra foi em dolar e o upsell e cobrado
  // em real, entao riscar "R$ 114" compararia duas moedas diferentes.
  const comAncora = locale === "pt";
  const quadro = OFERTAS.find((x) => x.id === "quadro");

  return (
    <section className="mt-8">
      {/* ── A FAIXA DE SALDO, quando existe ───────────────────────────
          É o ÚNICO botão de "criar outra música" do painel. O que existia no
          rodapé mandava pro funil no preço cheio mesmo com crédito na conta:
          cobrava de novo por algo já pago. */}
      {saldo > 0 && (
        <div className="mb-4 rounded-[var(--raio-lg)] border border-[var(--acento)]/45 bg-[var(--acento)]/[0.07] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)]/15 text-[var(--acento)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p style={{ fontFamily: "var(--fonte-display)", fontSize: "var(--t-lg)", fontWeight: 500 }}>
                {t.saldo(saldo)}
              </p>
              <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}>
                {t.saldoSub}
              </p>
            </div>
          </div>
          <Link
            to={locale === "es" ? "/es/criar" : "/criar"}
            search={{ credito: 1 } as never}
            onClick={() => {
              // Sessão nova (senão a música nova sobrescreve o presente já
              // entregue) e store limpo (senão a `letraFinal` da compra
              // anterior aparece na revelação do quiz novo). As duas regras
              // custaram três incidentes e não podem viver em cópias.
              trackEvent("credito_usar_click", { saldo });
              novaSessao();
              reset();
            }}
            className="cta mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium"
          >
            {t.usar(saldo)} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-6">
        <p style={{ fontFamily: "var(--fonte-display)", fontSize: "var(--t-lg)", fontWeight: 500 }}>
          {t.titulo}
        </p>
        <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}>
          {t.sub}
        </p>

        {/* Uma coluna no celular, que é onde 99% abre. O `pt-3` existe pra o
            selo, que sobe pra fora do card, não ser cortado. */}
        <div className="mt-5 grid gap-4 pt-3 sm:grid-cols-2">
          {musica.map((of) => {
            const txt = o[of.id];
            const de = PRECO_CHEIO * of.creditos;
            const off = Math.round((1 - of.precoBrl / de) * 100);
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
                {/* O SELO DE DESCONTO, montado em cima da borda do card. */}
                {comAncora && (
                  <span className="absolute -top-3 left-4 rounded-full bg-[var(--acento)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    {t.off(off)}
                  </span>
                )}
                {destaque && "selo" in txt && (
                  <span className="absolute -top-3 right-4 rounded-full border border-[var(--acento)]/40 bg-[var(--papel)] px-2.5 py-1 text-[11px] font-medium text-[var(--acento)]">
                    {txt.selo}
                  </span>
                )}

                <p className="mt-1 font-medium" style={{ fontSize: "var(--t-base)" }}>
                  {txt.titulo}
                </p>
                <p className="mt-1 flex-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.45 }}>
                  {txt.sub}
                </p>

                <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  {comAncora && (
                    <span className="text-[var(--tinta-suave)] line-through" style={{ fontSize: "var(--t-sm)" }}>
                      {brl(de)}
                    </span>
                  )}
                  <span className="font-semibold text-[var(--acento)]" style={{ fontSize: "var(--t-xl)" }}>
                    {brl(of.precoBrl)}
                  </span>
                  {of.creditos > 1 && (
                    <span className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                      {t.porMusica(of.precoBrl / of.creditos)}
                    </span>
                  )}
                </p>

                <span
                  className="cta mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-0 font-medium"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  {txt.cta} <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            );
          })}
        </div>

        {quadro && (
          <div className="mt-4 rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 transition-colors hover:border-[var(--tinta-fraca)]">
            <a
              href={`${quadro.checkout}?email=${encodeURIComponent(email)}`}
              onClick={() => trackEvent("credito_oferta_click", { oferta: "quadro" })}
              className="block p-4"
            >
              <span className="flex items-center gap-3">
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
                <span className="shrink-0 font-semibold text-[var(--acento)]" style={{ fontSize: "var(--t-lg)" }}>
                  {brl(quadro.precoBrl)}
                </span>
              </span>
              <span
                className="cta mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-0 font-medium"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {o.quadro.cta} <ArrowRight className="h-4 w-4" />
              </span>
            </a>
            {/* VER ANTES DE COMPRAR. É o produto mais difícil de imaginar da
                lista: "folha A4 com a letra" não desenha nada na cabeça de
                ninguém. O exemplo usa dado inventado e a foto que já é pública
                na home, nunca o presente de um cliente. */}
            <a
              href="/quadro/exemplo"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent("quadro_exemplo_click");
              }}
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
      </div>
    </section>
  );
}
