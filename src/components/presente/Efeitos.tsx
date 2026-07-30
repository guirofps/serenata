// Efeitos ESCOLHÍVEIS que caem sobre a foto durante a música. Vários modelos
// pra o comprador escolher (corações, estrelas, pétalas, luzes), na nossa
// identidade (rosé/ouro, delicado), mais sutil que o concorrente.
//
// z-40: CAI NA FRENTE da letra e da foto (como no melhor concorrente), mas
// pointer-events-none, então não atrapalha o toque. @keyframes dispara
// confiável assim que monta; só aparece com a música tocando (`ativo`).

export const EFEITOS = [
  { chave: "nenhum", rotulo: "Nenhum" },
  { chave: "coracoes", rotulo: "Corações 💗" },
  { chave: "estrelas", rotulo: "Estrelas ✨" },
  { chave: "petalas", rotulo: "Pétalas 🌸" },
  { chave: "luzes", rotulo: "Luzes ✨" },
] as const;

// Posições/tempos fixos (nada de Math.random, que quebraria o SSR).
const PART = [
  { left: 5, size: 16, delay: 0.0, dur: 8.0, op: 0.6 },
  { left: 14, size: 24, delay: 1.7, dur: 9.5, op: 0.75 },
  { left: 23, size: 13, delay: 3.3, dur: 8.2, op: 0.5 },
  { left: 33, size: 20, delay: 0.8, dur: 10.5, op: 0.65 },
  { left: 42, size: 15, delay: 4.1, dur: 8.8, op: 0.55 },
  { left: 51, size: 27, delay: 2.2, dur: 9.8, op: 0.78 },
  { left: 60, size: 14, delay: 5.0, dur: 8.0, op: 0.5 },
  { left: 69, size: 21, delay: 1.1, dur: 10.8, op: 0.68 },
  { left: 78, size: 17, delay: 3.0, dur: 8.5, op: 0.6 },
  { left: 87, size: 23, delay: 4.6, dur: 9.4, op: 0.72 },
  { left: 95, size: 13, delay: 2.0, dur: 7.8, op: 0.46 },
  { left: 29, size: 18, delay: 6.0, dur: 10.0, op: 0.62 },
  { left: 65, size: 15, delay: 6.6, dur: 8.3, op: 0.54 },
  { left: 47, size: 12, delay: 5.6, dur: 8.1, op: 0.44 },
];

const ROSE = "oklch(0.74 0.14 12)";
const OURO = "oklch(0.84 0.12 82)";

// Desenho de cada partícula por tipo.
function Forma({ tipo, size }: { tipo: string; size: number }) {
  if (tipo === "estrelas") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ color: OURO }}>
        <path fill="currentColor" d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
      </svg>
    );
  }
  if (tipo === "petalas") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size * 1.3} style={{ color: ROSE }}>
        <path fill="currentColor" d="M12 2c4 3 6 7 6 11a6 6 0 01-12 0c0-4 2-8 6-11z" />
      </svg>
    );
  }
  if (tipo === "luzes") {
    return (
      <span
        style={{
          display: "block",
          width: size,
          height: size,
          borderRadius: "9999px",
          background: `radial-gradient(circle, ${OURO} 0%, transparent 70%)`,
        }}
      />
    );
  }
  // coracoes (padrão)
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ color: ROSE }}>
      <path
        fill="currentColor"
        d="M12 21s-6.7-4.3-9.3-8.1C.9 10.3 1.7 6.9 4.6 5.7c2-.8 3.9.1 4.9 1.6l.9 1.3.9-1.3c1-1.5 2.9-2.4 4.9-1.6 2.9 1.2 3.7 4.6 1.9 7.2C18.7 16.7 12 21 12 21z"
      />
    </svg>
  );
}

export function Efeitos({ tipo, ativo }: { tipo: string | null; ativo: boolean }) {
  if (!ativo || !tipo || tipo === "nenhum") return null;
  const brilho = tipo === "estrelas" || tipo === "luzes" ? OURO : ROSE;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <style>{`
        @keyframes serenataQueda {
          0%   { transform: translateY(-10vh) rotate(-8deg); opacity: 0; }
          12%  { opacity: var(--op); }
          88%  { opacity: var(--op); }
          100% { transform: translateY(114vh) rotate(12deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .serenata-part { display: none; } }
      `}</style>
      {PART.map((c, i) => (
        <span
          key={i}
          className="serenata-part absolute top-0 will-change-transform"
          style={{
            left: `${c.left}%`,
            ["--op" as string]: String(c.op),
            filter: `drop-shadow(0 0 6px color-mix(in oklch, ${brilho} 55%, transparent))`,
            animation: `serenataQueda ${c.dur}s linear ${c.delay}s infinite`,
          }}
        >
          <Forma tipo={tipo} size={c.size} />
        </span>
      ))}
    </div>
  );
}
