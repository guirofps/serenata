import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PixPagamento } from "@/components/quiz/PixPagamento";
import { Logo } from "@/components/marca/Logo";
import { TEMA_CLARO } from "@/lib/marca";
import { trackEvent } from "@/lib/track";
import { Button } from "@/components/ui/button";

// O PIX QUE VOLTA.
//
// ── POR QUE ESTA ROTA PRECISOU EXISTIR ───────────────────────────
//
// O e-mail de PIX abandonado (39 pessoas por dia) promete, com todas as
// letras: "o seu código continua valendo, é o mesmo que você gerou". Com o
// checkout hospedado isso era verdade de graça, porque o link era a tela do
// gateway com o código dela dentro.
//
// No checkout transparente a tela é NOSSA, e ela vive dentro do funil, presa
// ao estado do navegador. Sem esta rota, o e-mail teria que mandar a pessoa
// pro checkout gerar um código NOVO — e aí a frase acima vira mentira, que é
// exatamente o erro que aquele texto foi escrito pra corrigir.
//
// Serve pro segundo caso também, e ele é mais comum do que parece: quem abriu
// o PIX, foi no aplicativo do banco, e voltou pra aba fechada.
//
// ── NÃO CRIA NADA ────────────────────────────────────────────────
//
// Só LÊ um pedido pendente que já existe. Uma rota pública que cria cobrança
// seria um jeito de qualquer um encher a conta da Woovi de PIX morto.
//
// ── E A REFERÊNCIA NÃO É SEGREDO ─────────────────────────────────
//
// Ela é `serenata:<quiz_response_id>`, um uuid que a pessoa recebe no próprio
// link. O que ela abre é um código de pagamento: quem tiver o link pode PAGAR
// pela música de alguém, não ver dado nenhum. Por isso a tela devolve o
// mínimo — código, valor e título — e nunca e-mail, nome ou a letra.

type Dados =
  | { ok: true; copiaECola: string; valorTexto: string; titulo: string | null }
  | { ok: false; motivo: "nao-achei" | "ja-pago" | "vencido" };

const buscarPix = createServerFn({ method: "POST" })
  .validator((data: { referencia: string }) => data)
  .handler(async ({ data }): Promise<Dados> => {
    const { data: p } = await supabaseAdmin()
      .from("pedidos")
      .select("status, pix_codigo, pix_expira, valor_centavos, musica_id")
      .eq("payment_id", `woovi:${data.referencia}`)
      .maybeSingle();

    if (!p) return { ok: false, motivo: "nao-achei" };
    if (p.status === "pago") return { ok: false, motivo: "ja-pago" };
    if (!p.pix_codigo) return { ok: false, motivo: "nao-achei" };
    // O código da Woovi vale 1 hora. Passou disso, o QR não paga mais nada e
    // mostrar ele seria pior que não mostrar: a pessoa tentaria, o banco
    // recusaria, e ela concluiria que o problema é a nossa loja.
    if (p.pix_expira && Date.parse(p.pix_expira as string) < Date.now()) {
      return { ok: false, motivo: "vencido" };
    }

    let titulo: string | null = null;
    if (p.musica_id) {
      const { data: m } = await supabaseAdmin()
        .from("musicas")
        .select("titulo")
        .eq("id", p.musica_id)
        .maybeSingle();
      titulo = (m?.titulo as string | null) ?? null;
    }

    const centavos = (p.valor_centavos as number | null) ?? 0;
    return {
      ok: true,
      copiaECola: p.pix_codigo as string,
      valorTexto: `R$ ${(centavos / 100).toFixed(2).replace(".", ",").replace(",00", "")}`,
      titulo,
    };
  });

export const Route = createFileRoute("/pix/$referencia")({
  component: Pagina,
  // SEM INDEXAR. É uma tela de pagamento com um código dentro; não tem por que
  // existir em buscador nenhum.
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

function Pagina() {
  const { referencia } = Route.useParams();
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    trackEvent("pix_retomado_aberto", { referencia });
    buscarPix({ data: { referencia } })
      .then(setDados)
      .catch(() => setDados({ ok: false, motivo: "nao-achei" }));
  }, [referencia]);

  return (
    <div className={`${TEMA_CLARO} min-h-dvh bg-background`}>
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {!dados && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Abrindo o seu PIX...</p>
          </div>
        )}

        {dados?.ok && (
          <>
            {dados.titulo && (
              <p className="mb-5 text-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{dados.titulo}</span>{" "}
                está gravada e esperando.
              </p>
            )}
            <PixPagamento
              copiaECola={dados.copiaECola}
              valorTexto={dados.valorTexto}
              referencia={referencia}
              aoPagar={() => {
                window.location.href = "/obrigado";
              }}
              // Aqui o cartão vai pro checkout da Perfect Pay direto, sem
              // passar pelo funil: quem chegou por este link já decidiu
              // comprar, e fazer ela reler a oferta seria atrito puro.
              aoEscolherCartao={() => {
                trackEvent("pix_retomado_cartao", { referencia });
                window.location.href = `/criar?checkout=1`;
              }}
            />
          </>
        )}

        {dados && !dados.ok && (
          <div className="space-y-4 rounded-2xl border border-primary/10 bg-secondary/30 px-5 py-6 text-center">
            <p className="font-medium">
              {dados.motivo === "ja-pago"
                ? "Esse pagamento já entrou"
                : dados.motivo === "vencido"
                  ? "Esse código PIX venceu"
                  : "Não achei esse PIX"}
            </p>
            <p className="text-sm leading-snug text-muted-foreground">
              {dados.motivo === "ja-pago"
                ? "A sua música já está liberada. O link pra montar o presente foi pro seu e-mail."
                : dados.motivo === "vencido"
                  ? "Nada foi cobrado. Dá pra gerar outro em um toque, com o mesmo preço."
                  : "O link pode ter sido cortado pelo aplicativo de e-mail. Dá pra continuar por aqui."}
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                window.location.href = dados.motivo === "ja-pago" ? "/obrigado" : "/criar";
              }}
            >
              {dados.motivo === "ja-pago" ? "Abrir a minha música" : "Continuar a compra"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
