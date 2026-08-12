import { useState } from "react";
import { MessageCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/lib/i18n";
import { t } from "@/lib/textos";
import { captureLeadProgress } from "@/lib/lead-capture";
import { useQuizStore } from "@/lib/quiz-store";
import { trackEvent } from "@/lib/track";
import { mascaraTelefone, telefoneValido, paraE164, exemploTelefone } from "@/lib/telefone";

// PEDIR O WHATSAPP NA ESPERA — e só aqui.
//
// Medido em 12/08 (14 dias): 413 pessoas ouviram a própria música e 343 delas
// nunca chegaram ao checkout. De todas essas a gente tem e-mail e mais nada; o
// telefone só existe pra quem já tinha preenchido o cadastro do gateway, ou
// seja, pra quem já estava comprando. A lista de recuperação nasce cega
// justamente pra quem mais precisa de conversa.
//
// POR QUE NA ESPERA, e não junto do e-mail:
//
// O e-mail é PEDÁGIO (sem ele não sai a letra). Se o telefone virar pedágio
// junto, a gente arrisca os e-mails que já entram por causa de um campo a
// mais, numa tela onde a maioria já morre no primeiro passo. Aqui o telefone
// é FAVOR: ela está parada olhando uma barra por ~2 minutos, e o que a gente
// oferece é não precisar ficar olhando.
//
// E quem sai da página nesses 2 minutos é exatamente quem a gente perde hoje.
//
// POR QUE NÃO NO POPUP DO FIM DA PRÉVIA: aquele momento tem um trabalho só,
// que é o botão de comprar. Dois pedidos na mesma tela custam o principal.
//
// A promessa é AVISAR. Não é "receba o presente pelo WhatsApp": a página com
// as fotos quem monta é o comprador, e prometer entrega pronta aqui venderia
// um trabalho que a gente não faz.

export function AvisarWhatsApp({ locale = "pt" }: { locale?: Locale }) {
  const T = t(locale);
  const respostas = useQuizStore((s) => s.respostas);
  const [valor, setValor] = useState("");
  const [estado, setEstado] = useState<"aberto" | "salvo" | "dispensado">("aberto");
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (estado === "dispensado") return null;

  if (estado === "salvo") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-600/25 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
        <Check className="h-4 w-4 shrink-0" />
        {T.zapPronto}
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!telefoneValido(valor, locale)) {
      setErro(true);
      return;
    }
    setSalvando(true);
    // O upsert de progresso NUNCA manda telefone. Só esta tela manda, e manda
    // junto a origem — é o que diz depois que ela pediu pra ser avisada, em
    // vez de alguém ter pescado o número em outro lugar.
    await captureLeadProgress({
      locale,
      respostas,
      whatsapp: paraE164(valor, locale),
      whatsappOrigem: "espera",
    });
    trackEvent("whatsapp_deixado", { origem: "espera" });
    setSalvando(false);
    setEstado("salvo");
  }

  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-[var(--tinta-fraca)]/40 bg-secondary/40 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366]/15 text-[#128C4A]">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{T.zapTitulo}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{T.zapTexto}</p>

          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={valor}
            onChange={(e) => {
              setValor(mascaraTelefone(e.target.value, locale));
              setErro(false);
            }}
            placeholder={exemploTelefone(locale)}
            aria-label={T.zapCampo}
            aria-invalid={erro}
            className="mt-3 bg-white"
          />
          {erro && <p className="mt-1.5 text-xs text-red-600">{T.zapInvalido}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={salvando || !valor} className="rounded-full">
              {T.zapBotao}
            </Button>
            {/* Recusar é UM toque e está visível. Um campo opcional que dá
                trabalho pra dispensar é campo obrigatório com outro nome. */}
            <button
              type="button"
              onClick={() => {
                trackEvent("whatsapp_dispensado", { origem: "espera" });
                setEstado("dispensado");
              }}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {T.zapDispensar}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
