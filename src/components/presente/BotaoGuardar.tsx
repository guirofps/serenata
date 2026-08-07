import { useEffect, useState } from "react";
import { Download, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";
import { tp } from "@/lib/textos-presente";

// "Baixar a música" no celular NÃO baixa: abre o arquivo numa aba e a pessoa
// fica sem saber o que fazer. E 99% abre isso no celular.
//
// O que ela quer de verdade é MANDAR o áudio — no WhatsApp, pro grupo da
// família. Então o botão abre a folha de compartilhamento nativa, com o
// arquivo anexado, e o próprio sistema oferece WhatsApp, salvar em Arquivos,
// AirDrop.
//
// A Web Share API com arquivo (nível 2) existe em iOS 15+ e Chrome Android.
// Onde não existir, cai no download clássico — que no desktop é o certo de
// qualquer jeito.

// `canShare` com um File de mentira é a ÚNICA checagem confiável: há navegador
// com navigator.share que recusa arquivo. Testar só `share` levaria a um erro
// depois de baixar 5 MB à toa.
function suportaCompartilharArquivo(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([""], "t.mp3", { type: "audio/mpeg" })] })
  );
}

export function BotaoGuardar({
  audioUrl,
  titulo,
  nome,
  comDica = false,
  escuro = false,
  locale = "pt",
}: {
  audioUrl: string;
  titulo: string;
  nome: string;
  /** Mostra embaixo a explicação do que acontece no celular. */
  comDica?: boolean;
  /** Variante pra página-presente, que é o mundo escuro da marca. */
  escuro?: boolean;
  locale?: Locale;
}) {
  const T = tp(locale);
  const [estado, setEstado] = useState<"parado" | "preparando" | "ok">("parado");
  // Só no cliente: no SSR não existe navigator, e o texto mudaria na hidratação.
  const [folha, setFolha] = useState(false);
  useEffect(() => setFolha(suportaCompartilharArquivo()), []);

  // Nome de arquivo limpo: acento e barra quebram em parte dos aparelhos.
  const arquivo = `${titulo}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  async function guardar() {
    const suporta = suportaCompartilharArquivo();

    if (!suporta) {
      // Desktop e navegador antigo: download normal.
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = `${arquivo}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    setEstado("preparando");
    try {
      const resp = await fetch(audioUrl);
      if (!resp.ok) throw new Error(`download falhou: ${resp.status}`);
      const blob = await resp.blob();
      const file = new File([blob], `${arquivo}.mp3`, { type: "audio/mpeg" });
      await navigator.share({
        files: [file],
        title: titulo,
        text: `Uma música feita para ${nome} 🎁`,
      });
      setEstado("ok");
      setTimeout(() => setEstado("parado"), 2500);
    } catch (err) {
      // Cancelar a folha de compartilhamento vira AbortError — é escolha da
      // pessoa, não erro: não pode virar mensagem de falha.
      if (err instanceof Error && err.name === "AbortError") {
        setEstado("parado");
        return;
      }
      console.error("[presente] compartilhar falhou:", err);
      // Último recurso: abre o arquivo, que é melhor que não fazer nada.
      window.open(audioUrl, "_blank", "noopener");
      setEstado("parado");
    }
  }

  return (
    <div className={comDica ? "w-full" : undefined}>
      <button
        onClick={guardar}
        disabled={estado === "preparando"}
        className={cn(
          "inline-flex h-12 items-center gap-2 rounded-full border px-6",
          "transition-colors duration-150 disabled:opacity-60",
          escuro
            ? "border-white/25 text-white/80 hover:border-white/50 hover:text-white"
            : "border-[var(--tinta-fraca)] text-[var(--tinta)] hover:border-[var(--acento)] hover:text-[var(--acento)]",
        )}
        style={{ fontSize: "var(--t-sm)" }}
      >
        {estado === "preparando" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {T.preparandoAudio}
          </>
        ) : estado === "ok" ? (
          <>
            <Check className="h-4 w-4" /> {T.pronto}
          </>
        ) : (
          <>
            {/* "BAIXAR" no rótulo, e o ícone em opacidade cheia. O texto era
                "Guardar ou enviar" com o ícone a 40%: virou ticket de suporte
                em 03/08 ("como baixa a música?"), porque ninguém procura a
                palavra "guardar" quando quer o arquivo. */}
            <Download className="h-4 w-4" /> {T.baixarOuEnviar}
          </>
        )}
      </button>

      {comDica && (
        <p
          className={cn("mt-2", escuro ? "text-white/45" : "text-[var(--tinta-suave)]")}
          style={{ fontSize: "var(--t-xs)", lineHeight: 1.55 }}
        >
          {folha
            ? T.ajudaCelular
            : T.ajudaDesktop}
        </p>
      )}
    </div>
  );
}
