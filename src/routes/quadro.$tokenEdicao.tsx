import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { carregarQuadro, type Quadro } from "@/lib/quadro";
import { QuadroEfeitos } from "@/components/presente/QuadroEfeitos";
import {
  CORES_QUADRO,
  corDoQuadro,
  paleta,
  lerEstilo,
  gravarEstilo,
  ESTILO_PADRAO,
  type Estilo,
} from "@/lib/quadro-estilo";
import { EFEITOS, rotuloEfeito } from "@/components/presente/Efeitos";
import { FONTES, MARCA } from "@/lib/marca";
import { Printer, Lock, Check } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { acessoAoQuadro } from "@/lib/meus-quadros";
import { OFERTAS } from "@/lib/creditos";
import { trackEvent } from "@/lib/track";

// A FOLHA A4 PRA EMOLDURAR.
//
// ── O HISTÓRICO DE ERROS, porque cada um custou uma rodada ────────
//
// 1. Primeira versão: folha branca com um filete de cor, sem nada da Serenata,
//    e o texto VAZANDO por cima da foto e do título.
//
// 2. O vazamento resistiu a quatro tentativas de conserto. A raiz:
//    `scrollHeight` de um elemento com `column-count`, dentro de um pai com
//    `overflow: hidden`, devolve a altura LIMITADA da caixa, não a do texto.
//    Todas as medições liam esse número e "cabia" quando não cabia. A versão
//    boa mede num clone fora da tela, uma coluna, sem limite de altura.
//
// 3. O PDF saía com DUAS páginas. Esconder o botão não bastava: o container em
//    volta mantinha padding e altura de tela cheia, e a sobra virava folha
//    vazia. Agora a moldura de tela é zerada na impressão.
//
// 4. Ao aumentar o QR, a letra apareceu CORTADA: o rodapé cresceu depois que o
//    corpo já tinha sido calculado. Um ResizeObserver na caixa resolve a
//    família inteira, em vez de perseguir cada imagem que carrega depois.

export const Route = createFileRoute("/quadro/$tokenEdicao")({
  loader: async ({ params }) => {
    const q = await carregarQuadro({ data: { tokenEdicao: params.tokenEdicao } });
    if (!q) throw notFound();
    return q;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.titulo ? `${loaderData.titulo} · para imprimir` : "Para imprimir" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Pagina,
});

const T = {
  pt: {
    acao: "Imprimir ou salvar em PDF",
    dica: "Escolha “Salvar como PDF”. Pra emoldurar, peça impressão em gráfica, papel fosco A4.",
    ouvir: "Aponte a câmera e ouça",
    para: "para",
    modo: "Fundo",
    escuro: "Escuro",
    claro: "Claro",
    cor: "Cor",
    efeito: "Detalhe",
    dicaClaro: "O fundo claro gasta muito menos tinta em impressora de casa.",
  },
  es: {
    acao: "Imprimir o guardar en PDF",
    dica: "Elige “Guardar como PDF”. Para enmarcar, pide impresión profesional en papel mate A4.",
    ouvir: "Apunta la cámara y escucha",
    para: "para",
    modo: "Fondo",
    escuro: "Oscuro",
    claro: "Claro",
    cor: "Color",
    efeito: "Detalle",
    dicaClaro: "El fondo claro gasta mucha menos tinta en impresora de casa.",
  },
};

const NOVA_LINHA = String.fromCharCode(10);

/**
 * O corpo que faz a letra caber. MEDE num clone e escala.
 *
 * Medir o elemento real não funciona (ver o histórico no topo). O clone tem
 * uma coluna só, a largura de UMA coluna do layout final, e nenhum limite de
 * altura: ali o `scrollHeight` volta a ser o que diz ser.
 */
function corpoQueCabe(
  texto: string,
  larguraColunaPx: number,
  colunas: number,
  caixaPx: number,
  entrelinha: number,
  maxPt: number,
): number {
  if (!caixaPx || !larguraColunaPx) return maxPt;
  const REF = 10;
  const clone = document.createElement("p");
  clone.textContent = texto;
  Object.assign(clone.style, {
    position: "absolute",
    left: "-99999px",
    top: "0",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    width: `${larguraColunaPx}px`,
    fontSize: `${REF}pt`,
    lineHeight: String(entrelinha),
    fontFamily: getComputedStyle(document.body).fontFamily,
  });
  document.body.appendChild(clone);
  const alturaUmaColuna = clone.scrollHeight;
  clone.remove();
  if (!alturaUmaColuna) return maxPt;
  // Em N colunas a altura vira ~1/N. O 0,94 cobre o arredondamento da quebra
  // de coluna, que nunca divide exatamente ao meio.
  const alvo = (REF * caixaPx * 0.94) / (alturaUmaColuna / colunas);
  // Piso de 7pt: abaixo disso não se lê num quadro na parede.
  return Math.max(7, Math.min(maxPt, Math.floor(alvo * 4) / 4));
}

function Pagina() {
  const q = Route.useLoaderData() as Quadro;
  const t = T[q.locale] ?? T.pt;
  const token = q.linkPresente.split("/p/")[1] ?? "";

  const [estilo, setEstilo] = useState<Estilo>(ESTILO_PADRAO);
  const [qr, setQr] = useState<string | null>(null);
  const [corpoPt, setCorpoPt] = useState(11);
  const [pronto, setPronto] = useState(false);
  // ── O DIREITO DE IMPRIMIR ──────────────────────────────────────
  //
  // O loader roda no servidor, onde não existe sessão pra ler: ele devolve
  // `nenhum` pra todo mundo (e `confirmado` só pro exemplo). Então a folha
  // aparece primeiro, que é o que ela veio ver, e o direito chega logo depois.
  //
  // Enquanto não chega, a tela mostra a folha SEM o botão de imprimir. O
  // contrário (mostrar e tirar) seria pior: ela clica, some, e ela acha que
  // quebrou.
  const [acesso, setAcesso] = useState<Quadro["acesso"]>(q.acesso);
  const [conferindo, setConferindo] = useState(q.acesso !== "confirmado");
  useEffect(() => {
    if (!q.musicaId) {
      setConferindo(false);
      return;
    }
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token;
      if (!tk) {
        if (vivo) setConferindo(false);
        return;
      }
      const r = await acessoAoQuadro({ data: { token: tk, musicaId: q.musicaId as string } });
      if (vivo) {
        setAcesso(r.acesso);
        setConferindo(false);
      }
    })().catch(() => {
      if (vivo) setConferindo(false);
    });
    return () => {
      vivo = false;
    };
  }, [q.musicaId]);

  // O FORMATO DA FOTO decide o arranjo, e isso não é detalhe.
  //
  // A faixa que sangra de borda a borda funciona pra foto DEITADA: `cover`
  // corta um pouco das laterais e a cena continua inteira. Numa foto EM PÉ ela
  // faz o oposto: a imagem é escalada pra preencher os 210mm de largura, fica
  // muito mais alta que a faixa, e o corte come cabeça e pés. Justamente os
  // rostos.
  //
  // Metade das fotos de celular é retrato, então isso não é caso raro.
  const [formato, setFormato] = useState<"paisagem" | "quadrada" | "retrato">("paisagem");
  const caixaRef = useRef<HTMLDivElement>(null);
  const letraRef = useRef<HTMLParagraphElement>(null);

  const p = paleta(estilo.modo);
  const acento = corDoQuadro(estilo.cor, estilo.modo);

  // DUAS COLUNAS QUANDO A LETRA É LONGA, e não é escolha estética: 49 linhas
  // com entrelinha legível ocupam ~270mm, e o A4 tem 297mm no total. Numa
  // coluna só, com foto, não cabe em tamanho nenhum que se leia.
  const duasColunas = q.letra.split(NOVA_LINHA).filter((l) => l.trim()).length > 26;

  const mudar = (novo: Partial<Estilo>) => {
    const e = { ...estilo, ...novo };
    setEstilo(e);
    gravarEstilo(token, e);
    trackEvent("quadro_personalizou", novo as Record<string, string>);
  };

  useEffect(() => {
    if (token) setEstilo(lerEstilo(token));
  }, [token]);

  // Mede a imagem ANTES de decidir o layout. Uma imagem em memória, sem tocar
  // na tela: só precisamos da proporção.
  useEffect(() => {
    if (!q.fotoUrl) return;
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth / img.naturalHeight;
      setFormato(r > 1.15 ? "paisagem" : r < 0.85 ? "retrato" : "quadrada");
    };
    img.src = q.fotoUrl;
  }, [q.fotoUrl]);

  useEffect(() => {
    QRCode.toDataURL(q.linkPresente, {
      margin: 0,
      width: 400,
      // O QR inverte com o modo: leitor de celular precisa de contraste, e QR
      // escuro sobre fundo escuro simplesmente não lê.
      color: { dark: p.qrEscuro, light: p.qrFundo },
    })
      .then(setQr)
      .catch(() => {});
  }, [q.linkPresente, p.qrEscuro, p.qrFundo]);

  useLayoutEffect(() => {
    const medir = () => {
      const el = letraRef.current;
      const caixa = caixaRef.current;
      if (!el || !caixa) return;
      const colunas = duasColunas ? 2 : 1;
      const vao = duasColunas ? 12 * 3.7795 : 0; // 12mm de vão entre colunas
      const larguraColuna = (el.clientWidth - vao) / colunas;
      setCorpoPt(corpoQueCabe(q.letra, larguraColuna, colunas, caixa.clientHeight, duasColunas ? 1.42 : 1.6, 11));
      setPronto(true);
    };

    medir();
    const rAF = requestAnimationFrame(medir);
    // SEMPRE QUE A CAIXA MUDAR DE TAMANHO. O rodapé cresce quando o QR e a
    // logo carregam, e cada milímetro que ele ganha a letra perde. Foi assim
    // que ela apareceu cortada depois que aumentei o QR.
    const obs = new ResizeObserver(medir);
    if (caixaRef.current) obs.observe(caixaRef.current);
    let vivo = true;
    document.fonts?.ready.then(() => {
      if (vivo) medir();
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(rAF);
      obs.disconnect();
    };
  }, [q.letra, duasColunas, estilo.modo, formato]);
  // A REDE DE SEGURANÇA, e ela já existiu e eu deixei cair numa reescrita.
  //
  // O cálculo do clone acerta quase sempre, mas erra pra cima quando algo muda
  // a altura da caixa depois dele: o rodapé crescendo, a foto trocando de
  // arranjo, o CSS partindo as duas colunas de forma desigual. Quando erra, a
  // letra aparece CORTADA em cima e embaixo, porque a caixa tem
  // `overflow: hidden` e o conteúdo está centralizado.
  //
  // `scrollHeight` não detecta transbordo em multicoluna. O retângulo de um
  // Range detecta: ele devolve a posição REAL do primeiro e do último
  // caractere na tela. Se algum estiver fora, encolhe 0,25pt e o efeito roda
  // de novo, até parar de vazar.
  useLayoutEffect(() => {
    const el = letraRef.current;
    const caixa = caixaRef.current;
    const txt = el?.firstChild;
    if (!el || !caixa || !txt || !txt.textContent || corpoPt <= 7) return;
    const fim = txt.textContent.trimEnd().length;
    if (fim < 2) return;

    const r = document.createRange();
    r.setStart(txt, 0);
    r.setEnd(txt, 2);
    const primeiro = r.getBoundingClientRect();
    r.setStart(txt, fim - 2);
    r.setEnd(txt, fim);
    const ultimo = r.getBoundingClientRect();
    const cx = caixa.getBoundingClientRect();

    if (primeiro.top < cx.top - 1 || ultimo.bottom > cx.bottom + 1) {
      setCorpoPt((v) => Math.max(7, v - 0.25));
    }
  }, [corpoPt, estilo.modo, estilo.efeito, formato, qr]);

  const botao = (ativo: boolean) =>
    "rounded-full px-3 py-1.5 text-[12px] transition-colors " +
    (ativo ? "bg-white text-[#1a1512] font-semibold" : "border border-white/25 text-white/70");

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          /* Esconder o botão NÃO basta: o container em volta mantinha padding
             e altura de tela cheia, e a sobra virava uma segunda folha. */
          .nao-imprime { display: none !important; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .tela { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .folha { box-shadow: none !important; margin: 0 !important; }
        }
        /* Sem isto o navegador "economiza tinta" e imprime o fundo em branco. */
        .folha, .folha * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="tela min-h-screen bg-[#1c1815] py-6">
        <div className="nao-imprime mx-auto mb-6 max-w-[210mm] space-y-4 px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-white/40">{t.modo}</span>
              <button onClick={() => mudar({ modo: "escuro" })} className={botao(estilo.modo === "escuro")}>
                {t.escuro}
              </button>
              <button onClick={() => mudar({ modo: "claro" })} className={botao(estilo.modo === "claro")}>
                {t.claro}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-white/40">{t.cor}</span>
              {CORES_QUADRO.map((c) => (
                <button
                  key={c.chave}
                  onClick={() => mudar({ cor: c.chave })}
                  aria-label={q.locale === "es" ? c.nomeEs : c.nome}
                  title={q.locale === "es" ? c.nomeEs : c.nome}
                  className={
                    "h-6 w-6 rounded-full transition-transform " +
                    (estilo.cor === c.chave ? "ring-2 ring-white ring-offset-2 ring-offset-[#1c1815]" : "")
                  }
                  style={{ background: c.escuro }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-white/40">{t.efeito}</span>
            {EFEITOS.map((e) => (
              <button key={e.chave} onClick={() => mudar({ efeito: e.chave })} className={botao(estilo.efeito === e.chave)}>
                {rotuloEfeito(e, q.locale)}
              </button>
            ))}
          </div>

          {/* ── O QUE ESTA PESSOA PODE FAZER AQUI ──────────────
              Três estados, e cada um mostra UMA ação só. Duas ações lado a
              lado numa tela de celular é onde a pessoa aperta a errada. */}
          {conferindo ? (
            <div className="text-center text-[13px] text-white/40">conferindo...</div>
          ) : acesso === "confirmado" ? (
            <div className="text-center">
              <button
                onClick={() => {
                  trackEvent("quadro_imprimir", { modo: estilo.modo, efeito: estilo.efeito });
                  window.print();
                }}
                className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full px-7 font-medium"
                style={{ fontSize: 15, background: "#f0b95f", color: "#0d0a08" }}
              >
                <Printer className="h-4 w-4" /> {t.acao}
              </button>
              <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-white/45">
                {t.dica} {estilo.modo === "escuro" && t.dicaClaro}
              </p>
            </div>
          ) : acesso === "previa" ? (
            /* COMPROU, AINDA NÃO ESCOLHEU. Não é hora de vender de novo: é
               hora de mandar ela terminar o que já pagou. */
            <div className="mx-auto max-w-md text-center">
              <p className="text-[13px] leading-relaxed text-white/70">
                Você tem um quadro pra montar. Confirme que ele é o desta
                música pra liberar a impressão.
              </p>
              <a
                href="/meu-quadro"
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-medium"
                style={{ fontSize: 15, background: "#f0b95f", color: "#0d0a08" }}
              >
                <Check className="h-4 w-4" /> Escolher esta música
              </a>
            </div>
          ) : (
            /* NÃO COMPROU. O quadro fica visível de propósito: é a vitrine
               dele. O que não sai é o papel. */
            <div className="mx-auto max-w-md text-center">
              <p className="text-[13px] leading-relaxed text-white/70">
                Este é o quadro da sua música: a letra e a foto de vocês numa
                folha A4, pronta pra você imprimir e emoldurar.
              </p>
              <a
                href={OFERTAS.find((o) => o.id === "quadro")?.checkout ?? "/dashboard"}
                onClick={() => trackEvent("credito_oferta_click", { oferta: "quadro", origem: "quadro" })}
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-medium"
                style={{ fontSize: 15, background: "#f0b95f", color: "#0d0a08" }}
              >
                <Lock className="h-4 w-4" /> Quero este quadro por R$ 24,90
              </a>
              <p className="mt-2 text-[12px] text-white/40">
                Depois de comprar você volta e escolhe de qual música é.
              </p>
            </div>
          )}
        </div>

        <div
          className="folha relative mx-auto overflow-hidden"
          style={{
            width: "210mm",
            height: "297mm",
            background: p.fundo,
            color: p.texto,
            boxShadow: "0 10px 50px rgba(0,0,0,.5)",
            opacity: pronto ? 1 : 0,
          }}
        >
          {/* A MARCA DE PRÉVIA.
              Esconder o botão de imprimir não impede Ctrl+P, e um quadro que
              sai inteiro sem pagar não é produto. A marca vai DENTRO da folha
              e imprime junto: quem burlar leva um papel que não serve pra
              emoldurar, que é exatamente a diferença entre ver e ter.
              O exemplo (`musicaId` nulo) não leva marca: ele é a vitrine. */}
          {q.musicaId && acesso !== "confirmado" && !conferindo && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
              style={{ transform: "rotate(-28deg)" }}
            >
              <span
                style={{
                  fontSize: "34mm",
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  color: p.texto,
                  opacity: 0.14,
                  whiteSpace: "nowrap",
                }}
              >
                {q.locale === "es" ? "VISTA PREVIA" : "PRÉVIA"}
              </span>
            </div>
          )}
          {/* A FOTO. No escuro ela sangra e some no degradê, que é o gesto da
              página presente. No claro esse gesto não existe (não dá pra
              "escurecer até o creme" sem sujar a imagem), então ela vira um
              bloco com margem e o texto vive no papel. */}
          {q.fotoUrl && p.fotoSangra && (
            <div
              style={
                formato === "retrato"
                  ? {
                      // EM PÉ: não sangra. A foto vira um bloco centralizado,
                      // com a proporção quase intacta, e o fundo escuro é a
                      // moldura. Cortar uma foto vertical pra caber numa faixa
                      // deitada é o que destrói o rosto.
                      position: "absolute",
                      top: "14mm",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "62mm",
                      height: "74mm",
                      overflow: "hidden",
                      borderRadius: 3,
                    }
                  : {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: formato === "quadrada" ? "96mm" : "88mm",
                    }
              }
            >
              <img
                src={q.fotoUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  // Deitada e quadrada: puxa pro terço superior, onde ficam os
                  // rostos. Em pé: centro, porque o bloco já respeita a
                  // proporção e não há o que compensar.
                  objectPosition: formato === "retrato" ? "center center" : "center 22%",
                  display: "block",
                }}
              />
              {/* O degradê é o que entrega o título quando a foto sangra. No
                  arranjo em pé a foto não encosta no texto, então ele viraria
                  uma sombra sem função em cima da imagem. */}
              {formato !== "retrato" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(to bottom, rgba(13,10,8,0.18) 0%, rgba(13,10,8,0.62) 34%, rgba(13,10,8,0.93) 62%, ${p.fundo} 82%)`,
                  }}
                />
              )}
            </div>
          )}

          <QuadroEfeitos tipo={estilo.efeito} cor={acento} />

          {/* Fio de acento: assina sem virar bloco de cor. */}
          <div
            style={{
              position: "absolute",
              top: "14mm",
              left: "50%",
              transform: "translateX(-50%)",
              width: "18mm",
              height: "0.6mm",
              background: acento,
              borderRadius: 1,
              zIndex: 2,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "22mm 20mm 15mm",
            }}
          >
            {q.fotoUrl && !p.fotoSangra && (
              <div
                style={{
                  marginTop: "2mm",
                  // Em pé ganha altura e perde largura; deitada fica na faixa.
                  height: formato === "retrato" ? "84mm" : formato === "quadrada" ? "64mm" : "55mm",
                  width: formato === "retrato" ? "72mm" : "100%",
                  marginLeft: formato === "retrato" ? "auto" : undefined,
                  marginRight: formato === "retrato" ? "auto" : undefined,
                  overflow: "hidden",
                  borderRadius: 3,
                }}
              >
                <img
                  src={q.fotoUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: formato === "retrato" ? "center center" : "center 22%",
                    display: "block",
                  }}
                />
              </div>
            )}

            <div
              style={{
                marginTop: q.fotoUrl
                  ? p.fotoSangra
                    ? formato === "quadrada"
                      ? "78mm"
                      : "70mm"
                    : "8mm"
                  : "10mm",
                textAlign: "center",
              }}
            >
              {q.nome && (
                <p style={{ fontSize: "7.5pt", letterSpacing: "0.42em", textTransform: "uppercase", color: acento }}>
                  {t.para} {q.nome}
                </p>
              )}
              <h1
                style={{
                  fontFamily: FONTES.display,
                  fontWeight: 500,
                  fontSize: "23pt",
                  lineHeight: 1.12,
                  marginTop: "3mm",
                  color: p.texto,
                }}
              >
                {q.titulo}
              </h1>
            </div>

            <div
              ref={caixaRef}
              style={{
                flex: 1,
                minHeight: 0,
                marginTop: "8mm",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <p
                ref={letraRef}
                style={{
                  whiteSpace: "pre-wrap",
                  textAlign: "center",
                  fontSize: `${corpoPt}pt`,
                  lineHeight: duasColunas ? 1.42 : 1.6,
                  color: p.textoSuave,
                  maxWidth: duasColunas ? "100%" : "138mm",
                  ...(duasColunas ? { columnCount: 2, columnGap: "12mm", width: "100%" } : {}),
                }}
              >
                {q.letra}
              </p>
            </div>

            {q.dedicatoria && (
              <p
                style={{
                  textAlign: "center",
                  fontFamily: FONTES.display,
                  fontSize: "11pt",
                  fontStyle: "italic",
                  color: acento,
                  margin: "6mm 0 0",
                }}
              >
                {q.dedicatoria}
              </p>
            )}

            {/* O RODAPÉ É O QR, não a assinatura. Quem olha o quadro na parede
                não precisa saber quem fez, precisa conseguir OUVIR. */}
            <div
              style={{
                marginTop: "5mm",
                paddingTop: "4mm",
                borderTop: `0.25mm solid ${p.linha}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2mm",
              }}
            >
              <p
                style={{
                  fontSize: "9pt",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: acento,
                  fontWeight: 600,
                }}
              >
                {t.ouvir}
              </p>
              {qr && (
                <img
                  src={qr}
                  alt=""
                  // Zona de silêncio em volta: sem margem clara o leitor erra
                  // os cantos e o celular não engata.
                  style={{
                    width: "24mm",
                    height: "24mm",
                    display: "block",
                    background: p.qrFundo,
                    padding: "1.8mm",
                    borderRadius: 2,
                  }}
                />
              )}
              <img
                src="/img/logo-serenata-alfa.png"
                alt={MARCA.nome}
                style={{
                  height: "7mm",
                  width: "auto",
                  display: "block",
                  marginTop: "0.5mm",
                  // A logo é vinho sobre transparente: no fundo escuro ela some,
                  // então clareia. No claro vai como é.
                  filter: p.fotoSangra ? "brightness(0) invert(1) opacity(0.82)" : "none",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
