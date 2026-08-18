import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { carregarQuadro, type Quadro } from "@/lib/quadro";
import { FONTES, MARCA, CORES } from "@/lib/marca";
import { Printer, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/track";

// A FOLHA A4 PRA EMOLDURAR.
//
// Uma página, tamanho exato de A4 retrato, feita pra sair da impressora e ir
// pro quadro. Tudo que não é a folha some na impressão.
//
// TRÊS DECISÕES QUE DECIDEM SE FICA BONITO NO PAPEL:
//
// 1. Texto VETORIAL, não imagem. Rasterizar num canvas seria mais fácil, e a
//    letra sairia serrilhada justamente no que a pessoa vai ler de perto,
//    emoldurado. Aqui o navegador imprime o texto como texto.
//
// 2. Medidas em MILÍMETRO, não pixel. `210mm x 297mm` é A4 de verdade em
//    qualquer impressora; pixel depende de DPI e vira sorte.
//
// 3. `print-color-adjust: exact`. Sem isso o navegador "economiza tinta" e
//    imprime o fundo em branco, matando a única cor que a pessoa escolheu.

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
    dica: "No celular: toque em imprimir e escolha “Salvar como PDF”. Pra emoldurar, peça impressão em papel fosco A4.",
    ouvir: "Aponte a câmera para ouvir",
    para: "para",
  },
  es: {
    acao: "Imprimir o guardar en PDF",
    dica: "En el celular: toca imprimir y elige “Guardar como PDF”. Para enmarcar, pide impresión en papel mate A4.",
    ouvir: "Apunta la cámara para escuchar",
    para: "para",
  },
};

function Pagina() {
  const q = Route.useLoaderData() as Quadro;
  const t = T[q.locale] ?? T.pt;
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(q.linkPresente, {
      margin: 0,
      width: 320,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => {});
  }, [q.linkPresente]);

  const linhas = q.letra.split("\n");
  // AUTOAJUSTE GROSSEIRO, e proposital.
  //
  // Letra tem entre 20 e 45 linhas. Num corpo fixo, a curta fica perdida no
  // meio da folha e a longa vaza pra segunda página, que é o pior defeito
  // possível num quadro. Três faixas resolvem sem inventar cálculo de layout.
  const corpo = linhas.length > 38 ? "8.6pt" : linhas.length > 30 ? "9.6pt" : "10.8pt";
  const entreLinhas = linhas.length > 38 ? 1.5 : 1.65;
  const acento = q.corDestaque ?? CORES.vinho;

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          /* Só a folha sobrevive. Botão, dica e fundo da tela somem. */
          .nao-imprime { display: none !important; }
          html, body { background: #fff !important; margin: 0 !important; }
          .folha { box-shadow: none !important; margin: 0 !important; }
        }
        .folha, .folha * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="min-h-screen bg-[#e9e4dc] py-6">
        <div className="nao-imprime mx-auto mb-6 max-w-[210mm] px-4 text-center">
          <button
            onClick={() => {
              trackEvent("quadro_imprimir");
              window.print();
            }}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1a1a] px-7 text-white"
            style={{ fontSize: 15 }}
          >
            <Printer className="h-4 w-4" /> {t.acao}
          </button>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-[#6b6259]">{t.dica}</p>
        </div>

        {/* A FOLHA. Medida exata, e é ela que vai pro papel. */}
        <div
          className="folha mx-auto flex flex-col bg-white"
          style={{
            width: "210mm",
            height: "297mm",
            padding: "18mm 18mm 14mm",
            boxShadow: "0 8px 40px rgba(0,0,0,.14)",
            color: "#1a1a1a",
          }}
        >
          {/* Filete de cor no topo: é o único lugar onde a cor que ela
              escolheu no editor aparece impressa. */}
          <div style={{ height: "2.5mm", background: acento, borderRadius: 2 }} />

          {q.fotoUrl && (
            <div
              style={{
                marginTop: "9mm",
                height: "62mm",
                overflow: "hidden",
                borderRadius: 3,
                background: "#f2efea",
              }}
            >
              <img
                src={q.fotoUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          )}

          <div style={{ marginTop: q.fotoUrl ? "8mm" : "16mm", textAlign: "center" }}>
            {q.nome && (
              <p
                style={{
                  fontSize: "8pt",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: "#8a8078",
                }}
              >
                {t.para} {q.nome}
              </p>
            )}
            <h1
              style={{
                fontFamily: FONTES.display,
                fontWeight: 500,
                fontSize: "21pt",
                lineHeight: 1.15,
                marginTop: "2.5mm",
              }}
            >
              {q.titulo}
            </h1>
          </div>

          {/* A LETRA. `flex:1` empurra o rodapé pra base da folha em vez de
              deixá-lo colado no fim do texto: letra curta não pode fazer o
              QR Code subir pro meio da página. */}
          <div
            style={{
              flex: 1,
              marginTop: "7mm",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 0,
            }}
          >
            <p
              style={{
                whiteSpace: "pre-wrap",
                textAlign: "center",
                fontSize: corpo,
                lineHeight: entreLinhas,
                color: "#332f2b",
                maxWidth: "150mm",
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
                margin: "0 0 6mm",
              }}
            >
              {q.dedicatoria}
            </p>
          )}

          <div
            style={{
              borderTop: "0.4mm solid #e6e0d8",
              paddingTop: "5mm",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6mm",
            }}
          >
            <div>
              <p style={{ fontFamily: FONTES.display, fontSize: "13pt", fontWeight: 500 }}>
                {MARCA.nome}
              </p>
              <p style={{ fontSize: "7.5pt", color: "#8a8078", marginTop: "1mm" }}>{t.ouvir}</p>
            </div>
            {qr ? (
              <img src={qr} alt="" style={{ width: "22mm", height: "22mm", display: "block" }} />
            ) : (
              <div style={{ width: "22mm", height: "22mm", display: "grid", placeItems: "center" }}>
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
