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
    titulo: "Quer criar outra música?",
    sub: "Aqui você compra crédito com desconto. Cada crédito vale uma música nova e completa, pra quem você quiser.",
    passos: [
      "Compre o crédito aqui",
      "Conte a história de outra pessoa",
      "A música fica pronta em minutos",
    ],
    quadroPronto: (n: number) =>
      n === 1 ? "Você tem 1 quadro pra montar" : `Você tem ${n} quadros pra montar`,
    quadroProntoSub:
      "Escolha de qual música ele é e salve o PDF pra imprimir. Você troca de música quantas vezes quiser antes de confirmar.",
    quadroProntoCta: "Montar meu quadro",
    porMusica: (v: number) => `${brl(v)} cada`,
    naoExpira: "Os créditos não expiram",
    off: (p: number) => `${p}% off`,
    oQueECredito: "O que é um crédito?",
    oQueECreditoTexto:
      "É uma música nova e completa, já paga. Você compra aqui, entra em “Minhas músicas”, toca em criar, conta a história de outra pessoa e no fim não paga nada de novo. Cada crédito vale uma música, e eles não expiram.",
  },
  es: {
    saldo: (n: number) => (n === 1 ? "Tienes 1 crédito" : `Tienes ${n} créditos`),
    saldoSub: "Una canción nueva y completa, para quien quieras, en el género que quieras.",
    usar: (n: number) => (n === 1 ? "Usar mi crédito ahora" : `Usar 1 de mis ${n} créditos`),
    titulo: "¿Quieres crear otra canción?",
    sub: "Aquí compras crédito con descuento. Cada crédito vale una canción nueva y completa, para quien tú quieras.",
    passos: [
      "Compra el crédito aquí",
      "Cuenta la historia de otra persona",
      "La canción queda lista en minutos",
    ],
    quadroPronto: (n: number) =>
      n === 1 ? "Tienes 1 cuadro para armar" : `Tienes ${n} cuadros para armar`,
    quadroProntoSub:
      "Elige de cuál canción es y guarda el PDF para imprimir. Puedes cambiar de canción todas las veces que quieras antes de confirmar.",
    quadroProntoCta: "Armar mi cuadro",
    porMusica: (v: number) => `${brl(v)} c/u`,
    naoExpira: "Los créditos no vencen",
    off: (p: number) => `${p}% off`,
    oQueECredito: "¿Qué es un crédito?",
    oQueECreditoTexto:
      "Es una canción nueva y completa, ya pagada. La compras aquí, entras en “Mis canciones”, tocas en crear, cuentas la historia de otra persona y al final no pagas nada de nuevo. Cada crédito vale una canción, y no vencen.",
  },
};

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export function BlocoCreditos({
  saldo,
  locale,
  email,
  quadrosParaMontar = 0,
}: {
  saldo: number;
  locale: "pt" | "es";
  /** Vai no checkout pra o webhook saber a quem creditar. */
  email: string;
  /** Quadros comprados e ainda não amarrados a uma música. */
  quadrosParaMontar?: number;
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
      {/* ── O QUE ELA COMPROU E AINDA NÃO USOU VEM PRIMEIRO ──────────
          Antes de qualquer oferta. Vender de novo pra quem tem produto parado
          é a forma mais rápida de a pessoa achar que pagou e não recebeu. */}
      {quadrosParaMontar > 0 && (
        <div className="mb-4 rounded-[var(--raio-lg)] border-2 border-[var(--acento)]/50 bg-[var(--acento)]/[0.07] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--acento)]/15 text-[var(--acento)]">
              <Frame className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p style={{ fontFamily: "var(--fonte-display)", fontSize: "var(--t-lg)", fontWeight: 500 }}>
                {t.quadroPronto(quadrosParaMontar)}
              </p>
              <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
                {t.quadroProntoSub}
              </p>
            </div>
          </div>
          <a
            href="/meu-quadro"
            onClick={() => trackEvent("quadro_montar_click", { quantos: quadrosParaMontar })}
            className="cta mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium"
          >
            {t.quadroProntoCta} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}

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

        {/* COMO FUNCIONA, em três passos numerados.
            "Crédito" não é palavra do vocabulário de quem compra aqui: sem
            dizer o que acontece depois de pagar, o card vira uma cobrança sem
            promessa. Três linhas curtas resolvem, e cabem no celular. */}
        <ol className="mt-4 space-y-2">
          {t.passos.map((passo, i) => (
            <li key={passo} className="flex items-center gap-2.5">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--acento)]/12 font-semibold text-[var(--acento)]"
                style={{ fontSize: "var(--t-xs)" }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: "var(--t-sm)" }}>{passo}</span>
            </li>
          ))}
        </ol>

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

        {/* ── O QUE É UM CRÉDITO ────────────────────────────────
          Vai no fim de propósito: quem já entendeu compra antes de chegar
          aqui, e quem não entendeu precisa de uma explicação que não atrapalhe
          quem não precisa dela. "Crédito" não é palavra do vocabulário de
          quem compra aqui, e ninguém compra o que não sabe o que é. */}
      <div className="mt-5 rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 p-4">
        <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
          {t.oQueECredito}
        </p>
        <p className="mt-1.5 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
          {t.oQueECreditoTexto}
        </p>
      </div>

      <p className="mt-4 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
          {t.naoExpira}
        </p>
      </div>
    </section>
  );
}
