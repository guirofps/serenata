import { useEffect, useState } from "react";
import { useQuizStore } from "@/lib/quiz-store";
import { irParaCheckout } from "@/lib/checkout";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Music, Images, Sparkles, QrCode, Download, ShieldCheck, ChevronLeft } from "lucide-react";

// A OFERTA, entre a letra e o gateway.
//
// Até aqui o preço só existia como letra miúda de 12px embaixo do botão do
// reveal, e 93,5% de quem recebia a letra clicava em comprar — número alto
// demais pra ser intenção de compra. Era clique de curiosidade: a pessoa não
// sabia que ia cair num formulário de pagamento, e 86% sumiam lá.
//
// Esta tela não serve pra "avisar do custo". Serve pra VENDER: é a última
// superfície nossa antes de uma página da Perfect Pay que é só formulário.
//
// Tudo é escrito com o nome do homenageado de propósito. "A música de Rosa"
// compromete de um jeito que "sua música" não compromete.

const ITENS = [
  { Icone: Music, titulo: "A música completa, cantada", detalhe: "Em 2 versões, pra você escolher a que emocionar mais." },
  { Icone: Images, titulo: "A página presente", detalhe: "Com as fotos de vocês passando durante a música." },
  { Icone: Sparkles, titulo: "O karaokê", detalhe: "A letra acende palavra por palavra, no ritmo em que é cantada." },
  { Icone: QrCode, titulo: "Link e QR Code", detalhe: "Manda no WhatsApp, ou imprime o QR e cola numa caixa de bombom." },
  { Icone: Download, titulo: "O MP3 pra baixar", detalhe: "A música fica com você, pra guardar e ouvir quando quiser." },
];

export function TelaOferta({ aoVoltar }: { aoVoltar: () => void }) {
  const respostas = useQuizStore((s) => s.respostas);
  const email = useQuizStore((s) => s.email);
  const [indo, setIndo] = useState(false);
  const nome = (respostas.nome as string)?.trim() || "quem você ama";

  // O degrau novo do funil. Sem este evento, "viu a oferta" e "foi pro
  // checkout" continuariam colados e a tela não serviria de medida.
  useEffect(() => {
    trackEventOnce("oferta_vista", "v1");
  }, []);

  return (
    <div className="space-y-6">
      <button
        onClick={aoVoltar}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar pra letra
      </button>

      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          A música de {nome}, completa
        </h1>
        <p className="text-muted-foreground">
          A letra já é sua. Isto aqui é pra ela ganhar voz.
        </p>
      </div>

      <ul className="space-y-3 rounded-2xl border bg-card p-5">
        {ITENS.map(({ Icone, titulo, detalhe }) => (
          <li key={titulo} className="flex gap-3">
            <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{titulo}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{detalhe}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Preço ancorado igual à home: R$ 97 é o que custa uma música feita à
          mão por um compositor, e é a comparação honesta. */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 px-5 py-5 text-center">
        <p className="text-xs text-muted-foreground">
          <span className="line-through">R$ 97</span> hoje por
        </p>
        <p className="font-display text-4xl font-semibold tracking-tight">R$ 37</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pagamento único. Não é assinatura.
        </p>
      </div>

      <div>
        <Button
          size="lg"
          className="cta w-full rounded-full border-0"
          disabled={indo}
          onClick={() => {
            setIndo(true);
            trackEvent("checkout_click", { valor: 37 });
            irParaCheckout({ email: email || undefined });
          }}
        >
          {indo ? "Abrindo o pagamento…" : `Quero a música de ${nome}`}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Pagamento por PIX ou cartão, processado pela Perfect Pay.
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Pronta em até 30 minutos, normalmente em menos de 5.
        </p>
      </div>
    </div>
  );
}
