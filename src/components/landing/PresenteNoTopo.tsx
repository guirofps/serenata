import { useEffect, useState } from "react";
import { Efeitos } from "@/components/presente/Efeitos";
import { CORES, FONTES } from "@/lib/marca";
import { Play, ArrowUpRight } from "lucide-react";

// O PRESENTE, ACIMA DA DOBRA.
//
// Medido em 01/08: 72,4% das sessões veem UMA página só, e a primeira tela do
// celular era 812px de texto puro, sem uma imagem do produto. Ao mesmo tempo,
// quem abre um presente de exemplo entra no quiz 31,4% das vezes contra 12,7%
// de quem não abre. Ou seja: a coisa que mais faz entrar no funil estava
// escondida lá embaixo.
//
// Este cartão é a MESMA ação, no lugar onde todo mundo olha. Não é print nem
// mockup: usa o componente Efeitos da página-presente de verdade, e o cartão
// inteiro é um link que abre um presente real.
//
// Movimento por TEMPO e não por @keyframes: keyframes dentro de @layer não
// pegam no Tailwind v4 e prefers-reduced-motion mata animação CSS inteira.

// Versos REAIS do presente de exemplo que o cartão abre. Não são inventados:
// é a letra que a pessoa vai encontrar se tocar.
const VERSOS = [
  "Seu Antônio, essa aqui é pra você",
  "O senhor acorda antes do sol nascer",
  "Café coado, o dia já quer começar",
  "Domingo de churrasco, a família inteira",
];

export function PresenteNoTopo({
  token,
  foto = "/img/exemplos/pai.webp",
  nome = "Antônio",
}: {
  token: string;
  foto?: string;
  nome?: string;
}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 0.1), 100);
    return () => clearInterval(id);
  }, []);
  const ativa = Math.floor((t / 1.4) % VERSOS.length);

  return (
    <a
      href={`/p/${token}`}
      target="_blank"
      rel="noreferrer"
      className="group mx-auto block w-full max-w-[310px] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]"
    >
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
            uma música para
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

      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--acento)]">
        Abrir um presente de verdade
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </p>
    </a>
  );
}
