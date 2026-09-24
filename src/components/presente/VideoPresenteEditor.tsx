import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Film, RefreshCw } from "lucide-react";
import { OFERTAS } from "@/lib/creditos";
import { atualizarVideo, videoDoEditor, type EstadoVideo } from "@/lib/video-presente";
import { FolhaPixUpsell } from "@/components/conta/FolhaPixUpsell";
import { trackEvent, trackEventOnce } from "@/lib/track";

// O VÍDEO-PRESENTE, dentro da montagem da página.
//
// A página e o vídeo são a MESMA montagem: as fotos, o título e a dedicatória
// que ela acabou de escolher logo acima são o que o vídeo usa. Por isso a
// oferta não descreve o vídeo, ela MOSTRA: a prévia toca aqui, ao vivo, e muda
// na hora em que ela troca uma foto ou mexe na dedicatória.
//
//   sem vídeo    → a prévia tocando + a oferta (PIX abre aqui, pelo token)
//   pago         → "montando o seu vídeo", e a tela se atualiza sozinha
//   pronto       → o vídeo em HD e o botão de baixar
//   falhou       → avisa que a gente já sabe e resolve (o dono recebe alerta)
//
// ── SÓ EM REAL ───────────────────────────────────────────────────
//
// O PIX é brasileiro. Quem comprou no funil espanhol pagou em dólar: pra eles
// a oferta não aparece (mas o player aparece, se um vídeo existir).

// O Remotion só baixa quando o bloco chega perto da tela: ele pesa, e quem
// abre o editor só pra copiar o link não precisa dele.
const PreviaVideo = lazy(() => import("./PreviaVideo"));

const TEXTOS = {
  pt: {
    titulo: "Sua página também virou vídeo",
    sub: "As fotos que você escolheu passando no ritmo da música, com a letra acendendo palavra por palavra. Dá o play e veja.",
    semFoto: "Suba as fotos aqui em cima: elas entram no vídeo na hora.",
    cta: "Quero o vídeo em HD",
    fino: "Sem a marca de prévia, pra baixar e mandar no WhatsApp ou postar no story. Mudou uma foto? O vídeo acompanha.",
    montando: "Estamos montando o seu vídeo",
    montandoSub:
      "Leva uns minutos. Pode fechar a página: a gente te avisa por e-mail quando ficar pronto.",
    pronto: "O vídeo de vocês",
    baixar: "Baixar o vídeo",
    mudou: "Você mudou a página depois do vídeo. Quer que ele fique igual?",
    atualizar: "Atualizar meu vídeo",
    falhou:
      "Deu um problema pra montar o seu vídeo. A gente já foi avisado e resolve sem custo nenhum.",
    ajuda: "Se quiser falar com a gente: contato@serenatagift.com",
  },
  es: {
    titulo: "Tu página también se volvió video",
    sub: "",
    semFoto: "",
    cta: "",
    fino: "",
    montando: "Estamos armando tu video",
    montandoSub:
      "Tarda unos minutos. Puedes cerrar la página: te avisamos por correo cuando esté listo.",
    pronto: "El video de ustedes",
    baixar: "Descargar el video",
    mudou: "Cambiaste la página después del video. ¿Quieres que quede igual?",
    atualizar: "Actualizar mi video",
    falhou: "Hubo un problema al armar tu video. Ya nos enteramos y lo resolvemos sin costo.",
    ajuda: "Si quieres escribirnos: contato@serenatagift.com",
  },
} as const;

export function VideoPresenteEditor({
  tokenEdicao,
  locale = "pt",
  fotos,
  titulo,
  dedicatoria,
  audioUrl,
  versao,
}: {
  tokenEdicao: string;
  locale?: "pt" | "es";
  /** As fotos da página, AO VIVO do editor: capa primeiro, galeria depois. */
  fotos: string[];
  titulo: string;
  dedicatoria: string;
  /** O áudio da versão que ela escolheu no editor. */
  audioUrl: string | null;
  versao: 1 | 2;
}) {
  const [estado, setEstado] = useState<EstadoVideo | null>(null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  // Pagou NESTA tela. Segura o "montando" enquanto o webhook ainda não criou
  // a linha do vídeo: sem isto, uma consulta que chega antes dele devolvia
  // "sem vídeo" e a oferta reaparecia pra quem acabou de pagar.
  const [pagou, setPagou] = useState(false);
  const [perto, setPerto] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
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

  // Enquanto o render roda, a tela se atualiza sozinha.
  const emAndamento =
    estado?.status === "aguardando" ||
    estado?.status === "renderizando" ||
    (pagou && !estado?.status);
  useEffect(() => {
    if (!emAndamento) return;
    const id = setInterval(() => void atualizar(), 15_000);
    return () => clearInterval(id);
  }, [emAndamento, atualizar]);

  // Com o vídeo pronto, mexer na página (foto, dedicatória, versão) pode
  // deixá-lo desatualizado: reconsulta depois que o editor salvou (a frase
  // salva com debounce, por isso a folga de 2,5s).
  const pronto = estado?.status === "pronto";
  useEffect(() => {
    if (!pronto) return;
    const id = setTimeout(() => void atualizar(), 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos, dedicatoria, versao]);

  // Liga a prévia quando o bloco chega a uma tela de distância.
  const mostraOferta = !!estado && estado.habilitado && locale !== "es" && !estado.status && !pagou;
  useEffect(() => {
    if (!mostraOferta || perto || !caixa.current) return;
    const obs = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setPerto(true);
          trackEventOnce("video_previa_vista", `video_previa_vista:${tokenEdicao}`, {
            origem: "editor",
          });
        }
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(caixa.current);
    return () => obs.disconnect();
  }, [mostraOferta, perto, tokenEdicao]);

  const pedirAtualizacao = async () => {
    setPedindo(true);
    trackEvent("video_presente_atualizar", { origem: "editor" });
    try {
      const r = await atualizarVideo({ data: { tokenEdicao } });
      if (r.ok) setPagou(true); // mesma tela de "montando" de quem acabou de pagar
      await atualizar();
    } finally {
      setPedindo(false);
    }
  };

  if (!estado) return null;

  // ── PRONTO ────────────────────────────────────────────────────
  if (estado.status === "pronto" && estado.url) {
    return (
      <section id="video" style={{ scrollMarginTop: "5rem" }}>
        <h2 className="mb-4 font-medium" style={{ fontSize: "var(--t-lg)" }}>
          {t.pronto}
        </h2>
        <video
          src={estado.url}
          controls
          playsInline
          preload="metadata"
          className="mx-auto w-full max-w-[300px] rounded-[var(--raio-lg)] bg-black shadow-lg"
          style={{ aspectRatio: "9 / 16" }}
          onPlay={() => trackEvent("video_presente_play", { origem: "editor" })}
        />
        {estado.desatualizado && estado.atualizacoesRestantes > 0 ? (
          <div className="mx-auto mt-4 max-w-[300px] rounded-[var(--raio-lg)] border border-[var(--acento)]/30 bg-[var(--papel-fundo)] p-3 text-center">
            <p style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}>{t.mudou}</p>
            <button
              type="button"
              disabled={pedindo}
              onClick={() => void pedirAtualizacao()}
              className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full cta px-5 font-medium disabled:opacity-60"
              style={{ fontSize: "var(--t-sm)" }}
            >
              {pedindo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t.atualizar}
            </button>
          </div>
        ) : null}
        {estado.urlDownload ? (
          <a
            href={estado.urlDownload}
            onClick={() => trackEvent("video_presente_baixou", { origem: "editor" })}
            className="mx-auto mt-4 flex w-full max-w-[300px] items-center justify-center gap-2 rounded-full bg-[var(--acento)] px-6 py-3 font-medium text-white"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <Download className="h-4 w-4" /> {t.baixar}
          </a>
        ) : null}
      </section>
    );
  }

  // ── PAGO, RENDERIZANDO ────────────────────────────────────────
  if (emAndamento) {
    return (
      <section
        id="video"
        className="flex items-start gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4"
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
      </section>
    );
  }

  // ── FALHOU ────────────────────────────────────────────────────
  if (estado.status === "falhou") {
    return (
      <section
        id="video"
        className="rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4 text-center"
        style={{ scrollMarginTop: "5rem" }}
      >
        <p style={{ fontSize: "var(--t-sm)" }}>{t.falhou}</p>
        <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
          {t.ajuda}
        </p>
      </section>
    );
  }

  // ── A PRÉVIA + A OFERTA ───────────────────────────────────────
  // Só em real, e só com a infraestrutura de render ligada (ver `habilitado`).
  if (!mostraOferta) return null;
  const oferta = OFERTAS.find((o) => o.id === "video");
  if (!oferta) return null;
  const precoTexto = `R$ ${oferta.precoBrl.toFixed(2).replace(".", ",")}`;
  const karaoke = versao === 2 && estado.karaoke.v2.length ? estado.karaoke.v2 : estado.karaoke.v1;
  const semFoto = fotos.length === 0;

  return (
    <section
      id="video"
      ref={caixa}
      className="rounded-3xl border border-[var(--acento)]/25 bg-[var(--papel-fundo)] p-6"
      style={{ scrollMarginTop: "5rem" }}
    >
      <h2 className="flex items-center gap-2 font-medium" style={{ fontSize: "var(--t-lg)" }}>
        <Film className="h-5 w-5 text-[var(--acento)]" /> {t.titulo}
      </h2>
      <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
        {semFoto ? t.semFoto : t.sub}
      </p>

      <div className="mt-5">
        {perto && audioUrl ? (
          <Suspense
            fallback={
              <div
                className="mx-auto w-full max-w-[300px] animate-pulse rounded-[var(--raio-lg)] bg-black/80"
                style={{ aspectRatio: "9 / 16" }}
              />
            }
          >
            <PreviaVideo
              audioUrl={audioUrl}
              fotos={fotos}
              karaoke={karaoke}
              titulo={titulo}
              dedicatoria={dedicatoria}
              duracaoReserva={versao === 1 ? estado.duracaoS : 0}
              locale={locale}
            />
          </Suspense>
        ) : (
          <div
            className="mx-auto w-full max-w-[300px] rounded-[var(--raio-lg)] bg-black/80"
            style={{ aspectRatio: "9 / 16" }}
          />
        )}
      </div>

      <button
        type="button"
        disabled={semFoto}
        onClick={() => {
          trackEvent("credito_oferta_click", { oferta: "video", origem: "editor_previa" });
          setFolhaAberta(true);
        }}
        className="mx-auto mt-5 flex h-12 w-full max-w-[300px] items-center justify-center gap-2 rounded-full cta px-6 font-medium disabled:opacity-50"
        style={{ fontSize: "var(--t-sm)" }}
      >
        {t.cta} · {precoTexto}
      </button>
      <p
        className="mx-auto mt-2 max-w-[300px] text-center text-[var(--tinta-suave)]"
        style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}
      >
        {t.fino}
      </p>

      {folhaAberta && (
        <FolhaPixUpsell
          ofertaId="video"
          titulo={t.titulo}
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
    </section>
  );
}
