import { useMemo } from "react";

// Exibição da letra no reveal.
//
// NOTA (23/07): a versão anterior tentava karaokê — trilha instrumental +
// revelação linha a linha "no ritmo". Foi descartada por ser TEATRO: a base
// era gerada independente da letra, então não existe melodia à qual as
// palavras correspondam. Ninguém sabe a entonação nem onde cada verso entra,
// e destacar linhas promete uma sincronia que não existe — pior que silêncio.
//
// A emoção vem de ouvir a música CANTADA de verdade. O player do áudio real
// entra quando o desenho do paywall estiver decidido.

type Linha = { texto: string; marcador: boolean };

function parseLinhas(letra: string): Linha[] {
  return letra
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((texto) => ({ texto, marcador: /^\[.*\]$/.test(texto) }));
}

export function KaraokePlayer({ letra }: { letra: string; genero?: string }) {
  const linhas = useMemo(() => parseLinhas(letra), [letra]);

  return (
    <div className="space-y-1">
      {linhas.map((l, i) =>
        l.marcador ? (
          <p
            key={i}
            className="pt-3 text-[11px] uppercase tracking-widest text-muted-foreground/60"
          >
            {l.texto.replace(/[[\]]/g, "")}
          </p>
        ) : (
          <p key={i} className="text-[15px] leading-relaxed">
            {l.texto}
          </p>
        ),
      )}
    </div>
  );
}
