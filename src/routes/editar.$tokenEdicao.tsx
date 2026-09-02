import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  carregarParaEditar,
  salvarPersonalizacao,
  removerFoto,
  adicionarNaGaleria,
  removerDaGaleria,
  definirVersaoPreferida,
  definirCor,
  definirEfeito,
  MAX_GALERIA,
} from "@/lib/personalizar";
import { prepararFoto } from "@/lib/imagem";
import { QrCode } from "@/components/presente/QrCode";
import { Efeitos, EFEITOS, rotuloEfeito } from "@/components/presente/Efeitos";
import { BotaoGuardar } from "@/components/presente/BotaoGuardar";
import { marcarDono } from "@/lib/dono-presente";
import { marcarSessaoGasta } from "@/lib/session-context";
import { linkSuporte, TEXTO_SUPORTE } from "@/lib/suporte-whatsapp";
import { OfertaQuadroEditor } from "@/components/presente/OfertaQuadroEditor";
import { AtalhoOutraMusica } from "@/components/conta/AtalhoOutraMusica";
import { trackEvent } from "@/lib/track";
import { TEMA_CLARO, FONTES, MARCA, CORES_PRESENTE, nomeCor } from "@/lib/marca";
import { tp } from "@/lib/textos-presente";
import { Logo } from "@/components/marca/Logo";
import { cn } from "@/lib/utils";
import { ImagePlus, Trash2, Check, Copy, ExternalLink, Loader2, X, Play, Pause, MessageCircle } from "lucide-react";
import { PedirRefacao } from "@/components/presente/PedirRefacao";

// A ÁREA DO COMPRADOR — onde o presente deixa de ser um render e vira o
// documento dela.
//
// A URL usa `token_edicao`, que é diferente do token público da página. O
// público vai colado no WhatsApp do presenteado; se ele autorizasse escrita,
// quem GANHA o presente poderia alterá-lo.
//
// Mundo CLARO aqui (é ferramenta, é onde se decide), enquanto a página
// entregue é a noite. A passagem entre os dois é a narrativa da marca.

const MAX_DEDICATORIA = 280;

export const Route = createFileRoute("/editar/$tokenEdicao")({
  loader: async ({ params }) => {
    const p = await carregarParaEditar({ data: { tokenEdicao: params.tokenEdicao } });
    if (!p) throw notFound();
    return p;
  },
  head: () => ({
    // Área privada: fora do índice dos buscadores.
    meta: [
      // Sem idioma aqui: o head roda antes do loader, então o título fica
      // neutro em vez de errado. É a aba do navegador, não a página.
      { title: MARCA.nome },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Editor,
  notFoundComponent: () => (
    <main className="grid min-h-screen place-items-center bg-[#faf5ee] px-6 text-center">
      <div>
        <p className="text-xl text-[#2a1518]">Esse link de edição não existe.</p>
        <p className="mt-2 text-sm text-[#2a1518]/60">
          Confira o link que você recebeu por e-mail.
        </p>
      </div>
    </main>
  ),
});

function Editor() {
  const p = Route.useLoaderData();
  const T = tp(p?.locale ?? "pt");
  const { tokenEdicao } = Route.useParams();
  const tz = TEXTO_SUPORTE[p?.locale === "es" ? "es" : "pt"];
  const linkZap = linkSuporte({
    locale: p?.locale === "es" ? "es" : "pt",
    titulo: p.titulo,
    token: p.tokenPublico?.slice(0, 8),
  });

  // Marca este navegador como dono do presente. É o que faz o botão de baixar
  // a música aparecer também na página pública, pra quem volta atrás do MP3
  // depois de já ter enviado o link.
  useEffect(() => {
    marcarDono(p.tokenPublico);
    // E marca a SESSÃO como gasta: chegar aqui significa que este navegador já
    // produziu um presente entregue, então uma música nova precisa começar numa
    // linha nova do banco (ver novaSessao em session-context).
    //
    // Vale aqui e não só na tela de obrigado porque nem todo entregue passa por
    // lá: quando o atendimento libera o acesso na mão, o editor é a única
    // porta. Foi assim que o caso de 15/08 ia se repetir de graça, com o
    // comprador ganhando 3 músicas e as 3 caindo na mesma linha.
    marcarSessaoGasta();
  }, [p.tokenPublico]);

  const [fotoUrl, setFotoUrl] = useState(p.fotoUrl);
  const [galeria, setGaleria] = useState(p.galeria);
  const [subindoGaleria, setSubindoGaleria] = useState(false);
  const [dedicatoria, setDedicatoria] = useState(p.dedicatoria ?? "");
  const [fraseStatus, setFraseStatus] = useState<"idle" | "salvando" | "salvo">(
    p.dedicatoria ? "salvo" : "idle",
  );
  const timerFrase = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (timerFrase.current) clearTimeout(timerFrase.current); }, []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // Enriquecimentos: a versão que ela prefere (a que abre por padrão no
  // presente) e a cor dos elementos da página.
  const [versaoPref, setVersaoPref] = useState<1 | 2>(p.versaoPreferida);
  const [cor, setCor] = useState(p.corDestaque ?? CORES_PRESENTE[0].oklch);
  const [efeito, setEfeito] = useState(p.efeito ?? "nenhum");
  // Relógio da PRÉVIA: faz as partículas caírem ao vivo enquanto a pessoa
  // escolhe o efeito, sem precisar abrir a página do presente.
  const [tickPrevia, setTickPrevia] = useState(0);
  useEffect(() => {
    if (efeito === "nenhum") return;
    const id = setInterval(() => setTickPrevia((t) => t + 0.1), 100);
    return () => clearInterval(id);
  }, [efeito]);
  const [tocando, setTocando] = useState<1 | 2 | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const audioPreferido = versaoPref === 2 ? p.audioUrlV2 : p.audioUrlV1;

  // Um <audio> só, compartilhado pelos dois botões de prévia. Trocar de versão
  // no meio para a atual e começa a outra do zero.
  function ouvir(v: 1 | 2) {
    const el = audioRef.current;
    const src = v === 2 ? p.audioUrlV2 : p.audioUrlV1;
    if (!el || !src) return;
    if (tocando === v) {
      el.pause();
      setTocando(null);
      return;
    }
    el.src = src;
    el.play().catch(() => setTocando(null));
    setTocando(v);
  }

  async function escolherVersao(v: 1 | 2) {
    setVersaoPref(v);
    const r = await definirVersaoPreferida({ data: { tokenEdicao, versao: v } });
    if (r.ok) setSalvo(true);
    else setVersaoPref(p.versaoPreferida);
  }

  async function escolherEfeito(e: string) {
    const anterior = efeito;
    setEfeito(e);
    const r = await definirEfeito({ data: { tokenEdicao, efeito: e } });
    if (r.ok) setSalvo(true);
    else setEfeito(anterior);
  }

  async function escolherCor(oklch: string) {
    const anterior = cor;
    setCor(oklch);
    const r = await definirCor({ data: { tokenEdicao, oklch } });
    if (r.ok) setSalvo(true);
    else setCor(anterior);
  }

  const linkPublico =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${p.tokenPublico}`
      : `/p/${p.tokenPublico}`;

  // A mensagem que o comprador COPIA e manda pro presenteado. É a única frase
  // da operação inteira escrita em nome dele — sair em português numa venda
  // mexicana seria o vazamento mais visível que existe.
  const mensagemPronta = T.mensagemPronta(linkPublico);

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setSalvando(true);
    try {
      // Corta e comprime ANTES de subir (src/lib/imagem.ts).
      const { base64 } = await prepararFoto(arquivo);
      // Preview otimista: a foto aparece antes da rede responder.
      setFotoUrl(base64);
      const r = await salvarPersonalizacao({ data: { tokenEdicao, fotoBase64: base64 } });
      if (!r.ok) {
        setErro(r.erro ?? T.erroFoto);
        setFotoUrl(p.fotoUrl); // desfaz o otimismo
        return;
      }
      if (r.fotoUrl) setFotoUrl(r.fotoUrl);
      setSalvo(true);
    } catch (err) {
      console.error("[editar] foto falhou:", err);
      setErro(err instanceof Error ? err.message : T.erroUsarFoto);
      setFotoUrl(p.fotoUrl);
    } finally {
      setSalvando(false);
      // Permite reescolher o MESMO arquivo (o input não dispara change se o
      // value continuar igual).
      if (inputFoto.current) inputFoto.current.value = "";
    }
  }

  async function aoEscolherGaleria(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])];
    if (!arquivos.length) return;
    setErro(null);
    setSubindoGaleria(true);
    try {
      const cabem = MAX_GALERIA - galeria.length;
      if (cabem <= 0) {
        setErro(T.galeriaCheia(MAX_GALERIA));
        return;
      }
      // Corta e comprime cada uma no navegador ANTES de subir — o mesmo
      // motivo da capa, multiplicado pelo número de fotos.
      const prontas: string[] = [];
      for (const a of arquivos.slice(0, cabem)) {
        try {
          prontas.push((await prepararFoto(a)).base64);
        } catch (err) {
          console.error("[galeria] foto ignorada:", err);
        }
      }
      if (!prontas.length) {
        setErro(T.erroFotos);
        return;
      }
      const r = await adicionarNaGaleria({ data: { tokenEdicao, fotosBase64: prontas } });
      if (!r.ok) {
        setErro(r.erro ?? T.erroSalvarFotos);
        return;
      }
      setGaleria(r.galeria ?? []);
      setSalvo(true);
    } finally {
      setSubindoGaleria(false);
      if (inputGaleria.current) inputGaleria.current.value = "";
    }
  }

  async function tirarDaGaleria(caminho: string) {
    const r = await removerDaGaleria({ data: { tokenEdicao, caminho } });
    if (r.ok) setGaleria(r.galeria);
  }

  async function tirarFoto() {
    setSalvando(true);
    await removerFoto({ data: { tokenEdicao } });
    setFotoUrl(null);
    setSalvando(false);
  }

  async function salvarFrase(texto: string) {
    setFraseStatus("salvando");
    setErro(null);
    const r = await salvarPersonalizacao({ data: { tokenEdicao, dedicatoria: texto } });
    if (!r.ok) {
      setErro(r.erro ?? T.erroFrase);
      setFraseStatus("idle");
    } else {
      setFraseStatus("salvo");
    }
  }

  // A frase salva SOZINHA enquanto se digita (espera 900ms parado), igual aos
  // outros campos que gravam na hora. Sem botão escondido; o status mostra.
  function aoDigitarFrase(v: string) {
    const texto = v.slice(0, MAX_DEDICATORIA);
    setDedicatoria(texto);
    setFraseStatus("idle");
    if (timerFrase.current) clearTimeout(timerFrase.current);
    timerFrase.current = setTimeout(() => salvarFrase(texto), 900);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagemPronta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      setErro(T.erroCopiar);
    }
  }

  const restam = MAX_DEDICATORIA - dedicatoria.length;

  return (
    <div
      className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      <header className="border-b border-[var(--tinta-fraca)]/30">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo tamanho="sm" />
          <a
            href="/dashboard"
            // A ÁREA DE TOQUE CRESCE, O TEXTO NÃO SE MEXE. Link dentro de
            // linha não pode ter 44px de altura sem empurrar o layout, então
            // o padding entra e a margem negativa devolve o espaço. O dedo
            // ganha o alvo inteiro e a tela continua igual.
            className="-my-3 inline-flex h-11 items-center py-3 text-[var(--tinta-suave)] transition-colors hover:text-[var(--tinta)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            {T.suaConta}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--tinta-suave)]">
            {T.suaMusicaPronta}
          </p>
          <h1
            className="mt-4 text-balance"
            style={{
              fontFamily: FONTES.display,
              fontWeight: 500,
              fontSize: "var(--t-3xl)",
              lineHeight: 1.15,
            }}
          >
            {T.agoraMonte(p.nome)}
          </h1>
          <p
            className="mx-auto mt-4 max-w-md text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
          >
            {T.umaFotoUmaFrase}
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[1fr_380px] lg:gap-10">
          {/* ── COLUNA DE EDIÇÃO ──────────────────────────────── */}
          {/* No mobile a prévia vem PRIMEIRO (order-1) e gruda no topo; a
              edição fica embaixo. No desktop, edição à esquerda, prévia à
              direita. */}
          <div className="order-2 min-w-0 space-y-10 lg:order-1">
            {/* <audio> compartilhado das prévias de versão */}
            <audio
              ref={audioRef}
              onEnded={() => setTocando(null)}
              className="hidden"
            />

            {/* versão preferida — qual das duas gravações abre por padrão */}
            {p.audioUrlV2 && (
              <section>
                <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                  {T.qualGravacao}
                </h2>
                <p
                  className="mt-1 text-[var(--tinta-suave)]"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  {T.fizemosDuas}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([1, 2] as const).map((v) => {
                    const escolhida = versaoPref === v;
                    return (
                      <div
                        key={v}
                        className={cn(
                          "flex items-center gap-3 rounded-[var(--raio)] border p-3 transition-colors duration-150",
                          escolhida
                            ? "border-[var(--acento)] bg-[var(--acento)]/5"
                            : "border-[var(--tinta-fraca)] bg-[var(--papel-fundo)]",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => ouvir(v)}
                          aria-label={tocando === v ? T.pausar : T.ouvir}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--tinta)] text-[var(--papel)] transition-transform active:scale-95"
                        >
                          {tocando === v ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="ml-0.5 h-4 w-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-medium" style={{ fontSize: "var(--t-sm)" }}>
                            {T.versaoN(v)}
                            {/* Só depois de uma refação. Sem ela o selo seria
                                ruído: "nova" em relação a quê? */}
                            {(p?.refacoes ?? 0) > 0 && (
                              <span
                                className="rounded-full bg-[var(--acento)]/12 px-2 py-0.5 font-semibold text-[var(--acento)]"
                                style={{ fontSize: "10px" }}
                              >
                                {T.seloNova}
                              </span>
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => escolherVersao(v)}
                            className={cn(
                              // Mesma técnica do link do cabeçalho: alvo de
                              // 44px sem mexer no espaçamento da lista.
                              "-my-3 inline-flex h-11 items-center gap-1 py-3 transition-colors",
                              escolhida
                                ? "text-[var(--acento)]"
                                : "text-[var(--tinta-suave)] hover:text-[var(--tinta)]",
                            )}
                            style={{ fontSize: "var(--t-xs)" }}
                          >
                            {escolhida ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> {T.eEssa}
                              </>
                            ) : (
                              T.escolherEsta
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── AS GRAVAÇÕES DE ANTES ────────────────────────
                    Fechadas por padrão: a decisão desta tela é escolher entre
                    as versões ATUAIS, e mostrar quatro gravações de uma vez
                    transforma uma escolha simples numa comparação.

                    Existem porque a refação SOMA. O custo da primeira já foi
                    pago e não volta, então guardar cobre quem pede o ajuste,
                    ouve, e prefere o original. */}
                {(p?.anteriores?.length ?? 0) > 0 && (
                  <details className="mt-4 rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)]">
                    <summary
                      className="flex h-11 cursor-pointer list-none items-center px-4 text-[var(--tinta-suave)]"
                      style={{ fontSize: "var(--t-sm)" }}
                    >
                      {T.anterioresVer}
                    </summary>
                    <div className="border-t border-[var(--tinta-fraca)]/30 p-4">
                      <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}>
                        {T.anterioresTexto}
                      </p>
                      {(p?.anteriores ?? []).map((a) => (
                        <div key={a.ordem} className="mt-4">
                          {a.pedido && (
                            <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)", lineHeight: 1.45 }}>
                              <strong>{T.anterioresPedido}</strong> {a.pedido}
                            </p>
                          )}
                          <div className="mt-2 space-y-2">
                            {[a.audioUrlV1, a.audioUrlV2].filter(Boolean).map((url, i) => (
                              <audio
                                key={i}
                                src={url as string}
                                controls
                                preload="none"
                                className="w-full"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            )}

            {/* cor de destaque — o play, a letra que acende, a barra */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                {T.aCorDaPagina}
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {T.aCorTexto}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {CORES_PRESENTE.map((c) => {
                  const escolhida = cor === c.oklch;
                  return (
                    <button
                      key={c.chave}
                      type="button"
                      onClick={() => escolherCor(c.oklch)}
                      aria-label={nomeCor(c, p?.locale ?? "pt")}
                      aria-pressed={escolhida}
                      title={nomeCor(c, p?.locale ?? "pt")}
                      // 44px É O MÍNIMO PRA DEDO, e a bolinha tinha 40. A cor
                      // continua com 40 (seis delas maiores não caberiam numa
                      // fileira de celular estreito); o que cresceu foi a área
                      // de toque em volta, que ninguém vê e todo mundo usa.
                      className="grid h-11 w-11 place-items-center rounded-full"
                    >
                      <span
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-full transition-transform active:scale-90",
                          escolhida
                            ? "ring-2 ring-[var(--tinta)] ring-offset-2 ring-offset-[var(--papel)]"
                            : "hover:scale-110",
                        )}
                        style={{ backgroundColor: c.oklch }}
                      >
                        {escolhida && (
                          <Check className="h-4 w-4 text-[#0d0a08]" strokeWidth={3} />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* efeito da página — corações caindo durante a música */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                {T.umEfeito}
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {T.umEfeitoTexto}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {EFEITOS.map((op) => {
                  const on = efeito === op.chave;
                  return (
                    <button
                      key={op.chave}
                      type="button"
                      onClick={() => escolherEfeito(op.chave)}
                      className={cn(
                        // `py-2` dava 39px de altura. `h-11` crava os 44.
                        "inline-flex h-11 items-center rounded-full border px-4 transition-colors",
                        on
                          ? "border-[var(--acento)] bg-[var(--acento)]/10 text-[var(--acento)]"
                          : "border-[var(--tinta-fraca)] text-[var(--tinta-suave)] hover:border-[var(--tinta-suave)]",
                      )}
                      style={{ fontSize: "var(--t-sm)" }}
                    >
                      {rotuloEfeito(op, p?.locale === "es" ? "es" : "pt")}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* foto */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                {T.aFotoDaCapa}
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {T.aFotoTexto}
              </p>

              <input
                ref={inputFoto}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={aoEscolherFoto}
                className="sr-only"
                id="foto"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label
                  htmlFor="foto"
                  className={cn(
                    "inline-flex h-12 cursor-pointer items-center gap-2 rounded-full px-6 font-medium transition-transform",
                    "bg-[var(--acento)] text-white hover:scale-[1.02] active:scale-95",
                    salvando && "pointer-events-none opacity-60",
                  )}
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  {salvando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {fotoUrl ? T.trocarFoto : T.escolherFoto}
                </label>

                {fotoUrl && (
                  <button
                    onClick={tirarFoto}
                    disabled={salvando}
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-5 text-[var(--tinta-suave)] transition-colors hover:text-[var(--tinta)] disabled:opacity-50"
                    style={{ fontSize: "var(--t-sm)" }}
                  >
                    <Trash2 className="h-4 w-4" /> {T.remover}
                  </button>
                )}
              </div>
            </section>

            {/* galeria — as fotos que passam durante a música */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                {T.asFotosQuePassam}
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {T.asFotosTexto(MAX_GALERIA)}
              </p>

              <input
                ref={inputGaleria}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={aoEscolherGaleria}
                className="sr-only"
                id="galeria"
              />

              {galeria.length > 0 && (
                <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {galeria.map((g, i) => (
                    <li key={g.caminho} className="group relative">
                      <img
                        src={g.url}
                        alt=""
                        className="aspect-square w-full rounded-[var(--raio)] object-cover"
                      />
                      {/* A ordem importa: é a sequência em que aparecem */}
                      <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--tinta)]/70 text-[10px] font-medium text-[var(--papel)]">
                        {i + 1}
                      </span>
                      {/* APAGAR FOTO: alvo de 44px, botão de 28px.
                          O botão tinha 24px de altura, abaixo do mínimo pra
                          dedo, e fica encavalado num canto de miniatura, que é
                          o pior lugar possível pra errar.

                          Mas ele APAGA, e num destrutivo engordar o alvo tem
                          um custo: quanto maior, mais fácil acertar sem
                          querer. Por isso a área de toque cresce pra 44 e o
                          desenho cresce só pra 28, e a confirmação entra
                          junto: quem toca sem querer diz não e não perde nada.

                          O `-m-2` devolve o espaço que o padding tomou, então
                          a miniatura não muda de tamanho. */}
                      <button
                        onClick={() => {
                          if (!window.confirm(T.removerFotoConfirma)) return;
                          tirarDaGaleria(g.caminho);
                        }}
                        aria-label={`Remover foto ${i + 1}`}
                        className="absolute right-0 top-0 -m-2 grid h-11 w-11 place-items-center p-2"
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--tinta)]/70 text-[var(--papel)] transition-colors duration-150 hover:bg-[var(--acento)]">
                          <X className="h-4 w-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {galeria.length < MAX_GALERIA && (
                <label
                  htmlFor="galeria"
                  className={cn(
                    "mt-4 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-6 transition-colors duration-150 hover:border-[var(--acento)]",
                    subindoGaleria && "pointer-events-none opacity-60",
                  )}
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  {subindoGaleria ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {galeria.length ? T.adicionarMais : T.escolherFotos}
                </label>
              )}
            </section>

            {/* dedicatória */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                {T.umaFraseSua}
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {T.umaFraseTexto}
              </p>
              <textarea
                value={dedicatoria}
                onChange={(e) => aoDigitarFrase(e.target.value)}
                onBlur={() => {
                  // Ao sair do campo, grava na hora (não espera o debounce).
                  if (timerFrase.current) clearTimeout(timerFrase.current);
                  if (fraseStatus !== "salvo") salvarFrase(dedicatoria);
                }}
                placeholder={T.dedicatoriaPlaceholder(p.nome)}
                rows={3}
                className="mt-4 w-full rounded-2xl border border-[var(--tinta-fraca)] bg-[var(--papel-fundo)] p-4 outline-none transition-colors focus:border-[var(--acento)]"
                style={{ fontSize: "var(--t-base)", fontFamily: FONTES.display }}
              />
              <div className="mt-2 flex items-center justify-between">
                <span
                  className={cn(
                    "text-[var(--tinta-fraca)]",
                    restam < 30 && "text-[var(--acento)]",
                  )}
                  style={{ fontSize: "var(--t-xs)" }}
                >
                  {restam} caracteres
                </span>
                {/* Salva sozinha: aqui só o retorno visual, sem botão. */}
                <span
                  className="flex items-center gap-1 text-[var(--tinta-suave)]"
                  style={{ fontSize: "var(--t-xs)" }}
                >
                  {fraseStatus === "salvando" ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> salvando…
                    </>
                  ) : fraseStatus === "salvo" ? (
                    <>
                      <Check className="h-3 w-3" /> salvo
                    </>
                  ) : null}
                </span>
              </div>
            </section>

            {erro && (
              <p
                className="rounded-xl bg-[var(--acento)]/10 px-4 py-3 text-[var(--acento)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {erro}
              </p>
            )}

            {/* entrega */}
            <section className="rounded-3xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-6">
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                {T.agoraEntregar}
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                {T.copieEMande}
              </p>

              <pre
                className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-[var(--papel)] p-4 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)", fontFamily: "inherit" }}
              >
                {mensagemPronta}
              </pre>

              {/* QR Code: o caminho de virar presente FÍSICO. Imprime, cola
                  numa caixa de bombom, e o digital ganha corpo sem logística
                  nenhuma da nossa parte. */}
              <div className="mt-6 flex flex-col items-center gap-4 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/30 bg-[var(--papel)] p-5 sm:flex-row sm:items-center sm:text-left">
                <QrCode url={linkPublico} nome={p.nome} locale={p?.locale ?? "pt"} />
                <div>
                  <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
                    {T.prefereMao}
                  </p>
                  <p
                    className="mt-1 text-[var(--tinta-suave)]"
                    style={{ fontSize: "var(--t-xs)", lineHeight: 1.6 }}
                  >
                    {T.qrTexto}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={copiar}
                  className="inline-flex h-12 items-center gap-2 rounded-full cta px-6 font-medium"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiado ? T.copiado : T.copiarMensagem}
                </button>
                <a
                  href={`/p/${p.tokenPublico}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-6 transition-colors hover:border-[var(--tinta-suave)]"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  <ExternalLink className="h-4 w-4" /> {T.verComoVaiVer}
                </a>
                {/* Baixar/enviar o MP3 é ação de QUEM MONTA o presente (aqui),
                    não de quem recebe. No celular abre a folha de
                    compartilhamento nativa (WhatsApp, Arquivos). */}
                {audioPreferido && (
                  <BotaoGuardar
                    audioUrl={audioPreferido}
                    titulo={p.titulo}
                    nome={p.nome}
                    comDica
                    locale={p?.locale ?? "pt"}
                  />
                )}
              </div>
            </section>
          </div>

          {/* ── PRÉVIA AO VIVO ────────────────────────────────── */}
          {/* Mobile: barra grudada no topo (sempre visível enquanto edita).
              Desktop: coluna à direita, também sticky. */}
          <aside className="order-1 min-w-0 lg:order-2 lg:self-start">
            <div className="sticky top-0 z-20 -mx-6 border-b border-[var(--tinta-fraca)]/20 bg-[var(--papel)] px-6 pb-3 pt-1 lg:static lg:mx-0 lg:top-8 lg:border-0 lg:bg-transparent lg:p-0">
              <p
                className="mb-1.5 text-center text-[var(--tinta-suave)] lg:mb-3"
                style={{ fontSize: "var(--t-xs)" }}
              >
                {T.previa}
              </p>
              {/* Moldura de celular: é assim que o presente é aberto. Pequena
                  no mobile (cabe grudada no topo), inteira no desktop. */}
              <div className="mx-auto w-[132px] overflow-hidden rounded-[1.5rem] border-[6px] border-[#1a1512] bg-[#0d0a08] lg:w-auto lg:max-w-[300px] lg:rounded-[2.2rem] lg:border-[9px]">
                <div className="relative flex aspect-[9/16] flex-col items-center justify-center px-3 text-center lg:px-5">
                  {/* Sem foto de capa, usa a primeira da galeria: é o que a
                      página realmente mostra, e evita a prévia ficar preta. */}
                  {(fotoUrl ?? galeria[0]?.url) && (
                    <>
                      <img
                        src={fotoUrl ?? galeria[0]?.url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to bottom, rgba(13,10,8,0.62) 0%, rgba(13,10,8,0.78) 55%, #0d0a08 100%)",
                        }}
                      />
                    </>
                  )}

                  {/* Efeito ao vivo: o MESMO componente da página-presente,
                      contido na moldura e em escala reduzida. */}
                  <Efeitos tipo={efeito} ativo tempo={tickPrevia} contido escala={0.42} />
                  <div className="relative z-10">
                    <p className="text-[6px] uppercase tracking-[0.25em] text-white/45 lg:text-[8px] lg:tracking-[0.3em]">
                      {T.umaMusicaPara}
                    </p>
                    <p
                      className="mt-1 text-base leading-tight text-white lg:mt-2 lg:text-3xl"
                      style={{ fontFamily: FONTES.display, fontWeight: 600 }}
                    >
                      {p.nome}
                    </p>
                    <div className="mx-auto mt-2 h-px w-6 bg-white/20 lg:mt-5 lg:w-10" />
                    <p
                      className="mt-1.5 text-[9px] text-white/80 lg:mt-4 lg:text-sm"
                      style={{ fontFamily: FONTES.display }}
                    >
                      {p.titulo}
                    </p>
                    <div
                      className="mx-auto mt-2 grid h-7 w-7 place-items-center rounded-full lg:mt-5 lg:h-11 lg:w-11"
                      style={{ backgroundColor: cor }}
                    >
                      <Play className="ml-0.5 h-3 w-3 text-[#0d0a08] lg:h-4 lg:w-4" fill="#0d0a08" />
                    </div>
                    {dedicatoria && (
                      <p
                        className="mt-2 text-[7px] leading-relaxed text-white/70 lg:mt-5 lg:text-[11px]"
                        style={{ fontFamily: FONTES.display }}
                      >
                        {dedicatoria}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {salvo && (
                <p
                  className="mt-3 hidden items-center justify-center gap-1.5 text-[var(--tinta-suave)] lg:flex"
                  style={{ fontSize: "var(--t-xs)" }}
                >
                  <Check className="h-3.5 w-3.5" /> alterações salvas
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* CONVITE PRA FAZER OUTRA, e ele vem ANTES do suporte de propósito.
            O comprador chega aqui pra montar o presente, ou seja, no momento
            em que ele acabou de ouvir a música da pessoa dele e está com o
            resultado na mão. É onde a pergunta "quem mais merece uma?" cai em
            pé. Depois do bloco de ajuda ela viraria rodapé. */}
        <div className="mx-auto max-w-md">
          {/* TROCA, não soma: o convite de criar outra saiu e o quadro entrou.
              O editor já tinha três blocos depois da tarefa, e um quarto viraria
              bagunça. O quadro vende 4,6x mais (23 contra 5) e faz sentido aqui,
              onde ela acabou de escolher a foto e ler a letra.

              A "mais uma música" continua nos e-mails de entrega e recompra,
              onde não compete com nada. */}
          <OfertaQuadroEditor
            locale={p?.locale === "es" ? "es" : "pt"}
            tokenEdicao={tokenEdicao}
          />

          {/* E a "mais uma música" volta, mas como LINHA e não como bloco.
              O comentário acima continua valendo: um quarto CARTÃO aqui vira
              bagunça e o quadro vende mais. Uma linha de texto não disputa
              espaço com cartão nenhum, e ela precisa existir aqui por dois
              motivos:

              1. É o alvo do link do e-mail de entrega. Sem âncora, o e-mail
                 teria que mandar pro `/dashboard`, onde 84% dos compradores
                 nunca entram, que é exatamente onde este pacote morreu.
              2. Em agosto, 32 recompras saíram a preço cheio (R$ 1.317,40
                 contra R$ 896) porque a única porta visível levava ao
                 `/criar`. */}
          <div id="outra-musica" style={{ scrollMarginTop: "5rem" }}>
            <AtalhoOutraMusica
              locale={p?.locale === "es" ? "es" : "pt"}
              tokenEdicao={tokenEdicao}
              origem="editor"
            />
          </div>
        </div>

        {/* SUPORTE POR WHATSAPP, e só aqui dentro.
            Esta tela é pós-pagamento por definição: só chega quem tem o token
            de edição. Número visível antes da compra seria uma saída aberta no
            meio do funil, e a conversa vira dúvida, desconto ou nada.
            É também onde o comprador passa mais tempo (61% dos que compram
            chegam aqui) e onde ele descobre que quer ajuda: subir a foto,
            baixar o MP3, mandar o link. */}
        {/* O AJUSTE, no fim da página e fechado por padrão.
            A ação daqui é montar o presente; perguntar "o que você não
            gostou?" no meio disso planta dúvida em quem estava satisfeito. */}
        <PedirRefacao
          tokenEdicao={tokenEdicao}
          locale={p?.locale === "es" ? "es" : "pt"}
        />

        {linkZap && (
          <div className="mx-auto mt-12 max-w-md text-center">
            <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
              {tz.titulo}
            </p>
            <a
              href={linkZap}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("suporte_zap_click", { origem: "editor" })}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-6 transition-colors hover:border-[var(--acento)] hover:text-[var(--acento)]"
              style={{ fontSize: "var(--t-sm)" }}
            >
              <MessageCircle className="h-4 w-4" /> {tz.botao}
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
