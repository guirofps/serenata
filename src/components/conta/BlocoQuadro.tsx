import { Frame, ArrowRight, Printer, Check } from "lucide-react";
import { OFERTAS, TEXTO_OFERTA } from "@/lib/creditos";
import { trackEvent } from "@/lib/track";

// A ABA DO QUADRO.
//
// Ele saiu da lista de ofertas e ganhou lugar próprio por um motivo de
// produto, não de arrumação: os outros dois vendem CRÉDITO, que é a mesma
// coisa em quantidades diferentes. O quadro é outra categoria, sai da tela e
// vai pra parede, e misturado na mesma lista ele lia como "a terceira opção
// de música", que é o que ele não é.
//
// E ele é o único dos três que precisa ser VISTO. "Folha A4 com a letra" não
// desenha nada na cabeça de ninguém; a foto do quadro pronto vende sozinha.
// Por isso a imagem vem antes do texto, e não como enfeite ao lado.

const TXT = {
  pt: {
    jaTem1: "Você tem 1 quadro pra montar",
    jaTem: (n: number) => `Você tem ${n} quadros pra montar`,
    jaTemSub:
      "Escolha de qual música ele é, deixe do seu jeito e salve o PDF pra imprimir.",
    montar: "Montar meu quadro",
    comoFunciona: "Como funciona",
    passos: [
      "Você escolhe de qual das suas músicas é o quadro",
      "Escolhe a cor, o fundo e a mensagem que vai nele",
      "Salva em PDF, manda imprimir e põe numa moldura de A4",
    ],
    verExemplo: "Ver o quadro inteiro",
    legenda: "É isso que fica na parede dela.",
  },
  es: {
    jaTem1: "Tienes 1 cuadro para armar",
    jaTem: (n: number) => `Tienes ${n} cuadros para armar`,
    jaTemSub: "Elige de cuál canción es, déjalo a tu gusto y guarda el PDF para imprimir.",
    montar: "Armar mi cuadro",
    comoFunciona: "Cómo funciona",
    passos: [
      "Eliges de cuál de tus canciones es el cuadro",
      "Eliges el color, el fondo y el mensaje que va en él",
      "Guardas el PDF, lo mandas a imprimir y lo pones en un marco A4",
    ],
    verExemplo: "Ver el cuadro completo",
    legenda: "Esto es lo que queda en su pared.",
  },
};

export function BlocoQuadro({
  paraMontar,
  locale,
  email,
}: {
  /** Quadros comprados e ainda não amarrados a uma música. */
  paraMontar: number;
  locale: "pt" | "es";
  email: string;
}) {
  const t = TXT[locale] ?? TXT.pt;
  const o = (TEXTO_OFERTA[locale] ?? TEXTO_OFERTA.pt).quadro;
  const oferta = OFERTAS.find((x) => x.id === "quadro");

  return (
    <section className="mt-6">
      {/* ── O PREVIEW, NA MOLDURA ──────────────────────────────
          O mesmo trabalho que o celular faz no preview da página presente:
          mostrar o produto no lugar onde ele vai viver. A folha solta é um
          arquivo; dentro da moldura é um quadro, e a diferença entre as duas
          coisas é justamente o que a pessoa está comprando.

          A moldura é CSS, não foto: madeira escura, passe-partout branco e
          sombra. Assim ela acompanha o tamanho da tela e não pesa nada. */}
      <a
        href="/quadro/exemplo?de=painel"
        onClick={() => trackEvent("quadro_exemplo_click", { origem: "aba" })}
        className="block"
      >
        <div
          className="mx-auto w-full max-w-[260px]"
          style={{
            padding: "5%",
            borderRadius: 3,
            background: "linear-gradient(150deg,#3b2c22,#241a14 45%,#443327)",
            boxShadow: "0 22px 45px rgba(0,0,0,.30), 0 3px 8px rgba(0,0,0,.20)",
          }}
        >
          {/* O passe-partout. É ele que faz parecer emoldurado de verdade, e
              não impresso e colado num papelão. */}
          <div style={{ background: "#f6f2ea", padding: "5%" }}>
            <img
              src="/img/quadro-exemplo.jpg"
              alt={t.legenda}
              className="block w-full"
              loading="lazy"
            />
          </div>
        </div>
        <p
          className="mt-3 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-sm)" }}
        >
          {t.legenda}
        </p>
        <p
          className="mt-1 text-center text-[var(--tinta-suave)] underline underline-offset-2"
          style={{ fontSize: "var(--t-xs)" }}
        >
          {t.verExemplo}
        </p>
      </a>

      {/* ── JÁ COMPROU: a ação é montar, não comprar de novo ────── */}
      {paraMontar > 0 ? (
        <div className="mt-4 rounded-[var(--raio-lg)] border-2 border-[var(--acento)]/50 bg-[var(--acento)]/[0.07] p-5">
          <p style={{ fontFamily: "var(--fonte-display)", fontSize: "var(--t-lg)", fontWeight: 500 }}>
            {paraMontar === 1 ? t.jaTem1 : t.jaTem(paraMontar)}
          </p>
          <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
            {t.jaTemSub}
          </p>
          <a
            href="/meu-quadro"
            onClick={() => trackEvent("quadro_montar_click", { quantos: paraMontar })}
            className="cta mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium"
          >
            <Printer className="h-4 w-4" /> {t.montar}
          </a>
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--acento)]/12 text-[var(--acento)]">
              <Frame className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                {o.titulo}
              </p>
              <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}>
                {o.sub}
              </p>
            </div>
          </div>

          <p className="mt-4 font-medium" style={{ fontSize: "var(--t-sm)" }}>
            {t.comoFunciona}
          </p>
          <ol className="mt-2 space-y-2">
            {t.passos.map((passo, i) => (
              <li key={passo} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--acento)]/12 font-semibold text-[var(--acento)]"
                  style={{ fontSize: "var(--t-xs)" }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "var(--t-sm)", lineHeight: 1.45 }}>{passo}</span>
              </li>
            ))}
          </ol>

          {oferta && (
            <>
              <p className="mt-5 text-center font-semibold text-[var(--acento)]" style={{ fontSize: "var(--t-2xl)" }}>
                R$ {oferta.precoBrl.toFixed(2).replace(".", ",")}
              </p>
              <a
                href={`${oferta.checkout}?email=${encodeURIComponent(email)}`}
                onClick={() => trackEvent("credito_oferta_click", { oferta: "quadro", origem: "aba" })}
                className="cta mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium"
              >
                {o.cta} <ArrowRight className="h-4 w-4" />
              </a>
              <p
                className="mt-3 flex items-center justify-center gap-1.5 text-center text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-xs)" }}
              >
                <Check className="h-3.5 w-3.5" /> {locale === "es" ? "Pago único" : "Pagamento único"}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
