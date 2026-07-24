import { cn } from "@/lib/utils";

// Logotipo da SERENATA — escolhido em 23/07.
//
// É a logo de verdade: letreiro desenhado (serifa com ligaduras, filete
// dourado) + símbolo próprio (onda sonora virando coração). Não é fonte de
// prateleira com um ícone do lado — foi essa a diferença que faltava nas
// primeiras tentativas.
//
// Bitmap e não SVG porque o letreiro é desenhado, não tipografado. Um único
// arquivo serve os dois mundos: no escuro entra um filtro, não um segundo
// arquivo.
//
// TRANSPARÊNCIA: o rascunho do Higgsfield vinha com o xadrez PINTADO nos
// pixels (pedir "fundo transparente" a um gerador faz ele DESENHAR o
// padrão). O recorte é feito por saturação em `scratch/extrair-logo.mjs` —
// o xadrez é cinza puro e a marca é vinho e ouro. Fonte em
// `docs/marca/logo-serenata.png`; não regerar o WebP na mão.
//
// 784x160 cobre a maior exibição (h-20 = 80px) em tela 2x. 45 KB: o playbook
// da Movify põe a página abaixo de 1,5 MB em 4G.
const ARQUIVO = "/img/logo-serenata.webp";
// Proporção real do arquivo (784x160), declarada pra não causar CLS.
const RAZAO = 784 / 160;

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
