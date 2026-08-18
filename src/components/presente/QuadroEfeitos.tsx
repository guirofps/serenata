// OS EFEITOS DA PÁGINA PRESENTE, PARADOS.
//
// Na página presente eles caem pela tela durante a música, e o movimento é
// metade da graça. No papel não existe movimento, então a tradução não é
// "mesmo efeito sem animação": é outro problema. Partícula parada e opaca vira
// sujeira em cima do texto, e num quadro que a pessoa vai olhar todo dia isso
// cansa em uma semana.
//
// As três regras que fazem funcionar impresso:
//
// 1. FICAM NAS BORDAS. Uma máscara radial apaga o miolo, que é onde vivem o
//    título e a letra. O efeito emoldura, não invade.
// 2. OPACIDADE BAIXA (0,10 a 0,22). Na tela isso quase não aparece; no papel
//    fosco vira textura. Impressão sempre escurece o que está claro.
// 3. TAMANHOS E POSIÇÕES FIXOS, não aleatórios. O mesmo quadro impresso duas
//    vezes tem que sair igual, senão a pessoa reclama que "veio diferente".

const ROSE = "oklch(0.82 0.13 10)";
const OURO = "oklch(0.90 0.13 88)";

/** Posições fixas, em % da folha. Espalhadas pelas margens, nunca no centro. */
const PECAS = [
  { x: 6, y: 8, t: 30, g: -12, o: 0.2 },
  { x: 16, y: 22, t: 18, g: 8, o: 0.13 },
  { x: 4, y: 41, t: 24, g: 15, o: 0.16 },
  { x: 11, y: 63, t: 15, g: -6, o: 0.11 },
  { x: 5, y: 82, t: 26, g: 10, o: 0.18 },
  { x: 18, y: 93, t: 17, g: -14, o: 0.12 },
  { x: 94, y: 11, t: 27, g: 9, o: 0.19 },
  { x: 85, y: 27, t: 16, g: -11, o: 0.12 },
  { x: 96, y: 46, t: 22, g: 13, o: 0.15 },
  { x: 88, y: 68, t: 18, g: -7, o: 0.13 },
  { x: 95, y: 86, t: 28, g: 6, o: 0.2 },
  { x: 80, y: 96, t: 15, g: -15, o: 0.11 },
  { x: 38, y: 4, t: 19, g: 11, o: 0.13 },
  { x: 62, y: 6, t: 22, g: -9, o: 0.15 },
  { x: 30, y: 97, t: 20, g: 7, o: 0.14 },
  { x: 68, y: 95, t: 24, g: -12, o: 0.16 },
];

function Forma({ tipo, tamanho, cor }: { tipo: string; tamanho: number; cor: string }) {
  if (tipo === "estrelas") {
    return (
      <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} style={{ color: OURO }}>
        <path fill="currentColor" d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
      </svg>
    );
  }
  if (tipo === "petalas") {
    return (
      <svg viewBox="0 0 24 24" width={tamanho} height={tamanho * 1.25} style={{ color: ROSE }}>
        <path fill="currentColor" d="M12 2c4 3 6 7 6 11a6 6 0 01-12 0c0-4 2-8 6-11z" />
      </svg>
    );
  }
  if (tipo === "luzes") {
    // Círculo cheio com desfoque: é a luz de vela da marca, e no papel vira
    // um halo suave em vez de uma bola chapada.
    return (
      <span
        style={{
          display: "block",
          width: tamanho,
          height: tamanho,
          borderRadius: 9999,
          background: cor,
          filter: `blur(${Math.max(2, tamanho / 5)}px)`,
        }}
      />
    );
  }
  // corações
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} style={{ color: ROSE }}>
      <path
        fill="currentColor"
        d="M12 21s-7.5-4.6-9.5-9A5.3 5.3 0 0112 5.7 5.3 5.3 0 0121.5 12c-2 4.4-9.5 9-9.5 9z"
      />
    </svg>
  );
}

export function QuadroEfeitos({ tipo, cor }: { tipo: string; cor: string }) {
  if (!tipo || tipo === "nenhum") return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        // A MÁSCARA é o que impede o efeito de brigar com o texto: transparente
        // no miolo, opaca nas bordas.
        WebkitMaskImage:
          "radial-gradient(ellipse 62% 54% at 50% 50%, transparent 42%, black 92%)",
        maskImage: "radial-gradient(ellipse 62% 54% at 50% 50%, transparent 42%, black 92%)",
      }}
    >
      {PECAS.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `translate(-50%,-50%) rotate(${p.g}deg)`,
            opacity: p.o,
          }}
        >
          <Forma tipo={tipo} tamanho={p.t} cor={cor} />
        </span>
      ))}
    </div>
  );
}
