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
// TRANSPARÊNCIA — a lição que custou caro: NUNCA peça "fundo transparente"
// a um gerador de imagem. Ele DESENHA o xadrez, porque foi assim que viu
// transparência no treino. E aí não há recorte que salve: o brilho da arte
// é esbranquiçado e o quadrado claro do xadrez também, então nenhum
// algoritmo separa os dois — eles são a mesma cor.
//
// O jeito certo: gerar sobre BRANCO SÓLIDO (a arte fica com aresta limpa) e
// recortar por saturação com `scratch/extrair-logo.mjs`. O branco tem
// saturação zero, a marca é vinho e ouro; a separação é trivial.
//
// Fonte da arte em `docs/marca/logo-serenata.png`, o original branco em
// `logo-serenata-fonte-branco.png`. Não regerar o WebP na mão.
//
// 777x160 cobre a maior exibição (h-20 = 80px) em tela 2x. 41 KB: o playbook
// da Movify põe a página abaixo de 1,5 MB em 4G.
const ARQUIVO = "/img/logo-serenata.webp";
// Proporção real do arquivo (777x160), declarada pra não causar CLS.
const RAZAO = 777 / 160;

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
