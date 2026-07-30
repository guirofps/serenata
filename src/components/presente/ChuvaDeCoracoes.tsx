// Efeito ESCOLHÍVEL: corações caindo suave sobre a foto, durante a música.
// Inspiração no melhor concorrente, feito com a nossa identidade (rosé/vinho,
// não o vermelho berrante deles) e mais delicado.
//
// @keyframes (não transição): anima de forma confiável assim que monta. Só
// aparece quando a música toca (`ativo`).

// Configs fixas (nada de Math.random, que quebraria o SSR): posição, tamanho,
// atraso e duração variados pra parecer natural.
const CORACOES = [
  { left: 6, size: 16, delay: 0.0, dur: 7.5, op: 0.55 },
  { left: 15, size: 24, delay: 1.8, dur: 9.0, op: 0.7 },
  { left: 24, size: 13, delay: 3.4, dur: 8.0, op: 0.45 },
  { left: 34, size: 20, delay: 0.9, dur: 10.0, op: 0.6 },
  { left: 43, size: 15, delay: 4.2, dur: 8.6, op: 0.5 },
  { left: 52, size: 27, delay: 2.3, dur: 9.6, op: 0.72 },
  { left: 61, size: 14, delay: 5.0, dur: 7.8, op: 0.48 },
  { left: 70, size: 21, delay: 1.2, dur: 10.4, op: 0.62 },
  { left: 79, size: 17, delay: 3.0, dur: 8.3, op: 0.55 },
  { left: 88, size: 23, delay: 4.6, dur: 9.2, op: 0.66 },
  { left: 95, size: 13, delay: 2.0, dur: 7.6, op: 0.42 },
  { left: 30, size: 18, delay: 6.0, dur: 9.8, op: 0.58 },
  { left: 66, size: 15, delay: 6.6, dur: 8.1, op: 0.5 },
  { left: 48, size: 12, delay: 5.6, dur: 7.9, op: 0.4 },
];

// Rosé/coral da paleta CORES_PRESENTE — combina com o mundo escuro e não
// briga com a cor de destaque escolhida.
const COR = "oklch(0.72 0.14 12)";

export function ChuvaDeCoracoes({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      <style>{`
        @keyframes serenataCoracao {
          0%   { transform: translateY(-8vh) rotate(-8deg) scale(0.9); opacity: 0; }
          12%  { opacity: var(--op); }
          88%  { opacity: var(--op); }
          100% { transform: translateY(112vh) rotate(10deg) scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .serenata-coracao { display: none; }
        }
      `}</style>
      {CORACOES.map((c, i) => (
        <svg
          key={i}
          className="serenata-coracao absolute top-0 will-change-transform"
          viewBox="0 0 24 24"
          width={c.size}
          height={c.size}
          style={{
            left: `${c.left}%`,
            color: COR,
            ["--op" as string]: String(c.op),
            filter: "drop-shadow(0 0 6px oklch(0.72 0.14 12 / 0.5))",
            animation: `serenataCoracao ${c.dur}s linear ${c.delay}s infinite`,
          }}
        >
          <path
            fill="currentColor"
            d="M12 21s-6.7-4.3-9.3-8.1C.9 10.3 1.7 6.9 4.6 5.7c2-.8 3.9.1 4.9 1.6l.9 1.3.9-1.3c1-1.5 2.9-2.4 4.9-1.6 2.9 1.2 3.7 4.6 1.9 7.2C18.7 16.7 12 21 12 21z"
          />
        </svg>
      ))}
    </div>
  );
}
