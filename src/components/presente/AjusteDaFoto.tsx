import { useRef, useState } from "react";
import { limitarFoco } from "@/lib/quadro-estilo";

// ONDE A PESSOA DECIDE QUE PEDAÇO DA FOTO APARECE.
//
// ── POR QUE ISTO PRECISOU EXISTIR ────────────────────────────────
//
// A faixa da foto no quadro é larga e baixa. A foto que a pessoa mandou quase
// nunca tem esse formato, então alguém tem que escolher que pedaço aparece —
// e até 03/09 quem escolhia era um palpite fixo no código: 22% a partir do
// topo pra foto deitada.
//
// O palpite acerta às vezes. Quando erra, corta a cara. No quadro de "Encontro
// no Golandim" a testa dela saiu raspada e a cabeça dele ficou de fora do
// enquadramento. Num presente cuja graça inteira é a foto de vocês dois, é o
// defeito mais caro que a folha pode ter, e nenhuma escolha de cor conserta.
//
// ── POR QUE ARRASTAR, E NÃO DOIS BOTÕES ──────────────────────────
//
// Porque é o gesto que a pessoa já fez cem vezes trocando foto de perfil e
// pondo banner. Não há nada pra aprender, nada pra ler, e o resultado aparece
// enquanto o dedo ainda está na tela.
//
// Botão de "subir/descer" pareceria mais simples de programar e seria pior de
// usar: enquadrar é uma decisão contínua, e quem tem que julgar o resultado é
// o olho, não a aritmética.
//
// ── AS DECISÕES DE TOQUE ─────────────────────────────────────────
//
// `touchAction: "none"` no quadro é o que impede a página de rolar embaixo do
// dedo. Sem isso, no celular, o gesto vira rolagem e o ajuste não acontece —
// e o celular é 100% de quem usa isto.
//
// Ponteiro capturado (`setPointerCapture`) pra o arrasto continuar valendo
// quando o dedo sai da moldura, que é o normal em tela pequena.

export function AjusteDaFoto({
  url,
  foco,
  alturaCss,
  aoMudar,
  rotulo,
  dica,
}: {
  url: string;
  /** Onde está agora, em porcentagem. */
  foco: { x: number; y: number };
  /** A mesma proporção da faixa na folha, senão o ajuste mente. */
  alturaCss: string;
  aoMudar: (f: { x: number; y: number }) => void;
  rotulo: string;
  dica: string;
}) {
  const caixa = useRef<HTMLDivElement | null>(null);
  const arrasto = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const [pegando, setPegando] = useState(false);

  function comecar(e: React.PointerEvent<HTMLDivElement>) {
    caixa.current?.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, fx: foco.x, fy: foco.y };
    setPegando(true);
  }

  function mover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    const el = caixa.current;
    if (!a || !el) return;
    const r = el.getBoundingClientRect();
    // ARRASTAR PRA BAIXO TEM QUE MOSTRAR O TOPO DA FOTO, então o `y` do
    // object-position DIMINUI. É o sinal invertido que faz o gesto parecer
    // que a mão está segurando a foto, e não uma régua.
    //
    // A conta é sobre o tamanho da moldura: o mesmo centímetro de dedo pesa
    // mais numa moldura pequena, que é exatamente como a pessoa espera.
    const dx = ((e.clientX - a.x) / Math.max(1, r.width)) * 100;
    const dy = ((e.clientY - a.y) / Math.max(1, r.height)) * 100;
    aoMudar(limitarFoco(a.fx - dx, a.fy - dy));
  }

  function soltar(e: React.PointerEvent<HTMLDivElement>) {
    caixa.current?.releasePointerCapture?.(e.pointerId);
    arrasto.current = null;
    setPegando(false);
  }

  return (
    <div>
      <p className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">{rotulo}</p>
      <div
        ref={caixa}
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        style={{ height: alturaCss, touchAction: "none" }}
        className={`relative w-full overflow-hidden rounded-xl border transition-colors ${
          pegando ? "border-white/60" : "border-white/20"
        }`}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${foco.x}% ${foco.y}%`,
            // A imagem não pode receber o arrasto no lugar do quadro, senão o
            // navegador tenta o "arrastar imagem" nativo e o gesto morre.
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        {/* As linhas de terço, só enquanto o dedo está na tela. Elas dizem
            onde é o meio sem sujar a moldura o tempo todo. */}
        {pegando && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-center text-[12px] text-white/40">{dica}</p>
    </div>
  );
}
