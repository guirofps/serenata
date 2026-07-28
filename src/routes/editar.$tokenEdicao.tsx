import { createFileRoute, notFound } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  carregarParaEditar,
  salvarPersonalizacao,
  removerFoto,
  adicionarNaGaleria,
  removerDaGaleria,
  MAX_GALERIA,
} from "@/lib/personalizar";
import { prepararFoto } from "@/lib/imagem";
import { QrCode } from "@/components/presente/QrCode";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { cn } from "@/lib/utils";
import { ImagePlus, Trash2, Check, Copy, ExternalLink, Loader2, X } from "lucide-react";

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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);

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

  async function salvarTexto() {
    setSalvando(true);
    setErro(null);
    const r = await salvarPersonalizacao({ data: { tokenEdicao, dedicatoria } });
    if (!r.ok) setErro(r.erro ?? "Não consegui salvar.");
    else setSalvo(true);
    setSalvando(false);
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
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Logo tamanho="sm" />
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

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* ── COLUNA DE EDIÇÃO ──────────────────────────────── */}
          <div className="space-y-10">
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
                onChange={(e) => setDedicatoria(e.target.value.slice(0, MAX_DEDICATORIA))}
                onBlur={salvarTexto}
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
                <button
                  onClick={salvarTexto}
                  disabled={salvando}
                  className="text-[var(--acento)] underline underline-offset-4 disabled:opacity-50"
                  style={{ fontSize: "var(--t-xs)" }}
                >
                  salvar agora
                </button>
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
                className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--papel)] p-4 text-[var(--tinta-suave)]"
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
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--acento)] px-6 font-medium text-white transition-transform hover:scale-[1.02] active:scale-95"
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
              </div>
            </section>
          </div>

          {/* ── PRÉVIA AO VIVO ────────────────────────────────── */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p
              className="mb-3 text-center text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-xs)" }}
            >
              prévia
            </p>
            {/* Moldura de celular: é assim que o presente é aberto */}
            <div className="mx-auto max-w-[300px] overflow-hidden rounded-[2.2rem] border-[9px] border-[#1a1512] bg-[#0d0a08]">
              <div className="relative flex aspect-[9/16] flex-col items-center justify-center px-5 text-center">
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
                  <p className="text-[8px] uppercase tracking-[0.3em] text-white/45">
                    uma música para
                  </p>
                  <p
                    className="mt-2 text-3xl text-white"
                    style={{ fontFamily: FONTES.display, fontWeight: 600 }}
                  >
                    {p.nome}
                  </p>
                  <div className="mx-auto mt-5 h-px w-10 bg-white/20" />
                  <p
                    className="mt-4 text-sm text-white/80"
                    style={{ fontFamily: FONTES.display }}
                  >
                    {p.titulo}
                  </p>
                  <div className="mx-auto mt-5 h-11 w-11 rounded-full bg-[oklch(0.84_0.13_78)]" />
                  {dedicatoria && (
                    <p
                      className="mt-5 text-[11px] leading-relaxed text-white/70"
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
                className="mt-4 flex items-center justify-center gap-1.5 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-xs)" }}
              >
                <Check className="h-3.5 w-3.5" /> alterações salvas
              </p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
