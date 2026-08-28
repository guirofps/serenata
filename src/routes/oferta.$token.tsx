import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { criarPixOferta, type ResultadoPixOferta } from "@/lib/criar-pix-oferta";
import { PixPagamento } from "@/components/quiz/PixPagamento";
import { Logo } from "@/components/marca/Logo";
import { TEMA_CLARO } from "@/lib/marca";
import { trackEvent } from "@/lib/track";
import { Button } from "@/components/ui/button";

// A OFERTA DA ESCADA, com o PIX na nossa página.
//
// ── DE ONDE VEM QUEM CHEGA AQUI ──────────────────────────────────
//
// Dos e-mails de recuperação, do segundo ao décimo primeiro, que descem o
// preço com o tempo (R$ 38 → 29 → 19 → 9). Antes o link ia direto pro
// checkout da Perfect Pay, porque cada degrau era um PRODUTO cadastrado lá
// com aquele preço.
//
// Com o checkout próprio a Woovi cobra qualquer valor, então o degrau vira só
// um número — e a economia de taxa (11,39% contra R$ 0,50) passa a valer
// também na recuperação, que é onde a margem já está mais fina por causa do
// desconto.
//
// ── POR QUE O PIX NASCE SOZINHO AQUI, SEM PASSO DE RESUMO ────────
//
// No funil existe um passo antes do QR, porque lá a pessoa acabou de ouvir a
// música e ainda está decidindo. Aqui não: ela clicou num e-mail que dizia o
// preço no assunto. O resumo seria repetir o que ela leu pra chegar, e um
// clique a mais entre a decisão e o pagamento.

export const Route = createFileRoute("/oferta/$token")({
  component: Pagina,
  // Uma tela de pagamento com o preço de uma pessoa dentro não tem por que
  // existir em buscador nenhum.
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

function Pagina() {
  const { token } = Route.useParams();
  const [r, setR] = useState<ResultadoPixOferta | null>(null);

  useEffect(() => {
    trackEvent("oferta_escada_aberta");
    criarPixOferta({ data: { token } })
      .then(setR)
      .catch(() => setR({ ok: false, erro: "gateway" }));
  }, [token]);

  return (
    <div className={`${TEMA_CLARO} min-h-dvh bg-background`}>
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {!r && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Abrindo a sua oferta...</p>
          </div>
        )}

        {r?.ok && (
          <>
            <p className="mb-5 text-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{r.titulo ?? `A música de ${r.nome}`}</span>{" "}
              está gravada e esperando.
            </p>
            <PixPagamento
              copiaECola={r.copiaECola}
              valorTexto={r.valorTexto}
              referencia={r.referencia}
              aoPagar={() => {
                window.location.href = "/obrigado";
              }}
              // O CARTÃO CONTINUA NA PERFECT PAY, e no preço do degrau: o
              // checkout hospedado de cada degrau segue cadastrado lá. Sem
              // isso, quem quer parcelar sairia daqui sem caminho.
              aoEscolherCartao={() => {
                trackEvent("oferta_escada_cartao");
                window.location.href = `/api/oferta-cartao?t=${encodeURIComponent(token)}`;
              }}
            />
          </>
        )}

        {r && !r.ok && (
          <div className="space-y-4 rounded-2xl border border-primary/10 bg-secondary/30 px-5 py-6 text-center">
            <p className="font-medium">
              {r.erro === "sem-musica" ? "Não achei a sua música" : "Esse link não vale mais"}
            </p>
            <p className="text-sm leading-snug text-muted-foreground">
              {r.erro === "sem-musica"
                ? "Pode ser que ela ainda esteja sendo gravada. Escreva pra contato@serenatagift.com que a gente resolve."
                : "Nada foi cobrado. Dá pra continuar a compra por aqui, com o mesmo preço da sua tela."}
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                window.location.href = "/criar";
              }}
            >
              Continuar a compra
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
