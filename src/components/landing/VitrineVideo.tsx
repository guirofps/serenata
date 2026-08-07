// O vídeo de reações reais, emoldurado como peça de vitrine — pro HERO.
// Substitui o mockup estático do "Eva" (que não fazia nada). Aqui a primeira
// coisa que a pessoa vê é gente de verdade se emocionando.
//
// Moldura premium: fio dourado da marca, sombra flutuante, cantos suaves.
// O vídeo é MUDO (não tem trilha), então roda em loop sem controle de som.

export function VitrineVideo({ caption, selo = "reações reais" }: { caption?: string; selo?: string }) {
  return (
    <figure className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
      {/* brilho dourado por trás — dá profundidade e tira a cara de "chapado" */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2.5rem] opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 30%, oklch(0.78 0.10 82 / 0.35), transparent 70%)",
        }}
      />
      <div
        className="relative overflow-hidden rounded-[1.6rem] bg-[var(--noite)] p-1.5"
        style={{
          boxShadow: "var(--sombra-flutuante)",
          border: "1px solid oklch(0.78 0.10 82 / 0.35)",
        }}
      >
        <video
          src="/video/reacoes.mp4"
          poster="/video/reacoes-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="block w-full rounded-[1.2rem]"
        />
        {/* selo de prova real, canto superior */}
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
          {selo}
        </span>
      </div>
      {caption && (
        <figcaption className="mt-4 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
