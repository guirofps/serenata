// Efeitos ESCOLHÍVEIS caindo sobre a foto durante a música (corações,
// estrelas, pétalas, luzes), na nossa identidade.
//
// A QUEDA É FUNÇÃO DO TEMPO DA MÚSICA, não de @keyframes do CSS. Dois motivos,
// os dois aprendidos na marra:
//   1. animação de CSS é DESLIGADA pelo sistema quando o aparelho tem
//      "Reduzir movimento" ligado (comum no iPhone) — e aí o efeito que o
//      comprador escolheu de propósito simplesmente não acontecia;
//   2. é o mesmo mecanismo do karaokê e das fotos, que já funciona e que dá
//      pra VERIFICAR (basta mover o currentTime e ler a posição).
// Bônus: as partículas ficam sincronizadas com a música e param quando ela
// pausa, o que é o comportamento certo.

// A `chave` é o que fica no banco e NUNCA muda de idioma; só o rótulo muda.
export const EFEITOS = [
  { chave: "nenhum", rotulo: "Nenhum", rotuloEs: "Ninguno" },
  { chave: "coracoes", rotulo: "Corações 💗", rotuloEs: "Corazones 💗" },
  { chave: "estrelas", rotulo: "Estrelas ✨", rotuloEs: "Estrellas ✨" },
  { chave: "petalas", rotulo: "Pétalas 🌸", rotuloEs: "Pétalos 🌸" },
  { chave: "luzes", rotulo: "Luzes 🕯️", rotuloEs: "Luces 🕯️" },
] as const;

/** O rótulo do efeito no idioma da venda. */
export function rotuloEfeito(e: (typeof EFEITOS)[number], locale: "pt" | "es") {
  return locale === "es" ? e.rotuloEs : e.rotulo;
}

// Partículas fixas (nada de Math.random, que quebraria o SSR).
// `vel` = fração da tela por segundo; `fase` espalha o início.
const PART = [
  { left: 4, size: 30, vel: 0.17, fase: 0.05, giro: -14, op: 0.85 },
  { left: 12, size: 22, vel: 0.22, fase: 0.42, giro: 10, op: 0.7 },
  { left: 19, size: 40, vel: 0.15, fase: 0.78, giro: -8, op: 0.95 },
  { left: 27, size: 26, vel: 0.2, fase: 0.19, giro: 16, op: 0.75 },
  { left: 34, size: 34, vel: 0.16, fase: 0.63, giro: -11, op: 0.9 },
  { left: 41, size: 23, vel: 0.24, fase: 0.31, giro: 13, op: 0.68 },
  { left: 48, size: 46, vel: 0.13, fase: 0.87, giro: -6, op: 1.0 },
  { left: 55, size: 28, vel: 0.19, fase: 0.11, giro: 9, op: 0.8 },
  { left: 62, size: 24, vel: 0.23, fase: 0.55, giro: -15, op: 0.72 },
  { left: 69, size: 38, vel: 0.14, fase: 0.28, giro: 7, op: 0.92 },
  { left: 76, size: 25, vel: 0.21, fase: 0.71, giro: -10, op: 0.74 },
  { left: 83, size: 32, vel: 0.17, fase: 0.03, giro: 12, op: 0.86 },
  { left: 90, size: 27, vel: 0.2, fase: 0.47, giro: -13, op: 0.78 },
  { left: 96, size: 36, vel: 0.15, fase: 0.92, giro: 8, op: 0.9 },
  { left: 8, size: 24, vel: 0.22, fase: 0.36, giro: -9, op: 0.7 },
  { left: 23, size: 33, vel: 0.16, fase: 0.68, giro: 14, op: 0.88 },
  { left: 45, size: 26, vel: 0.21, fase: 0.15, giro: -12, op: 0.75 },
  { left: 58, size: 42, vel: 0.13, fase: 0.83, giro: 6, op: 0.96 },
  { left: 72, size: 23, vel: 0.25, fase: 0.51, giro: -16, op: 0.68 },
  { left: 87, size: 29, vel: 0.18, fase: 0.24, giro: 11, op: 0.82 },
];

// Cores CLARAS: as partículas passam por cima de foto (que pode ser escura ou
// clara), então precisam de luminância alta pra não sumir.
const ROSE = "oklch(0.82 0.13 10)";
const OURO = "oklch(0.90 0.13 88)";

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
      <svg viewBox="0 0 24 24" width={size} height={size * 1.25} style={{ color: ROSE }}>
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
          background: `radial-gradient(circle, ${OURO} 0%, color-mix(in oklch, ${OURO} 40%, transparent) 45%, transparent 72%)`,
        }}
      />
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ color: ROSE }}>
      <path
        fill="currentColor"
        d="M12 21s-6.7-4.3-9.3-8.1C.9 10.3 1.7 6.9 4.6 5.7c2-.8 3.9.1 4.9 1.6l.9 1.3.9-1.3c1-1.5 2.9-2.4 4.9-1.6 2.9 1.2 3.7 4.6 1.9 7.2C18.7 16.7 12 21 12 21z"
      />
    </svg>
  );
}

export function Efeitos({
  tipo,
  ativo,
  tempo,
  contido = false,
  escala = 1,
}: {
  tipo: string | null;
  ativo: boolean;
  /** Segundo atual da música — é ele que move as partículas. */
  tempo: number;
  /** `true` prende o efeito ao elemento pai (usado na prévia do editor). */
  contido?: boolean;
  /** Reduz o tamanho das partículas (prévia pequena). */
  escala?: number;
}) {
  const ligado = ativo && Boolean(tipo) && tipo !== "nenhum";
  if (!ligado) return null;
  const brilho = tipo === "estrelas" || tipo === "luzes" ? OURO : ROSE;

  return (
    <div
      aria-hidden
      className={
        contido
          ? "pointer-events-none absolute inset-0 z-20 overflow-hidden"
          : "pointer-events-none fixed inset-0 z-40 overflow-hidden"
      }
    >
      {PART.map((c, i) => {
        // Ciclo 0→1 (topo → base), com fase pra não caírem todas juntas.
        const ciclo = (c.fase + tempo * c.vel) % 1;
        // -10vh a 110vh: entra acima da tela e sai embaixo.
        const y = -10 + ciclo * 120;
        // Balanço lateral, pra não parecer queda de elevador.
        const x = Math.sin((tempo * c.vel + c.fase) * Math.PI * 2) * 14;
        // Some nas pontas do trajeto (entrada e saída).
        const fade = Math.min(1, Math.min(ciclo, 1 - ciclo) * 8);
        return (
          <span
            key={i}
            className="absolute will-change-transform"
            style={{
              left: `${c.left}%`,
              // Contido: a queda é % da altura do PAI (top). Tela cheia: vh no
              // transform, que é mais barato de animar.
              top: contido ? `${y}%` : 0,
              opacity: c.op * fade,
              transform: contido
                ? `translate3d(${(x * escala).toFixed(1)}px, 0, 0) rotate(${(c.giro * ciclo).toFixed(1)}deg)`
                : `translate3d(${x.toFixed(1)}px, ${y.toFixed(2)}vh, 0) rotate(${(c.giro * ciclo).toFixed(1)}deg)`,
              filter: `drop-shadow(0 0 ${7 * escala}px color-mix(in oklch, ${brilho} 60%, transparent))`,
            }}
          >
            <Forma tipo={tipo as string} size={Math.max(4, Math.round(c.size * escala))} />
          </span>
        );
      })}
    </div>
  );
}
