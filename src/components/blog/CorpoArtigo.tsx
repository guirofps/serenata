import { useRef, useState } from "react";
import { FONTES } from "@/lib/marca";
import { AUDIO_EXEMPLOS, exemploPorSlug } from "@/lib/exemplos-pt";
import type { Bloco, Inline } from "@/lib/blog/tipos";
import { CartaoMusica } from "./CartaoMusica";
import { CtaCriar } from "./CtaCriar";

// O corpo do artigo, bloco a bloco. UM elemento de áudio pro artigo inteiro: duas
// músicas tocando juntas é impossível por construção (mesma regra da home).

function Inlines({ itens }: { itens: Inline[] }) {
  return (
    <>
      {itens.map((t, i) => {
        if (t.tipo === "negrito") return <strong key={i}>{t.texto}</strong>;
        if (t.tipo === "italico") return <em key={i}>{t.texto}</em>;
        if (t.tipo === "link")
          return (
            <a
              key={i}
              href={t.href}
              className="text-[var(--acento)] underline underline-offset-4"
              {...(t.interno ? {} : { target: "_blank", rel: "noopener" })}
            >
              {t.texto}
            </a>
          );
        return <span key={i}>{t.texto}</span>;
      })}
    </>
  );
}

export function CorpoArtigo({ blocos, tema }: { blocos: Bloco[]; tema?: "gospel" }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);

  async function alternar(slug: string) {
    const a = audioRef.current;
    if (!a) return;
    if (tocando === slug) {
      a.pause();
      setTocando(null);
      return;
    }
    a.src = `${AUDIO_EXEMPLOS}/${slug}.mp3`;
    try {
      await a.play();
      setTocando(slug);
    } catch (err) {
      console.error("[blog] play falhou:", err);
      setTocando(null);
    }
  }

  return (
    <div className="mt-10 space-y-5" style={{ fontSize: "var(--t-lg)", lineHeight: 1.7 }}>
      <audio ref={audioRef} onEnded={() => setTocando(null)} preload="none" />
      {blocos.map((b, i) => {
        switch (b.tipo) {
          case "h2":
            return (
              <h2
                key={i}
                id={b.id}
                className="pt-6 text-balance"
                style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.2 }}
              >
                {b.texto}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-2 font-medium" style={{ fontSize: "var(--t-xl)" }}>
                {b.texto}
              </h3>
            );
          case "p":
            return (
              <p key={i}>
                <Inlines itens={b.inline} />
              </p>
            );
          case "lista": {
            const Tag = b.ordenada ? "ol" : "ul";
            return (
              <Tag key={i} className={`space-y-2 pl-6 ${b.ordenada ? "list-decimal" : "list-disc"}`}>
                {b.itens.map((item, j) => (
                  <li key={j}>
                    <Inlines itens={item} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "citacao":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-[var(--acento)] pl-5 italic text-[var(--tinta-suave)]"
                style={{ fontFamily: FONTES.display }}
              >
                {b.linhas.map((l, j) => (
                  <span key={j} className="block">
                    {l}
                  </span>
                ))}
              </blockquote>
            );
          case "musica": {
            const ex = exemploPorSlug(b.slug);
            return ex ? (
              <CartaoMusica key={i} exemplo={ex} tocando={tocando === ex.slug} onAlternar={() => alternar(ex.slug)} />
            ) : null;
          }
          case "cta":
            return <CtaCriar key={i} tema={tema} texto={b.texto} />;
        }
      })}
    </div>
  );
}
