import { useMemo, useRef } from "react";

// As fotos passando durante a música — um carrossel calmo atrás da letra.
//
// Movimento: a que sai DESLIZA pra esquerda e some; a próxima entra pela
// direita. Um trilho horizontal, como quem vira as páginas de um álbum. Nada
// de rotação (ficava torta e cortada nas bordas) nem de troca seca.
//
// Por que objeto e não papel de parede: foto sangrando na tela cria uma briga
// insolúvel com a legibilidade da letra. Como objeto emoldurado, o texto corre
// no escuro AO REDOR dela e a foto pode aparecer clara. E nada disso existe
// antes do play: a página parada é só o convite.

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

  // Guarda qual foto acabou de sair, pra ela deslizar pra esquerda em vez de
  // sumir no lugar. Refs atualizados no render: só trocam quando o valor MUDA,
  // então isto é idempotente para re-renders com o mesmo `atual` (o que
  // acontece o tempo todo, já que `tempo` muda a cada frame).
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
        // Trilho horizontal em OPACIDADE CHEIA: a foto atravessa a tela e você
        // VÊ o movimento. A que entra vem da direita (115vw) até o centro (0);
        // a que sai vai pra esquerda (-115vw). As demais ficam paradas fora da
        // tela, à direita, esperando a vez.
        //
        // Truque do carrossel infinito: a que já saiu (à esquerda) precisa
        // "voltar" pra fila da direita pra entrar de novo quando reciclar. Esse
        // salto de -115vw pra 115vw é feito SEM transição (parada = 0ms), senão
        // ela atravessaria a tela ao contrário. Só os dois estados em cena (a
        // que entra e a que sai) animam.
        const parada = !naTela && !acabouDeSair;
        const x = naTela ? "0vw" : acabouDeSair ? "-115vw" : "115vw";
        return (
          <figure
            key={src}
            className="absolute left-1/2 top-1/2 m-0 will-change-transform ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:!transition-none"
            style={{
              // No celular quase toma a largura; no desktop não vira outdoor.
              width: "min(80vw, 360px)",
              // Opacidade cheia sempre: quem não está em cena está FORA da tela
              // (115vw), invisível pela posição, não pelo fade. É isso que faz
              // o deslize aparecer em vez de virar um crossfade.
              opacity: 1,
              transitionProperty: "transform",
              transitionDuration: parada ? "0ms" : "1000ms",
              transform: `translate(calc(-50% + ${x}), -50%)`,
              // Moldura de papel, simétrica (sem barra grossa embaixo que
              // deixava a foto retangular e cortada).
              padding: "10px",
              background: "#f4ece0",
              borderRadius: "6px",
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
              style={{ filter: "saturate(0.96) contrast(1.02)", borderRadius: "2px" }}
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
