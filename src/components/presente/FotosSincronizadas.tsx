import { useMemo } from "react";

// As fotos passando durante a música — como FOTOS REVELADAS, não como papel
// de parede.
//
// A primeira versão usava a imagem sangrando na tela inteira. Isso cria uma
// briga insolúvel: pra letra ficar legível é preciso escurecer a foto, e
// escurecendo o bastante a foto some (aconteceu — ficou em 72% de preto e
// não se via nada).
//
// Vira objeto e o conflito acaba: a revelada tem borda, sombra e uma leve
// torta, o texto corre no escuro AO REDOR dela, e por isso a foto pode
// aparecer clara. De quebra é o que parece presente — pilha de fotos na
// gaveta, não fundo de site.
//
// A troca acontece nas viradas de seção da própria canção.

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
  // Momentos de troca: as viradas reais da música. Sem marcador (música sem
  // seção marcada), divide o tempo em partes iguais pra galeria não ficar
  // parada por falta de dado.
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
    // Mais seções que fotos: a sequência dá a volta. Repetir é melhor que
    // deixar a tela vazia no fim da música.
    return i % fotos.length;
  }, [marcos, tempo, fotos.length]);

  if (!fotos.length) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      data-foto={atual}
      data-marcos={marcos.length}
      data-tempo={Math.round(tempo)}
    >
      {/* Escuro por baixo de tudo: é o fundo real da página, e é ele que
          garante a leitura da letra — não um filtro sobre a foto. */}
      <div className="absolute inset-0 bg-[#0d0a08]" />

      {fotos.map((src, i) => {
        const ativa = i === atual;
        // Torta alternada, sempre a mesma pra cada foto: assim a pilha
        // parece jogada na mesa e não gerada por script.
        const giro = i % 2 === 0 ? -2.6 : 2.4;
        return (
          <figure
            key={src}
            className="absolute left-1/2 top-1/2 m-0 transition-all duration-[1400ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
            style={{
              // Largura em vw com teto: no celular ocupa quase a tela, no
              // desktop não vira outdoor.
              width: "min(78vw, 380px)",
              // Todas montadas, só a opacidade e o transform mudam. Trocar
              // o src piscaria branco enquanto a próxima decodifica.
              opacity: ativa ? 1 : 0,
              transform: `translate(-50%, -50%) rotate(${giro}deg) scale(${ativa ? 1 : 0.94})`,
              // Papel: borda grossa embaixo, como revelada de verdade.
              padding: "12px 12px 46px",
              background: "#f4ece0",
              borderRadius: "3px",
              boxShadow: ativa
                ? "0 30px 60px -20px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.4)"
                : "0 10px 30px -20px rgba(0,0,0,0.5)",
            }}
          >
            <img
              src={src}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className="block aspect-square w-full object-cover"
              style={{ filter: "saturate(0.96) contrast(1.02)" }}
            />
          </figure>
        );
      })}

      {/* Véu sobre a foto, MUITO mais leve que na versão de papel de parede
          (era 72%): aqui ele só assenta a imagem no fundo e devolve o
          contraste onde a letra passa por cima. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(13,10,8,0.72) 0%, rgba(13,10,8,0.34) 30%, rgba(13,10,8,0.34) 70%, rgba(13,10,8,0.8) 100%)",
        }}
      />
    </div>
  );
}
