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
import { caminhoDeVolta } from "@/lib/volta-ao-funil";

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
// ── A REFERÊNCIA E O QUE ELA ABRE ────────────────────────────────
//
// Ela é `serenata:<quiz_response_id>` (Woovi) ou o `pay_...` do Asaas, e a
// pessoa recebe no próprio link. O que ela abre é um código de pagamento: a
// tela devolve o mínimo (código, valor e título) e nunca e-mail, nome ou a
// letra.
//
// DESDE 08/10 devolve também a SESSÃO, só de pedido do funil ainda NÃO pago,
// pra os botões de saída levarem pra música dela (`/retomar?s=`) e não pra
// abertura do quiz. A sessão é credencial, e a troca foi pesada: o link sai
// só pro e-mail do próprio comprador, a rota está em `rotas-sensiveis.ts`
// (nenhum script de terceiro lê a URL nem a tela), e pedido pago não devolve
// sessão nenhuma, então quem recebeu o link encaminhado pra pagar não ganha
// o editor de presente junto.

type Dados =
  | {
      ok: true;
      copiaECola: string;
      valorTexto: string;
      titulo: string | null;
      /** Upsell do painel (crédito, quadro) em vez da música do funil. */
      upsell: boolean;
      /** Só pedido do funil não pago. Ver o cabeçalho. */
      sessao: string | null;
      /** O cupom que baixou o preço desse pedido, pra o funil mostrar o mesmo valor. */
      cupom: string | null;
    }
  | {
      ok: false;
      motivo: "nao-achei" | "ja-pago" | "vencido";
      upsell: boolean;
      sessao: string | null;
      cupom: string | null;
    };

const buscarPix = createServerFn({ method: "POST" })
  .validator((data: { referencia: string }) => data)
  .handler(async ({ data }): Promise<Dados> => {
    // `up:<oferta>:<uuid>` é upsell do painel; `serenata:<quizId>` é o funil.
    // Muda o texto e muda pra onde o botão de saída leva: mandar quem estava
    // comprando um quadro pro início do quiz seria fazê-la refazer uma música
    // que ela já tem.
    const upsell = data.referencia.startsWith("up:");
    const vazio = { sessao: null, cupom: null };

    const { data: p } = await supabaseAdmin()
      .from("pedidos")
      .select("status, pix_codigo, pix_expira, valor_centavos, musica_id, quiz_response_id, cupom")
      // Asaas também (auditoria 30/09): desde 11/09 o link do e-mail de PIX
      // não pago é `/pix/pay_...` do Asaas, e a busca só por `woovi:` dava
      // "Não achei esse PIX" pra todo mundo.
      .in("payment_id", [`woovi:${data.referencia}`, `asaas:${data.referencia}`])
      .limit(1)
      .maybeSingle();

    if (!p) return { ok: false, motivo: "nao-achei", upsell, ...vazio };
    // Pago: sem sessão, de propósito (ver o cabeçalho). A saída é `/obrigado`.
    if (p.status === "pago") return { ok: false, motivo: "ja-pago", upsell, ...vazio };

    // A SESSÃO DO QUIZ, pros botões de saída (08/10). Upsell não precisa: a
    // saída dele é o painel, e quem compra upsell já tem conta.
    let sessao: string | null = null;
    if (!upsell && p.quiz_response_id) {
      const { data: q } = await supabaseAdmin()
        .from("quiz_responses")
        .select("session_id")
        .eq("id", p.quiz_response_id)
        .maybeSingle();
      sessao = (q?.session_id as string | null) ?? null;
    }
    const volta = { sessao, cupom: (p.cupom as string | null) ?? null };

    if (!p.pix_codigo) return { ok: false, motivo: "nao-achei", upsell, ...volta };
    // O código da Woovi vale 1 hora. Passou disso, o QR não paga mais nada e
    // mostrar ele seria pior que não mostrar: a pessoa tentaria, o banco
    // recusaria, e ela concluiria que o problema é a nossa loja.
    if (p.pix_expira && Date.parse(p.pix_expira as string) < Date.now()) {
      return { ok: false, motivo: "vencido", upsell, ...volta };
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
      upsell,
      ...volta,
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
      .catch(() =>
        setDados({
          ok: false,
          motivo: "nao-achei",
          upsell: referencia.startsWith("up:"),
          sessao: null,
          cupom: null,
        }),
      );
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
            {dados.upsell ? (
              <p className="mb-5 text-center text-sm text-muted-foreground">
                Termine aqui a sua compra. Assim que cair, ela aparece no seu painel.
              </p>
            ) : (
              dados.titulo && (
                <p className="mb-5 text-center text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{dados.titulo}</span>{" "}
                  está gravada e esperando.
                </p>
              )
            )}
            <PixPagamento
              copiaECola={dados.copiaECola}
              valorTexto={dados.valorTexto}
              referencia={referencia}
              // Upsell vai pro PAINEL, não pro `/obrigado`: quem comprou um
              // crédito já é cliente, e a tela de "obrigado pela sua compra"
              // com o passo a passo de montar o presente é a conversa errada.
              aoPagar={() => {
                window.location.href = dados.upsell ? "/dashboard" : "/obrigado";
              }}
              // ── O CARTÃO VOLTA PRA MÚSICA DELA (08/10) ─────────────
              //
              // Era `/criar?checkout=1`, com a ideia de ir direto pro
              // checkout. Só que o `/criar` só conhece `step` e `t`: o
              // `checkout=1` sumia, a pessoa caía na abertura do quiz, e
              // "começar" ali abria uma sessão NOVA, longe da música dela.
              // O `/retomar` reidrata a sessão e manda pro reveal, de onde o
              // botão de comprar abre a folha com "Pagar com cartão".
              aoEscolherCartao={() => {
                trackEvent("pix_retomado_cartao", { referencia, upsell: dados.upsell });
                window.location.href = dados.upsell
                  ? "/dashboard"
                  : caminhoDeVolta(dados.sessao, dados.cupom);
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
                ? dados.upsell
                  ? "Já está liberado no seu painel."
                  : "A sua música já está liberada. O link pra montar o presente foi pro seu e-mail."
                : dados.motivo === "vencido"
                  ? "Nada foi cobrado. Dá pra gerar outro em um toque, com o mesmo preço."
                  : "O link pode ter sido cortado pelo aplicativo de e-mail. Dá pra continuar por aqui."}
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                // Vencido ou sem código: pra música dela pelo `/retomar`
                // quando o pedido tem quiz (08/10, mesmo motivo do cartão
                // acima). Sem pedido nenhum, `caminhoDeVolta` cai no `/criar`.
                window.location.href = dados.upsell
                  ? "/dashboard"
                  : dados.motivo === "ja-pago"
                    ? "/obrigado"
                    : caminhoDeVolta(dados.sessao, dados.cupom);
              }}
            >
              {dados.upsell
                ? "Ir pro meu painel"
                : dados.motivo === "ja-pago"
                  ? "Abrir a minha música"
                  : "Continuar a compra"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
