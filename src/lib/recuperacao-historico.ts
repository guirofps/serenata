import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A LINHA DO TEMPO DO CLIENTE: o que já saiu pra ele e o que já falaram com ele.
//
// É a peça que faltava pro /recuperar virar atendimento de verdade, e não só
// fila de abandono. O que a ficha já respondia: "ele pagou?", "qual é a música
// dele?", "qual o link?". O que ela NÃO respondia, e é a primeira pergunta de
// metade dos tickets: "o e-mail chegou?".
//
// Sem isto o atendente só tem a palavra do cliente. Com isto ele vê que o
// e-mail foi entregue às 13:41, aberto às 13:52, e responde outra coisa: em
// vez de "vou reenviar" (que não resolve nada quando já chegou), ele manda o
// link direto e pergunta o que aparece na tela.
//
// Caso que provou a falta (17/08): um comprador abriu ticket dizendo que não
// conseguia acessar. Foram três consultas ao banco pra descobrir que os três
// e-mails tinham sido ENTREGUES e que ele já tinha aberto as páginas dele 23
// vezes. Nada disso era visível pro atendente, e a primeira tentativa ainda
// estourou o tempo do banco.

/** Eventos que contam história. Nome fixo: é o que faz o índice valer. */
const EVENTOS = [
  // saíram de nós
  "email_letra_enviado",
  "email_sequencia_enviado",
  // vieram do Resend (webhook)
  "email_delivered",
  "email_opened",
  "email_clicked",
  "email_bounced",
  // o time
  "recuperacao_contato",
] as const;

const ROTULO: Record<string, string> = {
  email_letra_enviado: "e-mail da letra enviado",
  email_sequencia_enviado: "e-mail de recuperação enviado",
  email_delivered: "entregue na caixa",
  email_opened: "ABRIU o e-mail",
  email_clicked: "CLICOU no e-mail",
  email_bounced: "VOLTOU (não existe / caixa cheia)",
  recuperacao_contato: "contato do time",
};

export type LinhaHistorico = {
  quando: string;
  evento: string;
  rotulo: string;
  /** Assunto do e-mail, canal do contato, número da sequência. */
  detalhe: string | null;
  /** Vermelho na tela: bounce é o único que exige ação. */
  ruim: boolean;
};

/**
 * Histórico de um cliente, por e-mail (e pelos pedidos dele).
 *
 * A JANELA É OBRIGATÓRIA e vem de fora de propósito. `funnel_events` tem 183
 * mil linhas e cresce 40 mil por dia; varrer tudo pra achar um e-mail estoura
 * o statement timeout de 8s do PostgREST, e foi exatamente o que aconteceu
 * comigo na primeira tentativa. A tela passa a data do primeiro pedido do
 * cliente, então a busca cobre a vida dele e mais nada.
 */
export const historicoDoCliente = createServerFn({ method: "POST" })
  .validator((data: { emails: string[]; pedidoIds: string[]; desde: string }) => data)
  .handler(async ({ data }): Promise<LinhaHistorico[]> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();

    const emails = data.emails.map((e) => e.toLowerCase().trim()).filter(Boolean);
    const pedidos = new Set(data.pedidoIds);
    if (!emails.length && !pedidos.size) return [];

    // Um dia de folga antes do primeiro pedido: o e-mail da letra sai ANTES do
    // pedido existir, então uma janela colada na data do pedido perderia
    // justamente o primeiro e-mail da história.
    const desde = new Date(new Date(data.desde).getTime() - 864e5).toISOString();

    const db = supabaseAdmin();

    // O FILTRO VAI NO BANCO, não em JavaScript, e a diferença foi de 8,1s
    // (estourando o timeout) para 0,39s no mesmo cliente.
    //
    // A primeira versão puxava TODOS os eventos de e-mail da janela e comparava
    // o destinatário aqui. Dois erros de uma vez: trazia milhares de linhas
    // para achar sete, e ordenava por `id`, que é uuid ALEATÓRIO, o que obriga
    // o Postgres a ordenar o conjunto inteiro antes de devolver a primeira
    // página. Ordenar por `created_at` é o que o índice (event_name,
    // created_at) já sabe fazer de graça.
    //
    // Vírgula e parêntese quebram a sintaxe do `or` do PostgREST. E-mail com
    // isso não existe na prática, mas um endereço estranho não pode virar
    // consulta malformada.
    const seguro = (v: string) => !/[,()]/.test(v);
    const condicoes = [
      ...emails.filter(seguro).flatMap((e) => [
        `event_data->>para.eq.${e}`,
        `event_data->>email.eq.${e}`,
      ]),
      // `recuperacao_contato` não guarda e-mail, guarda o pedido.
      ...[...pedidos].filter(seguro).map((id) => `event_data->>pedido.eq.${id}`),
    ];
    if (!condicoes.length) return [];

    const { data: evs, error } = await db
      .from("funnel_events")
      .select("event_name, event_data, created_at")
      .in("event_name", EVENTOS as unknown as string[])
      .gte("created_at", desde)
      .or(condicoes.join(","))
      .order("created_at", { ascending: false })
      // Teto generoso: o cliente mais movimentado que medi tinha 32 eventos.
      .limit(200);
    if (error) throw new Error(error.message);

    const linhas: LinhaHistorico[] = [];
    for (const e of evs ?? []) {
      const d = (e.event_data ?? {}) as Record<string, unknown>;
      const detalhe =
        e.event_name === "recuperacao_contato"
          ? [d.canal, d.nota].filter(Boolean).join(" · ") || null
          : e.event_name === "email_sequencia_enviado"
            ? `e-mail ${d.numero ?? "?"} da sequência`
            : ((d.assunto as string | undefined) ?? null);

      linhas.push({
        quando: e.created_at,
        evento: e.event_name,
        rotulo: ROTULO[e.event_name] ?? e.event_name,
        detalhe,
        ruim: e.event_name === "email_bounced",
      });
    }

    return linhas.sort((a, b) => (a.quando < b.quando ? 1 : -1));
  });
