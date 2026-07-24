import { useState } from "react";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Gift, Clock, Sparkles, Link2 } from "lucide-react";

// Blocos da página de venda, na ordem do playbook Movify §2.
// Cada bloco existe pra derrubar UMA objeção específica — não é decoração.

// ── 02 · PROVA IMEDIATA ── objeção: "isso é sério?"
// Sem cliente real ainda, então NADA de depoimento inventado (§3.5).
// Usamos fatos verificáveis do produto: são todos medidos por nós.
export function ProvaImediata() {
  const fatos = [
    { valor: "~6s", label: "pra letra ficar pronta" },
    { valor: "~2min", label: "pra música ser gravada" },
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
export function Dor() {
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
            precisa ser sobre a pessoa — e isso dá trabalho.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 05 · BENEFÍCIOS ── objeção: "o que eu ganho?"
// Benefício, não feature: o que muda pra ela, não o que o sistema faz.
export function Beneficios() {
  const itens = [
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
        "Não precisa escrever bem, nem cantar, nem ter ideia. Você conta a história do seu jeito — pode até falar em vez de digitar.",
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
          Por que uma música não se esquece
        </h2>
        <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {itens.map((b) => (
            <div key={b.titulo} className="flex gap-4">
              <b.icone className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acento)]" />
              <div>
                <h3
                  className="leading-snug"
                  style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}
                >
                  {b.titulo}
                </h3>
                <p
                  className="mt-1.5 text-[var(--tinta-suave)]"
                  style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
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

// ── 08 + 09 · ANCORAGEM E OFERTA ── objeções: "tá caro" / "e se der errado?"
// Ancoragem por comparação de custo, não por preço riscado falso.
export function Oferta({ preco = "37" }: { preco?: string }) {
  const inclui = [
    "A letra, feita da sua história (grátis, antes de decidir)",
    "Um trecho da música cantado, pra ouvir antes de pagar",
    "A música gravada e cantada, completa",
    "Duas versões — você escolhe a que preferir",
    "A página presente com link pra enviar",
    "O arquivo MP3 pra guardar e baixar",
    "QR Code pra imprimir e colar num presente físico",
  ];
  return (
    <section id="preco" style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-2xl px-6">
        {/* ancoragem: compara com o que ela gastaria de qualquer jeito */}
        <div className="text-center">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
          >
            Menos que o perfume que ela vai esquecer
          </h2>
          <div
            className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--tinta-fraca)]/20 text-center"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <div className="bg-[var(--papel)] px-4 py-5">
              <p className="text-[var(--tinta-suave)]">Um perfume comum</p>
              <p className="mt-1 font-semibold">R$ 200+</p>
              <p className="mt-1 text-[var(--tinta-fraca)]">acaba em 3 meses</p>
            </div>
            <div className="bg-[var(--papel)] px-4 py-5">
              <p className="text-[var(--tinta-suave)]">Uma música só dela</p>
              <p className="mt-1 font-semibold text-[var(--acento)]">R$ {preco}</p>
              <p className="mt-1 text-[var(--tinta-fraca)]">fica pra sempre</p>
            </div>
          </div>
        </div>

        {/* oferta: o que inclui, sem letra miúda */}
        <div className="mt-12 rounded-3xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-8">
          <p
            className="text-center text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            Você paga uma vez e leva
          </p>
          <ul className="mt-6 space-y-3">
            {inclui.map((i) => (
              <li key={i} className="flex gap-3" style={{ fontSize: "var(--t-base)" }}>
                <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--acento)]" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
          <p
            className="mt-7 border-t border-[var(--tinta-fraca)]/40 pt-6 text-center text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
          >
            <strong className="text-[var(--tinta)]">
              Você lê a letra inteira e ouve um trecho cantado antes de pagar.
            </strong>{" "}
            Se não for a cara da pessoa, você não paga nada — e ainda pode
            pedir pra reescrever de graça.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 10 · FAQ ── as objeções que sobraram (§3.5: objeção de venda, não dúvida técnica)
const PERGUNTAS = [
  {
    q: "E se a letra não ficar boa?",
    a: "Você lê antes de pagar qualquer coisa. Se não gostar, pode pedir pra reescrever de graça — e se ainda assim não for a cara da pessoa, é só não seguir. Você não paga nada pela letra.",
  },
  {
    q: "Quanto tempo demora?",
    a: "A letra fica pronta em segundos. A música gravada leva cerca de 2 minutos. Você não precisa esperar numa tela: se sair, avisamos no seu e-mail quando estiver pronta.",
  },
  {
    q: "A música é realmente só minha?",
    a: "Sim. Ela é composta e gravada do zero a partir da história que você contou. Não é catálogo, não é modelo pronto com o nome trocado. Ninguém mais recebe essa música.",
  },
  {
    q: "Preciso escrever bem pra ficar bom?",
    a: "Não. Quanto mais simples e verdadeiro, melhor. Um detalhe pequeno — o apelido, o prato de domingo, a mania dela — vale mais que texto bonito. E dá pra falar em vez de digitar, se preferir.",
  },
  {
    q: "Como eu entrego pra pessoa?",
    a: "Você recebe um link com uma página pronta: a música tocando, a letra acendendo no ritmo e o nome dela na capa. Manda no WhatsApp, ou imprime o QR Code e cola num presente. Quem entrega é você.",
  },
  {
    q: "E se ela não gostar?",
    a: "Você é quem conhece a pessoa. Por isso a letra vem antes: você lê e decide se aquilo é ela. É o mesmo cuidado de escolher um presente — só que aqui você confere antes.",
  },
];

export function FAQ() {
  // Primeira já aberta (§3.5).
  const [aberta, setAberta] = useState<number | null>(0);
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
          Perguntas que todo mundo faz
        </h2>
        <div className="mt-10 divide-y divide-[var(--tinta-fraca)]/35 border-y border-[var(--tinta-fraca)]/35">
          {PERGUNTAS.map((p, i) => {
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
