import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { centavosMxnDe, cobrarEmPeso, usdDoPeso } from "@/lib/preco-mxn";
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

/** As ofertas que a Ballad vende pelo Stripe depois da compra. */
export type OfertaStripe = "video" | "extra";

// A MÚSICA EXTRA (28/10, teste `extra_ballad`) usa o mesmo caixa, com três
// diferenças, as mesmas do PIX da Serenata (`criar-pix-upsell.ts`):
//   - o pedido nasce SEM `musica_id` (é crédito pra uma música que não
//     existe ainda; com ele, as consultas de "esta música já tem vídeo/pago"
//     confundiriam a extra com a música de agora);
//   - não há "já tem": dá pra comprar outra e outra. Por isso a chave de
//     idempotência leva o `nonce` da folha aberta, não só a música: reabrir a
//     MESMA folha devolve a mesma sessão, comprar de novo depois abre outra;
//   - o crédito vai pro razão (`creditos`) pelo e-mail da compra.
export const criarCheckoutVideoStripe = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; oferta?: OfertaStripe; nonce?: string }) => ({
    tokenEdicao: String(data?.tokenEdicao ?? "").slice(0, 100),
    oferta: (data?.oferta === "extra" ? "extra" : "video") as OfertaStripe,
    nonce: /^[a-z0-9]{8,32}$/.test(String(data?.nonce ?? "")) ? String(data?.nonce) : "",
  }))
  .handler(async ({ data }): Promise<ResultadoCheckoutVideo> => {
    const extra = data.oferta === "extra";
    const oferta = OFERTAS.find((o) => o.id === data.oferta);
    if (extra && !data.nonce) return { ok: false, erro: "indisponivel" };
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

    if (!extra) {
      const { data: jaTem } = await db.from("videos").select("id").eq("musica_id", m.id).limit(1);
      if (jaTem?.length) return { ok: false, erro: "ja-tem" };
    }

    const { data: q } = await db
      .from("quiz_responses")
      .select("email, locale")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    const email = String(q?.email ?? "").trim().toLowerCase() || undefined;
    // O crédito da extra é do E-MAIL: sem ele, não há a quem creditar.
    if (extra && !email) return { ok: false, erro: "indisponivel" };
    // O idioma da compra, da linha do quiz (ver `stripe-checkout.ts`): quem
    // comprou pelo `/es` vê o caixa do vídeo em espanhol também.
    const espanhol = q?.locale === "es";
    const centavos = Math.round(oferta.precoUsd * 100);
    // EM PESO PRA QUEM ESTÁ NO MÉXICO (28/10), o mesmo critério e a mesma
    // tabela do caixa da música (`stripe-checkout.ts`, `preco-mxn.ts`): o
    // editor mostrava e cobrava US$ 12 de quem tinha pago a música em peso. O
    // pedido grava o dólar do que se cobrou, como na música.
    const emPeso = cobrarEmPeso(getRequestHeader("x-vercel-ip-country"));
    const moeda = emPeso ? "mxn" : "usd";
    const valorNaMoeda = emPeso ? centavosMxnDe(centavos) : centavos;
    const valorDoPedido = emPeso ? usdDoPeso(valorNaMoeda) : centavos;

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
            locale: espanhol ? "es-419" : "en",
            // Sem redirecionar: a folha fica no editor, e o `onComplete` do
            // navegador chama a confirmação. O webhook confirma do mesmo jeito
            // se a pessoa fechar a aba no meio.
            redirect_on_completion: "never",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: moeda,
                  unit_amount: valorNaMoeda,
                  product_data: extra
                    ? espanhol
                      ? {
                          name: "Otra canción personalizada",
                          description:
                            "Una canción nueva hecha de la historia de quien tú elijas, cantada, con su página regalo. Se activa al terminar el cuestionario.",
                        }
                      : {
                          name: "Another personalized song",
                          description:
                            "A brand-new song made from the story of whoever you choose, sung, with its gift page. It's applied when you finish the questions.",
                        }
                    : espanhol
                    ? {
                        name: m.titulo ? `Video regalo: ${m.titulo}` : "Tu video regalo",
                        description:
                          "Sus fotos al ritmo de tu canción, con la letra iluminándose palabra por palabra. En HD, para descargar y compartir.",
                      }
                    : {
                        name: m.titulo ? `Gift video: ${m.titulo}` : "Your gift video",
                        description:
                          "Your photos moving to the rhythm of your song, with the lyrics lighting up word by word. In HD, to download and share.",
                      },
                },
              },
            ],
            customer_email: email,
            // Na extra, `musica_id` é a música de ONDE se comprou (rastro), não
            // a que vai nascer: a confirmação só usa a oferta e o e-mail.
            metadata: { tipo: "upsell", oferta: data.oferta, musica_id: m.id },
            payment_intent_data: {
              statement_descriptor_suffix: "BALLADGIFT",
              description: `${MARCA_ATIVA.nome} · ${extra ? "Extra song" : "Gift video"}`,
              metadata: { tipo: "upsell", oferta: data.oferta, musica_id: m.id },
            },
          },
          // Reabrir a folha devolve a MESMA sessão (idempotência de 24h do
          // Stripe). Mexeu no corpo, sobe a versão da chave (v3 em 09/10: o
          // idioma do caixa e do produto passou a seguir o da compra; v4 em
          // 28/10: a moeda, peso no México). A extra leva o `nonce` da folha.
          {
            idempotencia: extra
              ? `ballad-extra:v1:${m.id}:${data.nonce}:${moeda}:${valorNaMoeda}`
              : `ballad-video:v4:${m.id}:${moeda}:${valorNaMoeda}`,
          },
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
          valor_centavos: valorDoPedido,
          // Sem `quiz_response_id` de propósito, igual ao upsell por PIX: o
          // pedido base daquele quiz já existe, e as consultas de "quiz pago"
          // não podem confundir o vídeo com uma segunda compra da música.
          // A extra nem `musica_id` leva (ver o topo deste arquivo).
          musica_id: extra ? null : m.id,
        },
        { onConflict: "payment_id", ignoreDuplicates: true },
      );
      await marcarSeVeioDeEmail(db, `stripe:${sessao.id}`);
      if (error) throw new Error(error.message);

      await db.from("funnel_events").insert({
        event_name: extra ? "stripe_extra_criado" : "stripe_video_criado",
        session_id: "sistema",
        event_data: { sessao: sessao.id, musica_id: m.id, valor_centavos: valorDoPedido, moeda, valor_na_moeda: valorNaMoeda },
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
