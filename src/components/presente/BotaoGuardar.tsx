import { useState } from "react";
import { Share2, Download, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function BotaoGuardar({
  audioUrl,
  titulo,
  nome,
}: {
  audioUrl: string;
  titulo: string;
  nome: string;
}) {
  const [estado, setEstado] = useState<"parado" | "preparando" | "ok">("parado");

  // Nome de arquivo limpo: acento e barra quebram em parte dos aparelhos.
  const arquivo = `${titulo}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  async function guardar() {
    // `canShare` com um File de mentira é a ÚNICA checagem confiável: há
    // navegador com navigator.share que recusa arquivo. Testar só `share`
    // levaria a um erro depois de baixar 5 MB à toa.
    const suporta =
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([""], "t.mp3", { type: "audio/mpeg" })] });

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
    <button
      onClick={guardar}
      disabled={estado === "preparando"}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm text-white/75",
        "transition-colors duration-150 hover:border-white/35 hover:text-white disabled:opacity-60",
      )}
    >
      {estado === "preparando" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> preparando o áudio…
        </>
      ) : estado === "ok" ? (
        <>
          <Check className="h-4 w-4" /> pronto
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" /> Guardar ou enviar a música
          <Download className="h-3.5 w-3.5 opacity-40" />
        </>
      )}
    </button>
  );
}
