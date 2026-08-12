import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A FILA DE CARRINHO ABANDONADO, e o botão que libera o acesso.
//
// Nasceu de um número: em 11/08, de 21 pedidos do dia, 9 foram Pix gerado e
// não pago. 43% de quem chega a mandar gerar a cobrança não termina — e são
// pessoas que já preencheram nome, CPF e telefone. É a maior intenção de
// compra do funil inteiro, e até hoje era invisível.
//
// A tela existe pra uma pessoa só: quem trabalha a recuperação no WhatsApp.
// Por isso ela mostra o que serve pra CONVERSAR (nome, telefone, pra quem é a
// música, quanto tempo faz) e nada de dinheiro.

const SITE = "https://www.serenatagift.com";

export type Abandonado = {
  pedidoId: string;
  paymentId: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  horasAtras: number;
  criadoEm: string;
  valorCentavos: number | null;
  locale: "pt" | "es";
  // da música que já está pronta esperando
  musicaId: string | null;
  titulo: string | null;
  paraQuem: string | null;
  relacao: string | null;
  ocasiao: string | null;
  status: string | null;
  temAudio: boolean;
  linkPreviaCliente: string | null;
  audioV1: string | null;
  audioV2: string | null;
  jaComprouDepois: boolean;
  /**
   * O que aconteceu com este pedido depois. Existe porque, até 12/08, o
   * pedido SUMIA da tela no instante em que o operador liberava o acesso: ele
   * clicava, a linha desaparecia, e no dia seguinte não sabia dizer quem tinha
   * conseguido recuperar. Liberou dois e perguntou se tinha liberado.
   *
   * `liberado` = ele apertou o botão. `pagou` = a pessoa pagou depois de um
   * contato registrado. Sem contato registrado não é recuperação, é venda que
   * ia acontecer de qualquer jeito, e misturar as duas mentiria o placar dele.
   */
  recuperado: { tipo: "liberado" | "pagou"; quando: string; por: string | null } | null;
  contatos: { quando: string; canal: string; nota: string | null }[];
  // O copia-e-cola e a página do QR, direto do gateway.
  pixCodigo: string | null;
  pixUrl: string | null;
  pixExpirou: boolean;
};

/**
 * Só dígitos, com o DDI na frente: é o formato que o wa.me exige.
 *
 * O DDI sai do IDIOMA do funil. Estava cravado em 55, o que transformava todo
 * telefone mexicano num número brasileiro inexistente — o funil espanhol está
 * no ar desde 07/08 e a lista de recuperação dele nunca funcionou por isso.
 */
function paraWhatsapp(tel: string | null, locale: "pt" | "es"): string | null {
  if (!tel) return null;
  const so = tel.replace(/\D/g, "");
  if (so.length < 10) return null;
  const ddi = locale === "es" ? "52" : "55";
  if (so.startsWith(ddi)) return so;
  // "521..." é a discagem internacional antiga do México; o WhatsApp usa 52.
  if (locale === "es" && so.startsWith("521")) return "52" + so.slice(3);
  return ddi + so;
}

/**
 * CARÊNCIA antes de alguém aparecer na fila.
 *
 * Sem isso a pessoa entra no instante em que gera o Pix — e o operador liga
 * cobrando quem está com o aplicativo do banco aberto naquele segundo. É a
 * forma mais rápida de transformar uma venda em reclamação.
 *
 * 30 minutos: tempo de sobra pra quem ia pagar já ter pago, e curto o
 * bastante pra o Pix ainda estar quente.
 */
const CARENCIA_MIN = 30;

export const listarAbandonados = createServerFn({ method: "POST" })
  .validator((data: { horas?: number }) => data)
  .handler(async ({ data }): Promise<Abandonado[]> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();

    const db = supabaseAdmin();
    const janelaH = data.horas ?? 72;
    const desde = new Date(Date.now() - janelaH * 3600000).toISOString();
    const ate = new Date(Date.now() - CARENCIA_MIN * 60000).toISOString();

    const { data: pend } = await db
      .from("pedidos")
      .select(
        "id, payment_id, email, telefone, nome_pagador, valor_centavos, created_at, quiz_response_id, musica_id, pix_codigo, pix_url, pix_expira, status, gateway, paid_at",
      )
      // Pagos entram junto: são os RECUPERADOS, que precisam continuar
      // visíveis numa aba própria em vez de sumir da tela ao serem liberados.
      // A carência (`ate`) só vale pra quem ainda está aberto — recuperado
      // recente é justamente o que ele quer ver.
      .in("status", ["pendente", "pago"])
      .gte("created_at", desde)
      .order("created_at", { ascending: false });
    if (!pend?.length) return [];

    // Histórico de contato — o "mini CRM". Vive em `funnel_events` pela mesma
    // razão dos outros marcos: evita migration só pra guardar um carimbo, e
    // deixa o histórico visível junto do resto da jornada da pessoa.
    const { data: toques } = await db
      .from("funnel_events")
      .select("event_data, created_at")
      .eq("event_name", "recuperacao_contato")
      .order("created_at", { ascending: true });
    const porPedido = new Map<string, { quando: string; canal: string; nota: string | null }[]>();
    for (const t of toques ?? []) {
      const id = String((t.event_data as Record<string, unknown>)?.pedido ?? "");
      if (!id) continue;
      const lista = porPedido.get(id) ?? [];
      lista.push({
        quando: t.created_at,
        canal: String((t.event_data as Record<string, unknown>)?.canal ?? "whatsapp"),
        nota: ((t.event_data as Record<string, unknown>)?.nota as string) ?? null,
      });
      porPedido.set(id, lista);
    }

    // Quem pagou depois continua na lista, mas MARCADO — o operador precisa
    // saber que já resolveu sozinho pra não ligar cobrando quem já pagou.
    const { data: pagos } = await db
      .from("pedidos")
      .select("email, quiz_response_id")
      .eq("status", "pago");
    const emailPagou = new Set((pagos ?? []).map((p) => (p.email ?? "").toLowerCase()).filter(Boolean));
    const quizPagou = new Set((pagos ?? []).map((p) => p.quiz_response_id).filter(Boolean));

    // Quem liberou o quê, pelo botão do painel. É o que devolve o placar ao
    // operador: sem isto ele aperta o botão, a linha some, e no dia seguinte
    // ele não sabe dizer se liberou ou não (aconteceu em 12/08, duas vezes).
    const { data: liberacoes } = await db
      .from("funnel_events")
      .select("event_data, created_at")
      .eq("event_name", "acesso_liberado_na_mao")
      .order("created_at", { ascending: true });
    const liberadoPor = new Map<string, { quando: string; por: string | null }>();
    for (const l of liberacoes ?? []) {
      const id = String((l.event_data as Record<string, unknown>)?.pedido ?? "");
      if (id) liberadoPor.set(id, {
        quando: l.created_at,
        por: ((l.event_data as Record<string, unknown>)?.por as string) ?? null,
      });
    }

    const out: Abandonado[] = [];
    for (const p of pend) {
      const contatos = porPedido.get(p.id) ?? [];
      const liberado = liberadoPor.get(p.id) ?? null;

      // O QUE ENTRA NA TELA:
      //   pendente  → só depois da carência (não ligar pra quem está com o
      //               aplicativo do banco aberto neste segundo);
      //   pago      → só se foi recuperação de verdade, ou seja, o operador
      //               liberou no botão OU a pessoa pagou depois de um contato
      //               registrado. Venda normal do dia não é assunto dele, e
      //               inflaria o placar com 16 linhas que ele não trabalhou.
      const ehRecuperado = p.status === "pago" && (Boolean(liberado) || contatos.length > 0);
      if (p.status === "pendente" && p.created_at > ate) continue;
      if (p.status === "pago" && !ehRecuperado) continue;

      const recuperado: Abandonado["recuperado"] = liberado
        ? { tipo: "liberado", quando: liberado.quando, por: liberado.por }
        : ehRecuperado
          ? { tipo: "pagou", quando: p.paid_at ?? p.created_at, por: null }
          : null;

      type QuizLinha = {
        respostas: Record<string, string> | null;
        locale: string | null;
        session_id: string | null;
      };
      let quiz: QuizLinha | null = null;
      if (p.quiz_response_id) {
        const { data } = await db
          .from("quiz_responses")
          .select("respostas, locale, session_id")
          .eq("id", p.quiz_response_id)
          .maybeSingle();
        quiz = (data as unknown as QuizLinha) ?? null;
      }
      const { data: m } = p.quiz_response_id
        ? await db
            .from("musicas")
            .select("id, titulo, status, audio_path, audio_path_v2, token")
            .eq("quiz_response_id", p.quiz_response_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null };

      // Áudio por URL ASSINADA e curta (2h). O bucket é privado, e link que
      // não expira acaba encaminhado pra fora — o operador precisa OUVIR pra
      // argumentar, não precisa de um link eterno.
      const assinar = async (caminho: string | null) => {
        if (!caminho) return null;
        const { data: u } = await db.storage.from("musicas").createSignedUrl(caminho, 2 * 3600);
        return u?.signedUrl ?? null;
      };

      const r = (quiz?.respostas ?? {}) as Record<string, string>;
      out.push({
        pedidoId: p.id,
        paymentId: p.payment_id,
        // Só o PRIMEIRO nome. O gateway devolve o nome completo do cadastro
        // ("MARIA DAS GRACAS DE SOUZA"), e abrir uma conversa de WhatsApp com
        // nome completo em caixa alta soa a cobrança de banco.
        nome: (p as { nome_pagador?: string | null }).nome_pagador
          ? String((p as { nome_pagador?: string | null }).nome_pagador)
              .trim()
              .split(/\s+/)[0]
              .toLowerCase()
              .replace(/^./, (c) => c.toUpperCase())
          : null,
        email: p.email,
        telefone: p.telefone,
        whatsapp: paraWhatsapp(p.telefone, quiz?.locale === "es" ? "es" : "pt"),
        horasAtras: Math.round(((Date.now() - new Date(p.created_at).getTime()) / 3600000) * 10) / 10,
        criadoEm: p.created_at,
        valorCentavos: p.valor_centavos,
        locale: quiz?.locale === "es" ? "es" : "pt",
        musicaId: m?.id ?? null,
        titulo: m?.titulo ?? null,
        paraQuem: r.nome?.trim() ?? null,
        relacao: r.relacao ?? null,
        ocasiao: r.ocasiao ?? null,
        status: m?.status ?? null,
        temAudio: Boolean(m?.audio_path),
        // O link que o operador MANDA. É a própria sessão da pessoa: ela cai
        // na tela dela, ouve o trecho com o paywall e o botão de pagar está
        // logo ali. Nunca mandar o /p/<token>, que é a página COMPLETA.
        linkPreviaCliente: quiz?.session_id
          ? `${SITE}/retomar?s=${encodeURIComponent(quiz.session_id)}`
          : null,
        audioV1: await assinar(m?.audio_path ?? null),
        audioV2: await assinar(m?.audio_path_v2 ?? null),
        jaComprouDepois:
          p.status === "pago" ||
          emailPagou.has((p.email ?? "").toLowerCase()) ||
          (p.quiz_response_id ? quizPagou.has(p.quiz_response_id) : false),
        recuperado,
        contatos,
        pixCodigo: (p as { pix_codigo?: string | null }).pix_codigo ?? null,
        pixUrl: (p as { pix_url?: string | null }).pix_url ?? null,
        // Código vencido não adianta mandar: a pessoa cola no banco e recebe
        // erro, o que é pior que não mandar nada. A tela avisa e cai pro link
        // da prévia, que gera cobrança nova.
        pixExpirou: (() => {
          const e = (p as { pix_expira?: string | null }).pix_expira;
          return e ? new Date(e).getTime() < Date.now() : false;
        })(),
      });
    }
    return out;
  });

/**
 * MARCA QUE FALOU COM A PESSOA.
 *
 * O operador vai trabalhar dezenas por dia, em turnos, e talvez não seja o
 * único. Sem registro, a mesma pessoa recebe a mesma mensagem duas vezes — e
 * cobrança repetida é o que faz alguém bloquear o número. Bloqueado o número,
 * acabou a recuperação inteira.
 *
 * Guarda QUEM falou, por onde e a nota. A nota é o que transforma a lista em
 * ferramenta: "disse que paga sexta" vale mais que qualquer automação.
 */
export const marcarContato = createServerFn({ method: "POST" })
  .validator((data: { pedidoId: string; canal?: string; nota?: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { exigirRecuperacao, papelAtual } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const db = supabaseAdmin();
    await db.from("funnel_events").insert({
      event_name: "recuperacao_contato",
      event_data: {
        pedido: data.pedidoId,
        canal: data.canal ?? "whatsapp",
        nota: data.nota ?? null,
        por: papelAtual(),
      },
    });
    return { ok: true };
  });

/**
 * LIBERA O ACESSO sem pagamento pelo gateway.
 *
 * É o mesmo fluxo que o webhook roda numa compra aprovada — pedido, conta,
 * vínculo da música e e-mail de entrega —, aqui disparado à mão. Serve pro
 * "me paga por fora" e pra cortesia.
 *
 * `gateway: "manual"` de propósito: no painel fica claro que a venda não veio
 * de gateway nenhum. Marcar como perfectpay faria o nosso número parar de
 * bater com o extrato deles, e conciliação quebrada é dívida que só cresce.
 */
export const liberarAcesso = createServerFn({ method: "POST" })
  // `pagou` NÃO tem default de propósito. Liberar acesso e registrar venda
  // são decisões diferentes, e deixar uma delas implícita foi o que fez o
  // painel contar R$ 111 que nunca entraram (medido em 12/08).
  .validator((data: { pedidoId: string; motivo?: string; pagou: boolean }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string; links?: { editor: string; presente: string } }> => {
    const { exigirRecuperacao, papelAtual } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const quem = papelAtual();

    const db = supabaseAdmin();
    const { data: p } = await db
      .from("pedidos")
      .select("id, email, quiz_response_id, status, valor_centavos")
      .eq("id", data.pedidoId)
      .maybeSingle();
    if (!p) return { ok: false, erro: "pedido não encontrado" };
    if (p.status === "pago") return { ok: false, erro: "esse pedido já está pago" };
    if (!p.quiz_response_id) return { ok: false, erro: "pedido sem quiz vinculado" };

    const { data: m } = await db
      .from("musicas")
      .select("id, titulo, token, token_edicao, status, audio_path, quiz_response_id")
      .eq("quiz_response_id", p.quiz_response_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Não libera o que não existe: é a mesma regra do checkout. Entregar uma
    // música que não ficou pronta gera um ticket pior que a venda perdida.
    if (!m || m.status !== "pronta" || !m.audio_path) {
      return { ok: false, erro: "a música ainda não está pronta" };
    }

    const { data: q } = await db
      .from("quiz_responses")
      .select("respostas, locale")
      .eq("id", p.quiz_response_id)
      .maybeSingle();
    const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";
    const nome =
      ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
      (locale === "es" ? "quien tú quieres" : "quem você ama");

    const { error: erroPedido } = await db
      .from("pedidos")
      .update({
        status: "pago",
        gateway: "manual",
        dinheiro_entrou: data.pagou,
        status_gateway:
          `liberado na mão por ${quem} — ${data.pagou ? "PAGOU por fora" : "CORTESIA, sem pagamento"}` +
          (data.motivo ? ` — ${data.motivo}` : ""),
        musica_id: m.id,
        paid_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (erroPedido) return { ok: false, erro: erroPedido.message };

    // Conta do comprador: é o que faz a música aparecer no /dashboard dele.
    if (p.email) {
      try {
        await db.auth.admin.createUser({ email: p.email, email_confirm: true, user_metadata: {} });
      } catch {
        // já existe; segue e só amarra a música
      }
      try {
        const { data: conta } = await db.from("users").select("id").eq("email", p.email).maybeSingle();
        if (conta?.id) await db.from("musicas").update({ user_id: conta.id }).eq("id", m.id);
      } catch (err) {
        console.error("[recuperacao] conta não vinculada:", err);
      }
    }

    // Nunca mais perseguir quem foi liberado: sem isto ela receberia amanhã um
    // "vem ouvir um trecho" tendo a música inteira.
    if (p.email) {
      try {
        await db.from("excluidos_email").upsert(
          { email: p.email, motivo: "liberado na recuperação" },
          { onConflict: "email" },
        );
      } catch {
        // a trava do cron já barra por pedido pago; isto é cinto e suspensório
      }
    }

    const linkEditor = `${SITE}/editar/${m.token_edicao}`;
    const linkPresente = `${SITE}/p/${m.token}`;

    if (p.email) {
      try {
        const { Resend } = await import("resend");
        const { emailPresentePronto, assuntoPresentePronto } = await import("../../emails/presente-pronto");
        const chave = process.env.RESEND_API_KEY;
        if (chave) {
          await new Resend(chave).emails.send({
            from: "Serenata <contato@serenatagift.com>",
            replyTo: "contato@serenatagift.com",
            to: [p.email],
            subject: assuntoPresentePronto(nome, locale),
            html: emailPresentePronto({
              nome,
              titulo: m.titulo ?? "Sua música",
              linkEditor,
              linkPresente,
              locale,
            }),
          });
        }
      } catch (err) {
        // E-mail que falha NÃO desfaz a liberação: o acesso já está de pé e os
        // links aparecem na tela pro operador mandar no WhatsApp.
        console.error("[recuperacao] e-mail de entrega falhou:", err);
      }
    }

    await db.from("funnel_events").insert({
      event_name: "acesso_liberado_na_mao",
      event_data: { pedido: p.id, email: p.email, musica: m.id, por: quem, motivo: data.motivo ?? null },
    });

    return { ok: true, links: { editor: linkEditor, presente: linkPresente } };
  });
