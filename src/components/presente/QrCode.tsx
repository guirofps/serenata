import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2 } from "lucide-react";
import { CORES } from "@/lib/marca";
import { type Locale } from "@/lib/i18n";
import { tp } from "@/lib/textos-presente";

// QR Code do link do presente — prometido na oferta desde sempre e até
// agora inexistente.
//
// Serve pra uma coisa específica do CLAUDE.md: transformar digital em
// físico. Imprime, cola numa caixa de bombom, e o presente vira objeto sem
// nenhuma logística da nossa parte.
//
// Gerado NO CLIENTE: não vale a pena uma rota de servidor pra desenhar um
// quadrado, e assim funciona mesmo se a rede cair depois da página abrir.

export function QrCode({
  url,
  nome,
  locale = "pt",
}: {
  url: string;
  nome: string;
  locale?: Locale;
}) {
  const T = tp(locale);
  const [png, setPng] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(url, {
      width: 1024, // grande: isto vai ser IMPRESSO, não só visto na tela
      margin: 2, // "zona quieta" — QR sem margem falha na leitura
      // Correção alta: o código continua legível com um pedaço sujo,
      // dobrado ou com o dedo em cima. Vale o custo de mais pontinhos.
      errorCorrectionLevel: "H",
      color: { dark: CORES.tinta, light: CORES.papel },
    })
      .then((d) => vivo && setPng(d))
      .catch((e) => {
        console.error("[qr] falhou:", e);
        if (vivo) setErro(true);
      });
    return () => {
      vivo = false;
    };
  }, [url]);

  if (erro) return null; // sem QR a página segue inteira; não vale um erro na cara

  return (
    <div className="text-center">
      <div
        className="mx-auto inline-flex items-center justify-center overflow-hidden rounded-[var(--raio)] bg-[var(--papel)] p-3"
        style={{ boxShadow: "var(--sombra)" }}
      >
        {png ? (
          <img src={png} alt={T.qrAlt(nome)} className="h-40 w-40" />
        ) : (
          <div className="grid h-40 w-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--tinta-fraca)]" />
          </div>
        )}
      </div>

      {png && (
        <a
          href={png}
          download={`qrcode-presente-${nome.toLowerCase().replace(/\s+/g, "-")}.png`}
          className="mt-3 inline-flex items-center gap-1.5 text-[var(--tinta-suave)] underline-offset-4 transition-colors duration-150 hover:text-[var(--acento)] hover:underline"
          style={{ fontSize: "var(--t-xs)" }}
        >
          <Download className="h-3.5 w-3.5" /> {T.baixarQr}
        </a>
      )}
    </div>
  );
}
