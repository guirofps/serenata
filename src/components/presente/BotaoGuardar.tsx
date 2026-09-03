import { useEffect, useState } from "react";
import { Download, Loader2, Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";
import { tp } from "@/lib/textos-presente";

// DUAS AÇÕES, DOIS BOTÕES. Baixar e enviar são intenções diferentes.
//
// ── O QUE ISTO CONSERTA, E QUANTO CUSTOU ─────────────────────────
//
// Até 03/09 havia um botão só, "Baixar ou enviar", e no celular ele NÃO
// baixava: abria a folha de compartilhamento. Quem queria o arquivo na pasta
// de downloads via um menu de "enviar para..." e concluía que estava quebrado.
//
// Em 02/09 isso virou contestação. O comprador pagou, entrou no editor, ficou
// cinco minutos, chamou o suporte (que estava fora do ar) e escreveu
// publicamente que era golpe. A frase dele no WhatsApp foi "Não consigo baixar
// pelo e-mail".
//
// ── POR QUE O DIAGNÓSTICO ANTIGO ERRAVA A CURA ───────────────────
//
// O comentário anterior dizia, corretamente, que `<a download>` não baixa no
// celular. A causa: o atributo `download` é IGNORADO em URL de outro domínio,
// e a nossa é do Supabase. O navegador então navega pro arquivo em vez de
// salvar.
//
// A cura não é trocar download por compartilhar, é fazer o SERVIDOR mandar
// baixar. A URL assinada do Supabase aceita `?download=<nome>`, e aí ele
// responde com `Content-Disposition: attachment` — o que baixa de verdade em
// qualquer navegador, inclusive celular, mesmo sendo outro domínio.
//
// Medido em 03/09 no arquivo real:
//   sem o parâmetro → content-disposition: (nenhum)
//   com o parâmetro → attachment; filename=unico-amor.mp3
//
// ── E O COMPARTILHAR CONTINUA ────────────────────────────────────
//
// Mandar o áudio no WhatsApp é o que muita gente quer, e é bom. Só não pode
// ser a única coisa que o botão de "baixar" faz. Vira o segundo botão, com o
// nome do que ele realmente faz.

// `canShare` com um File de mentira é a ÚNICA checagem confiável: há navegador
// com navigator.share que recusa arquivo. Testar só `share` levaria a um erro
// depois de baixar 5 MB à toa.
/**
 * A mesma URL, mas pedindo ao Supabase pra responder como ANEXO.
 *
 * Só na hora de baixar: a URL do player precisa continuar tocando, e uma que
 * responde `attachment` faz o navegador baixar em vez de reproduzir.
 */
function urlQueBaixa(url: string, arquivo: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("download", `${arquivo}.mp3`);
    return u.toString();
  } catch {
    // URL relativa ou malformada: melhor tentar como está do que não baixar.
    return url;
  }
}

function suportaCompartilharArquivo(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([""], "t.mp3", { type: "audio/mpeg" })] })
  );
}

export function BotaoGuardar({
  audioUrl,
  obterUrl,
  titulo,
  nome,
  comDica = false,
  escuro = false,
  locale = "pt",
}: {
  /** A URL assinada, quando quem chama já a tem (editor e página presente). */
  audioUrl?: string;
  /**
   * Busca a URL no CLIQUE. É o caminho do painel, que lista N músicas e não
   * pode assinar todas na carga só porque uma pode ser baixada.
   * Um dos dois é obrigatório; `audioUrl` ganha quando os dois vêm.
   */
  obterUrl?: () => Promise<string | null>;
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

  /** Pega a URL, do prop ou do servidor. `null` quando não deu. */
  async function pegarUrl(): Promise<string | null> {
    let url = audioUrl ?? null;
    if (!url && obterUrl) {
      try {
        url = await obterUrl();
      } catch {
        url = null;
      }
    }
    return url;
  }

  // BAIXAR de verdade, inclusive no celular. Ver o cabeçalho: quem faz o
  // download acontecer é o `Content-Disposition` que o Supabase manda quando a
  // URL pede, e não o atributo `download` do link, que é ignorado entre
  // domínios diferentes.
  async function baixar() {
    setEstado("preparando");
    const url = await pegarUrl();
    if (!url) return setEstado("parado");

    const a = document.createElement("a");
    a.href = urlQueBaixa(url, arquivo);
    a.download = `${arquivo}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setEstado("parado");
  }

  // ENVIAR: a folha nativa com o arquivo anexado, que oferece WhatsApp,
  // Arquivos, AirDrop. Só aparece onde a Web Share API aceita arquivo.
  async function enviar() {
    setEstado("preparando");
    const url = await pegarUrl();
    if (!url) return setEstado("parado");

    try {
      const resp = await fetch(url);
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
      // Cancelar a folha vira AbortError — é escolha da pessoa, não erro.
      if (err instanceof Error && err.name === "AbortError") {
        return setEstado("parado");
      }
      console.error("[presente] compartilhar falhou:", err);
      // Se o compartilhar quebrou, o download resolve o que ela queria.
      await baixar();
    }
  }

  const classeBotao = cn(
    "inline-flex h-12 items-center justify-center gap-2 rounded-full border px-6",
    "transition-colors duration-150 disabled:opacity-60",
    escuro
      ? "border-white/25 text-white/80 hover:border-white/50 hover:text-white"
      : "border-[var(--tinta-fraca)] text-[var(--tinta)] hover:border-[var(--acento)] hover:text-[var(--acento)]",
  );

  return (
    <div className={comDica ? "w-full" : undefined}>
      {/* Os dois lado a lado no celular, que é onde 99% abre. `flex-wrap`
          porque "Enviar pelo WhatsApp" é longo e num aparelho estreito ele
          desce em vez de espremer o de baixar. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={baixar}
          disabled={estado === "preparando"}
          className={classeBotao}
          style={{ fontSize: "var(--t-sm)" }}
        >
          {estado === "preparando" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {T.preparandoAudio}
            </>
          ) : (
            <>
              {/* "BAIXAR" no rótulo, e o ícone em opacidade cheia. O texto era
                  "Guardar ou enviar" com o ícone a 40%: virou ticket de suporte
                  em 03/08 ("como baixa a música?"), porque ninguém procura a
                  palavra "guardar" quando quer o arquivo. */}
              <Download className="h-4 w-4" /> {T.baixarMusica}
            </>
          )}
        </button>

        {/* Só onde a folha nativa aceita arquivo. No desktop ela quase nunca
            existe, e um botão que não faz nada é pior que botão nenhum. */}
        {folha && (
          <button
            onClick={enviar}
            disabled={estado === "preparando"}
            className={classeBotao}
            style={{ fontSize: "var(--t-sm)" }}
          >
            {estado === "ok" ? (
              <>
                <Check className="h-4 w-4" /> {T.pronto}
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" /> {T.enviarMusica}
              </>
            )}
          </button>
        )}
      </div>

      {comDica && (
        <p
          className={cn("mt-2", escuro ? "text-white/45" : "text-[var(--tinta-suave)]")}
          style={{ fontSize: "var(--t-xs)", lineHeight: 1.55 }}
        >
          {folha ? T.ajudaCelular : T.ajudaDesktop}
        </p>
      )}
    </div>
  );
}
