import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { criarPix, type ResultadoPix } from "@/lib/criar-pix";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { PixPagamento } from "@/components/quiz/PixPagamento";
import { Button } from "@/components/ui/button";

// O CHECKOUT DE PIX NA NOSSA PRÓPRIA PÁGINA.
//
// Este arquivo só CRIA a cobrança. Quem desenha o QR, copia o código e espera
// o dinheiro é o `PixPagamento`, compartilhado com a rota `/pix/$referencia`.
//
// ── O QUE ELE EXISTE PRA CONSERTAR ───────────────────────────────
//
// Medido em 27/08: 70% de quem clica em comprar NÃO gera pedido nenhum, uns
// 250 por dia. Parte disso é a troca de domínio: a pessoa sai de
// serenatagift.com, cai num checkout de outra marca, e desiste.
//
// Aqui ela não sai. O QR aparece na mesma tela onde ela ouviu a música.
//
// ── E A OUTRA METADE DO GANHO É TAXA ─────────────────────────────
//
// Woovi cobra R$ 0,50; a Perfect Pay cobrou 11,39% nas vendas medidas (R$
// 4,63 de média). Sobre as ~55 vendas de PIX por dia, são uns R$ 5.500 por
// mês, e isso não depende de a conversão melhorar um ponto sequer.

type Fase =
  | { t: "criando" }
  | { t: "pronto"; dados: Extract<ResultadoPix, { ok: true }> }
  | { t: "erro"; motivo: string };

export function PixTransparente({
  valorTexto,
  aoDesistir,
}: {
  /** O preço como a pessoa viu na oferta, só pra confirmar na tela. */
  valorTexto: string;
  /** Volta pro checkout hospedado: é por onde sai o cartão. */
  aoDesistir: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ t: "criando" });
  const jaPediu = useRef(false);

  // CRIA A COBRANÇA, uma vez só.
  useEffect(() => {
    if (jaPediu.current) return;
    jaPediu.current = true;
    (async () => {
      try {
        const r = await criarPix({ data: { sessionId: getOrCreateSessionId() } });
        if (!r.ok) {
          trackEvent("pix_transparente_falhou", { erro: r.erro });
          setFase({ t: "erro", motivo: r.erro });
          return;
        }
        trackEventOnce("pix_transparente_gerado", "v1", { valor: r.valorCentavos });
        setFase({ t: "pronto", dados: r });
      } catch (err) {
        console.error("[pix] criar falhou:", err);
        trackEvent("pix_transparente_falhou", { erro: "excecao" });
        setFase({ t: "erro", motivo: "excecao" });
      }
    })();
  }, []);

  if (fase.t === "criando") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Gerando o seu PIX...</p>
      </div>
    );
  }

  if (fase.t === "erro") {
    // NUNCA deixa a pessoa sem caminho. Ela quer pagar; se o nosso PIX
    // falhou, o checkout de sempre continua ali.
    return (
      <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-4 text-left">
        <p className="text-sm font-semibold text-amber-900">
          Não consegui gerar o PIX agora
        </p>
        <p className="text-xs leading-snug text-amber-800/80">
          Nada foi cobrado. Dá pra concluir pelo nosso checkout normal, que aceita
          PIX e cartão.
        </p>
        <Button size="lg" className="w-full" onClick={aoDesistir}>
          Continuar pelo checkout
        </Button>
      </div>
    );
  }

  return (
    <PixPagamento
      copiaECola={fase.dados.copiaECola}
      valorTexto={valorTexto}
      referencia={fase.dados.referencia}
      // A tela de obrigado é a mesma de quem pagou pelo checkout antigo: um só
      // lugar decide o que acontece depois da compra.
      aoPagar={() => {
        window.location.href = "/obrigado";
      }}
      aoEscolherCartao={aoDesistir}
    />
  );
}
