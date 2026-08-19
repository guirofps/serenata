import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Logo } from "@/components/marca/Logo";
import { MARCA, FONTES, TEMA_CLARO } from "@/lib/marca";
import { ProvaSocial } from "@/components/landing/ProvaSocial";
import { Play, Pause, ArrowRight, Check, ChevronDown } from "lucide-react";
import { useProfundidadeRolagem } from "@/lib/rolagem";

// PRIMEIRA PÁGINA DE BUSCA. É um teste, não uma seção nova do site.
//
// POR QUE ESPOSA, e não "mãe" como eu tinha chutado: os dados de 14 dias do
// funil PT dizem que a intenção dominante é o casamento, não a data comercial.
// Esposa teve 223 sessões e 29 compras; marido, 160 e 20. Juntos são metade do
// funil e quase metade das vendas. Mãe teve 37 sessões e 2 compras.
//
// POR QUE UMA SÓ: página que ranqueia vira molde pra vinte; vinte feitas no
// escuro viram vinte páginas mortas. Em 3 semanas o Search Console diz quais
// termos já trazem gente, e a segunda página é escolhida com dado.
//
// O QUE FAZ ELA VALER: as músicas REAIS, tocáveis, com a letra à mostra. É o
// único ativo que concorrente nenhum copia, porque sai de história de gente de
// verdade. São os mesmos exemplos que já estão públicos na home — nada de
// presente de cliente novo virando conteúdo sem autorização.
//
// O que NÃO fazer aqui: encher de texto genérico pra "ter conteúdo". Google
// pune volume raso desde os updates de conteúdo útil, e resposta de IA já come
// o clique informacional. O que sobra funcionando é isto: intenção de compra +
// prova que ninguém tem.

const AUDIO_BASE =
  "https://ouwijepgctgtfzrrwpvt.supabase.co/storage/v1/object/public/exemplos";

const EXEMPLOS = [
  {
    slug: "isabela",
    titulo: "Desde a Escola, Isabela",
    genero: "Sertanejo universitário",
    capa: "isabela",
    token: "e406f9b4356f4a5a9e7d8e",
    versos: [
      "Isabela, deixa eu te contar",
      "uma história que já é nossa há dez anos.",
      "Eu te vi ainda no colégio",
      "e o mundo mudou de lugar",
    ],
    detalhe: "Dez anos de história começando no colégio.",
  },
  {
    slug: "camburi",
    titulo: "Camburi",
    genero: "MPB",
    capa: "camburi",
    token: "7b89d2ed634646c4b1ee95",
    versos: [
      "Du, deixa eu te contar uma coisa",
      "De todas as escolhas que eu fiz na vida",
      "Você foi a mais certa, sem nem pensar duas vezes",
      "Aguenta minha chatice sem revirar os olhos",
    ],
    detalhe: "O apelido, a praia de sempre e a chatice aguentada com amor.",
  },
  {
    slug: "garga",
    titulo: "Gargamel",
    genero: "Pagode",
    capa: "garga",
    token: "5c980fdd76344b0c81e4e1",
    versos: [
      "Zona leste, meu amor, foi de lá que você veio",
      "Você nasceu na zona leste, sem nada de herança",
      "Mas trazia no peito o tamanho da esperança",
      "Riam do seu apelido lá na infância",
    ],
    detalhe: "Um apelido de infância que virou declaração.",
  },
];

// O conteúdo que a pessoa veio buscar de verdade. Quem digita "música pra
// esposa" não quer um ensaio sobre amor: quer saber o que contar pra música
// sair boa. Isto responde isso e, de quebra, melhora a matéria-prima que
// chega no nosso quiz.
const O_QUE_CONTAR = [
  {
    titulo: "O apelido que só você usa",
    texto:
      "É a primeira coisa que ela reconhece. Uma música que diz “meu amor” podia ser de qualquer um; uma que diz o apelido bobo de vocês dois só pode ser dela.",
  },
  {
    titulo: "Um lugar com data",
    texto:
      "A praia de todo janeiro, a padaria da esquina, o apartamento pequeno do começo. Lugar puxa memória mais rápido que qualquer adjetivo.",
  },
  {
    titulo: "Uma mania que te irrita e você ama",
    texto:
      "É o detalhe que prova intimidade. “Aguenta minha chatice sem revirar os olhos” diz mais sobre um casamento que dez versos sobre amor eterno.",
  },
  {
    titulo: "O que você nunca disse em voz alta",
    texto:
      "Quase todo mundo tem uma frase engasgada há anos. Numa música ela sai, e é geralmente o verso que faz a pessoa chorar.",
  },
];

const PERGUNTAS = [
  {
    q: "Quanto custa uma música personalizada para a esposa?",
    a: "A letra é de graça e fica pronta na hora: você lê ela inteira, e ouve um trecho cantado, antes de decidir qualquer coisa. Só a música gravada é paga, uma vez só, sem mensalidade — e o valor aparece na tela antes de você pagar.",
  },
  {
    q: "Quanto tempo demora para ficar pronta?",
    a: "A letra sai em segundos. A música gravada leva cerca de 2 minutos. Você não precisa esperar na tela: se sair da página, avisamos por e-mail quando estiver pronta.",
  },
  {
    q: "Preciso saber escrever ou cantar?",
    a: "Não. Você conta a história do seu jeito, escrevendo ou falando por áudio. Quanto mais simples e verdadeiro, melhor: um detalhe pequeno vale mais que um texto bonito.",
  },
  {
    q: "Qual estilo combina mais para uma música de casamento ou aniversário de namoro?",
    a: "Sertanejo e pop romântico são os mais pedidos para esposa. MPB funciona bem quando a história é mais intimista, e pagode quando o casal é de rir junto. Você escolhe o estilo no meio do quiz.",
  },
  {
    q: "Como eu entrego a música para ela?",
    a: "Você recebe uma página com a música tocando, a letra acendendo no ritmo, as fotos de vocês e o nome dela na capa. Manda o link no WhatsApp, ou imprime o QR Code e cola num presente físico. Quem entrega é você.",
  },
  {
    q: "E se ela não gostar?",
    a: "Você lê a letra inteira e ouve um trecho cantado antes de pagar, então dificilmente chega até o fim sem gostar. Ainda assim, tem 7 dias de garantia: se não ficar satisfeito, devolvemos o valor sem perguntar nada.",
  },
];

const URL = "https://www.serenatagift.com/musica-personalizada-para-esposa";
const TITULO = "Música personalizada para esposa: ouça exemplos reais | Serenata";
const DESCRICAO =
  "Uma música feita da história de vocês dois, com o apelido dela e o que só vocês sabem. Ouça exemplos reais, leia a letra e receba a sua na hora, de graça.";

export const Route = createFileRoute("/musica-personalizada-para-esposa")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "https://www.serenatagift.com/og-presente.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "1200" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTES.googleFonts },
    ],
    // FAQ estruturado: é o que faz as perguntas aparecerem abertas no
    // resultado de busca, e é lido por assistente de IA quando alguém
    // pergunta "quanto custa música personalizada".
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PERGUNTAS.map((p) => ({
            "@type": "Question",
            name: p.q,
            acceptedAnswer: { "@type": "Answer", text: p.a },
          })),
        }),
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  useProfundidadeRolagem("lp-esposa");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(0);

  // UM <audio> pros três: duas músicas tocando juntas é impossível por
  // construção, não por disciplina de código.
  async function alternar(slug: string) {
    const a = audioRef.current;
    if (!a) return;
    if (tocando === slug) {
      a.pause();
      setTocando(null);
      return;
    }
    a.src = `${AUDIO_BASE}/${slug}.mp3`;
    try {
      await a.play();
      setTocando(slug);
    } catch (err) {
      console.error("[lp-esposa] play falhou:", err);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />
      <audio ref={audioRef} onEnded={() => setTocando(null)} preload="none" />

      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/"><Logo tamanho="sm" /></Link>
          <Link to="/criar" className="cta rounded-full px-5 py-2.5 text-sm font-medium">
            Criar minha música
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="pt-12 text-center sm:pt-16">
          <p className="uppercase tracking-[0.3em] text-[var(--acento)]" style={{ fontSize: "var(--t-xs)" }}>
            para a esposa
          </p>
          <h1
            className="mx-auto mt-4 max-w-2xl text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-hero)", lineHeight: 1.08 }}
          >
            Uma música personalizada para a sua <span className="texto-ouro">esposa</span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}
          >
            Feita da história de vocês dois: o apelido que só você usa, o lugar de sempre,
            aquilo que você nunca teve coragem de dizer em voz alta. A letra fica pronta
            na hora e é de graça.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3">
            <Link
              to="/criar"
              className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
            >
              Criar a música dela <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-[var(--tinta-suave)]">
              A letra é de graça. Você só paga depois de ler ela inteira e ouvir um trecho cantado.
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <ProvaSocial />
          </div>
        </section>

        {/* ── EXEMPLOS REAIS (o que ninguém copia) ─────────────── */}
        <section className="mt-16 sm:mt-24">
          <h2
            className="text-balance text-center"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
          >
            Três músicas de verdade, feitas para esposas de verdade
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-base)" }}>
            Não são demonstrações genéricas. Cada uma nasceu da história que um marido
            contou, e você pode ouvir e ler a letra agora.
          </p>

          <div className="mt-8 space-y-4">
            {EXEMPLOS.map((ex) => (
              <article
                key={ex.slug}
                className="overflow-hidden rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-white"
              >
                <div className="flex gap-4 p-4">
                  <button
                    onClick={() => alternar(ex.slug)}
                    aria-label={tocando === ex.slug ? `Pausar ${ex.titulo}` : `Ouvir ${ex.titulo}`}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                  >
                    <img
                      src={`/img/exemplos/${ex.capa}.webp`}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
                      {tocando === ex.slug ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-0.5" />}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <h3 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-base)" }}>
                      {ex.titulo}
                    </h3>
                    <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                      {ex.genero} · {ex.detalhe}
                    </p>
                    <blockquote className="mt-2 border-l-2 border-[var(--ouro)] pl-3">
                      {ex.versos.map((v) => (
                        <p key={v} className="text-[13px] leading-snug text-[var(--tinta-suave)]">
                          {v}
                        </p>
                      ))}
                    </blockquote>
                    <a
                      href={`/p/${ex.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[var(--acento)] underline underline-offset-4"
                      style={{ fontSize: "var(--t-xs)" }}
                    >
                      abrir o presente completo →
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-3 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
            Trechos de 45 segundos. A música completa tem cerca de 4 minutos.
          </p>
        </section>

        {/* ── O QUE CONTAR (o conteúdo útil de verdade) ────────── */}
        <section className="mt-16 sm:mt-24">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
          >
            O que contar para a música sair boa
          </h2>
          <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}>
            A diferença entre uma música que emociona e uma que parece de rádio está toda
            aqui. Não é escrever bonito, é lembrar do específico.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {O_QUE_CONTAR.map((c) => (
              <div
                key={c.titulo}
                className="rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/35 bg-[var(--papel)] p-5"
              >
                <h3 className="flex items-start gap-2" style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-base)" }}>
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--acento)]" />
                  {c.titulo}
                </h3>
                <p className="mt-1.5 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
                  {c.texto}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className="mt-16 sm:mt-24">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
          >
            Perguntas frequentes
          </h2>
          <div className="mt-6 divide-y divide-[var(--tinta-fraca)]/30 border-y border-[var(--tinta-fraca)]/30">
            {PERGUNTAS.map((p, i) => (
              <div key={p.q}>
                <button
                  onClick={() => setAberta(aberta === i ? null : i)}
                  className="flex w-full items-start justify-between gap-4 py-4 text-left"
                >
                  <h3 className="font-medium" style={{ fontSize: "var(--t-base)" }}>{p.q}</h3>
                  <ChevronDown
                    className={`mt-0.5 h-5 w-5 shrink-0 transition-transform ${aberta === i ? "rotate-180" : ""}`}
                  />
                </button>
                {aberta === i && (
                  <p className="pb-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
                    {p.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA FINAL ────────────────────────────────────────── */}
        <section className="mt-16 pb-20 text-center sm:mt-24">
          <h2
            className="mx-auto max-w-lg text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
          >
            A letra fica pronta antes de você decidir qualquer coisa
          </h2>
          <Link
            to="/criar"
            className="cta mt-6 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
          >
            Contar a nossa história <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm text-[var(--tinta-suave)]">
            Grátis para ler. Você só paga se quiser ouvir cantada.
          </p>
        </section>
      </main>

      <footer className="border-t border-[var(--tinta-fraca)]/30 py-8 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
        <Link to="/" className="underline underline-offset-4">{MARCA.nome}</Link> · uma música feita da história de quem você ama
      </footer>
    </div>
  );
}
