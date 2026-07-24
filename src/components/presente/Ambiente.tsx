// Fundo ambiente da página-presente.
//
// É o que tira a cara de "documento": a página respira mesmo parada.
//
// Feito com gradientes em movimento e não com vídeo: pesa ZERO byte de
// rede, funciona offline, não trava em celular fraco e não tem risco de
// autoplay bloqueado no iOS. O vídeo entra depois como enfeite opcional,
// nunca como estrutura.
//
// Só `transform` e `opacity` animam (§4.1 do playbook) — nada de animar
// `background-position`, que força repaint a cada frame.

export function Ambiente({ intenso = false }: { intenso?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Vídeo autoral (luz de vela desfocada) — só MONTA quando a música
          toca. Duas razões: o carregamento inicial não paga um byte por ele,
          e a sala "acende" junto com a canção, que é a narrativa certa.
          53 KB; se falhar, os gradientes abaixo seguram a cena sozinhos. */}
      {intenso && (
        <video
          src="/video/ambiente.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          // A opacidade final vive no style, NÃO no fim da animação: se a
          // animação não rodar (motor sem frames, política de energia), o
          // vídeo ainda aparece em vez de virar download invisível.
          style={{ opacity: 0.32, animation: "acende 2.4s ease-out" }}
        />
      )}

      {/* brasa quente: o "calor" da serenata, subindo devagar */}
      <div
        className="absolute left-1/2 top-1/2 h-[130vmax] w-[130vmax] -translate-x-1/2 -translate-y-1/2 opacity-70 motion-reduce:animate-none"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--presente-destaque) 16%, transparent), transparent 70%)",
          animation: "brasa 26s ease-in-out infinite",
        }}
      />
      {/* segundo foco, fora de fase, pra luz nunca parecer estática */}
      <div
        className="absolute left-[18%] top-[62%] h-[90vmax] w-[90vmax] -translate-x-1/2 -translate-y-1/2 opacity-50 motion-reduce:animate-none"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--presente-vinho) 30%, transparent), transparent 68%)",
          animation: "brasa 34s ease-in-out infinite reverse",
        }}
      />
      {/* poeira dourada: pontos lentos, dá profundidade sem custo */}
      <div
        className={intenso ? "absolute inset-0 opacity-[0.16]" : "absolute inset-0 opacity-[0.09]"}
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 20% 30%, var(--presente-destaque), transparent), radial-gradient(1.5px 1.5px at 70% 65%, var(--presente-destaque), transparent), radial-gradient(1px 1px at 45% 85%, var(--presente-destaque), transparent), radial-gradient(1px 1px at 85% 20%, var(--presente-destaque), transparent)",
          backgroundSize: "60vmax 60vmax",
          animation: "poeira 40s linear infinite",
        }}
      />
      {/* vinheta: fecha as bordas e joga o olho pro centro */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 60% at 50% 45%, transparent 40%, rgba(6,4,3,0.72) 100%)",
        }}
      />

      <style>{`
        @keyframes brasa {
          0%,100% { transform: translate(-50%,-50%) scale(1);    opacity: .55; }
          50%     { transform: translate(-50%,-52%) scale(1.14); opacity: .8; }
        }
        @keyframes poeira {
          from { transform: translate3d(0,0,0); }
          to   { transform: translate3d(0,-60vmax,0); }
        }
        /* só a ENTRADA do vídeo; o valor final mora no style do elemento */
        @keyframes acende {
          from { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="brasa"], [style*="poeira"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
