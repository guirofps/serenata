import { Link } from "@tanstack/react-router";
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

export function OfertaQuadroEditor({
  locale = "pt",
  tokenEdicao,
}: {
  locale?: "pt" | "es";
  /**
   * O token do link do editor. É ele que prova a posse da música e permite
   * gerar o PIX aqui dentro, sem login.
   *
   * Sem ele o botão cai no checkout hospedado, como antes: melhor uma venda
   * a 11,4% de taxa que uma tela que não vende.
   */
  tokenEdicao?: string;
}) {
  // O quadro só existe em real: oferecer em espanhol mostraria preço em real
  // pra quem comprou em dólar e levaria a um checkout que não é dela.
  if (locale === "es") return null;

  const oferta = OFERTAS.find((o) => o.id === "quadro");
  if (!oferta) return null;
  const t = TEXTO_OFERTA.pt.quadro;

  // ── O CARTÃO LEVA À FOLHA, NÃO AO PAGAMENTO ──────────────────
  //
  // Medido em 02/09, agosto inteiro:
  //
  //   PIX da música          1.299 gerados → 742 pagos → 57,1%
  //   PIX do quadro avulso     139 gerados →  33 pagos → 23,7%
  //
  // Dois terços abrem a folha de pagamento e desistem. Não é preço: R$ 24,90
  // é o menor número da operação, e o pacote de R$ 28 converte 77,8%.
  //
  // É que daqui a pessoa nunca viu o quadro DELA. O que este cartão mostra é
  // uma miniatura de 38x54 pixels de um exemplo de outra pessoa, e "a letra
  // numa folha A4" não desenha nada na cabeça de ninguém. Pedir R$ 24,90 por
  // algo que ela não consegue imaginar é o que produz aquele 23,7%.
  //
  // E a tela que resolve isso JÁ EXISTE: `/quadro/<token_edicao>` monta a
  // folha real, com a letra e a foto dela, aberta por token e sem login, com
  // a compra travando só a impressão. Ela era alcançável pelo painel, onde
  // 84% dos compradores nunca entram — e o e-mail manda todo mundo pro
  // editor, que é esta tela aqui.
  //
  // Custo aceito: quem já decidiu ganha um toque a mais. Vale, porque na tela
  // seguinte o botão está do lado do produto montado, em vez de um QR Code
  // pedindo dinheiro por uma descrição.
  const comPrevia = Boolean(tokenEdicao);

  const classe =
    "mx-auto mt-12 flex max-w-md items-center gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4 transition-colors hover:border-[var(--acento)]/50";

  const aoClicar = () =>
    trackEvent("credito_oferta_click", {
      oferta: "quadro",
      origem: "editor",
      via: comPrevia ? "previa" : "checkout",
    });

  const conteudo = (
    <>
      {/* A moldura em miniatura. "Folha A4 com a letra" não desenha nada na
          cabeça de ninguém; a imagem resolve em meio segundo. Ela continua
          sendo um EXEMPLO: a folha da pessoa é o que vem na tela seguinte. */}
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
          {comPrevia
            ? "Veja como essa mesma letra fica numa folha A4, com a foto de vocês e o QR Code que toca a música."
            : "Essa mesma letra e foto numa folha A4, pra imprimir e pendurar na parede."}
        </span>
        <span
          className="mt-1 block font-semibold text-[var(--acento)]"
          style={{ fontSize: "var(--t-sm)" }}
        >
          R$ {oferta.precoBrl.toFixed(2).replace(".", ",")}
        </span>
      </span>

      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--acento)]" />
    </>
  );

  // Rota interna vira `Link` (sem recarregar a página). Sem token não dá pra
  // montar a folha dela: aí sim vai pro checkout hospedado, que é outro
  // domínio e continua `<a>`.
  return comPrevia ? (
    <Link
      to="/quadro/$tokenEdicao"
      params={{ tokenEdicao: tokenEdicao as string }}
      // O `de` faz o botão de voltar de lá apontar pra CÁ. Sem ele o padrão é
      // o `/dashboard`, que exige login: quem chega por token não tem conta, e
      // o caminho de volta viraria porta fechada no meio da compra.
      search={{ de: "editor" }}
      onClick={aoClicar}
      className={classe}
    >
      {conteudo}
    </Link>
  ) : (
    <a href={oferta.checkout} onClick={aoClicar} className={classe}>
      {conteudo}
    </a>
  );
}
