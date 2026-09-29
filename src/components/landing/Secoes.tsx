import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";
import { Check, ChevronDown, Gift, Clock, Sparkles, Link2, ArrowRight } from "lucide-react";

// Blocos da página de venda, na ordem do playbook Movify §2.
// Cada bloco existe pra derrubar UMA objeção específica — não é decoração.

// ── 02 · PROVA IMEDIATA ── objeção: "isso é sério?"
// Sem cliente real ainda, então NADA de depoimento inventado (§3.5).
// Usamos fatos verificáveis do produto: são todos medidos por nós.
// ── ELA NÃO SABIA QUE EXISTIA ESPANHOL ───────────────────────────
//
// Medido em 26/08: a abertura do quiz ES converte 17,1% contra 40,4% da
// portuguesa, e este componente é um dos motivos. Ele renderiza LOGO ABAIXO do
// botão, e as três linhas saíam em português na página espanhola:
//
//   ~6s  "pra letra ficar pronta"
//   ~1min "pra música ser gravada"
//   100% "feita da sua história"
//
// Numa tela cuja única função é responder "isso é sério?", texto em língua
// estrangeira responde que não. Não é falha de tradução, é a assinatura de
// site clonado — e o mexicano lê isso no segundo em que decide se confia.
export function ProvaImediata({ locale = "pt" }: { locale?: Locale }) {
  const fatos =
    locale === "en"
      ? [
          { valor: "~6s", label: "to get your lyrics" },
          { valor: "~1min", label: "to record the song" },
          { valor: "100%", label: "made from your story" },
        ]
      : locale === "es"
      ? [
          { valor: "~6s", label: "para tener la letra" },
          { valor: "~1min", label: "para grabar la canción" },
          { valor: "100%", label: "hecha de tu historia" },
        ]
      : [
          { valor: "~6s", label: "pra letra ficar pronta" },
          { valor: "~1min", label: "pra música ser gravada" },
          { valor: "100%", label: "feita da sua história" },
        ];
  return (
    <section className="border-y border-[var(--tinta-fraca)]/25 bg-[var(--papel-fundo)]">
      <div className="mx-auto grid max-w-4xl grid-cols-3 gap-4 px-6 py-8 sm:py-10">
        {fatos.map((f) => (
          <div key={f.label} className="text-center">
            <p
              className="tabular-nums leading-none"
              style={{
                fontFamily: FONTES.display,
                fontWeight: 600,
                fontSize: "var(--t-2xl)",
              }}
            >
              {f.valor}
            </p>
            <p
              className="mt-1.5 text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-xs)" }}
            >
              {f.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 03 · DOR ── objeção: "isso é pra mim?"
// Nomeada com as palavras que a pessoa usaria (§3.1).
// Inglês (Ballad Gift): a mesma dor, com o que se dá de presente nos EUA
// (vela, cartão de loja, gift card) no lugar do perfume e da caneca.
const DOR_EN = {
  titulo: "Every year, the same question: what do I get them?",
  p1: "They already have the candle. Flowers wilt in three days. The gift card ends up in a drawer.",
  p2: "In the end you grab something, hand it over a little awkwardly, and two months later nobody remembers what it was.",
  p3: "Not because you don't care. It's because a gift that moves someone has to be about them, and that takes work.",
};

export function Dor({ locale = "pt" }: { locale?: Locale }) {
  if (locale === "en") return <DorTexto t={DOR_EN} />;
  return (
    <section style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2
          className="text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
        >
          Todo ano a mesma dúvida: o que dar de presente?
        </h2>
        <div
          className="mx-auto mt-7 max-w-lg space-y-3 text-left text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
        >
          <p>
            Perfume ela já tem. Flor murcha em três dias. Caneca vira poeira
            na prateleira.
          </p>
          <p>
            No fim você compra qualquer coisa, entrega meio sem graça, e em
            dois meses ninguém lembra o que foi.
          </p>
          <p className="font-medium text-[var(--tinta)]">
            Não porque você não se importa. É porque presente que emociona
            precisa ser sobre a pessoa, e isso dá trabalho.
          </p>
        </div>
      </div>
    </section>
  );
}

function DorTexto({ t }: { t: typeof DOR_EN }) {
  return (
    <section style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2
          className="text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
        >
          {t.titulo}
        </h2>
        <div
          className="mx-auto mt-7 max-w-lg space-y-3 text-left text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
        >
          <p>{t.p1}</p>
          <p>{t.p2}</p>
          <p className="font-medium text-[var(--tinta)]">{t.p3}</p>
        </div>
      </div>
    </section>
  );
}

// ── 05 · BENEFÍCIOS ── objeção: "o que eu ganho?"
// Benefício, não feature: o que muda pra ela, não o que o sistema faz.
export function Beneficios({ locale = "pt" }: { locale?: Locale }) {
  const en = locale === "en";
  const itens = en
    ? [
        { icone: Sparkles, titulo: "They'll know it's theirs", texto: "The lyrics mention the nickname, the Sunday pancakes, the road trip you took. No way to mistake it for a song on the radio." },
        { icone: Gift, titulo: "There's no other like it", texto: "Every song is written and recorded from scratch, from your story. Nobody in the world has received this one." },
        { icone: Clock, titulo: "You don't need to know anything", texto: "No need to write well, sing or have ideas. Tell the story your way. You can even talk instead of typing." },
        { icone: Link2, titulo: "Easy to give", texto: "You get a link to a ready-made page. Text it to them and it opens with the song playing and the lyrics lighting up." },
      ]
    : [
    {
      icone: Sparkles,
      titulo: "Ela vai saber que é dela",
      texto:
        "A letra cita o apelido, a comida de domingo, a viagem que vocês fizeram. Não tem como confundir com música de rádio.",
    },
    {
      icone: Gift,
      titulo: "Não existe outra igual",
      texto:
        "Cada música é composta e gravada do zero, a partir da sua história. Ninguém no mundo recebeu essa.",
    },
    {
      icone: Clock,
      titulo: "Você não precisa saber nada",
      texto:
        "Não precisa escrever bem, nem cantar, nem ter ideia. Você conta a história do seu jeito. Pode até falar em vez de digitar.",
    },
    {
      icone: Link2,
      titulo: "Fácil de entregar",
      texto:
        "Você recebe um link com uma página pronta. Manda no WhatsApp e ela abre com a música tocando e a letra acendendo.",
    },
  ];
  return (
    <section
      className="bg-[var(--papel-fundo)]"
      style={{ paddingBlock: "var(--secao)" }}
    >
      <div className="mx-auto max-w-5xl px-6">
        <h2
          className="text-center text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
        >
          {en ? "Why a song is never forgotten" : "Por que uma música não se esquece"}
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:mt-12 sm:gap-x-10 sm:gap-y-9">
          {itens.map((b) => (
            <div key={b.titulo} className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <b.icone className="h-5 w-5 shrink-0 text-[var(--acento)] sm:mt-0.5" />
              <div>
                <h3
                  className="leading-snug"
                  style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-lg)" }}
                >
                  {b.titulo}
                </h3>
                <p
                  className="mt-1 text-[var(--tinta-suave)] sm:mt-1.5"
                  style={{ fontSize: "var(--t-xs)", lineHeight: 1.55 }}
                >
                  {b.texto}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 08 + 09 · A OFERTA ── objeções: "o que eu levo?" / "e se der errado?"
//
// ── POR QUE NÃO TEM PREÇO AQUI ────────────────────────────────────
//
// Saiu em 18/08 pro teste A/B de preço (`preco` em `experimentos.ts`). Um
// número na home é um número que o anúncio promete e que a tela de oferta
// tem que cumprir: com o preço variando por pessoa no fim do quiz, metade
// do tráfego leria 38 aqui e pagaria outra coisa lá — o mesmo problema do
// checkout internacional que cobrava 9,68 depois de anunciar 9.
//
// O que substitui o preço não é silêncio: é a razão de clicar que a gente
// já cumpre de verdade — a letra inteira e um trecho cantado ANTES de pagar
// qualquer coisa. Era a letra miúda do rodapé do cartão; virou o argumento.
//
// A ancoragem não sumiu do funil, mudou de lugar: ela vive na `TelaOferta`,
// colada no preço que aquela pessoa vai ver, que é onde ancoragem funciona.
export function Oferta({ locale = "pt" }: { locale?: Locale }) {
  const en = locale === "en";
  const inclui = en
    ? [
        "The lyrics, made from your story (free, before you decide)",
        "A sung preview of the song, to hear before you pay",
        "The full song, recorded and sung",
        "Two versions, you pick your favorite",
        "The gift page with a link to send",
        "The MP3 file to download and keep",
        "A QR code to print and put on a physical gift",
      ]
    : [
    "A letra, feita da sua história (grátis, antes de decidir)",
    "Um trecho da música cantado, pra ouvir antes de pagar",
    "A música gravada e cantada, completa",
    "Duas versões, você escolhe a que preferir",
    "A página presente com link pra enviar",
    "O arquivo MP3 pra guardar e baixar",
    "QR Code pra imprimir e colar num presente físico",
  ];
  return (
    <section id="preco" className="luz-ouro" style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
          >
            {en ? "The gift they'll forget, and the one they won't" : "O presente que vão esquecer, e o que não vão"}
          </h2>
          <p
            className="mx-auto mt-4 max-w-md text-balance text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
          >
            {en
              ? "A song made from your story doesn't end up at the back of a drawer. It stays on their phone, on the anniversary, on the hard days."
              : "Uma música feita da história de vocês não vai pro fundo da gaveta. Ela fica no celular, na data, no dia ruim."}
          </p>
        </div>

        {/* oferta: o que inclui, sem letra miúda */}
        <div className="cartao-rico mt-8 rounded-3xl p-5 sm:mt-12 sm:p-8">
          <p
            className="text-center text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            {en ? "Pay once and you get" : "Você paga uma vez e leva"}
          </p>
          <ul className="mt-5 space-y-2 sm:mt-6 sm:space-y-3">
            {inclui.map((i) => (
              <li key={i} className="flex gap-2.5 sm:gap-3" style={{ fontSize: "var(--t-sm)" }}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acento)] sm:mt-1" />
                <span>{i}</span>
              </li>
            ))}
          </ul>

          {/* No lugar do preço, a promessa que faz o clique valer a pena.
              É a mesma frase que estava no rodapé do cartão, promovida ao
              tamanho que ela merece: é ela que tira o risco de clicar. */}
          <div className="mt-8 border-t border-[var(--tinta-fraca)]/40 pt-7 text-center">
            <p
              className="mx-auto max-w-md text-balance"
              style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)", lineHeight: 1.3 }}
            >
              {en ? "You read the full lyrics and hear a sung preview" : "Você lê a letra inteira e ouve um trecho cantado"}{" "}
              <span className="texto-ouro">{en ? "before you pay" : "antes de pagar"}</span>.
            </p>
            <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
              {en
                ? "one-time payment · no subscription · the page is yours forever"
                : "pagamento único · sem mensalidade · a página fica sua pra sempre"}
            </p>

            <Link
              to="/criar"
              className="cta mt-6 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
            >
              {en ? "Create my song" : "Criar minha música"} <ArrowRight className="h-4 w-4" />
            </Link>
            <p
              className="mx-auto mt-5 max-w-md text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
            >
              {en
                ? "If it doesn't feel like them, you pay nothing, and you can still ask for a free rewrite."
                : "Se não for a cara da pessoa, não paga nada, e ainda pode pedir pra reescrever de graça."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 10 · FAQ ── as objeções que sobraram (§3.5: objeção de venda, não dúvida técnica)
const PERGUNTAS = [
  {
    q: "E se a letra não ficar boa?",
    a: "Você lê antes de pagar qualquer coisa. Se não gostar, pode pedir pra reescrever de graça. E se ainda assim não for a cara da pessoa, é só não seguir. Você não paga nada pela letra.",
  },
  {
    q: "Quanto tempo demora?",
    a: "A letra fica pronta em segundos. A música gravada leva cerca de 1 minuto. Você não precisa esperar numa tela: se sair, avisamos no seu e-mail quando estiver pronta.",
  },
  {
    q: "A música é realmente só minha?",
    a: "Sim. Ela é composta e gravada do zero a partir da história que você contou. Não é catálogo, não é modelo pronto com o nome trocado. Ninguém mais recebe essa música.",
  },
  {
    q: "Preciso escrever bem pra ficar bom?",
    a: "Não. Quanto mais simples e verdadeiro, melhor. Um detalhe pequeno (o apelido, o prato de domingo, a mania dela) vale mais que texto bonito. E dá pra falar em vez de digitar, se preferir.",
  },
  {
    q: "Como eu entrego pra pessoa?",
    a: "Você recebe um link com uma página pronta: a música tocando, a letra acendendo no ritmo e o nome dela na capa. Manda no WhatsApp, ou imprime o QR Code e cola num presente. Quem entrega é você.",
  },
  {
    q: "E se ela não gostar?",
    a: "Você é quem conhece a pessoa. Por isso a letra vem antes: você lê e decide se aquilo é ela. É o mesmo cuidado de escolher um presente, só que aqui você confere antes.",
  },
];

const PERGUNTAS_EN = [
  { q: "What if the lyrics aren't good?", a: "You read them before paying anything. If you don't like them, you can ask for a free rewrite. And if it still doesn't feel like them, just don't continue. You pay nothing for the lyrics." },
  { q: "How long does it take?", a: "The lyrics are ready in seconds. The recorded song takes about 1 minute. You don't have to wait on a screen: if you leave, we'll email you when it's ready." },
  { q: "Is the song really only mine?", a: "Yes. It's written and recorded from scratch from the story you told. It's not a catalog, not a template with the name swapped. Nobody else gets this song." },
  { q: "Do I need to be a good writer?", a: "No. The simpler and truer, the better. A small detail (the nickname, the Sunday breakfast, their funny habit) is worth more than pretty writing. You can also talk instead of typing." },
  { q: "How do I give it to them?", a: "You get a link to a ready-made page: the song playing, the lyrics lighting up on the beat and their name on the cover. Text it to them, or print the QR code and put it on a gift. You're the one who gives it." },
  { q: "What if they don't like it?", a: "You're the one who knows them. That's why the lyrics come first: you read them and decide if that's them. It's the same care as picking a gift, except here you check before you pay." },
];

export function FAQ({ locale = "pt" }: { locale?: Locale }) {
  // Primeira já aberta (§3.5).
  const [aberta, setAberta] = useState<number | null>(0);
  const lista = locale === "en" ? PERGUNTAS_EN : PERGUNTAS;
  return (
    <section
      id="faq"
      className="bg-[var(--papel-fundo)]"
      style={{ paddingBlock: "var(--secao)" }}
    >
      <div className="mx-auto max-w-2xl px-6">
        <h2
          className="text-center text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
        >
          {locale === "en" ? "Questions everyone asks" : "Perguntas que todo mundo faz"}
        </h2>
        <div className="mt-10 divide-y divide-[var(--tinta-fraca)]/35 border-y border-[var(--tinta-fraca)]/35">
          {lista.map((p, i) => {
            const on = aberta === i;
            return (
              <div key={p.q}>
                <button
                  onClick={() => setAberta(on ? null : i)}
                  aria-expanded={on}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-[var(--acento)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--acento)]"
                >
                  <span className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                    {p.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-[var(--tinta-suave)] transition-transform duration-300",
                      on && "rotate-180",
                    )}
                  />
                </button>
                {/* grid-rows truque: anima altura sem animar `height` (§4.1) */}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                    on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p
                      className="pb-5 pr-8 text-[var(--tinta-suave)]"
                      style={{ fontSize: "var(--t-sm)", lineHeight: 1.65 }}
                    >
                      {p.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
