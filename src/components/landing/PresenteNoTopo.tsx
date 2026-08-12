import { useEffect, useState } from "react";
import { Efeitos } from "@/components/presente/Efeitos";
import { CORES, FONTES } from "@/lib/marca";
import { Play } from "lucide-react";
import { type Locale } from "@/lib/i18n";

// O PRESENTE, ACIMA DA DOBRA.
//
// Medido em 01/08: 72,4% das sessões veem UMA página só, e a primeira tela do
// celular era 812px de texto puro, sem uma imagem do produto. Ao mesmo tempo,
// quem abre um presente de exemplo entra no quiz 31,4% das vezes contra 12,7%
// de quem não abre. Ou seja: a coisa que mais faz entrar no funil estava
// escondida lá embaixo.
//
// Este cartão traz o entregável pra onde todo mundo olha. Não é print nem
// mockup: usa o componente Efeitos da página-presente de verdade.
//
// NÃO É CLICÁVEL, de propósito (decisão do dono, 02/08). A versão anterior
// abria um presente real em outra aba, e a lógica de tirar isso é boa: o
// herói tem UM trabalho, que é o clique no "Criar minha música". Mandar a
// pessoa pra outra aba na primeira tela dispersa o tráfego, e quem quiser
// abrir exemplo encontra a seção de exemplos logo abaixo, com abas por
// relação. Aqui o cartão só MOSTRA.
//
// Movimento por TEMPO e não por @keyframes: keyframes dentro de @layer não
// pegam no Tailwind v4 e prefers-reduced-motion mata animação CSS inteira.

// Versos REAIS do presente de exemplo que o cartão abre. Não são inventados:
// é a letra que a pessoa vai encontrar se tocar. O espanhol sai de "El Mandil
// Azul" (exesmama651ba4fe), uma das três músicas geradas na validação de 07/08.
const T: Record<
  Locale,
  { foto: string; nome: string; rotulo: string; legenda: string; versos: string[] }
> = {
  pt: {
    foto: "/img/exemplos/pai.webp",
    nome: "Antônio",
    rotulo: "uma música para",
    legenda: "É isso que a pessoa recebe, no celular dela.",
    versos: [
      "Seu Antônio, essa aqui é pra você",
      "O senhor acorda antes do sol nascer",
      "Café coado, o dia já quer começar",
      "Domingo de churrasco, a família inteira",
    ],
  },
  es: {
    foto: "/img/exemplos/mae.webp",
    nome: "Lupita",
    rotulo: "una canción para",
    legenda: "Esto es lo que recibe la persona, en su celular.",
    versos: [
      "Hoy le canto a mi Lupita",
      "la que nunca se quejó",
      "Desde las cinco en el mercado",
      "ya se oía tu voz",
    ],
  },
};

export function PresenteNoTopo({
  locale = "pt",
  foto,
  nome,
}: {
  locale?: Locale;
  foto?: string;
  nome?: string;
}) {
  const t0 = T[locale] ?? T.pt;
  const VERSOS = t0.versos;
  foto = foto ?? t0.foto;
  nome = nome ?? t0.nome;
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 0.1), 100);
    return () => clearInterval(id);
  }, []);
  const ativa = Math.floor((t / 1.4) % VERSOS.length);

  return (
    <div className="mx-auto w-full max-w-[310px]" aria-hidden>
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-[24px] border"
        style={{
          borderColor: "rgba(247,240,232,0.16)",
          boxShadow: "0 28px 60px -24px rgba(42,21,24,0.55)",
          background: CORES.noite,
        }}
      >
        <img
          src={foto}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
        {/* Véu escuro: a letra precisa ler por cima de qualquer foto. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(16,10,12,0.62) 0%, rgba(16,10,12,0.38) 38%, rgba(16,10,12,0.88) 100%)",
          }}
        />

        <Efeitos tipo="coracoes" ativo tempo={t} contido escala={0.5} />

        <div className="relative flex h-full flex-col px-5 py-5">
          <p
            className="text-center text-[9px] uppercase tracking-[0.3em]"
            style={{ color: "rgba(247,240,232,0.7)" }}
          >
            {t0.rotulo}
          </p>
          <p
            className="mt-0.5 text-center text-2xl"
            style={{ fontFamily: FONTES.display, color: CORES.creme }}
          >
            {nome}
          </p>

          <div className="flex flex-1 flex-col justify-center gap-1.5">
            {VERSOS.map((verso, i) => (
              <p
                key={verso}
                className="text-[13px] leading-snug transition-colors duration-300"
                style={{
                  color: i === ativa ? "oklch(0.86 0.13 78)" : "rgba(247,240,232,0.45)",
                  textShadow: i === ativa ? "0 0 18px oklch(0.86 0.13 78 / 0.35)" : "none",
                }}
              >
                {verso}
              </p>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "oklch(0.86 0.13 78)" }}
            >
              <Play className="h-4 w-4 fill-current text-[#22120f]" />
            </span>
            <span
              className="h-[3px] flex-1 rounded-full"
              style={{ background: "rgba(247,240,232,0.25)" }}
            />
          </div>
        </div>
      </div>

      {/* Legenda que DESCREVE, não convida a clicar: o convite é o CTA. */}
      <p className="mt-3 text-center text-sm text-[var(--tinta-suave)]">
        {t0.legenda}
      </p>
    </div>
  );
}
