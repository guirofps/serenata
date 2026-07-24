import { useMemo } from "react";

// As fotos passando ATRÁS da letra, trocando junto com a música.
//
// Não é carrossel: é fundo. A letra segue sendo o conteúdo e as fotos
// respiram por trás — por isso o escurecimento forte e o desfoque leve.
// Foto nítida atrás de texto disputa a leitura e as duas perdem.
//
// O corte acontece nas VIRADAS DE SEÇÃO da própria canção (os marcadores
// que vêm nos timestamps). Isso é o que nenhum concorrente consegue: quem
// usa música de catálogo não tem sincronia nenhuma pra usar, e quem entrega
// só o arquivo não tem página onde mostrar.

export function FotosSincronizadas({
  fotos,
  secoes,
  tempo,
  duracao,
}: {
  fotos: string[];
  secoes: number[];
  tempo: number;
  duracao: number;
}) {
  // Momentos de troca. Preferimos as viradas reais da música; sem elas
  // (música sem marcador), divide o tempo em partes iguais — assim a
  // galeria nunca fica parada por falta de dado.
  const marcos = useMemo(() => {
    if (secoes.length > 1) return secoes;
    if (!duracao || fotos.length < 2) return [];
    const passo = duracao / fotos.length;
    return Array.from({ length: fotos.length }, (_, i) => i * passo);
  }, [secoes, duracao, fotos.length]);

  // Qual foto está no ar. Com mais seções que fotos, a sequência dá a volta
  // — repetir é melhor que a tela ficar preta no fim da música.
  const atual = useMemo(() => {
    if (!fotos.length) return 0;
    if (!marcos.length) return 0;
    let i = 0;
    for (let k = 0; k < marcos.length; k++) if (tempo >= marcos[k]) i = k;
    return i % fotos.length;
  }, [marcos, tempo, fotos.length]);

  if (!fotos.length) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      // Estado no DOM: sem isto, descobrir por que a foto não troca exige
      // adivinhação. Custa nada e torna o comportamento verificável.
      data-foto={atual}
      data-marcos={marcos.length}
      data-tempo={Math.round(tempo)}
    >
      {fotos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          // A primeira carrega com prioridade; as outras podem esperar.
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[2200ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
          style={{
            // Todas ficam montadas e só a opacidade muda: trocar o `src`
            // causaria um piscar branco enquanto a próxima decodifica.
            opacity: i === atual ? 1 : 0,
            // Zoom lento e contínuo. É o que separa "slideshow" de "cinema"
            // e custa nada: só transform, na GPU.
            transform: i === atual ? "scale(1.08)" : "scale(1)",
            transitionProperty: "opacity, transform",
            transitionDuration: i === atual ? "2200ms, 9000ms" : "2200ms, 0ms",
            filter: "saturate(0.9) blur(1px)",
          }}
        />
      ))}

      {/* Escurecimento: sem isto a letra some sobre foto clara. Mais forte no
          topo e na base, onde ficam o cabeçalho e o player. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(13,10,8,0.88) 0%, rgba(13,10,8,0.72) 30%, rgba(13,10,8,0.72) 70%, rgba(13,10,8,0.92) 100%)",
        }}
      />
    </div>
  );
}
