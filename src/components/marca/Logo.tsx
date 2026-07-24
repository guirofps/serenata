import { cn } from "@/lib/utils";

// Logotipo da SERENATA — escolhido em 23/07.
//
// É a logo de verdade: letreiro desenhado (serifa com ligaduras, filete
// dourado) + símbolo próprio (onda sonora virando coração). Não é fonte de
// prateleira com um ícone do lado — foi essa a diferença que faltava nas
// primeiras tentativas.
//
// PNG e não SVG porque o letreiro é desenhado, não tipografado. Servido em
// duas versões: `logo-serenata.png` (vinho, para fundo claro) e a mesma com
// filtro de inversão para o fundo escuro do presente.

// WebP: 37 KB contra 447 KB do PNG. O playbook da Movify põe peso de página
// abaixo de 1,5 MB em 4G — logo de 450 KB come um terço disso sozinha.
const ARQUIVO = "/img/logo-serenata.webp";
// Proporção real do arquivo (1178x229), declarada pra não causar CLS.
const RAZAO = 1178 / 229;

export function Logo({
  className,
  tamanho = "md",
  escuro = false,
}: {
  className?: string;
  tamanho?: "sm" | "md" | "lg";
  /** No mundo escuro (página-presente) o vinho some; clareia a marca. */
  escuro?: boolean;
}) {
  const altura = {
    sm: "h-7",
    md: "h-10",
    lg: "h-14 sm:h-20",
  }[tamanho];

  // width/height declarados previnem CLS (playbook: CLS < 0,1).
  const alturaPx = { sm: 28, md: 40, lg: 56 }[tamanho];

  return (
    <img
      src={ARQUIVO}
      alt="Serenata"
      width={Math.round(alturaPx * RAZAO)}
      height={alturaPx}
      // A logo é o LCP do header: carrega cedo, sem lazy.
      fetchPriority="high"
      className={cn(altura, "w-auto select-none", className)}
      style={
        escuro
          ? // Clareia o vinho e realça o ouro sobre a noite, sem precisar de
            // um segundo arquivo.
            { filter: "brightness(1.9) saturate(0.85)" }
          : undefined
      }
      draggable={false}
    />
  );
}

// Só o símbolo (onda + coração), recortado da logo. Para favicon, avatar e
// lugares onde não cabe a palavra.
export function Simbolo({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block overflow-hidden", className)}
      aria-hidden
      style={{ aspectRatio: "1 / 1" }}
    >
      <img
        src={ARQUIVO}
        alt=""
        className="h-full w-auto max-w-none"
        style={{ objectFit: "none", objectPosition: "6% 50%", transform: "scale(2.6)" }}
        draggable={false}
      />
    </span>
  );
}
