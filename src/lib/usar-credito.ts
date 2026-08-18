import { createServerFn } from "@tanstack/react-start";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { emailPresentePronto, assuntoPresentePronto } from "../../emails/presente-pronto";

// O RESGATE DO CRÉDITO: a única porta que entrega uma música sem cobrar.
//
// ── POR QUE ISTO PRECISA EXISTIR ─────────────────────────────────
//
// O painel vendia crédito desde 18/08 e o botão "usar meu crédito" mandava
// pro funil normal, que cobra no fim. Quem comprasse o pacote de três pagaria
// R$ 67 e depois R$ 38 pela primeira música do pacote. Crédito que não desconta
// nada não é crédito, é doação.
//
// ── O QUE FAZ UMA MÚSICA SER "PAGA" NESTE PROJETO ────────────────
//
// Uma LINHA EM `pedidos` com `quiz_response_id` e status `pago`. É o que
// `sessaoJaPagou` consulta pra liberar o áudio inteiro, é o que o `/obrigado`
// procura, e é o que o painel lista. Por isso o crédito grava um pedido de
// verdade em vez de inventar um segundo conceito de desbloqueio: qualquer
// coisa nova aqui teria que ser ensinada a cinco telas, e uma delas ficaria
// pra trás.
//
// `dinheiro_entrou: false` é o que impede o resgate de virar venda fantasma no
// admin. O painel soma receita filtrando por `dinheiro_entrou !== false`
// (admin-dados.ts:487), então um pedido de R$ 0 entraria na contagem de vendas
// e afundaria o ticket médio. A coluna existe exatamente pra isso.
//
// ── A ORDEM IMPORTA E É ESTA ─────────────────────────────────────
//
// 1. Gasta o crédito.  2. Grava o pedido.  3. Manda o e-mail.
//
// Gastar primeiro é o que garante que ninguém desbloqueie duas músicas com um
// crédito. Se o passo 2 falhar depois do 1, a pessoa fica com um crédito
// debitado e sem pedido, o que é chato mas conserta em /recuperar; a ordem
// invertida entregaria duas músicas de graça e não teria conserto. Perder pro
// lado que dá pra consertar é a escolha certa.
//
// O DÉBITO É IDEMPOTENTE POR MÚSICA: `gastar_credito` insere em `creditos` com
// `on conflict do nothing` contra o índice único de (musica_id, origem 'uso').
// Dois cliques na mesma música debitam uma vez só. Mas ele devolve o saldo
// como se tivesse debitado, então a repetição não é distinguível daqui, e é
// por isso que o passo 2 é um upsert por `payment_id` e não um insert.

export type ResgateCredito =
  | { ok: true; token: string; tokenEdicao: string; saldo: number }
  | {
      ok: false;
      /**
       * `sem-conta` — não está logado (ou o token venceu).
       * `sem-saldo` — a conta não tem crédito.
       * `sem-musica` — a sessão não tem música gerada pra entregar.
       */
      erro: "sem-conta" | "sem-saldo" | "sem-musica" | "falhou";
    };

export const usarCredito = createServerFn({ method: "POST" })
  // O TOKEN, nunca o e-mail. Server function é rota HTTP: aceitar e-mail como
  // parâmetro deixaria qualquer um gastar o crédito de qualquer pessoa. Mesma
  // regra de `meusCreditos`, e pelo mesmo motivo.
  .validator((data: { token: string; sessionId: string }) => data)
  .handler(async ({ data }): Promise<ResgateCredito> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { ok: false, erro: "sem-conta" };

    const db = supabaseAdmin();

    // ── 1. TEM O QUE ENTREGAR? ───────────────────────────────
    // A regra que o projeto não quebra é "nunca cobrar por algo que não foi
    // produzido". Crédito é dinheiro que já foi cobrado, então vale igual:
    // debitar sem música pronta cobraria de novo por nada.
    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, respostas, locale")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!quiz?.id) return { ok: false, erro: "sem-musica" };

    const { data: musica } = await db
      .from("musicas")
      .select("id, token, token_edicao, titulo")
      .eq("quiz_response_id", quiz.id)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!musica?.id) return { ok: false, erro: "sem-musica" };

    // ── 2. GASTA ─────────────────────────────────────────────
    // Devolve -1 quando não há saldo. A trava de concorrência é um advisory
    // lock por e-mail dentro da função, então duas abas viram fila.
    const { data: saldo, error: erroGasto } = await db.rpc("gastar_credito", {
      p_email: email,
      p_musica: musica.id,
    });
    if (erroGasto) {
      console.error("[credito] gastar falhou:", erroGasto.message);
      return { ok: false, erro: "falhou" };
    }
    if (typeof saldo !== "number" || saldo < 0) return { ok: false, erro: "sem-saldo" };

    // ── 3. GRAVA O PEDIDO ────────────────────────────────────
    // Upsert por `payment_id`, que é derivado da música: reapertar o botão
    // atualiza a mesma linha em vez de criar uma segunda "venda".
    const { error: erroPedido } = await db.from("pedidos").upsert(
      {
        payment_id: `credito:${musica.id}`,
        gateway: "credito",
        status: "pago",
        valor_centavos: 0,
        // NÃO É VENDA. Ver o bloco de cima.
        dinheiro_entrou: false,
        email,
        quiz_response_id: quiz.id,
        musica_id: musica.id,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    );
    if (erroPedido) {
      console.error("[credito] pedido falhou:", erroPedido.message);
      return { ok: false, erro: "falhou" };
    }

    // ── 4. AMARRA NA CONTA ───────────────────────────────────
    // Sem isto a música não aparece no painel de quem gastou o crédito: a RLS
    // de `musicas` filtra por `user_id`. A conta já existe (ela precisou estar
    // logada pra chegar aqui), então é só ligar.
    try {
      const { data: conta } = await db.from("users").select("id").eq("email", email).maybeSingle();
      if (conta?.id) await db.from("musicas").update({ user_id: conta.id }).eq("id", musica.id);
    } catch (err) {
      console.error("[credito] conta não vinculada:", err);
    }

    // ── 5. O MESMO E-MAIL DA COMPRA ──────────────────────────
    // Quem resgatou crédito comprou igual: recebe o mesmo e-mail, com o link
    // do editor, que é o que ela vai procurar depois. Falha de e-mail não
    // desfaz o resgate (a música já está liberada na conta dela), vira log.
    try {
      const chave = process.env.RESEND_API_KEY;
      if (chave) {
        const locale = quiz.locale === "es" ? "es" : "pt";
        const nome =
          ((quiz.respostas ?? {}) as Record<string, string>).nome?.trim() ||
          (locale === "es" ? "quien tú quieres" : "quem você ama");
        const site = process.env.SITE_URL ?? "https://www.serenatagift.com";
        const linkEditor = `${site}/editar/${musica.token_edicao}`;
        const linkPresente = `${site}/p/${musica.token}`;
        await new Resend(chave).emails.send({
          from: "Serenata <contato@serenatagift.com>",
          to: [email],
          subject: assuntoPresentePronto(nome, locale),
          html: emailPresentePronto({
            nome,
            titulo: musica.titulo ?? "Sua música",
            linkEditor,
            linkPresente,
            locale,
          }),
          text: `A música de ${nome} está pronta.\n\nMonte o presente (coloque uma foto e uma frase):\n${linkEditor}\n\nO presente já funciona do jeito que está:\n${linkPresente}`,
        });
      }
    } catch (err) {
      console.error("[credito] e-mail falhou:", err);
    }

    try {
      await db.from("funnel_events").insert({
        event_name: "credito_resgatado",
        event_data: { email, musica: musica.id, saldoDepois: saldo },
      });
    } catch {
      // Auditoria não derruba resgate.
    }

    return { ok: true, token: musica.token, tokenEdicao: musica.token_edicao, saldo };
  });
