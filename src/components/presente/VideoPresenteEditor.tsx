import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Download, Loader2, Film } from "lucide-react";
import { OFERTAS, TEXTO_OFERTA } from "@/lib/creditos";
import { videoDoEditor, type EstadoVideo } from "@/lib/video-presente";
import { FolhaPixUpsell } from "@/components/conta/FolhaPixUpsell";
import { trackEvent } from "@/lib/track";

// O VÍDEO-PRESENTE, dentro do editor da música.
//
// Um bloco só, que muda de cara conforme o estado:
//
//   sem vídeo    → a oferta (e o PIX abre aqui mesmo, pelo token, sem login)
//   pago         → "montando o seu vídeo", e a tela se atualiza sozinha
//   pronto       → o player e o botão de baixar
//   falhou       → avisa que a gente já sabe e resolve (o dono recebe alerta)
//
// ── POR QUE NO EDITOR ────────────────────────────────────────────
//
// É onde a pessoa acabou de subir as fotos, e o vídeo é feito DELAS. Além
// disso, o editor tem 4x mais sessões que o painel (1.527 contra 398, 25/08).
//
// ── SÓ EM REAL ───────────────────────────────────────────────────
//
// O PIX é brasileiro. Quem comprou no funil espanhol pagou em dólar: pra eles
// a oferta não aparece (mas o player aparece, se um vídeo existir).

const TEXTOS = {
  pt: {
    semFoto:
      "Suba pelo menos uma foto aqui em cima pra montar o vídeo. Quanto mais fotos, mais bonito fica.",
    montando: "Estamos montando o seu vídeo",
    montandoSub:
      "Leva uns minutos. Pode fechar a página: a gente te avisa por e-mail quando ficar pronto.",
    pronto: "O vídeo de vocês",
    baixar: "Baixar o vídeo",
    falhou:
      "Deu um problema pra montar o seu vídeo. A gente já foi avisado e resolve sem custo nenhum.",
    ajuda: "Se quiser falar com a gente: contato@serenatagift.com",
  },
  es: {
    semFoto:
      "Sube al menos una foto aquí arriba para armar el video. Entre más fotos, más bonito queda.",
    montando: "Estamos armando tu video",
    montandoSub:
      "Tarda unos minutos. Puedes cerrar la página: te avisamos por correo cuando esté listo.",
    pronto: "El video de ustedes",
    baixar: "Descargar el video",
    falhou: "Hubo un problema al armar tu video. Ya nos enteramos y lo resolvemos sin costo.",
    ajuda: "Si quieres escribirnos: contato@serenatagift.com",
  },
} as const;

export function VideoPresenteEditor({
  tokenEdicao,
  locale = "pt",
}: {
  tokenEdicao: string;
  locale?: "pt" | "es";
}) {
  const [estado, setEstado] = useState<EstadoVideo | null>(null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  // Pagou NESTA tela. Segura o "montando" enquanto o webhook ainda não criou
  // a linha do vídeo: sem isto, uma consulta que chega antes dele devolvia
  // "sem vídeo" e a oferta reaparecia pra quem acabou de pagar.
  const [pagou, setPagou] = useState(false);
  const t = TEXTOS[locale] ?? TEXTOS.pt;

  const atualizar = useCallback(async () => {
    try {
      const e = await videoDoEditor({ data: { tokenEdicao } });
      setEstado(e);
      return e;
    } catch {
      return null;
    }
  }, [tokenEdicao]);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  // Enquanto o render roda, a tela se atualiza sozinha. 15s é folga: um
  // render leva 1 a 2 minutos, e ninguém fica olhando parado.
  const emAndamento =
    estado?.status === "aguardando" ||
    estado?.status === "renderizando" ||
    (pagou && !estado?.status);
  useEffect(() => {
    if (!emAndamento) return;
    const id = setInterval(() => void atualizar(), 15_000);
    return () => clearInterval(id);
  }, [emAndamento, atualizar]);

  if (!estado) return null;

  // ── PRONTO ────────────────────────────────────────────────────
  if (estado.status === "pronto" && estado.url) {
    return (
      <div id="video" className="mx-auto mt-12 max-w-md" style={{ scrollMarginTop: "5rem" }}>
        <p className="mb-3 text-center font-medium" style={{ fontSize: "var(--t-base)" }}>
          {t.pronto}
        </p>
        <video
          src={estado.url}
          controls
          playsInline
          preload="metadata"
          className="mx-auto w-full max-w-[320px] rounded-[var(--raio-lg)] bg-black shadow-lg"
          style={{ aspectRatio: "9 / 16" }}
          onPlay={() => trackEvent("video_presente_play", { origem: "editor" })}
        />
        {estado.urlDownload ? (
          <a
            href={estado.urlDownload}
            onClick={() => trackEvent("video_presente_baixou", { origem: "editor" })}
            className="mx-auto mt-4 flex w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-[var(--acento)] px-6 py-3 font-medium text-white"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <Download className="h-4 w-4" /> {t.baixar}
          </a>
        ) : null}
      </div>
    );
  }

  // ── PAGO, RENDERIZANDO ────────────────────────────────────────
  if (emAndamento) {
    return (
      <div
        id="video"
        className="mx-auto mt-12 flex max-w-md items-start gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4"
        style={{ scrollMarginTop: "5rem" }}
      >
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[var(--acento)]" />
        <span>
          <span className="block font-medium" style={{ fontSize: "var(--t-sm)" }}>
            {t.montando}
          </span>
          <span
            className="mt-0.5 block text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-xs)", lineHeight: 1.45 }}
          >
            {t.montandoSub}
          </span>
        </span>
      </div>
    );
  }

  // ── FALHOU ────────────────────────────────────────────────────
  if (estado.status === "falhou") {
    return (
      <div
        id="video"
        className="mx-auto mt-12 max-w-md rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4 text-center"
        style={{ scrollMarginTop: "5rem" }}
      >
        <p style={{ fontSize: "var(--t-sm)" }}>{t.falhou}</p>
        <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
          {t.ajuda}
        </p>
      </div>
    );
  }

  // ── A OFERTA ──────────────────────────────────────────────────
  // Só em real, e só com a infraestrutura de render ligada (ver `habilitado`).
  if (locale === "es" || !estado.habilitado) return null;
  const oferta = OFERTAS.find((o) => o.id === "video");
  if (!oferta) return null;
  const txt = TEXTO_OFERTA.pt.video;
  const precoTexto = `R$ ${oferta.precoBrl.toFixed(2).replace(".", ",")}`;
  const semFoto = estado.fotos === 0;

  const abrir = async () => {
    trackEvent("credito_oferta_click", { oferta: "video", origem: "editor" });
    // A foto pode ter subido agora há pouco, depois de a tela carregar.
    const e = semFoto ? await atualizar() : estado;
    if (!e || e.fotos === 0) return;
    setFolhaAberta(true);
  };

  return (
    <div id="video" style={{ scrollMarginTop: "5rem" }}>
      <button
        type="button"
        onClick={() => void abrir()}
        className="mx-auto mt-12 flex w-full max-w-md items-center gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4 text-left transition-colors hover:border-[var(--acento)]/50"
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-md bg-[var(--acento)]/10 text-[var(--acento)]"
          style={{ width: 46, height: 62 }}
        >
          <Film className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium" style={{ fontSize: "var(--t-sm)" }}>
            {txt.titulo}
          </span>
          <span
            className="mt-0.5 block text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-xs)", lineHeight: 1.45 }}
          >
            {semFoto ? t.semFoto : txt.sub}
          </span>
          <span
            className="mt-1 block font-semibold text-[var(--acento)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            {precoTexto}
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-[var(--acento)]" />
      </button>

      {folhaAberta && (
        <FolhaPixUpsell
          ofertaId="video"
          titulo={txt.titulo}
          precoTexto={precoTexto}
          checkoutCartao={oferta.checkout}
          tokenEdicao={tokenEdicao}
          aoPagar={() => {
            setFolhaAberta(false);
            setPagou(true);
            trackEvent("video_presente_pago", { origem: "editor" });
            setTimeout(() => void atualizar(), 3000);
          }}
          aoFechar={() => setFolhaAberta(false)}
        />
      )}
    </div>
  );
}
