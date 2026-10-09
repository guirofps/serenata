import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OFERTAS } from "@/lib/creditos";
import { MARCA_ATIVA } from "@/lib/marca-identidade";
import { stripeApi, confirmarSessaoStripe, ErroStripe } from "../../api/lib/stripe";
import { marcarSeVeioDeEmail } from "@/lib/toque-email.server";

// O VÍDEO-PRESENTE NA BALLAD GIFT (EUA), pelo Stripe (30/09/2026).
//
// Na Serenata o vídeo é vendido por PIX (`criar-pix-upsell.ts`); aqui é o
// mesmo produto e o mesmo caminho de liberação (`creditarUpsell`, chamado de
// dentro de `confirmarSessaoStripe` quando a sessão é de upsell), só muda
// quem cobra. As regras são as mesmas do resto do projeto:
//   - o preço sai do catálogo (`OFERTAS`), nunca do navegador;
//   - a música vem do TOKEN de edição, que é a prova de posse do editor;
//   - só se vende vídeo de música JÁ PAGA (vídeo de uma prévia não paga
//     seria entregar a música inteira por US$ 12);
//   - o pedido nasce pendente ANTES do pagamento, pro webhook saber de quem
//     é o dinheiro sem adivinhar.

function urlDoSite(): string {
  const u = process.env.VITE_APP_URL;
  return u?.startsWith("http") ? u.replace(/\/+$/, "") : MARCA_ATIVA.url;
}

export type ResultadoCheckoutVideo =
  | { ok: true; clientSecret: string; sessaoId: string }
  | { ok: false; erro: "indisponivel" | "sem-musica" | "nao-pago" | "ja-tem" | "falhou" };

export const criarCheckoutVideoStripe = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => ({ tokenEdicao: String(data?.tokenEdicao ?? "").slice(0, 100) }))
  .handler(async ({ data }): Promise<ResultadoCheckoutVideo> => {
    const oferta = OFERTAS.find((o) => o.id === "video");
    if (MARCA_ATIVA.chave !== "ballad" || !process.env.STRIPE_SECRET_KEY || !oferta?.precoUsd) {
      return { ok: false, erro: "indisponivel" };
    }
    if (!data.tokenEdicao) return { ok: false, erro: "sem-musica" };
    const db = supabaseAdmin();

    const { data: m } = await db
      .from("musicas")
      .select("id, titulo, quiz_response_id")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.id || !m.quiz_response_id) return { ok: false, erro: "sem-musica" };

    const { data: pago } = await db
      .from("pedidos")
      .select("id")
      .eq("status", "pago")
      .or(`quiz_response_id.eq.${m.quiz_response_id},musica_id.eq.${m.id}`)
      .limit(1);
    if (!pago?.length) return { ok: false, erro: "nao-pago" };

    const { data: jaTem } = await db.from("videos").select("id").eq("musica_id", m.id).limit(1);
    if (jaTem?.length) return { ok: false, erro: "ja-tem" };

    const { data: q } = await db.from("quiz_responses").select("email").eq("id", m.quiz_response_id).maybeSingle();
    const email = String(q?.email ?? "").trim().toLowerCase() || undefined;
    const centavos = Math.round(oferta.precoUsd * 100);

    try {
      const criar = () =>
        stripeApi<{ id: string; client_secret: string }>(
          "POST",
          "/checkout/sessions",
          {
            ui_mode: "embedded",
            // Ver `stripe-checkout.ts`: o nome e a cor da Ballad, não os da conta.
            branding_settings: { display_name: MARCA_ATIVA.nome, button_color: "#bd404d" },
            mode: "payment",
            locale: "en",
            // Sem redirecionar: a folha fica no editor, e o `onComplete` do
            // navegador chama a confirmação. O webhook confirma do mesmo jeito
            // se a pessoa fechar a aba no meio.
            redirect_on_completion: "never",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: centavos,
                  product_data: {
                    name: m.titulo ? `Gift video: ${m.titulo}` : "Your gift video",
                    description:
                      "Your photos moving to the rhythm of your song, with the lyrics lighting up word by word. In HD, to download and share.",
                  },
                },
              },
            ],
            customer_email: email,
            metadata: { tipo: "upsell", oferta: "video", musica_id: m.id },
            payment_intent_data: {
              statement_descriptor_suffix: "BALLADGIFT",
              description: `${MARCA_ATIVA.nome} · Gift video`,
              metadata: { tipo: "upsell", oferta: "video", musica_id: m.id },
            },
          },
          // Reabrir a folha devolve a MESMA sessão (idempotência de 24h do
          // Stripe). Mexeu no corpo, sobe a versão da chave.
          { idempotencia: `ballad-video:v2:${m.id}:${centavos}` },
        );
      let sessao: { id: string; client_secret: string } | null = null;
      for (let tentativa = 0; !sessao; tentativa++) {
        try {
          sessao = await criar();
        } catch (err) {
          if (!(err instanceof ErroStripe) || err.status !== 409 || tentativa >= 3) throw err;
          await new Promise((r) => setTimeout(r, 1200));
        }
      }

      const { error } = await db.from("pedidos").upsert(
        {
          payment_id: `stripe:${sessao.id}`,
          gateway: "stripe",
          status: "pendente",
          email: email ?? null,
          valor_centavos: centavos,
          // Sem `quiz_response_id` de propósito, igual ao upsell por PIX: o
          // pedido base daquele quiz já existe, e as consultas de "quiz pago"
          // não podem confundir o vídeo com uma segunda compra da música.
          musica_id: m.id,
        },
        { onConflict: "payment_id", ignoreDuplicates: true },
      );
      await marcarSeVeioDeEmail(db, `stripe:${sessao.id}`);
      if (error) throw new Error(error.message);

      await db.from("funnel_events").insert({
        event_name: "stripe_video_criado",
        session_id: "sistema",
        event_data: { sessao: sessao.id, musica_id: m.id, valor_centavos: centavos },
      });
      return { ok: true, clientSecret: sessao.client_secret, sessaoId: sessao.id };
    } catch (err) {
      console.error("[stripe-video] criar sessão falhou:", err instanceof ErroStripe ? `${err.status} ${err.message}` : err);
      return { ok: false, erro: "falhou" };
    }
  });

/**
 * O navegador avisa que o pagamento completou. Não é prova de nada: quem
 * responde é a API do Stripe, pela mesma trava do webhook, então chegar aqui
 * antes dele não libera duas vezes.
 */
export const confirmarVideoStripe = createServerFn({ method: "POST" })
  .validator((data: { sessaoId: string }) => ({ sessaoId: String(data?.sessaoId ?? "") }))
  .handler(async ({ data }): Promise<{ pago: boolean }> => {
    if (MARCA_ATIVA.chave !== "ballad" || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessaoId)) {
      return { pago: false };
    }
    try {
      const r = await confirmarSessaoStripe(supabaseAdmin(), data.sessaoId);
      return { pago: r.ok };
    } catch (err) {
      console.error("[stripe-video] confirmar falhou:", err);
      return { pago: false };
    }
  });

/** Pra folha do editor mostrar o preço certo sem importar o catálogo inteiro. */
export function precoVideoUsdTexto(): string | null {
  const v = OFERTAS.find((o) => o.id === "video")?.precoUsd;
  return v ? `$${Number.isInteger(v) ? v : v.toFixed(2)}` : null;
}
