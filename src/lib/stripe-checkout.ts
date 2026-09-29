import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MOEDA } from "@/lib/i18n";
import { MARCA_ATIVA } from "@/lib/marca-identidade";
import { stripeApi, confirmarSessaoStripe, ErroStripe } from "../../api/lib/stripe";

// O CHECKOUT DA BALLAD GIFT, do lado do servidor.
//
// Espelha o `criarPix` da Serenata nas regras que importam (ver o cabeçalho
// de `api/lib/stripe.ts`): o preço sai do banco, nunca do navegador; não se
// cobra música que não existe; o pedido nasce pendente ANTES do pagamento,
// pra que o webhook saiba de quem é o dinheiro sem adivinhar.

/** O preço do braço que ESTA sessão sorteou, em centavos. Mesmo leitor do PIX. */
async function valorCentavosDaSessao(
  db: ReturnType<typeof supabaseAdmin>,
  attribution: unknown,
): Promise<number> {
  const braco = (attribution as { exp?: Record<string, string> } | null)?.exp?.preco ?? "A";
  const { data } = await db.from("experimentos").select("variantes").eq("id", "preco").maybeSingle();
  const variantes = (data?.variantes ?? []) as Array<{ nome?: string; plano?: { valor?: number | string } }>;
  const achado = variantes.find((v) => v.nome === braco) ?? variantes.find((v) => v.nome === "A");
  const valor = Number(achado?.plano?.valor);
  // Sem linha no banco, o preço do catálogo. NUNCA um número vindo do cliente.
  const reais = Number.isFinite(valor) && valor > 0 ? valor : MOEDA.en.valor;
  return Math.round(reais * 100);
}

function urlDoSite(): string {
  const u = process.env.VITE_APP_URL;
  return u?.startsWith("http") ? u.replace(/\/+$/, "") : MARCA_ATIVA.url;
}

export type ResultadoCheckout =
  | { ok: true; clientSecret: string; sessaoId: string }
  | { ok: false; erro: "sem-musica" | "ja-pago" | "indisponivel" | "falhou" };

export const criarCheckoutStripe = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }): Promise<ResultadoCheckout> => {
    // Só a marca que vende em dólar. A Serenata nunca abre isto, nem por engano.
    if (MARCA_ATIVA.chave !== "ballad" || !process.env.STRIPE_SECRET_KEY) {
      return { ok: false, erro: "indisponivel" };
    }
    const sessionId = String(data.sessionId ?? "").slice(0, 100);
    if (!sessionId) return { ok: false, erro: "falhou" };
    const db = supabaseAdmin();

    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, email, respostas, attribution")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!quiz) return { ok: false, erro: "sem-musica" };

    // NUNCA COBRAR POR ALGO QUE AINDA NÃO FOI PRODUZIDO.
    const { data: musica } = await db
      .from("musicas")
      .select("id, titulo, letra")
      .eq("quiz_response_id", quiz.id)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!musica) return { ok: false, erro: "sem-musica" };

    const { data: jaPago } = await db
      .from("pedidos")
      .select("id")
      .eq("quiz_response_id", quiz.id)
      .eq("status", "pago")
      .limit(1);
    if (jaPago?.length) return { ok: false, erro: "ja-pago" };

    const centavos = await valorCentavosDaSessao(db, quiz.attribution);
    const nome = String((quiz.respostas as Record<string, unknown> | null)?.nome ?? "").trim().slice(0, 40);
    const email = String(quiz.email ?? "").trim() || undefined;

    try {
      // Reabrir a folha não cria outra sessão: mesma chave, mesma resposta do
      // Stripe (a idempotência deles dura 24h). O valor entra na chave pra um
      // braço de preço diferente nunca reaproveitar a sessão errada.
      // DUAS CHAMADAS AO MESMO TEMPO com a mesma chave (toque duplo, ou o React
      // montando a folha duas vezes) fazem o Stripe responder 409 pra segunda:
      // "outra requisição com esta chave em andamento". Não é erro de verdade,
      // é espera: um instante depois ele devolve a MESMA sessão já criada.
      const criar = () => stripeApi<{ id: string; client_secret: string }>(
        "POST",
        "/checkout/sessions",
        {
          ui_mode: "embedded",
          mode: "payment",
          // Inglês sempre: o Stripe seguia o idioma do navegador, e um americano
          // com o celular em espanhol (comum nos EUA) via o caixa em outra língua
          // que não a da página que acabou de ler.
          locale: "en",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: centavos,
                product_data: {
                  name: nome ? `A personalized song for ${nome}` : "Your personalized song",
                  description:
                    "The full sung song (2 versions), the gift page with your photos, the link and QR code, and the MP3 to keep.",
                },
              },
            },
          ],
          customer_email: email,
          client_reference_id: quiz.id,
          metadata: { quiz_id: quiz.id, musica_id: musica.id, session_id: sessionId },
          payment_intent_data: {
            // O NOME NA FATURA DO CARTÃO. A conta do Stripe ainda tem o
            // descritor de outro negócio ("STRIPEONLI"), e "não reconheço esta
            // cobrança" é o motivo nº 1 de chargeback nos EUA. O sufixo por
            // cobrança faz a fatura dizer "STRIPEONLI* BALLADGIFT" (prefixo +
            // sufixo cabem nos 22 caracteres). Some quando a conta ganhar o
            // descritor próprio, e não atrapalha se ficar.
            statement_descriptor_suffix: "BALLADGIFT",
            description: `${MARCA_ATIVA.nome} · ${musica.titulo ?? "song"}`,
            metadata: { quiz_id: quiz.id, musica_id: musica.id },
          },
          return_url: `${urlDoSite()}/obrigado?session_id={CHECKOUT_SESSION_ID}`,
        },
        // `v3`: a versão dos PARÂMETROS. O Stripe recusa a mesma chave com corpo
        // diferente, então mexeu no corpo desta chamada, sobe a versão.
        { idempotencia: `ballad-checkout:v3:${quiz.id}:${centavos}` },
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
          quiz_response_id: quiz.id,
          musica_id: musica.id,
        },
        { onConflict: "payment_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);

      await db.from("funnel_events").insert({
        event_name: "stripe_checkout_criado",
        session_id: sessionId,
        event_data: { sessao: sessao.id, valor_centavos: centavos },
      });
      return { ok: true, clientSecret: sessao.client_secret, sessaoId: sessao.id };
    } catch (err) {
      console.error("[stripe] criar sessão falhou:", err instanceof ErroStripe ? `${err.status} ${err.message}` : err);
      return { ok: false, erro: "falhou" };
    }
  });

/**
 * A `/obrigado` pergunta se a sessão que acabou de voltar do Stripe está paga.
 *
 * Não confia no `?session_id` como prova: ele só diz QUAL sessão consultar.
 * Quem responde é a API do Stripe, e a entrega passa pela mesma trava do
 * webhook, então chegar aqui antes dele não entrega duas vezes.
 *
 * DEVOLVE SÓ SIM OU NÃO, nunca token. O `session_id` está na URL da
 * `/obrigado`, e é nessa página que a tag de conversão carrega: quem lê a URL
 * não pode sair dali com o link de edição (CLAUDE.md, varredura de 20/08). O
 * link continua vindo de `sessaoJaPagou`, pela sessão guardada no navegador.
 */
export const confirmarCheckoutStripe = createServerFn({ method: "POST" })
  .validator((data: { sessaoId: string }) => data)
  .handler(async ({ data }): Promise<{ pago: boolean }> => {
    const id = String(data.sessaoId ?? "");
    if (MARCA_ATIVA.chave !== "ballad" || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
      return { pago: false };
    }
    try {
      const r = await confirmarSessaoStripe(supabaseAdmin(), id);
      return { pago: r.ok };
    } catch (err) {
      console.error("[stripe] confirmar na /obrigado falhou:", err);
      return { pago: false };
    }
  });
