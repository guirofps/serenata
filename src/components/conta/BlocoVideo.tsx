import { useEffect, useState } from "react";
import { Download, Film, Loader2, Play } from "lucide-react";
import { videoDoEditor, type EstadoVideo } from "@/lib/video-presente";
import { trackEvent } from "@/lib/track";

// A ABA DO VÍDEO, no painel.
//
// Em 25/09 o painel teve 121 aberturas no dia, contra 150 do editor, e o
// vídeo não aparecia em lugar nenhum dele. Esta aba NÃO vende sozinha: a
// prévia (com as fotos, a dedicatória e a letra dela) mora no editor, que é
// onde estão as fotos. Aqui é a vitrine que leva até lá, uma música por
// cartão, e o lugar de assistir e baixar o vídeo de quem já comprou.

type MusicaDoPainel = {
  id: string;
  titulo: string | null;
  status: string;
  token_edicao: string;
};

export function BlocoVideo({ musicas }: { musicas: MusicaDoPainel[] }) {
  const prontas = musicas.filter((m) => m.status === "pronta" && m.token_edicao);
  const [estados, setEstados] = useState<Record<string, EstadoVideo | null>>({});

  useEffect(() => {
    let vivo = true;
    for (const m of prontas) {
      videoDoEditor({ data: { tokenEdicao: m.token_edicao } })
        .then((e) => vivo && setEstados((s) => ({ ...s, [m.id]: e })))
        .catch(() => vivo && setEstados((s) => ({ ...s, [m.id]: null })));
    }
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prontas.map((m) => m.id).join(",")]);

  if (!prontas.length) {
    return (
      <p className="mt-8 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
        Assim que a sua música ficar pronta, o vídeo dela aparece aqui.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-medium" style={{ fontSize: "var(--t-lg)" }}>
          <Film className="h-5 w-5 text-[var(--acento)]" /> A sua página também vira vídeo
        </h2>
        <p
          className="mt-1 text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}
        >
          As fotos de vocês passando no ritmo da música, com a letra acendendo palavra por palavra.
          Pra mandar no WhatsApp ou postar no story.
        </p>
      </div>

      {prontas.map((m) => {
        const e = estados[m.id];
        const titulo = m.titulo ?? "Sua música";
        const linkEditor = `/editar/${m.token_edicao}?de=painel#video`;

        if (e === undefined) {
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--tinta-fraca)]/40 p-5 text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-sm)" }}
            >
              <Loader2 className="h-4 w-4 animate-spin" /> {titulo}
            </div>
          );
        }

        // Já tem vídeo pronto: assistir e baixar, aqui mesmo.
        if (e?.status === "pronto" && e.url) {
          return (
            <div key={m.id} className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-5">
              <p className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                {titulo}
              </p>
              <video
                src={e.url}
                controls
                playsInline
                preload="metadata"
                className="mx-auto mt-4 w-full max-w-[260px] rounded-[var(--raio-lg)] bg-black"
                style={{ aspectRatio: "9 / 16" }}
                onPlay={() => trackEvent("video_presente_play", { origem: "painel" })}
              />
              {e.urlDownload && (
                <a
                  href={e.urlDownload}
                  onClick={() => trackEvent("video_presente_baixou", { origem: "painel" })}
                  className="mx-auto mt-4 flex h-12 w-full max-w-[260px] items-center justify-center gap-2 rounded-full cta px-6 font-medium"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  <Download className="h-4 w-4" /> Baixar o vídeo
                </a>
              )}
            </div>
          );
        }

        // Pago ou montando: o editor mostra o estado certo.
        const emAndamento = e?.status && e.status !== "falhou";
        return (
          <a
            key={m.id}
            href={linkEditor}
            onClick={() =>
              trackEvent("video_painel_click", {
                estado: e?.status ?? "sem_video",
                fotos: e?.fotos ?? 0,
              })
            }
            className="flex items-center gap-4 rounded-2xl border-2 border-[var(--acento)]/35 bg-[var(--acento)]/[0.05] p-4"
          >
            <span
              className="grid h-20 w-[45px] shrink-0 place-items-center rounded-lg bg-[#1b1013] text-white/90"
              aria-hidden
            >
              <Play className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium" style={{ fontSize: "var(--t-base)" }}>
                {titulo}
              </span>
              <span
                className="mt-0.5 block text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-xs)", lineHeight: 1.45 }}
              >
                {emAndamento
                  ? "O seu vídeo está sendo montado. Toque pra ver como está."
                  : e && e.fotos > 0
                    ? "O vídeo já está montado com as suas fotos. Toque pra assistir a prévia."
                    : "Escolha umas fotos e veja o vídeo se montar na hora."}
              </span>
              <span
                className="mt-2 inline-block font-medium text-[var(--acento)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {emAndamento ? "Ver meu vídeo" : "Ver meu vídeo com as minhas fotos"} →
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
