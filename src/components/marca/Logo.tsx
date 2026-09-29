import { cn } from "@/lib/utils";
import { MARCA } from "@/lib/marca";

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
// A BALLAD GIFT (EUA) tem a sua, no mesmo desenho (onda com coração, vinho,
// traço fino), só com a palavra BALLAD. Kit em `docs/marca/ballad/`. Lá o
// escuro é um SEGUNDO arquivo, em creme: o filtro que clareia o vinho da
// Serenata deixava o traço fino da Ballad cinza e sem contraste.
const BALLAD = MARCA.chave === "ballad";
const ARQUIVO = BALLAD ? "/ballad/logo.webp" : "/img/logo-serenata.webp";
const ARQUIVO_ESCURO = BALLAD ? "/ballad/logo-clara.webp" : ARQUIVO;
// Proporção real do arquivo (777x160 e 560x137), declarada pra não causar CLS.
const RAZAO = BALLAD ? 560 / 137 : 777 / 160;

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
      src={escuro ? ARQUIVO_ESCURO : ARQUIVO}
      alt={MARCA.nome}
      width={Math.round(alturaPx * RAZAO)}
      height={alturaPx}
      // A logo é o LCP do header: carrega cedo, sem lazy.
      fetchPriority="high"
      className={cn(altura, "w-auto select-none", className)}
      style={
        escuro && !BALLAD
          ? // Clareia o vinho e realça o ouro sobre a noite, sem precisar de
            // um segundo arquivo.
            { filter: "brightness(1.9) saturate(0.85)" }
          : undefined
      }
      draggable={false}
    />
  );
}
