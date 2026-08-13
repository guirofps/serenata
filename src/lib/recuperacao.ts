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
  /**
   * Quando o operador pode falar com esta pessoa. Até lá o cartão aparece com
   * o cronômetro correndo e os botões travados: ele vê a fila em tempo real
   * sem poder ligar pra quem está com o app do banco aberto neste segundo.
   */
  podeFalarEm: string;
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
 * CARÊNCIA antes de o operador poder falar com a pessoa.
 *
 * Sem carência nenhuma ele liga cobrando quem está com o aplicativo do banco
 * aberto naquele segundo — a forma mais rápida de transformar uma venda em
 * reclamação.
 *
 * Mas ela era um FILTRO: o pedido só nascia na tela 30 minutos depois, e até
 * lá não existia pra ninguém. Isso escondia a fila justamente no momento em
 * que ela está mais quente, e obrigava o operador a ficar apertando Atualizar
 * pra descobrir se apareceu alguém.
 *
 * Agora é um CRONÔMETRO: o pedido aparece no instante em que o Pix é gerado,
 * com o tempo correndo na tela e os botões de contato travados até zerar. Ele
 * vê a fila enchendo e sabe exatamente quando pode falar.
 *
 * 10 minutos: Pix cai em segundos. Quem não pagou em dez não está pagando
 * agora, e o código ainda está quente na conversa.
 */
const CARENCIA_MIN = 10;

export const listarAbandonados = createServerFn({ method: "POST" })
  .validator((data: { horas?: number }) => data)
  .handler(async ({ data }): Promise<Abandonado[]> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();

    const db = supabaseAdmin();
    const janelaH = data.horas ?? 72;
    const desde = new Date(Date.now() - janelaH * 3600000).toISOString();

    const { data: pend } = await db
      .from("pedidos")
      .select(
        "id, payment_id, email, telefone, nome_pagador, valor_centavos, created_at, quiz_response_id, musica_id, pix_codigo, pix_url, pix_expira, status, gateway, paid_at",
      )
      // Pagos entram junto: são os RECUPERADOS, que precisam continuar
      // visíveis numa aba própria em vez de sumir da tela ao serem liberados.
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
    // O DESFAZER também é um evento, e ele tem que apagar o anterior do placar.
    // Sem isto o pedido revertido continuava contando como recuperado (e como
    // R$ 37 no cabeçalho), porque a liberação original nunca sai do histórico.
    const { data: revertidos } = await db
      .from("funnel_events")
      .select("event_data, created_at")
      .eq("event_name", "acesso_revertido")
      .order("created_at", { ascending: true });

    const liberadoPor = new Map<string, { quando: string; por: string | null }>();
    for (const l of liberacoes ?? []) {
      const id = String((l.event_data as Record<string, unknown>)?.pedido ?? "");
      if (id) liberadoPor.set(id, {
        quando: l.created_at,
        por: ((l.event_data as Record<string, unknown>)?.por as string) ?? null,
      });
    }
    // Ordem importa: liberar → desfazer → liberar de novo tem que terminar
    // valendo. Por isso a comparação é por DATA, não um simples delete.
    for (const r of revertidos ?? []) {
      const id = String((r.event_data as Record<string, unknown>)?.pedido ?? "");
      const lib = id ? liberadoPor.get(id) : null;
      if (lib && r.created_at > lib.quando) liberadoPor.delete(id);
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
      // O pendente NÃO é mais escondido pela carência: ele entra na hora e a
      // trava vira cronômetro no cartão (`podeFalarEm`).
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
        podeFalarEm: new Date(new Date(p.created_at).getTime() + CARENCIA_MIN * 60000).toISOString(),
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

export type FichaCliente = {
  /** Como as linhas foram agrupadas: telefone quando existe, senão e-mail. */
  chave: string;
  nomes: string[];
  emails: string[];
  telefones: string[];
  pedidos: {
    id: string;
    paymentId: string | null;
    status: string;
    gateway: string | null;
    statusGateway: string | null;
    valorCentavos: number | null;
    criadoEm: string;
    pagoEm: string | null;
    email: string | null;
    temPix: boolean;
  }[];
  musicas: {
    id: string;
    titulo: string | null;
    paraQuem: string | null;
    status: string | null;
    criadoEm: string;
    locale: "pt" | "es";
    linkPresente: string | null;
    linkEditor: string | null;
    linkPrevia: string | null;
    audioV1: string | null;
    audioV2: string | null;
    montouPresente: boolean;
  }[];
};

/**
 * A FICHA DO CLIENTE. Busca por e-mail, nome OU telefone, sem janela de data.
 *
 * Nasceu de um caso de 13/08 que levou meia hora e três consultas ao banco
 * pra resolver. Um comprador escreveu dizendo que tinha feito duas compras no
 * cartão e não recebido nada. A verdade era: uma compra no cartão no dia 9,
 * entregue, e dois Pix gerados hoje e não pagos — com DOIS e-mails diferentes,
 * um Gmail e um Yahoo, o que fazia a conta dele "sumir" quando ele entrava
 * pelo segundo.
 *
 * Nada disso era visível pro atendente. Ele dependia do dono abrir o banco.
 *
 * O agrupamento é por TELEFONE quando existe, e é o que resolve o caso: e-mail
 * a pessoa troca, telefone não. Sem isso a ficha continuaria mostrando meia
 * história.
 *
 * Continua sem faturamento agregado: valor por pedido é o que responde "eu
 * paguei?", e é disso que o suporte precisa. Total do mês não é assunto dele.
 */
export const buscarCliente = createServerFn({ method: "POST" })
  .validator((data: { termo: string }) => data)
  .handler(async ({ data }): Promise<FichaCliente[]> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();

    const termo = data.termo.trim();
    if (termo.length < 3) return [];
    const db = supabaseAdmin();
    // Telefone o operador digita como quiser: com traço, com parêntese, com
    // DDI. A busca compara só os dígitos.
    const digitos = termo.replace(/\D/g, "");
    const like = `%${termo.toLowerCase()}%`;

    const filtros = [`email.ilike.${like}`, `nome_pagador.ilike.${like}`];
    if (digitos.length >= 6) filtros.push(`telefone.ilike.%${digitos}%`);

    const [{ data: porPedido }, { data: porQuiz }] = await Promise.all([
      db
        .from("pedidos")
        .select("id, payment_id, email, telefone, nome_pagador, status, gateway, status_gateway, valor_centavos, created_at, paid_at, quiz_response_id, pix_codigo")
        .or(filtros.join(","))
        .order("created_at", { ascending: false })
        .limit(60),
      db
        .from("quiz_responses")
        .select("id, email, whatsapp")
        .ilike("email", like)
        .limit(60),
    ]);

    // Um conjunto de chaves (telefone e e-mail) que identificam essa pessoa.
    // A partir daqui a busca EXPANDE: achou o telefone, traz tudo daquele
    // telefone, inclusive os pedidos com outro e-mail.
    const tels = new Set<string>();
    const mails = new Set<string>();
    for (const p of porPedido ?? []) {
      if (p.telefone) tels.add(p.telefone.replace(/\D/g, ""));
      if (p.email) mails.add(p.email.toLowerCase());
    }
    for (const q of porQuiz ?? []) {
      if (q.email) mails.add(q.email.toLowerCase());
      if (q.whatsapp) tels.add(String(q.whatsapp).replace(/\D/g, ""));
    }
    if (!tels.size && !mails.size) return [];

    const ors: string[] = [];
    for (const m of mails) ors.push(`email.eq.${m}`);
    for (const t of tels) if (t.length >= 8) ors.push(`telefone.ilike.%${t.slice(-8)}%`);
    const { data: todos } = await db
      .from("pedidos")
      .select("id, payment_id, email, telefone, nome_pagador, status, gateway, status_gateway, valor_centavos, created_at, paid_at, quiz_response_id, pix_codigo")
      .or(ors.join(","))
      .order("created_at", { ascending: false })
      .limit(120);

    // Agrupa por telefone; quem não tem telefone agrupa pelo e-mail.
    const grupos = new Map<string, typeof todos>();
    for (const p of todos ?? []) {
      const chave = p.telefone ? p.telefone.replace(/\D/g, "").slice(-8) : (p.email ?? "sem").toLowerCase();
      const g = grupos.get(chave) ?? [];
      g.push(p);
      grupos.set(chave, g);
    }

    const assinar = async (caminho: string | null) => {
      if (!caminho) return null;
      const { data: u } = await db.storage.from("musicas").createSignedUrl(caminho, 2 * 3600);
      return u?.signedUrl ?? null;
    };

    const fichas: FichaCliente[] = [];
    for (const [chave, pedidos] of grupos) {
      const quizIds = [...new Set((pedidos ?? []).map((p) => p.quiz_response_id).filter(Boolean))] as string[];
      // Também as sessões daquele e-mail que nunca viraram pedido: é onde mora
      // a música que a pessoa fez e não comprou.
      const emailsDoGrupo = [...new Set((pedidos ?? []).map((p) => (p.email ?? "").toLowerCase()).filter(Boolean))];
      const { data: sessoes } = emailsDoGrupo.length
        ? await db.from("quiz_responses").select("id").in("email", emailsDoGrupo)
        : { data: [] };
      for (const s of sessoes ?? []) if (!quizIds.includes(s.id)) quizIds.push(s.id);

      const { data: musicas } = quizIds.length
        ? await db
            .from("musicas")
            .select("id, titulo, status, token, token_edicao, audio_path, audio_path_v2, foto_path, dedicatoria, created_at, quiz_response_id")
            .in("quiz_response_id", quizIds)
            .order("created_at", { ascending: false })
        : { data: [] };

      const { data: quizzes } = quizIds.length
        ? await db.from("quiz_responses").select("id, respostas, locale, session_id").in("id", quizIds)
        : { data: [] };
      const quizDe = new Map((quizzes ?? []).map((q) => [q.id, q]));

      fichas.push({
        chave,
        nomes: [...new Set((pedidos ?? []).map((p) => p.nome_pagador).filter(Boolean) as string[])],
        emails: [...new Set((pedidos ?? []).map((p) => p.email).filter(Boolean) as string[])],
        telefones: [...new Set((pedidos ?? []).map((p) => p.telefone).filter(Boolean) as string[])],
        pedidos: (pedidos ?? []).map((p) => ({
          id: p.id,
          paymentId: p.payment_id,
          status: p.status,
          gateway: p.gateway,
          statusGateway: p.status_gateway,
          valorCentavos: p.valor_centavos,
          criadoEm: p.created_at,
          pagoEm: p.paid_at,
          email: p.email,
          temPix: Boolean(p.pix_codigo),
        })),
        musicas: await Promise.all(
          (musicas ?? []).map(async (m) => {
            const q = m.quiz_response_id ? quizDe.get(m.quiz_response_id) : null;
            const r = (q?.respostas ?? {}) as Record<string, string>;
            const [a1, a2] = await Promise.all([
              assinar(m.audio_path),
              assinar(m.audio_path_v2),
            ]);
            return {
              id: m.id,
              titulo: m.titulo,
              paraQuem: r.nome?.trim() ?? null,
              status: m.status,
              criadoEm: m.created_at,
              locale: (q?.locale === "es" ? "es" : "pt") as "pt" | "es",
              linkPresente: m.token ? `${SITE}/p/${m.token}` : null,
              linkEditor: m.token_edicao ? `${SITE}/editar/${m.token_edicao}` : null,
              linkPrevia: q?.session_id ? `${SITE}/retomar?s=${encodeURIComponent(q.session_id)}` : null,
              audioV1: a1,
              audioV2: a2,
              montouPresente: Boolean(m.foto_path || m.dedicatoria),
            };
          }),
        ),
      });
    }
    return fichas;
  });

export type Pago = {
  pedidoId: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  /** Ela PEDIU aviso no WhatsApp na tela de espera. Muda o texto da mensagem. */
  pediuWhatsapp: boolean;
  pagoEm: string;
  horasAtras: number;
  locale: "pt" | "es";
  paraQuem: string | null;
  titulo: string | null;
  linkPresente: string | null;
  linkEditor: string | null;
  audioV1: string | null;
  audioV2: string | null;
  montouPresente: boolean;
};

/**
 * QUEM PAGOU, com os links na mão.
 *
 * Nasceu de dois problemas do mesmo dia. Um senhor pagou no cartão e não
 * achou nada: o e-mail existia, mas ele não sabia procurar. E dois e-mails de
 * entrega VOLTARAM (bounce do Gmail), então duas pessoas pagaram e nunca
 * receberam link nenhum.
 *
 * Nos dois casos o produto estava pronto e o suporte não tinha como chegar
 * nele sem abrir o banco. Esta lista resolve isso: o operador acha a pessoa,
 * copia o link e manda.
 *
 * NÃO mostra dinheiro. É a mesma regra do resto da tela: quem trabalha
 * recuperação vê o que serve pra CONVERSAR, não faturamento.
 */
export const listarPagos = createServerFn({ method: "POST" })
  .validator((data: { dias?: number; busca?: string }) => data)
  .handler(async ({ data }): Promise<Pago[]> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();

    const db = supabaseAdmin();
    const desde = new Date(Date.now() - (data.dias ?? 7) * 86400000).toISOString();

    let q = db
      .from("pedidos")
      .select("id, email, telefone, nome_pagador, paid_at, quiz_response_id")
      .eq("status", "pago")
      .gte("paid_at", desde)
      .order("paid_at", { ascending: false });
    // A busca existe pro caso do suporte: a pessoa escreve dizendo que pagou,
    // e o operador tem o e-mail dela e mais nada.
    if (data.busca?.trim()) q = q.ilike("email", `%${data.busca.trim()}%`);

    const { data: pedidos } = await q;
    if (!pedidos?.length) return [];

    // DUAS consultas pro lote inteiro, não duas por pedido. A primeira versão
    // fazia N+1 em cima de 85 pedidos e a tela levava 18 segundos pra abrir —
    // tempo demais pra quem está com um cliente esperando resposta no chat.
    const ids = pedidos.map((p) => p.quiz_response_id).filter(Boolean) as string[];
    const [{ data: quizzes }, { data: musicas }] = await Promise.all([
      db.from("quiz_responses").select("id, respostas, locale, whatsapp, whatsapp_em").in("id", ids),
      db
        .from("musicas")
        .select("quiz_response_id, titulo, token, token_edicao, audio_path, audio_path_v2, foto_path, dedicatoria, created_at")
        .in("quiz_response_id", ids)
        .order("created_at", { ascending: false }),
    ]);
    const porQuiz = new Map((quizzes ?? []).map((q) => [q.id, q]));
    // A mais recente de cada quiz: como veio ordenado por data desc, o primeiro
    // que entra no mapa é o que vale.
    type LinhaMusica = NonNullable<typeof musicas>[number];
    const musicaDe = new Map<string, LinhaMusica>();
    for (const m of musicas ?? []) {
      if (m.quiz_response_id && !musicaDe.has(m.quiz_response_id)) musicaDe.set(m.quiz_response_id, m);
    }

    const assinar = async (caminho: string | null) => {
      if (!caminho) return null;
      const { data: u } = await db.storage.from("musicas").createSignedUrl(caminho, 2 * 3600);
      return u?.signedUrl ?? null;
    };

    const out: Pago[] = [];
    // As assinaturas de URL ainda são uma chamada cada, mas agora em paralelo.
    const linhas = await Promise.all(pedidos.map(async (p) => {
      const quiz = p.quiz_response_id ? porQuiz.get(p.quiz_response_id) ?? null : null;
      const m = p.quiz_response_id ? musicaDe.get(p.quiz_response_id) ?? null : null;

      const q2 = quiz as {
        respostas?: Record<string, string> | null;
        locale?: string | null;
        whatsapp?: string | null;
        whatsapp_em?: string | null;
      } | null;
      const locale: "pt" | "es" = q2?.locale === "es" ? "es" : "pt";
      // Prefere o número que ELA digitou pedindo contato; o do checkout é o
      // que sobra, e serve, porque quem pagou já esperava falar com a gente.
      const tel = q2?.whatsapp ?? p.telefone ?? null;

      const [a1, a2] = await Promise.all([
        assinar(m?.audio_path ?? null),
        assinar(m?.audio_path_v2 ?? null),
      ]);

      return {
        pedidoId: p.id,
        nome: p.nome_pagador
          ? String(p.nome_pagador).trim().split(/\s+/)[0].toLowerCase().replace(/^./, (c) => c.toUpperCase())
          : null,
        email: p.email,
        telefone: tel,
        whatsapp: paraWhatsapp(tel, locale),
        pediuWhatsapp: Boolean(q2?.whatsapp_em),
        pagoEm: p.paid_at,
        horasAtras: Math.round(((Date.now() - new Date(p.paid_at).getTime()) / 3600000) * 10) / 10,
        locale,
        paraQuem: q2?.respostas?.nome?.trim() ?? null,
        titulo: m?.titulo ?? null,
        linkPresente: m?.token ? `${SITE}/p/${m.token}` : null,
        linkEditor: m?.token_edicao ? `${SITE}/editar/${m.token_edicao}` : null,
        audioV1: a1,
        audioV2: a2,
        // Se já subiu foto ou escreveu dedicatória, ela ACHOU a plataforma.
        // Quem não montou é candidato a não ter recebido o e-mail.
        montouPresente: Boolean(m?.foto_path || m?.dedicatoria),
      };
    }));
    out.push(...linhas);
    return out;
  });

/**
 * LINK DE ACESSO pra mandar no WhatsApp.
 *
 * O e-mail de entrega leva o link do painel, e e-mail cai em spam — a gente
 * não tem como saber quanto. Quem está com a pessoa na conversa consegue
 * resolver isso em dez segundos: cola o link, ela toca e entra.
 *
 * SÓ PRA QUEM JÁ TEM ACESSO. O link é uma sessão da conta dela, não um cupom:
 * gerar pra quem não pagou entregaria o produto de graça por outro caminho, e
 * seria justamente o buraco que o botão de liberar existe pra controlar.
 *
 * Fica AUDITADO com quem gerou. É o acesso mais forte que a tela concede, e
 * acesso forte sem registro é o que vira problema quando alguém sai da equipe.
 */
export const linkDeAcesso = createServerFn({ method: "POST" })
  .validator((data: { pedidoId: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string; link?: string }> => {
    const { exigirRecuperacao, papelAtual } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const quem = papelAtual();
    const db = supabaseAdmin();

    const { data: p } = await db
      .from("pedidos")
      .select("id, email, status, quiz_response_id")
      .eq("id", data.pedidoId)
      .maybeSingle();
    if (!p?.email) return { ok: false, erro: "pedido sem e-mail" };
    if (p.status !== "pago") {
      return { ok: false, erro: "essa pessoa ainda não tem acesso — libere primeiro" };
    }

    const { data: q } = p.quiz_response_id
      ? await db.from("quiz_responses").select("locale").eq("id", p.quiz_response_id).maybeSingle()
      : { data: null };
    const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";

    const { data: linkData, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: p.email,
      options: { redirectTo: `${SITE}/auth/callback?lang=${locale}` },
    });
    const link = linkData?.properties?.action_link;
    if (error || !link) return { ok: false, erro: error?.message ?? "não consegui gerar o link" };

    await db.from("funnel_events").insert({
      event_name: "link_acesso_gerado",
      event_data: { pedido: p.id, email: p.email, por: quem },
    });

    return { ok: true, link };
  });

/**
 * DESFAZ uma liberação feita à mão.
 *
 * Existe porque o botão de liberar é de um clique e o operador é humano: em
 * 12/08 ele liberou o Edivan sem querer. Sem desfazer, o único caminho era
 * mexer no banco.
 *
 * O que ele consegue desfazer de verdade:
 *   - o pedido volta pra `pendente` (sai do faturamento e volta pra fila);
 *   - a música se desprende da conta do comprador (some do painel dele);
 *   - a pessoa volta a receber a sequência de recuperação por e-mail;
 *   - os TOKENS são trocados, então o link que foi por e-mail para de abrir.
 *
 * O que ele NÃO consegue: o e-mail de entrega já saiu da nossa mão. Trocar o
 * token é o que existe de mais próximo de "chamar de volta", e por isso é
 * feito aqui e não é opcional.
 *
 * SÓ MEXE em liberação manual. Reverter uma compra aprovada pelo gateway
 * tiraria o produto de quem pagou de verdade — é o tipo de botão que, se
 * aceitar tudo, uma hora tira.
 */
export const reverterAcesso = createServerFn({ method: "POST" })
  .validator((data: { pedidoId: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string }> => {
    const { exigirRecuperacao, papelAtual } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const quem = papelAtual();
    const db = supabaseAdmin();

    const { data: p } = await db
      .from("pedidos")
      .select("id, email, quiz_response_id, status, gateway")
      .eq("id", data.pedidoId)
      .maybeSingle();
    if (!p) return { ok: false, erro: "pedido não encontrado" };
    if (p.status !== "pago") return { ok: false, erro: "esse pedido não está liberado" };
    if (p.gateway !== "manual") {
      return { ok: false, erro: "essa compra foi paga no gateway — não dá pra reverter por aqui" };
    }

    const { error } = await db
      .from("pedidos")
      .update({
        status: "pendente",
        dinheiro_entrou: null,
        paid_at: null,
        status_gateway: `liberação revertida por ${quem}`,
      })
      .eq("id", p.id);
    if (error) return { ok: false, erro: error.message };

    if (p.quiz_response_id) {
      const { data: m } = await db
        .from("musicas")
        .select("id")
        .eq("quiz_response_id", p.quiz_response_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (m?.id) {
        const novo = () =>
          Array.from(crypto.getRandomValues(new Uint8Array(11)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        await db
          .from("musicas")
          .update({ user_id: null, token: novo(), token_edicao: novo() + novo().slice(0, 10) })
          .eq("id", m.id);
      }
    }

    // Volta pra sequência: quem foi liberado sai da perseguição por e-mail, e
    // desfazer sem devolver deixaria a pessoa num limbo, sem acesso e sem
    // ninguém falando com ela.
    if (p.email) {
      await db.from("excluidos_email").delete().eq("email", p.email);
    }

    await db.from("funnel_events").insert({
      event_name: "acesso_revertido",
      event_data: { pedido: p.id, email: p.email, por: quem },
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
