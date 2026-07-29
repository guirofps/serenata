import { useMemo, useRef } from "react";

// As fotos passando durante a música — um carrossel calmo atrás da letra.
//
// O DESLIZE é calculado a cada frame a partir do TEMPO da música (o mesmo `t`
// que faz o karaokê acender). Nada de `transition` nem `@keyframes` do CSS:
// essas dependem do relógio de animação do navegador, que em certos casos não
// dispara (estado inicial e final no mesmo instante) e deixava a foto "parada
// no meio", virando só um fade. Aqui a posição é função direta do tempo, então
// ela se MOVE de verdade, igual à letra correndo.
//
// A que entra vem da direita (100vw) até o centro; a anterior sai pela
// esquerda (-100vw). Opacidade cheia sempre: o que aparece é o movimento da
// posição, não fade. E nada disso existe antes do play.

const SLIDE = 0.9; // segundos que o deslize leva pra atravessar

export function FotosSincronizadas({
  fotos,
  secoes,
  tempo,
  duracao,
  ativo,
}: {
  fotos: string[];
  secoes: number[];
  tempo: number;
  duracao: number;
  /** Só entra em cena depois que a música começa (e a letra já rola). */
  ativo: boolean;
}) {
  // Momentos de troca: as viradas reais da música. Sem marcador, divide o
  // tempo em partes iguais pra galeria não ficar parada por falta de dado.
  const marcos = useMemo(() => {
    if (secoes.length > 1) return secoes;
    if (!duracao || fotos.length < 2) return [];
    const passo = duracao / fotos.length;
    return Array.from({ length: fotos.length }, (_, i) => i * passo);
  }, [secoes, duracao, fotos.length]);

  const atual = useMemo(() => {
    if (!fotos.length || !marcos.length) return 0;
    let i = 0;
    for (let k = 0; k < marcos.length; k++) if (tempo >= marcos[k]) i = k;
    return i % fotos.length; // mais seções que fotos: a sequência dá a volta
  }, [marcos, tempo, fotos.length]);

  // Refs atualizados no render (idempotente por frame): guardam a foto que
  // saiu e o INSTANTE em que a troca aconteceu, pra medir o progresso do
  // deslize a partir do tempo da música.
  const atualRef = useRef(atual);
  const anteriorRef = useRef(-1);
  const mudouEmRef = useRef(-999);
  const ativoRef = useRef(false);

  // No primeiro frame ativo, marca o tempo pra PRIMEIRA foto deslizar pra
  // dentro (senão ela apareceria já no centro).
  if (ativo && !ativoRef.current) {
    ativoRef.current = true;
    mudouEmRef.current = tempo;
  }
  if (!ativo) ativoRef.current = false;

  if (atualRef.current !== atual) {
    anteriorRef.current = atualRef.current;
    atualRef.current = atual;
    mudouEmRef.current = tempo;
  }

  // Progresso do deslize (0 → 1) com desaceleração no fim (easeOutCubic).
  const p = Math.min(1, Math.max(0, (tempo - mudouEmRef.current) / SLIDE));
  const e = 1 - Math.pow(1 - p, 3);

  if (!fotos.length) return null;

  const moldura: React.CSSProperties = {
    width: "min(80vw, 360px)",
    padding: "10px",
    background: "#f4ece0",
    borderRadius: "6px",
    boxShadow: "0 30px 60px -20px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.4)",
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      data-foto={atual}
      data-marcos={marcos.length}
      data-tempo={Math.round(tempo)}
      data-ativo={ativo ? "1" : "0"}
    >
      {/* Escuro por baixo de tudo: garante a leitura da letra. */}
      <div className="absolute inset-0 bg-[#0d0a08]" />

      {fotos.map((src, i) => {
        // Posição em vw: a atual desliza da direita ao centro; a anterior sai
        // pra esquerda; o resto fica parado fora da tela, à direita.
        let xvw: number;
        if (!ativo) xvw = 100;
        else if (i === atual) xvw = (1 - e) * 100;
        else if (i === anteriorRef.current && p < 1) xvw = -e * 100;
        else xvw = 100;
        return (
          <figure
            key={src}
            className="absolute left-1/2 top-1/2 m-0 will-change-transform"
            style={{
              ...moldura,
              opacity: 1,
              transform: `translate(calc(-50% + ${xvw.toFixed(2)}vw), -50%)`,
            }}
          >
            <img
              src={src}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className="block aspect-square w-full object-cover"
              style={{ filter: "saturate(0.96) contrast(1.02)", borderRadius: "2px" }}
            />
          </figure>
        );
      })}

      {/* Véu leve: assenta a imagem no fundo e devolve contraste onde a letra
          passa por cima. */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: ativo ? 1 : 0,
          background:
            "linear-gradient(to bottom, rgba(13,10,8,0.72) 0%, rgba(13,10,8,0.34) 30%, rgba(13,10,8,0.34) 70%, rgba(13,10,8,0.8) 100%)",
        }}
      />
    </div>
  );
}
