import { createServerFn } from "@tanstack/react-start";
import { type Locale, normalizarLocale } from "@/lib/i18n";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELO_LETRA, MODELO_LETRA_CURTA, registrarCustoLetra, type UsoClaude } from "@/lib/custos";
import { dispararGeracaoMusica } from "@/lib/gerar-letra";
import {
  systemDaLetra,
  buildUserMessage,
  sanitizeNome,
  type LetraGerada,
} from "@/lib/letra-prompt";

// COAUTORIA DA LETRA — a pessoa constrói a letra junto, não recebe pronta.
//
// É a mecânica mais forte do LoveTune (o concorrente escalado): quando a
// pessoa escolhe e edita, a letra vira DELA também, e pagar é quase
// consequência. Validado com IA real em scratch/testar-coautoria.mjs: os
// dois refrões saem distintos, a letra respeita o refrão escolhido, e o
// aprimorar melhora de verdade. Custo das 3 etapas ~R$ 0,35 — irrelevante
// perto dos R$ 0,32 do Suno.
//
// Nossa versão é enxuta (2 etapas), não as 4 do LoveTune: escolher o REFRÃO
// (a parte que a pessoa canta e relê) + editar livremente com "melhorar com
// IA". Menos esperas, o essencial do que prende.
//
// MUDANÇA no gatilho da música: hoje ela dispara na geração da letra. Aqui
// dispara só no FINALIZAR, porque a letra não é final até a coautoria
// terminar. Continua ANTES do pagamento — a regra do CLAUDE.md se mantém.

// As strings vivem em `custos.ts`, coladas na tabela de preço: trocar o modelo
// sem trocar o preço faz o painel contabilizar errado sem avisar.
//
// SÃO DOIS, e a divisão foi medida (ver o comentário longo em `custos.ts`):
// a letra inteira, que o cliente lê e o Suno canta, vai no modelo bom; as três
// opções de refrão vão no barato. Cada chamador diz qual usa, e passa o MESMO
// valor pro `registrarCustoLetra` — é o único jeito de o painel não mentir.
const MODEL = MODELO_LETRA;
const MODEL_CURTO = MODELO_LETRA_CURTA;

type RespClaude = { texto: string; uso: UsoClaude; stopReason: string | null };

// Uma chamada ao Claude, no formato já validado (medir-custo-letra.mjs):
// system cacheável + pedido de JSON no fim. Devolve o texto cru; cada
// chamador parseia o que precisa.
async function chamarClaude(
  userMsg: string,
  maxTokens: number,
  locale: Locale = "pt",
  // O padrão é o modelo BOM. Etapa nova que esquecer de escolher cai no caro e
  // certo, nunca no barato e raso — o erro que ninguém percebe olhando a tela.
  modelo: string = MODEL,
): Promise<RespClaude> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ausente no servidor");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      // SEM `output_config.effort`: o Haiku 4.5 REJEITA esse campo com 400, e
      // como as opções de refrão ainda passam por ele isso derrubaria o funil
      // inteiro, não um caso de borda. Só voltaria a ser opção se as DUAS
      // etapas saíssem do Haiku.
      //
      // O `cache_control` abaixo agora VALE de novo na letra inteira: o Sonnet
      // cria entrada de cache a partir de 1.024 tokens de prefixo e este
      // system tem ~1.200. Nas opções de refrão continua sem efeito, porque o
      // Haiku 4.5 exige 4.096 (ver `custos.ts`).
      system: [{ type: "text", text: systemDaLetra(locale), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) {
    // O CORPO É LIDO UMA VEZ SÓ. `r.text()` consome o stream: ler de novo pra
    // montar a mensagem do throw devolveria string vazia, e o erro chegaria
    // sem a única informação que distingue saldo de chave de sobrecarga.
    const corpo = (await r.text()).slice(0, 500);
    // Loga no servidor e, quando a causa precisa de gente, manda e-mail.
    // Import dinâmico: mantém o Resend fora de qualquer bundle que não seja
    // este caminho de erro. Não usa `await` no alerta pra não somar latência
    // de e-mail em cima de um usuário que já está esperando — mas o `catch`
    // existe porque promessa solta que rejeita derruba o processo no Node.
    void import("@/lib/alerta-operacao")
      .then((m) => m.alertarFalhaClaude({ status: r.status, corpo, onde: "coautoria" }))
      .catch(() => {});
    throw new Error(`Anthropic ${r.status}: ${corpo.slice(0, 200)}`);
  }
  const j = await r.json();
  const texto: string = j.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
  return { texto, uso: (j.usage ?? {}) as UsoClaude, stopReason: j.stop_reason ?? null };
}

// Extrai o primeiro objeto JSON da resposta (o modelo às vezes embrulha em
// texto apesar da instrução).
function extrairJson<T>(texto: string): T {
  const s = texto.indexOf("{");
  const e = texto.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Resposta do modelo não continha JSON");
  return JSON.parse(texto.slice(s, e + 1)) as T;
}

// Acha o quiz_response da sessão pra chavear custo e persistência.
async function quizIdDaSessao(sessionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("quiz_responses")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * O mesmo id, mas para CONTABILIDADE. Nunca lança.
 *
 * O bug que isto conserta era de ORDEM DE AVALIAÇÃO, e por isso não se via
 * lendo o código de cima:
 *
 *   await registrarCustoLetra({ quizResponseId: await quizIdDaSessao(...), ... })
 *
 * O `registrarCustoLetra` tem `try/catch` interno justamente para custo nunca
 * derrubar entrega. Só que o `await quizIdDaSessao(...)` roda na LISTA DE
 * ARGUMENTOS — ou seja, ANTES de a função ser chamada, e portanto fora da
 * proteção dela. Uma falha ali derrubava `gerarRefroes` inteiro DEPOIS de a
 * letra já ter sido escrita e paga em tokens: dinheiro gasto, nada entregue,
 * e o usuário vendo "Não consegui escrever agora".
 *
 * ── POR QUE NÃO CONSERTEI NO `quizIdDaSessao` ────────────────────
 *
 * Seria uma linha a menos e um defeito PIOR. Os outros três chamadores dele
 * (`temMusicaDaSessao` e os dois estados do funil) leem `null` como "esta
 * sessão não tem música", e `temMusicaDaSessao` usa isso pra BARRAR o
 * checkout. Fazer o lookup devolver `null` quando o banco pisca transformaria
 * um erro passageiro em venda bloqueada — hoje ele estoura, e o `catch` do
 * `TelaOferta` deixa o comprador seguir de propósito ("indisponível não é o
 * mesmo que inexistente").
 *
 * Então o silêncio fica SÓ onde ele é correto: custo sem chave é uma linha de
 * contabilidade órfã, que se conserta depois olhando o banco. É barato. Venda
 * barrada e letra perdida não são.
 */
async function quizIdParaCusto(sessionId: string): Promise<string | null> {
  try {
    return await quizIdDaSessao(sessionId);
  } catch (err) {
    console.error("[coautoria] id da sessão não lido; custo fica sem chave:", err);
    return null;
  }
}

// ── O QUE ENTRA NO PROMPT TEM TAMANHO ───────────────────────────
//
// Nada aqui limitava o tamanho da entrada, e o preço do Claude é por token de
// ENTRADA também. `aprimorarLetra` era o pior: recebia `letra` do cliente e
// mandava inteira pro modelo, então um POST de 2 MB virava uma conta de 2 MB
// na Anthropic — e a resposta voltava pro remetente, o que faz do endereço um
// proxy grátis pra API.
//
// Os números são folgados de propósito. A história mais longa que o quiz
// produz não passa de uns 3 mil caracteres, e uma letra fica na casa dos 1,5
// mil: o teto está uma ordem de grandeza acima do uso real, então ele só
// aparece pra quem está tentando outra coisa.
const MAX_RESPOSTAS = 12_000;
const MAX_LETRA = 12_000;
const MAX_REFRAO = 2_000;

/**
 * O TETO DE CHAMADAS, importado só no servidor.
 *
 * `import()` dentro do handler, como `admin-auth.server`: o módulo usa
 * `node:crypto` e o contexto de requisição, e este arquivo é importado por
 * componente de tela (`RevealStep`, `EditorLetra`).
 */
async function cobrarLetra(sessionId: string): Promise<void> {
  const m = await import("@/lib/limite-uso.server");
  await m.cobrarUso(m.TETO_LETRA, sessionId);
}

async function cobrarMusica(sessionId: string): Promise<void> {
  const m = await import("@/lib/limite-uso.server");
  await m.cobrarUso(m.TETO_MUSICA, sessionId);
}

/** Erro de entrada grande demais. Mensagem única: não descreve o teto. */
function exigirTamanho(valor: unknown, teto: number, campo: string): void {
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor ?? "");
  if ((texto?.length ?? 0) > teto) throw new Error(`${campo} grande demais`);
}

function respostasSanitizadas(respostas: Record<string, unknown>, locale: Locale = "pt") {
  const nome = sanitizeNome(respostas.nome);
  // O FALLBACK TEM IDIOMA, e este aqui é o mais caro dos dois: ele não vai
  // pra tela, vai pro PROMPT. Sem o idioma, uma letra espanhola sem nome
  // recebia "essa pessoa" em português e o modelo cantava isso.
  //
  // `letra-prompt.ts` já tinha `fallbackNome` por idioma; ele nunca era usado
  // porque esta função preenchia antes.
  return { ...respostas, nome: nome || (locale === "es" ? "esa persona" : "essa pessoa") };
}

// ── ETAPA 1: dois refrões ────────────────────────────────────────
// As INSTRUÇÕES de cada etapa, por idioma.
//
// Não é preciosismo: o system prompt manda escrever em espanhol, mas uma
// instrução em português na última mensagem puxa o modelo de volta — ele
// responde no idioma do que acabou de ler. Medido nos testes.
const INSTRUCOES: Record<Locale, {
  refroes: string;
  montar: (refrao: string) => string;
  aprimorar: string;
}> = {
  pt: {
    refroes:
      'Gere DUAS opções de refrão bem diferentes entre si para esta música — uma mais direta e uma mais lírica, cada uma ancorada num detalhe concreto DIFERENTE da história. Cada refrão tem 4 linhas. Dê também um título e o estilo_suno (prompt de estilo pro gerador de música). Responda APENAS com JSON válido: {"titulo","estilo_suno","refroes":["refrão 1","refrão 2"]}',
    montar: (refrao) =>
      `O REFRÃO já foi escolhido. Use EXATAMENTE este refrão, sem alterar nenhuma palavra, em todas as ocorrências de [Chorus]:

${refrao}

Escreva a letra completa ao redor dele (intro curta, versos, ponte, outro) usando as marcações [Short Intro - máx 8s] [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Chorus] [Outro]. Responda APENAS com JSON válido: {"titulo","letra","estilo_suno","verso_destaque"}`,
    aprimorar:
      'Aqui está uma letra de música. Melhore-a: deixe as imagens mais concretas, corte qualquer clichê, ajuste o ritmo das linhas. MANTENHA a estrutura (as marcações [Verse], [Chorus] etc) e o refrão exatamente como estão. Responda APENAS com JSON válido: {"letra"}',
  },
  es: {
    refroes:
      'Genera DOS opciones de coro bien distintas entre sí para esta canción — una más directa y una más lírica, cada una anclada en un detalle concreto DIFERENTE de la historia. Cada coro tiene 4 líneas. Da también un título y el estilo_suno (prompt de estilo para el generador de música). Responde SOLO con JSON válido: {"titulo","estilo_suno","refroes":["coro 1","coro 2"]}',
    montar: (refrao) =>
      `El CORO ya fue elegido. Usa EXACTAMENTE este coro, sin cambiar ni una palabra, en todas las apariciones de [Chorus]:

${refrao}

Escribe la letra completa alrededor de él (intro corta, versos, puente, outro) usando las marcas [Short Intro - máx 8s] [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Chorus] [Outro]. Responde SOLO con JSON válido: {"titulo","letra","estilo_suno","verso_destaque"}`,
    aprimorar:
      'Aquí está una letra de canción. Mejórala: haz las imágenes más concretas, corta cualquier cliché, ajusta el ritmo de las líneas. MANTÉN la estructura (las marcas [Verse], [Chorus], etc.) y el coro exactamente como están. Responde SOLO con JSON válido: {"letra"}',
  },
};

export type RefroesGerados = { titulo: string; estiloSuno: string; refroes: [string, string] };

export const gerarRefroes = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; respostas: Record<string, unknown>; locale?: string }) => data)
  .handler(async ({ data }): Promise<RefroesGerados> => {
    exigirTamanho(data.respostas, MAX_RESPOSTAS, "respostas");
    await cobrarLetra(data.sessionId);
    const locale = normalizarLocale(data.locale);
    const userMsg = `${buildUserMessage(respostasSanitizadas(data.respostas, locale), locale)}

${INSTRUCOES[locale].refroes}`;

    // A ÚNICA ETAPA NO MODELO BARATO. Aqui o pedido é escolher entre três
    // frases curtas, e a medição de 26/08 mostrou que o Haiku perde na letra
    // LONGA (menos detalhe concreto, versos mais rasos), não em escolher.
    // Vale 45% do custo da letra e não é o que o Suno canta.
    const { texto, uso } = await chamarClaude(userMsg, 1500, locale, MODEL_CURTO);
    const p = extrairJson<{ titulo: string; estilo_suno: string; refroes: string[] }>(texto);

    // Custo atribuído à sessão (musicaId ainda não existe). O modelo passado
    // aqui é o MESMO da chamada acima: se divergir, o painel cobra a etapa no
    // preço do outro modelo e o erro só aparece na fatura.
    await registrarCustoLetra({
      quizResponseId: await quizIdParaCusto(data.sessionId),
      modelo: MODEL_CURTO,
      uso,
    });

    const refroes = (p.refroes ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (refroes.length < 2) throw new Error("modelo não devolveu dois refrões");
    return {
      titulo: String(p.titulo ?? "Sua música"),
      estiloSuno: String(p.estilo_suno ?? ""),
      refroes: [refroes[0], refroes[1]],
    };
  });

// ── ETAPA 2: letra inteira a partir do refrão escolhido ──────────
export const montarLetra = createServerFn({ method: "POST" })
  .validator(
    (data: { sessionId: string; respostas: Record<string, unknown>; refrao: string; locale?: string }) => data,
  )
  .handler(async ({ data }): Promise<LetraGerada> => {
    exigirTamanho(data.respostas, MAX_RESPOSTAS, "respostas");
    exigirTamanho(data.refrao, MAX_REFRAO, "refrão");
    await cobrarLetra(data.sessionId);
    const locale = normalizarLocale(data.locale);
    const userMsg = `${buildUserMessage(respostasSanitizadas(data.respostas, locale), locale)}

${INSTRUCOES[locale].montar(data.refrao)}`;

    const { texto, uso, stopReason } = await chamarClaude(userMsg, 4000, locale);
    if (stopReason === "max_tokens") throw new Error("Letra truncada pelo limite de tokens");
    const p = extrairJson<LetraGerada>(texto);

    await registrarCustoLetra({ quizResponseId: await quizIdParaCusto(data.sessionId), modelo: MODEL, uso });

    return {
      titulo: String(p.titulo ?? "Sua música"),
      letra: String(p.letra ?? ""),
      estilo_suno: String(p.estilo_suno ?? ""),
      verso_destaque: String(p.verso_destaque ?? ""),
    };
  });

// ── ETAPA 2b (opcional): aprimorar a letra editada ───────────────
export const aprimorarLetra = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; letra: string; locale?: string }) => data)
  .handler(async ({ data }): Promise<{ letra: string }> => {
    exigirTamanho(data.letra, MAX_LETRA, "letra");
    await cobrarLetra(data.sessionId);
    const locale = normalizarLocale(data.locale);
    const userMsg = `${INSTRUCOES[locale].aprimorar}

${data.letra}`;

    const { texto, uso, stopReason } = await chamarClaude(userMsg, 4000, locale);
    if (stopReason === "max_tokens") throw new Error("Letra truncada pelo limite de tokens");
    const p = extrairJson<{ letra: string }>(texto);

    await registrarCustoLetra({ quizResponseId: await quizIdParaCusto(data.sessionId), modelo: MODEL, uso });

    const letra = String(p.letra ?? "").trim();
    if (!letra) throw new Error("aprimorar não devolveu letra");
    return { letra };
  });

// ── ETAPA 3: finalizar — persiste a letra FINAL e dispara a música ─
// A `letra` aqui é a versão definitiva (escolhida + editada). É a única que
// vira música, então é a fonte de verdade daqui pra frente.
/**
 * EXISTE MÚSICA PRA ESTA SESSÃO?
 *
 * A trava final da regra que o projeto tem como inegociável: nunca cobrar por
 * algo que ainda não foi produzido.
 *
 * Em 11/08 um comprador pagou R$ 37 e não havia nada pra entregar. A causa
 * imediata foi a letra velha em localStorage (consertada no `quiz-store`), mas
 * a lição maior é que o caminho até o checkout confiava só no navegador. Isso
 * pergunta ao SERVIDOR, que é o único que sabe o que realmente existe.
 *
 * Consulta barata e por sessão: roda uma vez, no clique de pagar.
 */
export const temMusicaDaSessao = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }): Promise<{ existe: boolean; status: string | null }> => {
    const db = supabaseAdmin();
    const quizId = await quizIdDaSessao(data.sessionId);
    if (!quizId) return { existe: false, status: null };
    const { data: m } = await db
      .from("musicas")
      .select("id, status")
      .eq("quiz_response_id", quizId)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // BARRAR NÃO BASTA: se a música FALHOU, mandar a pessoa "voltar pra sua
    // letra" não refaz nada, e ela fica presa num loop.
    //
    // Medido em 3 dias: 2 sessões foram barradas aqui, cada uma clicou em
    // comprar 8 vezes, e NENHUMA das duas voltou. Elas queriam pagar e a
    // única coisa que faltava era a música existir.
    //
    // É o melhor R$ 0,32 do funil inteiro: alguém com o dedo no botão de
    // comprar. Refaz na hora e devolve `gerando`, que é o que a tela sabe
    // esperar.
    if (m && m.status === "falhou") {
      await db.from("musicas").update({ status: "gerando", erro: null }).eq("id", m.id);
      await dispararGeracaoMusica(m.id);
      return { existe: false, status: "gerando" };
    }

    return { existe: Boolean(m), status: m?.status ?? null };
  });

/**
 * ESTA SESSÃO JÁ PAGOU?
 *
 * Existia `temMusicaDaSessao` ("existe música") e não existia isto ("houve
 * pagamento"), e a diferença entre as duas é um comprador preso na vitrine.
 *
 * Em 16/08 um cliente pagou R$ 38 às 12h04, abriu o e-mail de entrega, e o
 * rastro dele mostra a tela de oferta e o popup de desbloqueio aparecendo
 * DUAS vezes depois disso, às 12h05 e às 12h19. Ele escreveu pro suporte
 * dizendo "não consigo ouvir a música por inteira", e era verdade: o site
 * continuava cortando em 40 segundos a música que ele já tinha comprado.
 *
 * O caminho é sempre o mesmo: o e-mail da letra leva ao `/retomar`, que
 * restaura a sessão e devolve pro funil. O funil só sabia se a música existe,
 * nunca se ela foi paga.
 *
 * Devolve os tokens junto porque quem chama isto quer MANDAR a pessoa pro
 * presente, e uma segunda consulta só pra pegar o token seria mais uma ida ao
 * servidor no meio de um redirecionamento.
 */
export const sessaoJaPagou = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      pago: boolean;
      /** Existe letra pronta no servidor, mesmo que o navegador tenha perdido. */
      temLetra: boolean;
      token: string | null;
      tokenEdicao: string | null;
    }> => {
      const vazio = { pago: false, temLetra: false, token: null, tokenEdicao: null };
      const db = supabaseAdmin();
      const quizId = await quizIdDaSessao(data.sessionId);
      if (!quizId) return vazio;

      const [{ data: pedido }, { data: m }] = await Promise.all([
        db
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", quizId)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle(),
        db
          .from("musicas")
          .select("token, token_edicao, letra")
          .eq("quiz_response_id", quizId)
          .not("letra", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        pago: Boolean(pedido),
        temLetra: Boolean(m?.letra),
        token: m?.token ?? null,
        tokenEdicao: m?.token_edicao ?? null,
      };
    },
  );

export const finalizarLetra = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      respostas: Record<string, unknown>;
      letra: string;
      titulo: string;
      estiloSuno: string;
      versoDestaque: string;
      locale?: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ musicaId: string | null; statusMusica: string }> => {
    exigirTamanho(data.respostas, MAX_RESPOSTAS, "respostas");
    exigirTamanho(data.letra, MAX_LETRA, "letra");
    // O teto da MÚSICA, não o da letra: aqui o gasto é o kie.ai. A idempotência
    // logo abaixo já cobre o duplo-clique honesto; isto cobre o laço.
    await cobrarMusica(data.sessionId);
    const db = supabaseAdmin();
    const locale = normalizarLocale(data.locale);
    // ── A LINHA DO QUIZ PODE AINDA NÃO TER CHEGADO ────────────────
    //
    // Isto desistia em silêncio, e a conta do silêncio estava no banco: em 7
    // dias, 12 pessoas finalizaram a letra e ficaram SEM MÚSICA NENHUMA. Duas
    // por dia, número constante independente do volume — o formato de uma
    // corrida, não de sobrecarga.
    //
    // A corrida é esta: `captureLeadProgress` é fire-and-forget no cliente e
    // é ele quem cria a linha de `quiz_responses`. Em 8 dos 12 casos a linha
    // nasceu 16 a 74 segundos DEPOIS de `letra_finalizada` — sempre depois,
    // nunca antes. Nos outros 4 ela nunca nasceu.
    //
    // O que acontecia com essas pessoas: a letra ficava pronta na tela, elas
    // liam, chegavam na oferta, clicavam em comprar, e o funil barrava por
    // falta de música. Uma delas hoje, às 13h16. É a pior perda possível —
    // alguém com a letra escrita e o dedo no botão.
    //
    // Desistir aqui nunca foi certo: `sessionId` e `respostas` estão em mãos,
    // que é tudo que a linha precisa. Então CRIA. Pela mesma RPC que o funil
    // usa, pra não haver dois jeitos de nascer um lead: ela é `SECURITY
    // DEFINER`, faz `GREATEST` no `furthest_step` e não apaga resposta, então
    // a captura verdadeira chegando 17 segundos depois completa a linha em
    // vez de brigar com ela.
    //
    // Os passos vão NULOS de propósito: quem sabe em que passo a pessoa está
    // é o cliente, e chutar daqui um número alto estragaria o funil do painel.
    let quizId = await quizIdDaSessao(data.sessionId);
    if (!quizId) {
      const { error: erroLead } = await db.rpc("upsert_quiz_response", {
        p_session_id: data.sessionId,
        p_respostas: data.respostas,
        p_locale: locale,
      });
      if (erroLead) {
        console.error("[coautoria] não deu pra criar o lead da sessão:", erroLead);
      }
      quizId = await quizIdDaSessao(data.sessionId);
    }
    if (!quizId) {
      console.error("[coautoria] sessão sem quiz_response; letra não persistida", data.sessionId);
      return { musicaId: null, statusMusica: "aguardando" };
    }

    // Idempotência: se já existe música pra esta sessão, NÃO dispara de novo
    // (cada geração custa R$ 0,32). Cobre o duplo-clique no "está pronta".
    const { data: existente } = await db
      .from("musicas")
      .select("id, status")
      .eq("quiz_response_id", quizId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      return { musicaId: existente.id, statusMusica: existente.status ?? "aguardando" };
    }

    // O IDIOMA fica gravado no lead ANTES de a música existir.
    //
    // É o que faz a página presente, o editor e os 4 e-mails saírem na língua
    // certa: nenhum dos três tem URL de onde deduzir (ver a migration
    // 20260807000000_locale). Gravado aqui, e não no primeiro passo do quiz,
    // porque é aqui que a sessão vira compra em potencial — e a RPC de
    // progresso parcial nunca sobrescreve o campo.
    await db.from("quiz_responses").update({ locale }).eq("id", quizId);

    const { data: inserida, error } = await db
      .from("musicas")
      .insert({
        quiz_response_id: quizId,
        token: crypto.randomUUID().replace(/-/g, "").slice(0, 22),
        status: "aguardando" as const,
        titulo: data.titulo,
        letra: data.letra,
        estilo_suno: data.estiloSuno,
        verso_destaque: data.versoDestaque,
        genero: String(data.respostas.estilo ?? ""),
        // Cópia do idioma pro painel do comprador, que não lê o lead (RLS).
        locale,
      })
      .select("id")
      .single();
    if (error || !inserida) {
      console.error("[coautoria] falha ao salvar musica:", error);
      return { musicaId: null, statusMusica: "aguardando" };
    }

    // GATILHO: a música começa a gerar AGORA, com a letra final. Ainda antes
    // do pagamento.
    await dispararGeracaoMusica(inserida.id);
    return { musicaId: inserida.id, statusMusica: "aguardando" };
  });
