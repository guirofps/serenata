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
import { EFEITOS } from "@/components/presente/Efeitos";
import { BotaoGuardar } from "@/components/presente/BotaoGuardar";
import { TEMA_CLARO, FONTES, MARCA, CORES_PRESENTE } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { cn } from "@/lib/utils";
import { ImagePlus, Trash2, Check, Copy, ExternalLink, Loader2, X, Play, Pause } from "lucide-react";

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
      { title: `Monte o presente · ${MARCA.nome}` },
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
  const { tokenEdicao } = Route.useParams();

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

  const mensagemPronta = `Fiz uma música pra você. É sua, só sua, a letra é sobre a gente.\n\n${linkPublico}`;

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
        setErro(r.erro ?? "Não consegui salvar a foto.");
        setFotoUrl(p.fotoUrl); // desfaz o otimismo
        return;
      }
      if (r.fotoUrl) setFotoUrl(r.fotoUrl);
      setSalvo(true);
    } catch (err) {
      console.error("[editar] foto falhou:", err);
      setErro(err instanceof Error ? err.message : "Não consegui usar essa foto.");
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
        setErro(`A galeria já está cheia (${MAX_GALERIA} fotos).`);
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
        setErro("Não consegui usar essas fotos.");
        return;
      }
      const r = await adicionarNaGaleria({ data: { tokenEdicao, fotosBase64: prontas } });
      if (!r.ok) {
        setErro(r.erro ?? "Não consegui salvar as fotos.");
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
      setErro(r.erro ?? "Não consegui salvar a frase.");
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
      setErro("Não consegui copiar. Selecione o texto e copie na mão.");
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
            className="text-[var(--tinta-suave)] transition-colors hover:text-[var(--tinta)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            sua conta
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--tinta-suave)]">
            sua música está pronta
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
            Agora monte o presente de {p.nome}
          </h1>
          <p
            className="mx-auto mt-4 max-w-md text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
          >
            Uma foto e uma frase sua. É o que transforma a página em algo que
            só vocês dois entendem.
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
                  Qual gravação você prefere?
                </h2>
                <p
                  className="mt-1 text-[var(--tinta-suave)]"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  Fizemos duas. Ouça as duas e escolha a que emociona mais. É a
                  que vai abrir quando ela receber.
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
                          aria-label={tocando === v ? "Pausar" : "Ouvir"}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--tinta)] text-[var(--papel)] transition-transform active:scale-95"
                        >
                          {tocando === v ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="ml-0.5 h-4 w-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
                            Versão {v}
                          </p>
                          <button
                            type="button"
                            onClick={() => escolherVersao(v)}
                            className={cn(
                              "mt-0.5 inline-flex items-center gap-1 transition-colors",
                              escolhida
                                ? "text-[var(--acento)]"
                                : "text-[var(--tinta-suave)] hover:text-[var(--tinta)]",
                            )}
                            style={{ fontSize: "var(--t-xs)" }}
                          >
                            {escolhida ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> é essa
                              </>
                            ) : (
                              "escolher esta"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* cor de destaque — o play, a letra que acende, a barra */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                A cor da página
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                É a cor do play, da letra que acende e da barra. Veja na prévia
                ao lado.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {CORES_PRESENTE.map((c) => {
                  const escolhida = cor === c.oklch;
                  return (
                    <button
                      key={c.chave}
                      type="button"
                      onClick={() => escolherCor(c.oklch)}
                      aria-label={c.nome}
                      aria-pressed={escolhida}
                      title={c.nome}
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
                    </button>
                  );
                })}
              </div>
            </section>

            {/* efeito da página — corações caindo durante a música */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                Um efeito na tela
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                Passa sobre a foto enquanto a música toca. Sutil, pra emocionar
                sem poluir.
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
                        "rounded-full border px-4 py-2 transition-colors",
                        on
                          ? "border-[var(--acento)] bg-[var(--acento)]/10 text-[var(--acento)]"
                          : "border-[var(--tinta-fraca)] text-[var(--tinta-suave)] hover:border-[var(--tinta-suave)]",
                      )}
                      style={{ fontSize: "var(--t-sm)" }}
                    >
                      {op.rotulo}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* foto */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                A foto da capa
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                Ela aparece atrás do nome. Fotos de rosto funcionam melhor.
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
                  {fotoUrl ? "Trocar a foto" : "Escolher uma foto"}
                </label>

                {fotoUrl && (
                  <button
                    onClick={tirarFoto}
                    disabled={salvando}
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-5 text-[var(--tinta-suave)] transition-colors hover:text-[var(--tinta)] disabled:opacity-50"
                    style={{ fontSize: "var(--t-sm)" }}
                  >
                    <Trash2 className="h-4 w-4" /> Remover
                  </button>
                )}
              </div>
            </section>

            {/* galeria — as fotos que passam durante a música */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                As fotos que passam com a música
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                Elas ficam atrás da letra e trocam nas viradas da canção. A
                foto muda bem quando o refrão entra. Até {MAX_GALERIA}.
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
                      <button
                        onClick={() => tirarDaGaleria(g.caminho)}
                        aria-label={`Remover foto ${i + 1}`}
                        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--tinta)]/70 text-[var(--papel)] transition-colors duration-150 hover:bg-[var(--acento)]"
                      >
                        <X className="h-3.5 w-3.5" />
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
                  {galeria.length ? "Adicionar mais fotos" : "Escolher as fotos"}
                </label>
              )}
            </section>

            {/* dedicatória */}
            <section>
              <h2 className="font-medium" style={{ fontSize: "var(--t-lg)" }}>
                Uma frase sua
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                Aparece embaixo do play. É a única coisa da página escrita por
                você.
              </p>
              <textarea
                value={dedicatoria}
                onChange={(e) => aoDigitarFrase(e.target.value)}
                onBlur={() => {
                  // Ao sair do campo, grava na hora (não espera o debounce).
                  if (timerFrase.current) clearTimeout(timerFrase.current);
                  if (fraseStatus !== "salvo") salvarFrase(dedicatoria);
                }}
                placeholder={`Pra você, ${p.nome}. Com todo o meu amor.`}
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
                Agora é só entregar
              </h2>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                Copie e mande no WhatsApp. Quem entrega o presente é você.
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
                <QrCode url={linkPublico} nome={p.nome} />
                <div>
                  <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
                    Prefere entregar na mão?
                  </p>
                  <p
                    className="mt-1 text-[var(--tinta-suave)]"
                    style={{ fontSize: "var(--t-xs)", lineHeight: 1.6 }}
                  >
                    Imprima este código e cole num cartão, numa caixa de bombom
                    ou no embrulho. Ela aponta a câmera e a música abre.
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
                  {copiado ? "Copiado!" : "Copiar mensagem"}
                </button>
                <a
                  href={`/p/${p.tokenPublico}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-6 transition-colors hover:border-[var(--tinta-suave)]"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  <ExternalLink className="h-4 w-4" /> Ver como ela vai ver
                </a>
                {/* Guardar/enviar o MP3 é ação de QUEM MONTA o presente (aqui),
                    não de quem recebe. No celular abre a folha de
                    compartilhamento nativa (WhatsApp, Arquivos). */}
                {audioPreferido && (
                  <BotaoGuardar audioUrl={audioPreferido} titulo={p.titulo} nome={p.nome} />
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
                prévia
              </p>
              {/* Moldura de celular: é assim que o presente é aberto. Pequena
                  no mobile (cabe grudada no topo), inteira no desktop. */}
              <div className="mx-auto w-[132px] overflow-hidden rounded-[1.5rem] border-[6px] border-[#1a1512] bg-[#0d0a08] lg:w-auto lg:max-w-[300px] lg:rounded-[2.2rem] lg:border-[9px]">
                <div className="relative flex aspect-[9/16] flex-col items-center justify-center px-3 text-center lg:px-5">
                  {fotoUrl && (
                    <>
                      <img
                        src={fotoUrl}
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
                  <div className="relative z-10">
                    <p className="text-[6px] uppercase tracking-[0.25em] text-white/45 lg:text-[8px] lg:tracking-[0.3em]">
                      uma música para
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
      </main>
    </div>
  );
}
