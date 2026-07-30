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
//
// Calibragem: a primeira versão era invisível na prática — partículas de
// 12-27px (minúsculas no celular), translúcidas, com atraso de até 6,6s e
// queda de 10s. Agora: MAIORES (22-46px), mais opacas, quedas mais curtas
// (5-8s) e a maioria com atraso < 2s, pra a chuva já estar formada no primeiro
// segundo. Continua sutil o bastante pra não tapar a letra.
const PART = [
  { left: 4, size: 30, delay: 0.0, dur: 6.4, op: 0.85 },
  { left: 12, size: 22, delay: 0.5, dur: 5.6, op: 0.7 },
  { left: 19, size: 40, delay: 1.4, dur: 7.2, op: 0.95 },
  { left: 27, size: 26, delay: 0.2, dur: 6.0, op: 0.75 },
  { left: 34, size: 34, delay: 2.1, dur: 6.8, op: 0.9 },
  { left: 41, size: 23, delay: 1.0, dur: 5.4, op: 0.68 },
  { left: 48, size: 46, delay: 0.7, dur: 7.8, op: 1.0 },
  { left: 55, size: 28, delay: 2.6, dur: 6.2, op: 0.8 },
  { left: 62, size: 24, delay: 0.35, dur: 5.8, op: 0.72 },
  { left: 69, size: 38, delay: 1.8, dur: 7.0, op: 0.92 },
  { left: 76, size: 25, delay: 0.9, dur: 6.6, op: 0.74 },
  { left: 83, size: 32, delay: 2.9, dur: 6.1, op: 0.86 },
  { left: 90, size: 27, delay: 1.2, dur: 5.9, op: 0.78 },
  { left: 96, size: 36, delay: 0.15, dur: 7.4, op: 0.9 },
  { left: 8, size: 24, delay: 3.2, dur: 6.3, op: 0.7 },
  { left: 23, size: 33, delay: 3.6, dur: 7.1, op: 0.88 },
  { left: 45, size: 26, delay: 4.0, dur: 5.7, op: 0.75 },
  { left: 58, size: 42, delay: 3.4, dur: 7.6, op: 0.96 },
  { left: 72, size: 23, delay: 4.4, dur: 6.0, op: 0.68 },
  { left: 87, size: 29, delay: 3.9, dur: 6.9, op: 0.82 },
];

// Cores CLARAS de propósito: as partículas passam por cima de foto (que pode
// ser escura ou clara), então precisam de luminância alta pra não sumir.
const ROSE = "oklch(0.82 0.13 10)";
const OURO = "oklch(0.90 0.13 88)";

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
