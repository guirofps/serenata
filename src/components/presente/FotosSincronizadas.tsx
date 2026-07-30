import { useMemo, useRef } from "react";

// As fotos como FUNDO CHEIO da tela (nunca cortadas num card), trocando com a
// música — a experiência imersiva do entregável. A letra corre por cima.
//
// Antes eram cartõezinhos que deslizavam e ficavam cortados; o conceito certo
// (referência: o melhor concorrente) é a foto preenchendo a tela inteira,
// com um crossfade calmo nas viradas da canção. A legibilidade da letra vem de
// um gradiente escuro por cima da foto, não de cortar a imagem.
//
// O crossfade é função direta do TEMPO da música (o mesmo `t` do karaokê),
// recalculado a cada frame — nada de transição CSS que às vezes não dispara.

const FADE = 1.2; // segundos de crossfade entre uma foto e a próxima

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
    return i % fotos.length;
  }, [marcos, tempo, fotos.length]);

  // Detecta a troca e mede o progresso do crossfade a partir do tempo.
  const atualRef = useRef(atual);
  const anteriorRef = useRef(-1);
  const mudouEmRef = useRef(-999);
  const ativoRef = useRef(false);
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
  const p = Math.min(1, Math.max(0, (tempo - mudouEmRef.current) / FADE));
  const e = p * p * (3 - 2 * p); // smoothstep

  if (!fotos.length) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0d0a08]" data-foto={atual} data-ativo={ativo ? "1" : "0"}>
      {fotos.map((src, i) => {
        // Opacidade: a atual entra, a anterior sai, o resto fica invisível.
        let op = 0;
        if (ativo) {
          if (i === atual) op = e;
          else if (i === anteriorRef.current && p < 1) op = 1 - e;
        }
        return (
          <img
            key={src}
            src={src}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover will-change-[opacity]"
            style={{ opacity: op, filter: "saturate(1.02)" }}
          />
        );
      })}

      {/* Gradiente pra letra: escuro em cima (título) e embaixo (letra), a foto
          respira no meio. É isto que garante a leitura sem cortar a imagem. */}
      <div
        className="absolute inset-0"
        style={{
          opacity: ativo ? 1 : 0,
          transition: "opacity 1s ease",
          background:
            "linear-gradient(to bottom, rgba(13,10,8,0.72) 0%, rgba(13,10,8,0.35) 26%, rgba(13,10,8,0.45) 60%, rgba(13,10,8,0.92) 100%)",
        }}
      />
    </div>
  );
}
