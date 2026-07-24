import { useMemo, useRef } from "react";

// As fotos passando durante a música — como FOTOS REVELADAS, não como papel
// de parede.
//
// Por que objeto e não fundo: foto sangrando na tela cria uma briga
// insolúvel. Pra letra ficar legível é preciso escurecer a imagem, e
// escurecendo o bastante a foto some (aconteceu: ficou em 72% de preto e
// não se via nada). Como objeto, o texto corre no escuro AO REDOR dela e a
// foto pode aparecer clara.
//
// O movimento: a que sai SOBE e some, a próxima chega POR BAIXO — na mesma
// direção em que a letra corre. E nada disso existe antes do play: a página
// parada é só o convite.

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
  /** Só entra em cena depois que a música começa. */
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
    // Mais seções que fotos: a sequência dá a volta. Repetir é melhor que
    // deixar a tela vazia no fim da música.
    return i % fotos.length;
  }, [marcos, tempo, fotos.length]);

  // Guarda qual foto acabou de sair, pra ela subir em vez de sumir no lugar.
  // Refs atualizados no render: só trocam quando o valor MUDA, então isto é
  // idempotente para re-renders com o mesmo `atual` (o que acontece o tempo
  // todo, já que `tempo` muda a cada frame).
  const atualRef = useRef(atual);
  const anteriorRef = useRef(-1);
  if (atualRef.current !== atual) {
    anteriorRef.current = atualRef.current;
    atualRef.current = atual;
  }

  if (!fotos.length) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      data-foto={atual}
      data-marcos={marcos.length}
      data-tempo={Math.round(tempo)}
      data-ativo={ativo ? "1" : "0"}
    >
      {/* Escuro por baixo de tudo: é o fundo real da página, e é ele que
          garante a leitura da letra — não um filtro sobre a foto. */}
      <div className="absolute inset-0 bg-[#0d0a08]" />

      {fotos.map((src, i) => {
        const naTela = ativo && i === atual;
        const acabouDeSair = ativo && i === anteriorRef.current && i !== atual;
        // Torta fixa por foto: a pilha parece jogada na mesa, não gerada
        // por script.
        const giro = i % 2 === 0 ? -2.6 : 2.4;
        // Quem saiu vai pra cima; quem ainda não entrou espera embaixo.
        const y = naTela ? "0px" : acabouDeSair ? "-14vh" : "16vh";
        return (
          <figure
            key={src}
            className="absolute left-1/2 top-1/2 m-0 will-change-[transform,opacity] transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              // No celular quase toma a tela; no desktop não vira outdoor.
              width: "min(78vw, 380px)",
              opacity: naTela ? 1 : 0,
              transform: `translate(-50%, calc(-50% + ${y})) rotate(${
                naTela ? giro : giro * 1.8
              }deg) scale(${naTela ? 1 : 0.92})`,
              // Papel: borda grossa embaixo, como revelada de verdade.
              padding: "12px 12px 46px",
              background: "#f4ece0",
              borderRadius: "3px",
              boxShadow: naTela
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

      {/* Véu leve: aqui ele só assenta a imagem no fundo e devolve contraste
          onde a letra passa por cima. Não precisa mais salvar a leitura —
          disso cuida o preto atrás. */}
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
