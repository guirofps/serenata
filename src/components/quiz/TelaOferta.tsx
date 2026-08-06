import { useEffect, useState } from "react";
import { useQuizStore } from "@/lib/quiz-store";
import { irParaCheckout } from "@/lib/checkout";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { TEMA_CLARO } from "@/lib/marca";
import { Button } from "@/components/ui/button";
import {
  Music, Images, Sparkles, QrCode, Download, Infinity as InfinityIcon,
  Pencil, ShieldCheck, ChevronLeft, ChevronDown, Check,
} from "lucide-react";

// A OFERTA, entre a letra e o gateway.
//
// Versão 2 (05/08). A primeira era cinco bullets e um preço. Refeita no
// padrão das paywalls dos projetos anteriores (Mensagem Angelical, Numaya):
// lista longa e específica do entregável, ancoragem contra o que a
// alternativa custa de verdade, prova, FAQ que mata objeção, e botão sempre
// à mão.
//
// A prova é o vídeo de reações reais — a mesma peça da home, gente de
// verdade ouvindo música feita por nós. É a coisa mais forte que existe pra
// colocar logo antes do preço.

const ENTREGAVEIS = [
  {
    Icone: Music,
    titulo: "A música completa, cantada",
    detalhe: "Do começo ao fim, sem corte. E em duas gravações diferentes da mesma letra, pra você escolher a que emocionar mais.",
  },
  {
    Icone: Images,
    titulo: "A página presente, com as fotos de vocês",
    detalhe: "Até 12 fotos, que passam sozinhas nas viradas da música. É essa página que você manda, não um arquivo solto.",
  },
  {
    Icone: Sparkles,
    titulo: "O karaokê, palavra por palavra",
    detalhe: "Cada palavra acende no instante exato em que é cantada. Quem recebe acompanha e canta junto.",
  },
  {
    Icone: QrCode,
    titulo: "Link e QR Code pra presentear",
    detalhe: "Manda o link no WhatsApp, ou imprime o QR Code e cola numa caixa de bombom. O presente digital vira presente de mão.",
  },
  {
    Icone: Download,
    titulo: "O MP3 pra baixar e guardar",
    detalhe: "A música fica no seu celular, pra ouvir quando quiser, com ou sem internet.",
  },
  {
    Icone: Pencil,
    titulo: "Você monta o presente do seu jeito",
    detalhe: "Escolhe a cor da página, o efeito na tela e escreve uma frase sua. Dá pra mexer quantas vezes quiser.",
  },
  {
    Icone: InfinityIcon,
    titulo: "É seu pra sempre",
    detalhe: "A página não expira e o link não para de funcionar. Pagamento único, sem mensalidade.",
  },
];

const DUVIDAS = [
  {
    p: "É cobrança única ou assinatura?",
    r: "Única. Você paga uma vez e a música é sua pra sempre. Não tem mensalidade, não tem renovação automática, não guardamos seu cartão.",
  },
  {
    p: "Quanto tempo demora?",
    r: "Até 30 minutos, e normalmente menos de 5. Você recebe um e-mail assim que ficar pronta, e também consegue montar o presente na hora, na própria tela.",
  },
  {
    p: "A música vai ser igual à letra que eu li?",
    r: "Sim. É exatamente essa letra que vai ser cantada, palavra por palavra. Nada de trocar por outra coisa depois do pagamento.",
  },
  {
    p: "E se eu não gostar da gravação?",
    r: "Você recebe duas versões da mesma letra, com interpretações diferentes, e escolhe qual vai abrir quando a pessoa receber. Se as duas não servirem, responda o e-mail que a gente resolve.",
  },
  {
    p: "Como eu entrego o presente?",
    r: "Depois de montar, a gente te dá o link pronto e uma mensagem pra copiar e colar no WhatsApp. Quem entrega é você.",
  },
];

export function TelaOferta({ aoVoltar }: { aoVoltar: () => void }) {
  const respostas = useQuizStore((s) => s.respostas);
  const email = useQuizStore((s) => s.email);
  const letraFinal = useQuizStore((s) => s.letraFinal);
  const [indo, setIndo] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const nome = (respostas.nome as string)?.trim() || "quem você ama";

  // O degrau novo do funil: sem este evento, "viu a oferta" e "foi pro
  // checkout" ficariam colados e a tela não serviria de medida.
  useEffect(() => {
    trackEventOnce("oferta_vista", "v1");
  }, []);

  function pagar() {
    setIndo(true);
    trackEvent("checkout_click", { valor: 37 });
    irParaCheckout({ email: email || undefined });
  }

  return (
    <div className="space-y-8 pb-28">
      <button
        onClick={aoVoltar}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar pra minha música
      </button>

      {/* ── O QUE ESTÁ EM JOGO ──────────────────────────────── */}
      <div className="space-y-3 text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">
          falta um passo
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          A música de {nome} está gravada.
        </h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          Você ouviu um trecho. Ela continua, e termina do jeito que você
          escreveu.
        </p>
      </div>

      {/* O verso que a própria pessoa escolheu, devolvido a ela. Não é copy
          nossa: é a linha que ela aprovou minutos atrás. */}
      {letraFinal?.versoDestaque && (
        <blockquote className="mx-auto max-w-sm rounded-2xl border-l-2 border-primary/40 bg-secondary/40 py-4 pl-5 pr-4 text-left">
          <p className="whitespace-pre-line font-display text-lg leading-snug">
            {letraFinal.versoDestaque.split("\n").slice(0, 2).join("\n")}
          </p>
          <footer className="mt-2 text-xs text-muted-foreground">
            da letra que você escreveu pra {nome}
          </footer>
        </blockquote>
      )}

      {/* ── O QUE VEM JUNTO ─────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-center font-display text-xl font-semibold">
          O que você leva
        </h2>
        <ul className="space-y-4 rounded-2xl border bg-card p-5">
          {ENTREGAVEIS.map(({ Icone, titulo, detalhe }) => (
            <li key={titulo} className="flex gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icone className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{titulo}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {detalhe}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── PROVA, logo antes do preço ──────────────────────────
          O TEMA_CLARO vai aqui de propósito: o VitrineVideo usa as variáveis
          da marca (--noite, --tinta-suave) e a rota /criar não as declara —
          sem isto a moldura e a legenda saem sem cor. */}
      <div style={TEMA_CLARO}>
        <VitrineVideo caption="reações de quem ouviu uma música feita por nós" />
      </div>

      {/* ── PREÇO, ancorado no que a alternativa custa de verdade ── */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 px-5 py-6 text-center">
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
          Encomendar uma música original a um compositor custa a partir de
          R$ 300, e leva semanas.
        </p>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            <span className="line-through">R$ 97</span> hoje por
          </p>
          <p className="font-display text-5xl font-semibold tracking-tight">R$ 37</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pagamento único. Não é assinatura.
          </p>
        </div>

        <Button
          size="lg"
          className="cta mt-5 w-full rounded-full border-0"
          disabled={indo}
          onClick={pagar}
        >
          {indo ? "Abrindo o pagamento…" : `Quero a música de ${nome}`}
        </Button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          PIX ou cartão, processado pela Perfect Pay
        </p>
      </div>

      {/* ── OBJEÇÕES ────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-center font-display text-xl font-semibold">
          Antes de pagar
        </h2>
        <div className="divide-y rounded-2xl border bg-card">
          {DUVIDAS.map((d, i) => (
            <div key={d.p}>
              <button
                onClick={() => setAberta(aberta === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="text-sm font-medium">{d.p}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    aberta === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {aberta === i && (
                <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {d.r}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Qualquer dúvida, escreva pra{" "}
        <a href="mailto:contato@serenatagift.com" className="text-primary underline underline-offset-2">
          contato@serenatagift.com
        </a>
        . A gente responde de verdade.
      </p>

      {/* ── BARRA FIXA ──────────────────────────────────────────
          A página ficou longa de propósito (lista, prova, objeções). Sem a
          barra, quem rola até o fim das dúvidas fica sem botão à mão — que é
          exatamente o erro que a gente acabou de consertar na home. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] leading-none text-muted-foreground">pagamento único</p>
            <p className="font-display text-lg font-semibold leading-tight">R$ 37</p>
          </div>
          <Button
            className="cta h-12 flex-1 rounded-full border-0"
            disabled={indo}
            onClick={pagar}
          >
            {indo ? "Abrindo…" : (
              <>
                <Check className="h-4 w-4" /> Quero a música
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
