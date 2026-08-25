import { ArrowRight } from "lucide-react";
import { OFERTAS, TEXTO_OFERTA } from "@/lib/creditos";
import { trackEvent } from "@/lib/track";

// O QUADRO, no fim do editor.
//
// ── POR QUE AQUI, E NÃO NO PAINEL ────────────────────────────────
//
// Medido em 25/08: o painel teve 19 cliques em oferta e 47 pessoas viram o
// exemplo do quadro, no período inteiro. Isso não explica as 23 vendas do
// quadro: elas vieram do checkout e do bump, não da vitrine que a gente
// construiu. O painel tem 398 sessões contra 1.527 do editor.
//
// A loja estava no cômodo em que ninguém entra.
//
// ── POR QUE UMA SÓ, E DEPOIS DO QR CODE ──────────────────────────
//
// O editor já tem três blocos depois da tarefa (o convite de criar outra, o
// ajuste da música e o WhatsApp). Um quarto vira bagunça, então esta oferta
// SUBSTITUI o convite de criar outra em vez de somar.
//
// E é o quadro, não a música extra, por dois motivos: ele vende 4,6x mais
// (23 contra 5) e faz sentido no lugar onde a pessoa está — ela acabou de
// escolher a foto e ler a letra, e o quadro é exatamente isso no papel.
//
// Fica DEPOIS do QR Code de propósito. Ali a tarefa terminou: ela já tem o
// link pra mandar. Oferta antes disso disputa atenção com o que ela veio
// fazer, e o presente por montar vale mais que qualquer upsell.
//
// A "mais uma música" continua nos e-mails de entrega e de recompra, que é
// onde ela já está e onde não compete com nada.

export function OfertaQuadroEditor({ locale = "pt" }: { locale?: "pt" | "es" }) {
  // O quadro só existe na Perfect Pay BR: oferecer em espanhol mostraria preço
  // em real pra quem comprou em dólar e levaria a um checkout que não é dela.
  if (locale === "es") return null;

  const oferta = OFERTAS.find((o) => o.id === "quadro");
  if (!oferta) return null;
  const t = TEXTO_OFERTA.pt.quadro;

  return (
    <a
      href={oferta.checkout}
      onClick={() => trackEvent("credito_oferta_click", { oferta: "quadro", origem: "editor" })}
      className="mx-auto mt-12 flex max-w-md items-center gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4 transition-colors hover:border-[var(--acento)]/50"
    >
      {/* A moldura em miniatura. "Folha A4 com a letra" não desenha nada na
          cabeça de ninguém; a imagem resolve em meio segundo. */}
      <span
        className="shrink-0"
        style={{
          padding: 4,
          borderRadius: 2,
          background: "linear-gradient(150deg,#3b2c22,#241a14 45%,#443327)",
          boxShadow: "0 4px 10px rgba(0,0,0,.22)",
        }}
      >
        <span className="block" style={{ background: "#f6f2ea", padding: 2 }}>
          <img
            src="/img/quadro-exemplo.jpg"
            alt=""
            className="block"
            style={{ width: 38, height: 54, objectFit: "cover" }}
          />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-medium" style={{ fontSize: "var(--t-sm)" }}>
          {t.titulo}
        </span>
        <span
          className="mt-0.5 block text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)", lineHeight: 1.45 }}
        >
          Essa mesma letra e foto numa folha A4, pra imprimir e pendurar na parede.
        </span>
        <span
          className="mt-1 block font-semibold text-[var(--acento)]"
          style={{ fontSize: "var(--t-sm)" }}
        >
          R$ {oferta.precoBrl.toFixed(2).replace(".", ",")}
        </span>
      </span>

      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--acento)]" />
    </a>
  );
}
