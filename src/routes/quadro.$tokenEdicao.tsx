import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { carregarQuadro, type Quadro } from "@/lib/quadro";
import { FONTES, MARCA } from "@/lib/marca";
import { Printer } from "lucide-react";
import { trackEvent } from "@/lib/track";

// A FOLHA A4 PRA EMOLDURAR.
//
// A primeira versão era uma folha branca com um filete de cor e o texto
// empilhado. Dois defeitos, e o dono viu os dois de cara: não parecia
// Serenata, e o texto VAZAVA por cima da foto e do título.
//
// ── O VAZAMENTO, e por que meu teste não pegou ───────────────────
//
// A letra vivia num flex com `minHeight: 0`. Quando não cabia, a caixa
// encolhia e o texto transbordava POR FORA dela, sobrepondo os vizinhos. E o
// meu teste comparava `scrollHeight` com `clientHeight` DO CONTAINER, que
// continuam iguais nesse caso: eu estava medindo a caixa, não o conteúdo.
//
// Agora o corpo é medido de verdade (`ajustarCorpo`), encolhendo até caber, e
// a caixa tem `overflow: hidden` pra não haver para onde vazar.
//
// ── A IDENTIDADE ─────────────────────────────────────────────────
//
// Emprestada da página presente, não inventada aqui: fundo #0d0a08, a foto
// entrando por baixo do mesmo degradê que ela usa, Fraunces no título, e a cor
// que o comprador escolheu como ACENTO (o nome, o fio, a dedicatória), nunca
// como bloco solto.
//
// Escuro num A4 gasta tinta, e é decisão consciente: isto existe pra ser
// impresso em gráfica e emoldurado, não pra sair na jato de tinta de casa.

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
  },
  es: {
    acao: "Imprimir o guardar en PDF",
    dica: "Elige “Guardar como PDF”. Para enmarcar, pide impresión profesional en papel mate A4.",
    ouvir: "Apunta la cámara y escucha",
    para: "para",
  },
};

const NOVA_LINHA = String.fromCharCode(10);
const FUNDO = "#0d0a08";
const AMBAR = "#f0b95f";

/**
 * Encolhe o corpo da letra até ela caber na altura disponível.
 *
 * Roda em `useLayoutEffect` pra acontecer ANTES da pintura: depois, a folha
 * piscaria com o texto grande antes de assentar, e quem mandasse imprimir
 * rápido pegaria o estado errado.
 */
/**
 * O corpo que faz a letra caber. MEDE a altura real e escala por regra de três.
 *
 * Duas tentativas anteriores falharam, e vale registrar as duas porque erram
 * por motivos diferentes:
 *
 * 1. Um LAÇO encolhendo 0,25pt por vez, medindo a cada passo. Não convergia
 *    porque o React re-renderizava e o `style` do JSX desfazia o `fontSize`
 *    que o laço tinha acabado de gravar no DOM.
 *
 * 2. Uma CONTA a partir do NÚMERO DE LINHAS do texto. Errava por baixo: em
 *    duas colunas estreitas as linhas longas QUEBRAM EM DUAS, então 51 linhas
 *    de letra viram bem mais de 51 linhas na tela. Devolvia 8,5pt onde a caixa
 *    pedia 7,75, e a letra vazava 11px.
 *
 * O que funciona é não adivinhar quantas linhas existem: medir a altura que o
 * texto REALMENTE ocupou no corpo atual e escalar, já que a entrelinha é
 * múltiplo do corpo. Encolher reduz a quebra de linha, então o resultado só
 * sobra, nunca falta.
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

  // MEDE NUM CLONE FORA DA TELA, e isso é o coração do conserto.
  //
  // Medir o elemento real não funciona: com `column-count`, dentro de um pai
  // com `overflow: hidden`, o `scrollHeight` devolve a altura LIMITADA da
  // caixa, não a altura natural do texto. Todas as minhas medições anteriores
  // liam esse número e por isso "cabia" quando não cabia.
  //
  // O clone tem uma coluna só, a largura de UMA coluna do layout final, e
  // nenhum limite de altura. Aí o `scrollHeight` volta a ser o que diz ser.
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
  const alturaNoLayout = alturaUmaColuna / colunas;
  const alvo = (REF * caixaPx * 0.94) / alturaNoLayout;
  // Piso de 7pt: abaixo disso não se lê num quadro na parede.
  return Math.max(7, Math.min(maxPt, Math.floor(alvo * 4) / 4));
}

function Pagina() {
  const q = Route.useLoaderData() as Quadro;
  // DUAS COLUNAS QUANDO A LETRA É LONGA, e não é escolha estética.
  //
  // A conta que eu não tinha feito: 49 linhas com entrelinha legível ocupam
  // ~270mm, e o A4 tem 297mm no total. Numa coluna só, com foto, NÃO CABE em
  // tamanho nenhum que se leia num quadro. Foi por isso que a primeira versão
  // vazou por cima da foto: não era bug de CSS, era falta de espaço.
  //
  // O corte em 26 linhas é onde a coluna única deixa de caber com a foto de
  // 112mm. Abaixo disso, uma coluna centralizada é mais bonita e fica.
  const duasColunas = q.letra.split(NOVA_LINHA).filter((l) => l.trim()).length > 26;
  const t = T[q.locale] ?? T.pt;
  const [qr, setQr] = useState<string | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const letraRef = useRef<HTMLParagraphElement>(null);
  const [pronto, setPronto] = useState(false);
  /** Corpo da letra depois do ajuste. Vive em estado, não no DOM: ver `medir`. */
  const [corpoPt, setCorpoPt] = useState(11);

  // A COR QUE ELA ESCOLHEU FICA SÓ NO FIO, não no texto.
  //
  // Na página presente a cor dela funciona: fundo preto, karaokê aceso, a
  // palavra brilhando no ritmo. No papel ela vira texto ciano sobre bordô, que
  // é feio e some na impressão. O texto usa o âmbar da marca, que conversa com
  // o fundo; a escolha dela assina no fio do topo, onde some se destoar.
  const fio = q.corDestaque ?? AMBAR;
  const acento = AMBAR;

  useEffect(() => {
    QRCode.toDataURL(q.linkPresente, {
      margin: 0,
      width: 400,
      // Claro sobre o fundo escuro: leitor de celular precisa de contraste, e
      // QR escuro sobre preto não lê.
      color: { dark: FUNDO, light: "#f7f0e8" },
    })
      .then(setQr)
      .catch(() => {});
  }, [q.linkPresente]);

  useLayoutEffect(() => {
    // MEDE, ESCALA, E CONFERE DE NOVO.
    //
    // O `style` do elemento é mexido só DENTRO da medição, como rascunho, e o
    // valor final vai pra estado. Foi a mistura dos dois que travou a versão
    // do laço: ele gravava no DOM e o React desfazia no re-render.
    //
    // Duas passadas porque encolher o texto muda a quebra de linha: a primeira
    // dá o valor quase certo, a segunda confirma em cima do layout novo.
    const medir = () => {
      const el = letraRef.current;
      const caixa = caixaRef.current;
      if (!el || !caixa) return;
      const colunas = duasColunas ? 2 : 1;
      // Largura de UMA coluna: o vão de 12mm entre elas sai da conta.
      const vao = duasColunas ? 12 * 3.7795 : 0;
      const larguraColuna = (el.clientWidth - vao) / colunas;
      setCorpoPt(corpoQueCabe(q.letra, larguraColuna, colunas, caixa.clientHeight, 1.55, 11));
      setPronto(true);
    };

    medir();
    // E de novo no quadro seguinte: a primeira medição pega a caixa antes de o
    // flex assentar a altura.
    const rAF = requestAnimationFrame(medir);

    // MEDIR DE NOVO QUANDO AS FONTES CARREGAREM.
    //
    // A primeira medição acontece com a fonte de sistema. Quando a Fraunces e
    // a Poppins entram, o texto muda de largura, reflui e CRESCE, e o ajuste
    // feito antes vira mentira: foi assim que a letra continuou vazando 26px
    // mesmo com o encolhimento rodando.
    //
    // `document.fonts.ready` resolve na hora quando já estão em cache, então
    // não custa nada no caso comum.
    let vivo = true;
    document.fonts?.ready.then(() => {
      if (vivo) medir();
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(rAF);
    };
  }, [q.letra, duasColunas]);

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          .nao-imprime { display: none !important; }
          html, body { background: #fff !important; margin: 0 !important; }
          .folha { box-shadow: none !important; margin: 0 !important; }
        }
        /* Sem isto o navegador "economiza tinta" e imprime o fundo em branco,
           o que apagaria a folha inteira, já que ela é escura. */
        .folha, .folha * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="min-h-screen bg-[#1c1815] py-6">
        <div className="nao-imprime mx-auto mb-6 max-w-[210mm] px-4 text-center">
          <button
            onClick={() => {
              trackEvent("quadro_imprimir");
              window.print();
            }}
            className="inline-flex h-12 items-center gap-2 rounded-full px-7 font-medium"
            style={{ fontSize: 15, background: AMBAR, color: FUNDO }}
          >
            <Printer className="h-4 w-4" /> {t.acao}
          </button>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-white/45">{t.dica}</p>
        </div>

        <div
          className="folha relative mx-auto overflow-hidden"
          style={{
            width: "210mm",
            height: "297mm",
            background: FUNDO,
            color: "#f7f0e8",
            boxShadow: "0 10px 50px rgba(0,0,0,.5)",
            opacity: pronto ? 1 : 0,
          }}
        >
          {/* A FOTO, sangrando de borda a borda e sumindo no fundo.
              É o gesto da página presente: a imagem não é um retângulo colado,
              ela É o ambiente, e o degradê é o que entrega o texto. */}
          {q.fotoUrl && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "112mm" }}>
              <img
                src={q.fotoUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 22%", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(to bottom, rgba(13,10,8,0.18) 0%, rgba(13,10,8,0.62) 34%, rgba(13,10,8,0.93) 62%, ${FUNDO} 82%)`,
                }}
              />
            </div>
          )}

          {/* Fio de acento no alto: assina sem virar bloco de cor. */}
          <div
            style={{
              position: "absolute",
              top: "14mm",
              left: "50%",
              transform: "translateX(-50%)",
              width: "18mm",
              height: "0.6mm",
              background: fio,
              borderRadius: 1,
            }}
          />

          <div
            style={{
              position: "relative",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "22mm 20mm 15mm",
            }}
          >
            {/* O título entra na altura em que a foto já escureceu, e por isso
                fica legível sem caixa nem sombra por baixo. */}
            <div style={{ marginTop: q.fotoUrl ? "62mm" : "10mm", textAlign: "center" }}>
              {q.nome && (
                <p
                  style={{
                    fontSize: "7.5pt",
                    letterSpacing: "0.42em",
                    textTransform: "uppercase",
                    color: acento,
                  }}
                >
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
                  color: "#fdfaf5",
                }}
              >
                {q.titulo}
              </h1>
            </div>

            {/* A CAIXA DA LETRA. A altura vem do flex e o corpo do texto se
                ajusta a ela. Com `overflow: hidden`, não há para onde vazar. */}
            <div
              ref={caixaRef}
              style={{
                flex: 1,
                minHeight: 0,
                marginTop: "9mm",
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
                  lineHeight: 1.55,
                  color: "rgba(247,240,232,0.82)",
                  maxWidth: duasColunas ? "100%" : "138mm",
                  ...(duasColunas
                    ? { columnCount: 2, columnGap: "12mm", width: "100%" }
                    : {}),
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
                  margin: "7mm 0 0",
                }}
              >
                {q.dedicatoria}
              </p>
            )}

            <div
              style={{
                marginTop: "8mm",
                paddingTop: "5mm",
                borderTop: "0.25mm solid rgba(247,240,232,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6mm",
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: FONTES.display,
                    fontSize: "13.5pt",
                    fontWeight: 500,
                    color: "#fdfaf5",
                  }}
                >
                  {MARCA.nome}
                </p>
                <p style={{ fontSize: "7pt", color: "rgba(247,240,232,0.45)", marginTop: "1.5mm" }}>
                  {t.ouvir}
                </p>
              </div>
              {qr && (
                <img
                  src={qr}
                  alt=""
                  style={{ width: "21mm", height: "21mm", display: "block", borderRadius: 1 }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
