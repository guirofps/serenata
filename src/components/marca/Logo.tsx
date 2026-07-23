import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";

// Logotipo da Serenata.
//
// Feito em SVG/tipografia, não em imagem: escala em qualquer tamanho, herda
// a cor do contexto, pesa nada e não borra em tela retina. Logo gerado por
// IA vira PNG com letra torta e não serve como marca de verdade.
//
// O símbolo é uma lua crescente com uma corda vibrando dentro — a serenata
// é cantada à noite, com um instrumento na mão. Dois traços, sem ornamento.

export function Simbolo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Lua crescente: um círculo mordido por outro (path único, sem máscara,
          pra funcionar dentro de currentColor em qualquer fundo) */}
      <path
        d="M22.5 4.2a13 13 0 1 0 5.3 17.6A15.2 15.2 0 0 1 22.5 4.2Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* A corda vibrando: uma onda curta atravessando a noite */}
      <path
        d="M4.5 16.5c2.6-3.4 5.2-3.4 7.8 0s5.2 3.4 7.8 0"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function Logo({
  className,
  tamanho = "md",
  soTexto = false,
}: {
  className?: string;
  tamanho?: "sm" | "md" | "lg";
  soTexto?: boolean;
}) {
  const escala = {
    sm: { texto: "text-lg", icone: "h-4 w-4", gap: "gap-1.5" },
    md: { texto: "text-2xl", icone: "h-5 w-5", gap: "gap-2" },
    lg: { texto: "text-4xl sm:text-5xl", icone: "h-8 w-8 sm:h-10 sm:w-10", gap: "gap-3" },
  }[tamanho];

  return (
    <span className={cn("inline-flex items-center", escala.gap, className)}>
      {!soTexto && <Simbolo className={escala.icone} />}
      <span
        className={cn(escala.texto, "leading-none tracking-[-0.01em]")}
        style={{ fontFamily: FONTES.display, fontWeight: 500 }}
      >
        Serenata
      </span>
    </span>
  );
}
