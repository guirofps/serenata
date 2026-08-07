import { useEffect, useState } from "react";
import { Efeitos } from "@/components/presente/Efeitos";
import { CORES, FONTES } from "@/lib/marca";
import { Play, QrCode } from "lucide-react";
import { type Locale } from "@/lib/i18n";
import { t as textos } from "@/lib/textos";

// A ESPERA VIRA VITRINE.
//
// Enquanto a letra é escrita (uns segundos) a tela mostrava um ícone pulsando
// e uma frase. Tempo morto na hora mais ansiosa do funil, e logo ANTES da
// única tela onde a gente pede dinheiro.
//
// Aqui a pessoa vê o presente que vai enviar: fundo escuro (a "noite" da
// serenata, o outro mundo da marca), o nome do homenageado, corações caindo e
// a letra acendendo linha a linha, exatamente como acontece na página real.
//
// As linhas são BARRAS, não versos. Inventar versos que não vão ser os dela
// seria mentira, e a letra de verdade chega em segundos: a barra diz "a sua
// letra vem aqui e acende no ritmo" sem prometer palavra nenhuma.
//
// O movimento é função do TEMPO, não de @keyframes: keyframes dentro de
// @layer não pegam no Tailwind v4 e `prefers-reduced-motion` mata animação
// CSS inteira (aprendido a caro nos efeitos da página-presente). Aqui um
// relógio em estado move tudo, então funciona em qualquer navegador.

// Larguras das barras: irregulares de propósito, senão parece tabela.
const LINHAS = [78, 92, 64, 88, 71, 84];

export function PreviaPresente({ nome, locale = "pt" }: { nome?: string; locale?: Locale }) {
  const T = textos(locale);
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 0.1), 100);
    return () => clearInterval(id);
  }, []);

  // Qual linha está sendo cantada: desce uma a cada 0,9s e recomeça.
  const ativa = Math.floor((t / 0.9) % LINHAS.length);
  const quem = nome?.trim() || T.quemVoceAma;

  return (
    <div className="mx-auto w-full max-w-[248px]">
      <div
        className="relative aspect-[9/16] overflow-hidden rounded-[26px] border shadow-2xl"
        style={{
          background: `linear-gradient(165deg, ${CORES.noiteSuave} 0%, ${CORES.noite} 55%, #100a0c 100%)`,
          borderColor: "rgba(247,240,232,0.14)",
        }}
      >
        {/* Luz âmbar de canto, a mesma da página-presente */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full"
          style={{ background: "oklch(0.80 0.11 82)", opacity: 0.28, filter: "blur(44px)" }}
        />

        <Efeitos tipo="coracoes" ativo tempo={t} contido escala={0.42} />

        <div className="relative flex h-full flex-col px-5 py-6">
          <p
            className="text-center text-[8px] uppercase tracking-[0.3em]"
            style={{ color: CORES.bruma }}
          >
            {T.umaMusicaPra}
          </p>
          <p
            className="mt-1 truncate text-center text-xl"
            style={{ fontFamily: FONTES.display, color: CORES.creme }}
          >
            {quem}
          </p>

          {/* A letra acendendo, linha a linha */}
          <div className="mt-5 flex flex-1 flex-col justify-center gap-2.5">
            {LINHAS.map((w, i) => (
              <div
                key={i}
                className="h-[7px] rounded-full transition-opacity duration-500"
                style={{
                  width: `${w}%`,
                  background:
                    i === ativa ? "oklch(0.84 0.13 78)" : "rgba(247,240,232,0.22)",
                  opacity: i === ativa ? 1 : 0.75,
                  boxShadow: i === ativa ? "0 0 12px oklch(0.84 0.13 78 / 0.6)" : "none",
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pb-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "oklch(0.84 0.13 78)" }}
            >
              <Play className="h-3.5 w-3.5 fill-current text-[#22120f]" />
            </span>
            <span className="h-[3px] flex-1 rounded-full" style={{ background: "rgba(247,240,232,0.2)" }} />
          </div>

          <p
            className="mt-2.5 flex items-center justify-center gap-1 text-[8px]"
            style={{ color: CORES.bruma }}
          >
            <QrCode className="h-2.5 w-2.5" /> link + QR Code pra enviar
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        É assim que <strong className="text-foreground">{quem}</strong> vai receber
      </p>
    </div>
  );
}
