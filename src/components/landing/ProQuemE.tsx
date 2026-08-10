import { Link } from "@tanstack/react-router";
import { FONTES } from "@/lib/marca";
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

const CASOS = [
  {
    emoji: "🎂",
    titulo: "O aniversário",
    texto: "A música que toca quando as velinhas apagam. E que a pessoa vai reouvir em todo aniversário depois desse.",
  },
  {
    emoji: "🕊️",
    titulo: "Em memória",
    texto: "A homenagem de saudade pra quem partiu, mas continua sendo sua mãe, seu pai, seu avô.",
  },
  {
    emoji: "🧡",
    titulo: "O pai (ou a mãe) que a vida deu",
    texto: "Padrasto, madrasta, tia, quem criou. Quem fez por escolha o que ninguém pediu.",
  },
  {
    emoji: "✈️",
    titulo: "Quem está longe",
    texto: "Longe de vista, perto no coração. A música chega onde você não alcança.",
  },
  {
    emoji: "💍",
    titulo: "O amor de muitos anos",
    texto: "Quem já ouviu “eu te amo” mil vezes e nunca ouviu do jeito que só uma música diz.",
  },
  {
    emoji: "🤍",
    titulo: "Aquele que “não chora”",
    texto: "O durão que se desmancha ao ouvir, em música, o que você nunca teve coragem de dizer na frente dele.",
  },
];

export function ProQuemE({ exemploToken }: { exemploToken?: string }) {
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
            pra quem é esse presente
          </span>

          <h2
            className="mx-auto mt-4 max-w-2xl text-balance sm:mt-6"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.12 }}
          >
            Todo presente vira objeto.
            <br className="hidden sm:block" /> Menos o que a pessoa continua ouvindo.
          </h2>
          <p
            className="mx-auto mt-3 max-w-xl text-[var(--tinta-suave)] sm:mt-5"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.55 }}
          >
            Uma música com o nome dela, as memórias de vocês e aquilo que a gente
            sempre esquece de dizer em voz alta. Ela vai reouvir, mostrar pros
            outros e guardar pra vida toda.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-3">
          {CASOS.map((t) => (
            <div
              key={t.titulo}
              className="card-lift rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/35 bg-[var(--papel)] p-3.5 sm:p-5"
            >
              <span className="text-xl sm:text-2xl" aria-hidden>
                {t.emoji}
              </span>
              <h3
                className="mt-1.5 leading-snug sm:mt-2"
                style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-base)" }}
              >
                {t.titulo}
              </h3>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}
              >
                {t.texto}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center sm:mt-12">
          <Link
            to="/criar"
            className="cta inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
          >
            Criar a música dessa pessoa <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            A letra fica pronta na hora, de graça. Você só paga se amar.
          </p>
          {exemploToken && (
            <p className="mt-5" style={{ fontSize: "var(--t-sm)" }}>
              <a
                href={`/p/${exemploToken}`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--acento)] underline underline-offset-4 hover:opacity-80"
              >
                Ver um presente pronto (exemplo) →
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
