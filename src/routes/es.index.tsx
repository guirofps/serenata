import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { BarraCTA } from "@/components/landing/BarraCTA";
import { ExemplosEs } from "@/components/landing/ExemplosEs";
import { ProvaSocial } from "@/components/landing/ProvaSocial";
import { PresenteNoTopo } from "@/components/landing/PresenteNoTopo";
import { ProQuemE } from "@/components/landing/ProQuemE";
import { Entregavel } from "@/components/landing/Entregavel";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { OfereceIdioma, lembrarIdioma } from "@/components/OfereceIdioma";
import { MOEDA } from "@/lib/i18n";
import {
  ArrowRight, Menu, X, Check, ChevronDown, Sparkles, Gift, Clock, Link2,
} from "lucide-react";

// A HOME EM ESPANHOL.
//
// DÍVIDA CONHECIDA, registrada de propósito: esta página é IRMÃ da portuguesa,
// não a mesma parametrizada. Melhoria feita numa não aparece na outra, e a
// gente mexe no funil quase todo dia.
//
// Foi escolha, não descuido. Parametrizar as 1.700 linhas dos 8 componentes da
// home brasileira, de madrugada, sem ninguém pra revisar, numa página que está
// vendendo agora, é o tipo de risco que não se corre por conveniência. Quando
// o teste no México provar que vale, o certo é fundir as duas — e aí com calma
// e com dados.
//
// O que MUDA de verdade em relação à portuguesa, e não é tradução:
//   - Sem a seção de Dia dos Pais: no México é junho, não agosto.
//   - A ancoragem é o MARIACHI (o presente com que a gente compete lá),
//     não "um presente comum de R$ 200".
//   - Os exemplos tocáveis são mariachi, banda e balada.

export const Route = createFileRoute("/es/")({
  component: HomeEs,
  head: () => ({
    meta: [
      { title: "Una canción hecha de la historia de quien tú quieres | Serenata" },
      {
        name: "description",
        content:
          "Cuenta su historia y recibe la letra al instante, gratis. Después la canción cantada y una página regalo con link y código QR para enviarla.",
      },
      { property: "og:title", content: "Una canción hecha de su historia" },
      { property: "og:locale", content: "es_MX" },
    ],
  }),
});

const PASOS = [
  {
    n: "01",
    titulo: "Cuenta la historia",
    texto:
      "Quién es la persona, qué han vivido, ese detalle que solo ustedes dos saben. Puedes escribirlo o decirlo hablando.",
  },
  {
    n: "02",
    titulo: "Lee la letra al instante",
    texto:
      "En segundos y gratis. Hecha con los detalles que contaste: el apodo, la comida, el lugar. No es una frase prefabricada.",
  },
  {
    n: "03",
    titulo: "Envía el regalo",
    texto:
      "La canción grabada se vuelve una página con la letra encendiéndose al ritmo. Un link solo tuyo, listo para mandar.",
  },
];

const BENEFICIOS = [
  {
    icone: Sparkles,
    titulo: "Va a saber que es suya",
    texto:
      "La letra menciona el apodo, la comida del domingo, el viaje que hicieron. No hay manera de confundirla con una canción de la radio.",
  },
  {
    icone: Gift,
    titulo: "No existe otra igual",
    texto:
      "Cada canción se compone y se graba desde cero, a partir de tu historia. Nadie en el mundo recibió esta.",
  },
  {
    icone: Clock,
    titulo: "No necesitas saber nada",
    texto:
      "No necesitas escribir bonito, ni cantar, ni tener idea. Cuentas la historia a tu manera. Hasta puedes hablar en vez de escribir.",
  },
  {
    icone: Link2,
    titulo: "Fácil de entregar",
    texto:
      "Recibes un link con una página lista. La mandas por WhatsApp y se abre con la canción sonando y la letra encendiéndose.",
  },
];

const INCLUYE = [
  "La letra, hecha de tu historia (gratis, antes de decidir)",
  "Un pedazo de la canción cantado, para escucharlo antes de pagar",
  "La canción grabada y cantada, completa",
  "Dos versiones, eliges la que prefieras",
  "La página regalo con link para enviar",
  "El archivo MP3 para guardar y descargar",
  "Código QR para imprimir y pegar en un regalo físico",
];

const PREGUNTAS = [
  {
    q: "¿Y si la letra no queda bien?",
    a: "La lees antes de pagar nada. Si no te gusta, puedes pedir que se reescriba gratis. Y si aun así no es la cara de la persona, simplemente no sigues. No pagas nada por la letra.",
  },
  {
    q: "¿Cuánto tarda?",
    a: "La letra queda lista en segundos. La canción grabada tarda unos 2 minutos. No tienes que esperar frente a la pantalla: si te sales, te avisamos por correo cuando esté lista.",
  },
  {
    q: "¿La canción es realmente solo mía?",
    a: "Sí. Se compone y se graba desde cero a partir de la historia que contaste. No es catálogo, no es una plantilla con el nombre cambiado. Nadie más recibe esa canción.",
  },
  {
    q: "¿Necesito escribir bonito para que quede bien?",
    a: "No. Mientras más simple y verdadero, mejor. Un detalle pequeño (el apodo, el platillo del domingo, su manía) vale más que un texto bonito. Y puedes hablar en vez de escribir, si prefieres.",
  },
  {
    q: "¿Cómo se lo entrego a la persona?",
    a: "Recibes un link con una página lista: la canción sonando, la letra encendiéndose al ritmo y su nombre en la portada. La mandas por WhatsApp, o imprimes el código QR y lo pegas en un regalo. Quien la entrega eres tú.",
  },
  {
    q: "¿Y si no le gusta?",
    a: "Tú eres quien conoce a la persona. Por eso la letra va primero: la lees y decides si eso es ella. Es el mismo cuidado de escoger un regalo, solo que aquí lo revisas antes.",
  },
];

function HomeEs() {
  useProfundidadeRolagem("home-es");
  useEffect(() => lembrarIdioma("es"), []);
  const [menuAberto, setMenuAberto] = useState(false);
  const [faqAberta, setFaqAberta] = useState<number | null>(0);
  const heroRef = useRef<HTMLElement>(null);
  const preco = MOEDA.es;

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />
      <OfereceIdioma />

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo tamanho="sm" />

          <nav className="hidden items-center gap-8 text-sm text-[var(--tinta-suave)] sm:flex">
            <a href="#como-funciona" className="transition-colors hover:text-[var(--tinta)]">
              Cómo funciona
            </a>
            <a href="#ejemplo" className="transition-colors hover:text-[var(--tinta)]">
              Ver un ejemplo
            </a>
            <Link to="/es/login" className="transition-colors hover:text-[var(--tinta)]">
              Entrar
            </Link>
            <Link to="/es/criar" className="cta rounded-full px-5 py-2.5 font-medium">
              Crear mi canción
            </Link>
          </nav>

          {/* No celular o CTA fica grudado no topo: medido no funil BR, 34 de
              36 visitantes não passam de 25% da página. Quem não rola precisa
              ter botão à mão desde o primeiro pixel. */}
          <div className="flex items-center gap-3 sm:hidden">
            <Link
              to="/es/criar"
              className="cta rounded-full px-4 py-2 font-medium"
              style={{ fontSize: "var(--t-sm)" }}
            >
              Crear
            </Link>
            <button onClick={() => setMenuAberto((v) => !v)} aria-label="Menú">
              {menuAberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuAberto && (
          <div className="border-t border-[var(--tinta-fraca)]/30 px-6 py-4 sm:hidden">
            <a href="#como-funciona" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Cómo funciona
            </a>
            <a href="#ejemplo" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Ver un ejemplo
            </a>
            <Link to="/es/login" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Entrar
            </Link>
            <Link
              to="/es/criar"
              className="cta mt-3 block rounded-full px-5 py-3 text-center text-sm font-medium"
            >
              Crear mi canción
            </Link>
          </div>
        )}
      </header>

      {/* ── 01 · HERO ───────────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full opacity-60"
            style={{ background: "oklch(0.82 0.11 82)", filter: "blur(140px)" }}
          />
          <div
            className="absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full opacity-40"
            style={{ background: "oklch(0.62 0.17 18)", filter: "blur(130px)" }}
          />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="text-center lg:text-left">
            <p
              className="uppercase tracking-[0.35em] text-[var(--acento)]"
              style={{ fontSize: "var(--t-xs)" }}
            >
              un regalo que se escucha
            </p>
            <h1
              className="mt-5 text-balance"
              style={{
                fontFamily: FONTES.display,
                fontWeight: 500,
                fontSize: "var(--t-hero)",
                lineHeight: 1.06,
                letterSpacing: "-0.02em",
              }}
            >
              Una canción hecha de la <span className="texto-ouro">historia</span> de
              quien tú quieres
            </h1>
            <p
              className="mx-auto mt-5 max-w-lg text-[var(--tinta-suave)] lg:mx-0"
              style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}
            >
              La letra queda lista al instante, gratis.
            </p>

            <div className="mt-6 lg:hidden">
              <VitrineVideo caption="reacciones de quien escuchó una canción hecha por nosotros" selo="reacciones reales" />
            </div>

            <div className="mt-7 flex flex-col items-center gap-3 lg:mt-9 lg:items-start">
              <Link
                to="/es/criar"
                className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
              >
                Crear mi canción <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-3 text-sm text-[var(--tinta-suave)]">
              La letra y un pedazo de la canción son gratis. Pagas solo para tener
              la canción completa y la página lista para enviar.
            </p>

            {/* Mesma posição da home portuguesa: logo abaixo do CTA, que é
                onde a pessoa olha antes de decidir se rola ou fecha. */}
            <ProvaSocial locale="es" />

            <div className="mt-8 lg:hidden">
              <PresenteNoTopo locale="es" />
            </div>
          </div>

          <div className="hidden space-y-8 lg:block">
            <VitrineVideo caption="reacciones de quien escuchó una canción hecha por nosotros" selo="reacciones reales" />
            <PresenteNoTopo locale="es" />
          </div>
        </div>
      </section>

      {/* ── 02 · PRUEBA INMEDIATA ───────────────────────────── */}
      <section className="border-y border-[var(--tinta-fraca)]/25 bg-[var(--papel-fundo)]">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-4 px-6 py-8 sm:py-10">
          {[
            { valor: "~6s", label: "para que la letra esté lista" },
            { valor: "~2min", label: "para que se grabe la canción" },
            { valor: "100%", label: "hecha de tu historia" },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <p
                className="tabular-nums leading-none"
                style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-2xl)" }}
              >
                {f.valor}
              </p>
              <p className="mt-1.5 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                {f.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 02.5 · PARA QUIÉN ES (perene, posición noble) ───── */}
      <ProQuemE exemploToken="exesmama651ba4fe" locale="es" />

      {/* ── 03 · DOLOR ──────────────────────────────────────── */}
      <section style={{ paddingBlock: "var(--secao)" }}>
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
          >
            Todos los años la misma duda: ¿qué le regalo?
          </h2>
          <div
            className="mx-auto mt-7 max-w-lg space-y-3 text-left text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
          >
            <p>
              Perfume ya tiene. Las flores se marchitan en tres días. La taza
              termina juntando polvo en la alacena.
            </p>
            <p>
              Al final compras cualquier cosa, la entregas medio sin ganas, y en
              dos meses nadie se acuerda de qué fue.
            </p>
            <p className="font-medium text-[var(--tinta)]">
              No porque no te importe. Es que un regalo que emociona tiene que
              ser sobre la persona, y eso da trabajo.
            </p>
          </div>
        </div>
      </section>

      {/* ── 04 · CÓMO FUNCIONA ──────────────────────────────── */}
      <section
        id="como-funciona"
        className="bg-[var(--papel-fundo)]"
        style={{ paddingBlock: "var(--secao)" }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2
            className="text-center text-3xl sm:text-4xl"
            style={{ fontFamily: FONTES.display, fontWeight: 500 }}
          >
            Cómo funciona
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {PASOS.map((p) => (
              <div key={p.n}>
                <p className="text-xs tracking-[0.3em] text-[var(--acento)]">{p.n}</p>
                <h3 className="mt-3 text-xl" style={{ fontFamily: FONTES.display, fontWeight: 500 }}>
                  {p.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--tinta-suave)]">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 05 · BENEFICIOS ─────────────────────────────────── */}
      <section style={{ paddingBlock: "var(--secao)" }}>
        <div className="mx-auto max-w-5xl px-6">
          <h2
            className="text-center text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
          >
            Por qué una canción no se olvida
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:mt-12 sm:gap-x-10 sm:gap-y-9">
            {BENEFICIOS.map((b) => (
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

      {/* ── 05.5 · EL ENTREGABLE (la página regalo) ─────────── */}
      <Entregavel exemploToken="exesmama651ba4fe" locale="es" />

      {/* ── 06 · EJEMPLOS REALES (tocables) ─────────────────── */}
      <ExemplosEs />

      {/* ── 07 · ANCLAJE Y OFERTA ───────────────────────────── */}
      <section id="precio" className="luz-ouro" style={{ paddingBlock: "var(--secao)" }}>
        <div className="mx-auto max-w-2xl px-6">
          <div className="text-center">
            <h2
              className="text-balance"
              style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
            >
              Cuesta menos que la serenata de una noche
            </h2>
            {/* Ancoragem MEXICANA: o mariachi na janela é o presente com que a
                gente compete lá de verdade, e o preço dele é público. */}
            <div
              className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--tinta-fraca)]/20 text-center"
              style={{ fontSize: "var(--t-sm)" }}
            >
              <div className="bg-[var(--papel)] px-4 py-5">
                <p className="text-[var(--tinta-suave)]">Mariachi a domicilio</p>
                <p className="mt-1 font-semibold">$1,500 MXN+</p>
                <p className="mt-1 text-[var(--tinta-fraca)]">se escucha una noche</p>
              </div>
              <div className="bg-[var(--papel)] px-4 py-5">
                <p className="text-[var(--tinta-suave)]">Una canción solo suya</p>
                <p className="mt-1 font-semibold text-[var(--acento)]">{preco.texto}</p>
                <p className="mt-1 text-[var(--tinta-fraca)]">se queda para siempre</p>
              </div>
            </div>
          </div>

          <div className="cartao-rico mt-8 rounded-3xl p-5 sm:mt-12 sm:p-8">
            <p className="text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
              Pagas una vez y te llevas
            </p>
            <ul className="mt-5 space-y-2 sm:mt-6 sm:space-y-3">
              {INCLUYE.map((i) => (
                <li key={i} className="flex gap-2.5 sm:gap-3" style={{ fontSize: "var(--t-sm)" }}>
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acento)] sm:mt-1" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-[var(--tinta-fraca)]/40 pt-7 text-center">
              <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                una canción hecha a mano costaría
              </p>
              <div className="mt-1 flex items-end justify-center gap-3">
                <span
                  className="text-[var(--tinta-fraca)] line-through"
                  style={{ fontSize: "var(--t-xl)" }}
                >
                  {preco.ancora}
                </span>
                <span
                  className="texto-ouro leading-none"
                  style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-hero)" }}
                >
                  {preco.texto}
                </span>
              </div>
              <p className="mt-2 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
                pago único · sin mensualidad · la página es tuya para siempre
              </p>

              <Link
                to="/es/criar"
                className="cta mt-6 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
              >
                Crear mi canción <ArrowRight className="h-4 w-4" />
              </Link>
              <p
                className="mx-auto mt-5 max-w-md text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
              >
                <strong className="text-[var(--tinta)]">
                  Lees la letra completa y escuchas un pedazo cantado antes de pagar.
                </strong>{" "}
                Si no es la cara de la persona, no pagas nada, y todavía puedes
                pedir que se reescriba gratis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 08 · PREGUNTAS ──────────────────────────────────── */}
      <section id="faq" className="bg-[var(--papel-fundo)]" style={{ paddingBlock: "var(--secao)" }}>
        <div className="mx-auto max-w-2xl px-6">
          <h2
            className="text-center text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
          >
            Preguntas
          </h2>
          <div className="mt-10 divide-y divide-[var(--tinta-fraca)]/30 border-y border-[var(--tinta-fraca)]/30">
            {PREGUNTAS.map((p, i) => (
              <div key={p.q}>
                <button
                  onClick={() => setFaqAberta(faqAberta === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                    {p.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--tinta-suave)] transition-transform ${
                      faqAberta === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {faqAberta === i && (
                  <p
                    className="pb-5 text-[var(--tinta-suave)]"
                    style={{ fontSize: "var(--t-sm)", lineHeight: 1.65 }}
                  >
                    {p.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 09 · CTA FINAL ──────────────────────────────────── */}
      <section className="luz-ouro bg-[var(--papel-fundo)] text-center" style={{ paddingBlock: "var(--secao)" }}>
        <div className="mx-auto max-w-2xl px-6">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
          >
            Cuéntame su historia. Yo la convierto en canción.
          </h2>
          <Link
            to="/es/criar"
            className="cta mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
          >
            Crear mi canción <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm text-[var(--tinta-suave)]">
            La letra es gratis. Solo pagas si te encanta.
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--tinta-fraca)]/30 py-10 text-center">
        <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
          {MARCA.nome} · <a href="mailto:contato@serenatagift.com" className="underline underline-offset-4">contato@serenatagift.com</a>
        </p>
      </footer>

      <BarraCTA alvoRef={heroRef} locale="es" />
    </div>
  );
}
