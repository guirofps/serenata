import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, caminho } from "@/lib/i18n";
import { t } from "@/lib/textos";

// ── 12 · BARRA FLUTUANTE DE CTA ── resgate de scroll (playbook §2).
//
// Aparece só depois que o herói sai da tela: antes disso o CTA do herói já
// está visível e a barra seria ruído.
// No mobile fica na ZONA DO POLEGAR (terço inferior) — §3.6.
//
// Usa listener de scroll passivo, e não IntersectionObserver: o observer não
// dispara de forma confiável em todos os ambientes (não emitiu um único
// evento no navegador de teste), e aqui a checagem é uma comparação de
// número — barata o suficiente pra rodar em scroll sem travar celular
// fraco (§4.1).

// O IDIOMA VEM DE UM PARÂMETRO SÓ, e os textos saem do dicionário.
//
// Antes os quatro textos eram valor padrão em português direto na
// assinatura. A home espanhola passava `destino` e `rotulo`, esquecia
// `titulo` e `sub`, e a barra flutuante do funil ES exibia "A letra e um
// trecho da música, grátis" em português — na tela que fica fixa no polegar,
// visível na rolagem inteira.
//
// Valor padrão em português é a pior forma de escrever isto: quem esquece um
// prop não vê erro nenhum, vê a página funcionando no idioma errado. Com
// `locale`, esquecer é impossível — não há o que passar a mais.
export function BarraCTA({
  alvoRef,
  locale = "pt",
  destino,
  rotulo,
  titulo,
  sub,
}: {
  alvoRef: React.RefObject<HTMLElement | null>;
  locale?: Locale;
  /** Sobrescreve o destino do idioma. Raro: por padrão segue o `locale`. */
  destino?: string;
  rotulo?: string;
  titulo?: string;
  sub?: string;
}) {
  const T = t(locale);
  const _destino = destino ?? caminho("/criar", locale);
  const _rotulo = rotulo ?? T.barraRotulo;
  const _titulo = titulo ?? T.barraTitulo;
  const _sub = sub ?? T.barraSub;
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Sem throttle de rAF de propósito: o trabalho é uma comparação de
    // número, e o React descarta o re-render quando o booleano não muda
    // (Object.is), então só há render nos dois instantes de virada.
    // rAF aqui, além de desnecessário, não roda quando a página não está
    // compondo frames — o que torna o comportamento impossível de testar.
    const avaliar = () => {
      const alvo = alvoRef.current;
      // Sem o herói medido, cai num limiar seguro (uma tela cheia).
      const limite = alvo ? alvo.offsetTop + alvo.offsetHeight : window.innerHeight;
      setVisivel(window.scrollY > limite - 80);
    };

    avaliar(); // estado inicial (ex.: reload já rolado)
    window.addEventListener("scroll", avaliar, { passive: true });
    window.addEventListener("resize", avaliar, { passive: true });
    return () => {
      window.removeEventListener("scroll", avaliar);
      window.removeEventListener("resize", avaliar);
    };
  }, [alvoRef]);

  return (
    <div
      data-barra-cta
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/95 backdrop-blur-md",
        // Só transform e opacity (§4.1). Reduced motion: sem transição.
        "transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
        visivel ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
      )}
      // Fora da tela não deve receber foco por teclado.
      aria-hidden={!visivel}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="hidden sm:block">
          <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
            {_titulo}
          </p>
          <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
            {_sub}
          </p>
        </div>
        <Link
          to={_destino}
          tabIndex={visivel ? 0 : -1}
          // Alvo de toque confortável (§3.6: mínimo 44px).
          className="cta inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 font-medium sm:flex-none"
          style={{ fontSize: "var(--t-sm)" }}
        >
          {_rotulo} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
