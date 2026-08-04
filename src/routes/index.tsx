import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Logo } from "@/components/marca/Logo";
import { MARCA, FONTES, TEMA_CLARO } from "@/lib/marca";
import { ProvaImediata, Dor, Beneficios, Oferta, FAQ } from "@/components/landing/Secoes";
import { ExemplosReais } from "@/components/landing/ExemplosReais";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { Entregavel } from "@/components/landing/Entregavel";
import { DiaDosPais } from "@/components/landing/DiaDosPais";
import { BarraCTA } from "@/components/landing/BarraCTA";
import { PresenteNoTopo } from "@/components/landing/PresenteNoTopo";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { Play, ArrowRight, Menu, X } from "lucide-react";

// Landing da Serenata — mundo CLARO.
//
// O site é claro (papel quente); a PÁGINA-PRESENTE é escura (a noite da
// serenata). A passagem de um pro outro é a narrativa: você navega no claro
// e, quando abre o presente, entra na noite.
//
// Decisão de docs/quiz-fase1.md: mostrar o ENTREGÁVEL antes de pedir
// qualquer coisa. Por isso tem uma música real, tocável, aqui.

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${MARCA.nome} · ${MARCA.promessa}` },
      {
        name: "description",
        content:
          "Conte a história de alguém querido e receba a letra de uma música personalizada na hora, de graça. A música completa vira uma página presente pra você enviar.",
      },
      { property: "og:title", content: `${MARCA.nome} · ${MARCA.promessa}` },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTES.googleFonts },
    ],
  }),
  component: Home,
});

const PASSOS = [
  {
    n: "01",
    titulo: "Conte a história",
    texto:
      "Quem é a pessoa, o que vocês viveram, aquele detalhe que só vocês dois sabem. Pode escrever ou falar.",
  },
  {
    n: "02",
    titulo: "Leia a letra na hora",
    texto:
      "Em segundos, de graça. Feita com os detalhes que você contou: o apelido, a comida, o lugar. Não é frase pronta.",
  },
  {
    n: "03",
    titulo: "Envie o presente",
    texto:
      "A música gravada vira uma página com a letra acendendo no ritmo. Um link só seu, pronto pra mandar.",
  },
];

function Home() {
  // Mede até onde a pessoa rola. É o que separa "saiu sem ver nada" de
  // "viu tudo e não quis" — a maior perda do funil está aqui e a gente
  // nunca soube qual dos dois é.
  useProfundidadeRolagem("home");
  const [menuAberto, setMenuAberto] = useState(false);
  // Referência do herói: a barra de CTA só aparece quando ele sai da tela.
  const heroRef = useRef<HTMLElement>(null);

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      {/* Fio vinho→ouro no topo da página: a mesma assinatura da capa do
          produto e dos e-mails. É o detalhe que diz "isto tem marca". */}
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo tamanho="sm" />

          <nav className="hidden items-center gap-8 text-sm text-[var(--tinta-suave)] sm:flex">
            <a href="#como-funciona" className="transition-colors hover:text-[var(--tinta)]">
              Como funciona
            </a>
            <a href="#exemplo" className="transition-colors hover:text-[var(--tinta)]">
              Ver um exemplo
            </a>
            <Link to="/login" className="transition-colors hover:text-[var(--tinta)]">
              Entrar
            </Link>
            <Link
              to="/criar"
              className="cta rounded-full px-5 py-2.5 font-medium"
            >
              Criar minha música
            </Link>
          </nav>

          <button
            onClick={() => setMenuAberto((v) => !v)}
            className="sm:hidden"
            aria-label="Menu"
          >
            {menuAberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuAberto && (
          <div className="border-t border-[var(--tinta-fraca)]/30 px-6 py-4 sm:hidden">
            <a href="#como-funciona" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Como funciona
            </a>
            <a href="#exemplo" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Ver um exemplo
            </a>
            <Link to="/login" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Entrar
            </Link>
            <Link
              to="/criar"
              className="cta mt-3 block rounded-full px-5 py-3 text-center text-sm font-medium"
            >
              Criar minha música
            </Link>
          </div>
        )}
      </header>

      {/* ── 01 · HERO ───────────────────────────────────────────
          O H1 entra VISÍVEL no HTML, sem depender de JS pra aparecer:
          animar a promessa principal atrasa o LCP e queima tráfego pago
          (playbook §5.5). Anima-se o que está em volta, nunca isto. */}
      <section ref={heroRef} className="relative overflow-hidden">
        {/* GLOW BLOBS: duas manchas gigantes desfocadas de luz colorida atrás
            do herói. É o truque (medido no melhor concorrente) que dá
            profundidade e cara de caro sem imagem nenhuma — luz de janela
            âmbar de um lado, vinho do outro. */}
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
          <a
            href="#dia-dos-pais"
            className="badge-marca inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium text-[var(--acento)] transition-transform hover:scale-105"
            style={{ fontSize: "var(--t-xs)" }}
          >
            🎁 Dia dos Pais · 9 de agosto
          </a>
          <p
            className="mt-5 uppercase tracking-[0.35em] text-[var(--acento)]"
            style={{ fontSize: "var(--t-xs)" }}
          >
            presente que se ouve
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
            Uma música feita da <span className="texto-ouro">história</span> de
            quem você ama
          </h1>
          {/* Parágrafo ENXUTO: eram seis linhas de texto denso na primeira
              tela do celular, e ninguém lê seis linhas antes de saber o que
              é. O que ele explicava (página, karaokê, envio) o cartão abaixo
              MOSTRA, que funciona melhor que descrever. */}
          <p
            className="mx-auto mt-6 max-w-lg text-[var(--tinta-suave)] lg:mx-0"
            style={{ fontSize: "var(--t-lg)", lineHeight: 1.6 }}
          >
            Conte a história e a letra fica pronta na hora, de graça. A música
            vira uma página que você envia.
          </p>

          {/* No CELULAR os dois blocos entram ANTES do botão, nesta ordem:
              primeiro a emoção (gente real reagindo), depois a explicação (o
              que você recebe). Estavam depois do CTA, e o vídeo é bom demais
              pra correr o risco de a pessoa clicar sem ver.
              A altura extra não custa o CTA: a BarraCTA flutuante aparece
              assim que o herói sai da tela. */}
          <div className="mt-8 space-y-8 lg:hidden">
            <VitrineVideo caption="reações de quem ouviu uma música feita por nós" />
            <PresenteNoTopo />
          </div>

          {/* UM botão só. O "Ouvir exemplos" saiu: rolava a tela pra longe do
              CTA, e tudo que ele prometia a pessoa encontra no caminho
              natural (a seção de exemplos, e o próprio quiz). Menos saída,
              menos dispersão. */}
          <div className="mt-8 flex flex-col items-center gap-3 lg:mt-9 lg:items-start">
            <Link
              to="/criar"
              className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
            >
              Criar minha música <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--tinta-suave)]">
            A letra e um trecho da música são grátis. Você paga só pra ter a
            música inteira e a página pronta pra enviar.
          </p>
        </div>

          {/* No DESKTOP os dois ficam na coluna da direita, na mesma ordem.
              No celular já apareceram junto do título, então aqui some. */}
          <div className="hidden space-y-8 lg:block">
            <VitrineVideo caption="reações de quem ouviu uma música feita por nós" />
            <PresenteNoTopo />
          </div>
        </div>
      </section>

      {/* ── 02 · PROVA IMEDIATA ─────────────────────────────── */}
      <ProvaImediata />

      {/* ── 02.5 · DIA DOS PAIS (sazonal, posição nobre) ────── */}
      <DiaDosPais exemploToken="expai51378356a9" />

      {/* ── 03 · DOR ────────────────────────────────────────── */}
      <Dor />

      {/* ── 04 · MECANISMO (como funciona) ──────────────────── */}
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
            Como funciona
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {PASSOS.map((p) => (
              <div key={p.n}>
                <p className="text-xs tracking-[0.3em] text-[var(--acento)]">{p.n}</p>
                <h3
                  className="mt-3 text-xl"
                  style={{ fontFamily: FONTES.display, fontWeight: 500 }}
                >
                  {p.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--tinta-suave)]">
                  {p.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04.5 · O ENTREGÁVEL (o diferencial: página-presente) ── */}
      <Entregavel exemploToken="expai51378356a9" />

      {/* ── 05 · BENEFÍCIOS ─────────────────────────────────── */}
      <Beneficios />

      {/* ── 06 · DEMONSTRAÇÃO (três músicas reais, tocáveis) ── */}
      <ExemplosReais />

      {/* ── 08 + 09 · ANCORAGEM E OFERTA ────────────────────── */}
      <Oferta />

      {/* ── 10 · FAQ ────────────────────────────────────────── */}
      <FAQ />

      {/* ── 11 · CTA FINAL (repete a promessa do herói) ─────── */}
      <section
        className="luz-ouro bg-[var(--papel-fundo)] text-center"
        style={{ paddingBlock: "var(--secao)" }}
      >
        <div className="mx-auto max-w-2xl px-6">
          <p
            className="text-balance"
            style={{
              fontFamily: FONTES.display,
              fontWeight: 400,
              fontSize: "var(--t-3xl)",
              lineHeight: 1.25,
            }}
          >
            Presente todo mundo esquece.
            <br />
            Uma música feita pra você, <span className="texto-ouro">não</span>.
          </p>
          <Link
            to="/criar"
            className="cta mt-10 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
          >
            Começar agora <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <div className="fio-marca opacity-70" aria-hidden />
      <footer className="py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <Logo tamanho="sm" />
            <p className="mt-2 max-w-xs text-sm text-[var(--tinta-suave)]">
              {MARCA.promessa}.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--tinta-suave)]">
            <a href="#como-funciona" className="hover:text-[var(--tinta)]">
              Como funciona
            </a>
            <a href="#exemplo" className="hover:text-[var(--tinta)]">
              Exemplo
            </a>
            <Link to="/criar" className="hover:text-[var(--tinta)]">
              Criar música
            </Link>
          </nav>
        </div>
        <p className="mt-10 text-center text-xs text-[var(--tinta-fraca)]">
          {MARCA.dominio} · © {new Date().getFullYear()} {MARCA.nome}
        </p>
        {/* Espaço pra barra flutuante não cobrir o rodapé no mobile. */}
        <div className="h-16" aria-hidden />
      </footer>

      {/* ── 12 · BARRA FLUTUANTE DE CTA ─────────────────────── */}
      <BarraCTA alvoRef={heroRef} />
    </div>
  );
}
