import { useEffect, useState } from "react";
import { useQuizStore } from "@/lib/quiz-store";
import { irParaCheckout } from "@/lib/checkout";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { TEMA_CLARO } from "@/lib/marca";
import { type Locale, MOEDA } from "@/lib/i18n";
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

const ENTREGAVEIS_PT = [
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

const DUVIDAS_PT = [
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

const ENTREGAVEIS_ES = [
  { Icone: Music, titulo: "La canción completa, cantada",
    detalhe: "De principio a fin, sin cortes. Y en dos grabaciones distintas de la misma letra, para que elijas la que más te emocione." },
  { Icone: Images, titulo: "La página regalo, con las fotos de ustedes",
    detalhe: "Hasta 12 fotos, que pasan solas en los cambios de la canción. Es esa página la que mandas, no un archivo suelto." },
  { Icone: Sparkles, titulo: "El karaoke, palabra por palabra",
    detalhe: "Cada palabra se enciende justo cuando se canta. Quien la recibe la sigue y canta contigo." },
  { Icone: QrCode, titulo: "Link y código QR para regalar",
    detalhe: "Mandas el link por WhatsApp, o imprimes el código QR y lo pegas en una caja de chocolates. El regalo digital se vuelve regalo de mano." },
  { Icone: Download, titulo: "El MP3 para descargar y guardar",
    detalhe: "La canción queda en tu celular, para escucharla cuando quieras, con o sin internet." },
  { Icone: Pencil, titulo: "Armas el regalo a tu manera",
    detalhe: "Eliges el color de la página, el efecto en pantalla y escribes una frase tuya. Puedes cambiarlo las veces que quieras." },
  { Icone: InfinityIcon, titulo: "Es tuya para siempre",
    detalhe: "La página no expira y el link no deja de funcionar. Pago único, sin mensualidad." },
];

const DUVIDAS_ES = [
  { p: "¿Es un pago único o una suscripción?",
    r: "Único. Pagas una vez y la canción es tuya para siempre. No hay mensualidad, no hay renovación automática, no guardamos tu tarjeta." },
  { p: "¿Cuánto tarda?",
    r: "Hasta 30 minutos, y normalmente menos de 5. Te avisamos por correo en cuanto esté lista, y también puedes armar el regalo ahí mismo, en la pantalla." },
  { p: "¿La canción va a ser igual a la letra que leí?",
    r: "Sí. Es exactamente esa letra la que se va a cantar, palabra por palabra. Nada de cambiarla por otra cosa después del pago." },
  { p: "¿Y si no me gusta la grabación?",
    r: "Recibes dos versiones de la misma letra, con interpretaciones distintas, y eliges cuál se abre cuando la persona la reciba. Si ninguna te sirve, responde el correo y lo resolvemos." },
  { p: "¿Cómo entrego el regalo?",
    r: "Después de armarlo te damos el link listo y un mensaje para copiar y pegar en WhatsApp. Quien lo entrega eres tú." },
];

const COPY = {
  pt: {
    entregaveis: ENTREGAVEIS_PT, duvidas: DUVIDAS_PT,
    voltar: "Voltar pra minha música",
    eyebrow: "falta um passo",
    titulo: (n: string) => `A música de ${n} está gravada.`,
    sub: "Você ouviu um trecho. Ela continua, e termina do jeito que você escreveu.",
    daLetra: (n: string) => `da letra que você escreveu pra ${n}`,
    oQueLeva: "O que você leva",
    provaLegenda: "reações de quem ouviu uma música feita por nós",
    provaSelo: "reações reais",
    ancora: "Encomendar uma música original a um compositor custa a partir de R$ 300, e leva semanas.",
    hojePor: "hoje por", pagamentoUnico: "Pagamento único. Não é assinatura.",
    // Só o ES precisa: o BR cobra na moeda de quem compra.
    conversao: "",
    cta: (n: string) => `Quero a música de ${n}`, ctaCurto: "Quero a música",
    abrindo: "Abrindo o pagamento…", abrindoCurto: "Abrindo…",
    gateway: "PIX ou cartão, processado pela Perfect Pay",
    antesDePagar: "Antes de pagar",
    suporte: "Qualquer dúvida, escreva pra",
    respondemos: ". A gente responde de verdade.",
    unicoLabel: "pagamento único",
  },
  es: {
    entregaveis: ENTREGAVEIS_ES, duvidas: DUVIDAS_ES,
    voltar: "Regresar a mi canción",
    eyebrow: "falta un paso",
    titulo: (n: string) => `La canción de ${n} ya está grabada.`,
    sub: "Escuchaste un pedazo. Sigue, y termina justo como tú la escribiste.",
    daLetra: (n: string) => `de la letra que escribiste para ${n}`,
    oQueLeva: "Lo que te llevas",
    provaLegenda: "reacciones de quien escuchó una canción hecha por nosotros",
    provaSelo: "reacciones reales",
    // Ancoragem MEXICANA: mariachi a domicílio é o presente com que a nossa
    // oferta compete de verdade lá, e o preço dele é público e verificável.
    ancora: "Contratar mariachi para una serenata cuesta desde $1,500 MXN, y solo se escucha una noche.",
    hojePor: "hoy por", pagamentoUnico: "Pago único. No es suscripción.",
    // O checkout da Perfect Pay converte pra moeda local — confirmado pelo
    // dono. Dizer isso ANTES do pulo importa: o preço em dólar numa tela em
    // espanhol levanta a dúvida "vou pagar câmbio?" bem no clique.
    conversao: "Verás el precio en la moneda de tu país al pagar.",
    cta: (n: string) => `Quiero la canción de ${n}`, ctaCurto: "Quiero la canción",
    abrindo: "Abriendo el pago…", abrindoCurto: "Abriendo…",
    gateway: "Tarjeta, procesado por Perfect Pay",
    antesDePagar: "Antes de pagar",
    suporte: "Cualquier duda, escríbenos a",
    respondemos: ". Te respondemos de verdad.",
    unicoLabel: "pago único",
  },
} as const;

export function TelaOferta({ aoVoltar, locale = "pt" }: { aoVoltar: () => void; locale?: Locale }) {
  const C = COPY[locale] ?? COPY.pt;
  const preco = MOEDA[locale] ?? MOEDA.pt;
  const respostas = useQuizStore((s) => s.respostas);
  const email = useQuizStore((s) => s.email);
  const letraFinal = useQuizStore((s) => s.letraFinal);
  const [indo, setIndo] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const nome = (respostas.nome as string)?.trim() || (locale === "es" ? "quien tú quieres" : "quem você ama");

  // O degrau novo do funil: sem este evento, "viu a oferta" e "foi pro
  // checkout" ficariam colados e a tela não serviria de medida.
  useEffect(() => {
    trackEventOnce("oferta_vista", "v1");
  }, []);

  function pagar() {
    setIndo(true);
    trackEvent("checkout_click", { valor: preco.valor, locale });
    irParaCheckout({ email: email || undefined, locale });
  }

  return (
    <div className="space-y-8 pb-28">
      <button
        onClick={aoVoltar}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {C.voltar}
      </button>

      {/* ── O QUE ESTÁ EM JOGO ──────────────────────────────── */}
      <div className="space-y-3 text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">
          {C.eyebrow}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          {C.titulo(nome)}
        </h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          {C.sub}
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
            {C.daLetra(nome)}
          </footer>
        </blockquote>
      )}

      {/* ── O QUE VEM JUNTO ─────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-center font-display text-xl font-semibold">
          {C.oQueLeva}
        </h2>
        <ul className="space-y-4 rounded-2xl border bg-card p-5">
          {C.entregaveis.map(({ Icone, titulo, detalhe }) => (
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
        <VitrineVideo caption={C.provaLegenda} selo={C.provaSelo} />
      </div>

      {/* ── PREÇO, ancorado no que a alternativa custa de verdade ── */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 px-5 py-6 text-center">
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
          {C.ancora}
        </p>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            <span className="line-through">{preco.ancora}</span> {C.hojePor}
          </p>
          <p className="font-display text-5xl font-semibold tracking-tight">{preco.texto}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {C.pagamentoUnico}
          </p>
          {C.conversao && (
            <p className="mx-auto mt-2 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              {C.conversao}
            </p>
          )}
        </div>

        <Button
          size="lg"
          className="cta mt-5 w-full rounded-full border-0"
          disabled={indo}
          onClick={pagar}
        >
          {indo ? C.abrindo : C.cta(nome)}
        </Button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {C.gateway}
        </p>
      </div>

      {/* ── OBJEÇÕES ────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-center font-display text-xl font-semibold">
          {C.antesDePagar}
        </h2>
        <div className="divide-y rounded-2xl border bg-card">
          {C.duvidas.map((d, i) => (
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
        {C.suporte}{" "}
        <a href="mailto:contato@serenatagift.com" className="text-primary underline underline-offset-2">
          contato@serenatagift.com
        </a>
        {C.respondemos}
      </p>

      {/* ── BARRA FIXA ──────────────────────────────────────────
          A página ficou longa de propósito (lista, prova, objeções). Sem a
          barra, quem rola até o fim das dúvidas fica sem botão à mão — que é
          exatamente o erro que a gente acabou de consertar na home. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] leading-none text-muted-foreground">{C.unicoLabel}</p>
            <p className="font-display text-lg font-semibold leading-tight">{preco.texto}</p>
          </div>
          <Button
            className="cta h-12 flex-1 rounded-full border-0"
            disabled={indo}
            onClick={pagar}
          >
            {indo ? C.abrindoCurto : (
              <>
                <Check className="h-4 w-4" /> {C.ctaCurto}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
