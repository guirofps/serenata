import { Link } from "@tanstack/react-router";
import { FONTES } from "@/lib/marca";
import { type Locale, caminho } from "@/lib/i18n";
import { ArrowRight } from "lucide-react";

// ── PRA QUEM É ── o bloco perene que substituiu o de Dia dos Pais.
//
// Nasceu como seção sazonal (2º domingo de agosto). Em 10/08, um dia depois da
// data, a home ainda exibia o selo "Dia dos Pais · 9 de agosto" e um contador
// travado em 00 dias / 00 horas / 00 min, em posição nobre logo abaixo do
// herói. Contador zerado não é neutro: passa "promoção que acabou, cheguei
// tarde" pra quem chegou de anúncio pago hoje.
//
// O texto NÃO foi jogado fora porque quase nada nele era sazonal de verdade: o
// padrasto, o pai à distância e o "em memória" falam de TIPO DE RELAÇÃO, não de
// data. É o alicerce que o CLAUDE.md manda perseguir — aniversário e homenagem
// não têm mês, e a agenda brasileira só volta a ajudar em outubro. Data vira
// camada por cima disto, nunca a estrutura.
//
// Cada cartão existe pra uma pessoa se reconhecer e pensar "é esse o meu caso".
// O "em memória" fica de propósito: é o mais forte que a gente tem, e é o único
// que ninguém mais oferece sem constrangimento.

// O espanhol não é tradução linha a linha: "quem está longe" no México é o
// filho que migrou e liga por vídeo, e o "durão que não chora" é o papá que
// se emociona escondido. Mesma estrutura, palavras de lá.
const T: Record<
  Locale,
  {
    selo: string;
    titulo: [string, string];
    sub: string;
    cta: string;
    rodape: string;
    exemplo: string;
    casos: { emoji: string; titulo: string; texto: string }[];
  }
> = {
  pt: {
    selo: "pra quem é esse presente",
    titulo: ["Todo presente vira objeto.", "Menos o que a pessoa continua ouvindo."],
    sub: "Uma música com o nome dela, as memórias de vocês e aquilo que a gente sempre esquece de dizer em voz alta. Ela vai reouvir, mostrar pros outros e guardar pra vida toda.",
    cta: "Criar a música dessa pessoa",
    rodape: "A letra fica pronta na hora, de graça. Você só paga se amar.",
    exemplo: "Ver um presente pronto (exemplo) →",
    casos: [
      { emoji: "🎂", titulo: "O aniversário", texto: "A música que toca quando as velinhas apagam. E que a pessoa vai reouvir em todo aniversário depois desse." },
      { emoji: "🕊️", titulo: "Em memória", texto: "A homenagem de saudade pra quem partiu, mas continua sendo sua mãe, seu pai, seu avô." },
      { emoji: "🧡", titulo: "O pai (ou a mãe) que a vida deu", texto: "Padrasto, madrasta, tia, quem criou. Quem fez por escolha o que ninguém pediu." },
      { emoji: "✈️", titulo: "Quem está longe", texto: "Longe de vista, perto no coração. A música chega onde você não alcança." },
      { emoji: "💍", titulo: "O amor de muitos anos", texto: "Quem já ouviu “eu te amo” mil vezes e nunca ouviu do jeito que só uma música diz." },
      { emoji: "🤍", titulo: "Aquele que “não chora”", texto: "O durão que se desmancha ao ouvir, em música, o que você nunca teve coragem de dizer na frente dele." },
    ],
  },
  es: {
    selo: "para quién es este regalo",
    titulo: ["Todo regalo termina guardado.", "Menos el que se sigue escuchando."],
    sub: "Una canción con su nombre, los recuerdos de ustedes y eso que siempre se nos olvida decir en voz alta. La va a volver a escuchar, se la va a enseñar a todos y la va a guardar toda la vida.",
    cta: "Crear la canción de esa persona",
    rodape: "La letra queda lista al instante, gratis. Solo pagas si te encanta.",
    exemplo: "Ver un regalo ya hecho (ejemplo) →",
    casos: [
      { emoji: "🎂", titulo: "El cumpleaños", texto: "La canción que suena cuando se apagan las velitas. Y que va a volver a escuchar en cada cumpleaños después de este." },
      { emoji: "🕊️", titulo: "En memoria", texto: "El homenaje para quien ya no está, pero sigue siendo tu mamá, tu papá, tu abuelo." },
      { emoji: "🧡", titulo: "El papá (o la mamá) que la vida te dio", texto: "El padrastro, la madrastra, la tía, quien te crió. Quien hizo por decisión lo que nadie le pidió." },
      { emoji: "✈️", titulo: "Quien está lejos", texto: "Del otro lado, o al otro lado del país. La canción llega hasta donde tú no alcanzas." },
      { emoji: "💍", titulo: "El amor de muchos años", texto: "Quien ya escuchó “te amo” mil veces y nunca lo escuchó como solo una canción lo dice." },
      { emoji: "🤍", titulo: "El que “no llora”", texto: "El duro que se quiebra al escuchar, cantado, lo que nunca te atreviste a decirle de frente." },
    ],
  },
};

export function ProQuemE({
  exemploToken,
  locale = "pt",
}: {
  exemploToken?: string;
  locale?: Locale;
}) {
  const t = T[locale] ?? T.pt;
  const CASOS = t.casos;
  return (
    <section id="pra-quem-e" className="px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          {/* O selo não carrega mais data nenhuma. Se um dia voltar a ter, tem
              que voltar com prazo de validade embutido — foi a falta dele que
              deixou um contador zerado no ar. */}
          <span
            className="inline-flex items-center gap-2 rounded-full border border-[var(--acento)]/30 bg-[var(--acento)]/10 px-4 py-1.5 font-medium text-[var(--acento)]"
            style={{ fontSize: "var(--t-xs)" }}
          >
            {t.selo}
          </span>

          <h2
            className="mx-auto mt-4 max-w-2xl text-balance sm:mt-6"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.12 }}
          >
            {t.titulo[0]}
            <br className="hidden sm:block" /> {t.titulo[1]}
          </h2>
          <p
            className="mx-auto mt-3 max-w-xl text-[var(--tinta-suave)] sm:mt-5"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.55 }}
          >
            {t.sub}
          </p>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-3">
          {CASOS.map((c) => (
            <div
              key={c.titulo}
              className="card-lift rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/35 bg-[var(--papel)] p-3.5 sm:p-5"
            >
              <span className="text-xl sm:text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <h3
                className="mt-1.5 leading-snug sm:mt-2"
                style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-base)" }}
              >
                {c.titulo}
              </h3>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}
              >
                {c.texto}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center sm:mt-12">
          <Link
            to={caminho("/criar", locale)}
            className="cta inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
          >
            {t.cta} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            {t.rodape}
          </p>
          {exemploToken && (
            <p className="mt-5" style={{ fontSize: "var(--t-sm)" }}>
              <a
                href={`/p/${exemploToken}`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--acento)] underline underline-offset-4 hover:opacity-80"
              >
                {t.exemplo}
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
