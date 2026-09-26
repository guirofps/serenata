import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { edicaoDoDono } from "@/lib/dono-presente";
import { videoDoEditor, type EstadoVideo } from "@/lib/video-presente";
import { trackEvent } from "@/lib/track";

// O VÍDEO, oferecido na PRÓPRIA página presente, só pra quem comprou.
//
// Quem compra volta várias vezes à página pra ver como ficou. É o momento em
// que ela está olhando o presente com olhos de quem deu, e "essa página vira
// vídeo" faz sentido ali. Quem RECEBE nunca vê: o componente só é montado
// dentro do bloco `dono` da página, a mesma marca do botão de baixar o MP3.
//
// Não vende aqui. Leva ao bloco do vídeo no editor, onde a prévia toca com as
// fotos dela e a compra acontece. Sem o token de edição no aparelho (marca
// antiga), leva ao painel, que pede o login.

export function OfertaVideoDono({
  tokenPublico,
  locale,
}: {
  tokenPublico: string;
  locale: "pt" | "es";
}) {
  const [edicao, setEdicao] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoVideo | null | undefined>(undefined);

  useEffect(() => {
    if (locale !== "pt") return;
    const t = edicaoDoDono(tokenPublico);
    setEdicao(t);
    if (!t) {
      setEstado(null);
      return;
    }
    videoDoEditor({ data: { tokenEdicao: t } })
      .then(setEstado)
      .catch(() => setEstado(null));
  }, [tokenPublico, locale]);

  if (locale !== "pt" || estado === undefined) return null;
  // Com o token: só oferece quando o render está ligado e ainda não há vídeo.
  if (estado && (!estado.habilitado || (estado.status && estado.status !== "pronto"))) return null;

  const pronto = estado?.status === "pronto";
  const href = edicao ? `/editar/${edicao}?de=presente#video` : "/dashboard?aba=video";

  return (
    <a
      href={href}
      onClick={() => trackEvent("video_dono_presente_click", { pronto, comToken: Boolean(edicao) })}
      className="mt-4 flex w-full max-w-xs items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3 text-left"
    >
      <Film className="h-5 w-5 shrink-0 text-[color:var(--presente-destaque)]" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white/90">
          {pronto ? "Ver o vídeo desta página" : "Esta página também vira vídeo"}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-white/50">
          {pronto
            ? "O seu vídeo está pronto pra baixar."
            : "As fotos de vocês no ritmo da música. Veja a prévia com as suas fotos."}
        </span>
      </span>
    </a>
  );
}
