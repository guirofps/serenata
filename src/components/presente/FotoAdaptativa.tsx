import { useCallback, useState } from "react";

// Foto do CLIENTE exibida como fundo, de forma ADAPTATIVA.
//
// O problema: cada pessoa manda o que tem — quadrada (Instagram), vertical
// (celular), horizontal (câmera). Um `object-cover` fixo corta demais em algum
// desses casos (a foto quadrada numa tela alta de celular perde as cabeças).
//
// A solução: medir a proporção REAL da imagem quando ela carrega e decidir:
//
//   - Foto MAIS ALTA que a tela (vertical): `cover` centralizado. Sobra pouco
//     e o corte é nas laterais, que é inofensivo.
//   - Foto MAIS LARGA que a tela (quadrada/horizontal numa tela alta): `cover`
//     ancorado no ALTO (rostos vivem no terço de cima), + um fundo desfocado
//     da própria imagem preenchendo o resto. Assim nunca aparece faixa vazia e
//     nunca corta a cabeça de ninguém.
//
// O desfoque atrás é o mesmo truque de player de música: preenche a tela com a
// cor/luz da própria foto, então parece intencional, não remendo.

export function FotoAdaptativa({
  src,
  className = "",
  opacity = 1,
  saturate = 1,
  eager = false,
}: {
  src: string;
  className?: string;
  opacity?: number;
  saturate?: number;
  eager?: boolean;
}) {
  // null = ainda não sei a proporção (usa o padrão seguro).
  const [razao, setRazao] = useState<number | null>(null);

  // Mede a proporção. Ref callback (não só onLoad): imagem que vem do CACHE
  // já chega `complete` e o evento load NUNCA dispara — foi o que deixava o
  // adaptativo desligado numa segunda visita.
  const medir = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth && el.naturalHeight) {
      setRazao(el.naturalWidth / el.naturalHeight);
    }
  }, []);

  // Proporção da janela. No SSR não há window: assume retrato de celular
  // (nosso caso dominante, 99% mobile).
  const razaoTela =
    typeof window !== "undefined" && window.innerHeight > 0
      ? window.innerWidth / window.innerHeight
      : 0.46;

  // A foto é "mais larga" que a tela? Então o cover vai cortar em cima/embaixo.
  const maisLarga = razao !== null && razao > razaoTela * 1.06;

  return (
    <div aria-hidden className={`overflow-hidden ${className}`} style={{ opacity }}>
      {/* Fundo desfocado da própria foto: preenche a tela sem faixa vazia. Só
          faz sentido quando a foto é mais larga que a tela. */}
      {maisLarga && (
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "blur(28px) saturate(1.1) brightness(0.55)", transform: "scale(1.15)" }}
        />
      )}
      <img
        src={src}
        alt=""
        ref={medir}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth && el.naturalHeight) {
            setRazao(el.naturalWidth / el.naturalHeight);
          }
        }}
        className="absolute inset-0 h-full w-full"
        style={{
          // Mais larga que a tela: mostra a foto INTEIRA (contain) sobre o
          // fundo desfocado, ancorada um pouco acima do centro. Nada é cortado.
          // Mais alta: cover normal, o corte cai nas laterais.
          objectFit: maisLarga ? "contain" : "cover",
          objectPosition: maisLarga ? "center 42%" : "center 32%",
          filter: `saturate(${saturate})`,
        }}
        data-razao={razao ?? ""}
        data-modo={maisLarga ? "contain+blur" : "cover"}
      />
    </div>
  );
}
