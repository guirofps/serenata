import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { novaSessao } from "@/lib/session-context";
import { useQuizStore } from "@/lib/quiz-store";
import { trackEvent } from "@/lib/track";

// O CONVITE PRA FAZER OUTRA MÚSICA.
//
// Existia um só, dentro do /dashboard, e o /dashboard exige login. Medido em
// 17/08: dos 259 compradores, 42 (16%) já logaram alguma vez. Em sete dias o
// /dashboard teve 70 sessões; o /editar teve 451 e o /obrigado 229. Ou seja,
// o único lugar que oferecia a segunda compra era o lugar onde o comprador
// não está.
//
// E a demanda existe sem a gente pedir: 11 compradores (4,2%) já compraram
// mais de uma vez por conta própria, 10 deles com quizzes DIFERENTES, isto é,
// músicas de verdade pra outras pessoas. Um deles pagou QUATRO PIX de R$ 38
// em um dia, três na mesma música, porque não achou como pedir outra e
// concluiu que pagar de novo era o jeito. Abriu ticket depois.
//
// Este componente é um só pros três lugares de propósito: a lógica de sair
// pro funil é frágil (ver abaixo) e três cópias iam divergir na primeira
// mudança.

/**
 * Três coisas que este botão TEM que fazer, e cada uma custou um incidente:
 *
 * 1. `novaSessao()` — rotaciona a sessão. Sem isso a música nova reaproveita
 *    a linha da anterior no banco e SOBRESCREVE o presente já entregue.
 *
 * 2. `reset()` — limpa o store. Em 11/08 um comprador respondeu um quiz novo
 *    pra filha, chegou na revelação e viu a letra que tinha feito pra esposa
 *    três dias antes (a `letraFinal` mora em localStorage e não expira).
 *    Pagou R$ 37 por uma música que não existia.
 *
 * 3. O idioma da conta, não a rota fixa — em 15/08 uma compradora mexicana
 *    passou 20 minutos respondendo o quiz em português depois de clicar num
 *    botão que apontava pro /criar.
 */
export function ConviteOutraMusica({
  locale,
  origem,
  variante = "cartao",
}: {
  locale: "pt" | "es";
  /** Em que tela o convite foi clicado. É o que permite saber se ele vende. */
  origem: "editor" | "obrigado" | "dashboard";
  /** `cartao` tem moldura e texto de oferta; `discreto` é só o link. */
  variante?: "cartao" | "discreto";
}) {
  const reset = useQuizStore((s) => s.reset);
  const es = locale === "es";

  const sair = () => {
    trackEvent("recompra_click", { origem, locale });
    novaSessao();
    reset();
  };

  const destino = es ? "/es/criar" : "/criar";

  if (variante === "discreto") {
    return (
      <Link
        to={destino}
        onClick={sair}
        className="inline-flex items-center gap-2 text-[var(--tinta-suave)] underline underline-offset-4 hover:text-[var(--acento)]"
        style={{ fontSize: "var(--t-sm)" }}
      >
        <Plus className="h-4 w-4" />
        {es ? "Crear otra canción" : "Criar outra música"}
      </Link>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border border-[var(--tinta-fraca)]/40 p-6 text-center">
      <p className="font-semibold text-[var(--tinta)]" style={{ fontSize: "var(--t-lg)" }}>
        {es ? "¿Quién más merece una?" : "Quem mais merece uma?"}
      </p>
      {/*
        A promessa é a MESMA do funil, e é verdadeira: a letra sai de graça de
        novo, e só se paga se a pessoa quiser ouvir cantada. Nada de "desconto
        de recompra": desconto não existe no gateway hoje, e prometer preço
        que o checkout não pratica é o jeito mais rápido de virar reembolso.
      */}
      <p className="mx-auto mt-2 max-w-sm text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
        {es
          ? "La letra vuelve a ser gratis. Cuéntame de otra persona y ve cómo queda, sin pagar nada."
          : "A letra sai de graça de novo. Conte de outra pessoa e veja como fica, sem pagar nada."}
      </p>
      <Link
        to={destino}
        onClick={sair}
        className="cta mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full border-0 px-8"
      >
        <Plus className="h-4 w-4" />
        {es ? "Crear otra canción" : "Criar outra música"}
      </Link>
    </section>
  );
}
