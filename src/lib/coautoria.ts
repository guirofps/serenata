import { createServerFn } from "@tanstack/react-start";
import { type Locale, normalizarLocale } from "@/lib/i18n";
import { MARCA_ATIVA } from "@/lib/marca-identidade";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { atribuicaoDoCliente, emailDoCliente } from "@/lib/lead-fallback";
import { registrarCustoLetra, type UsoClaude } from "@/lib/custos";
import { dispararGeracaoMusica } from "@/lib/gerar-letra";
import { recusaDeConteudo } from "@/lib/recusa-provedor";
import { systemDaLetra, buildUserMessage, sanitizeNome, type LetraGerada } from "@/lib/letra-prompt";
import { EXP_NOME_CANTADO, nomeCantadoLigado } from "@/lib/nome-cantado";
import {
  MODEL,
  MODEL_CURTO,
  chamarClaude,
  extrairJson,
  respostasSanitizadas,
  INSTRUCOES,
  recuperarLetra,
  letraParcial,
} from "@/lib/letra-claude";

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
//
// A conversa com o Claude (modelo, retentativa, instruções por idioma) mora
// em `letra-claude.ts` desde 11/10: o resgate da coautoria usa a mesma.

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

// ── TESTE `nome_cantado` (`nome-cantado.ts`) ─────────────────────
//
// O braço sai do BANCO, nunca do corpo da requisição: a atribuição gravada
// do quiz desta sessão e a linha viva do experimento. A linha é guardada por
// um minuto por instância, pra não somar uma consulta a cada etapa da letra;
// desligar pelo painel leva no máximo isso pra valer.
//
// Falha SEMPRE pro A: banco piscando aqui não pode custar a letra de ninguém.
const LINHA_NOME_CANTADO_MS = 60_000;
let linhaNomeCantado: { em: number; linha: Parameters<typeof nomeCantadoLigado>[1] } | null = null;

async function linhaDoNomeCantado(): Promise<Parameters<typeof nomeCantadoLigado>[1]> {
  if (linhaNomeCantado && Date.now() - linhaNomeCantado.em < LINHA_NOME_CANTADO_MS) {
    return linhaNomeCantado.linha;
  }
  const { data, error } = await supabaseAdmin()
    .from("experimentos")
    .select("ativo, variantes")
    .eq("id", EXP_NOME_CANTADO)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const linha = (data ?? null) as Parameters<typeof nomeCantadoLigado>[1];
  linhaNomeCantado = { em: Date.now(), linha };
  return linha;
}

/**
 * O nome a exigir na letra (braço B), ou `undefined` (o A). Só Serenata, só
 * português, e só com nome de verdade: o "essa pessoa" de quem não escreveu
 * nome nenhum não é nome pra cantar.
 */
async function nomeCantadoDaSessao(
  sessionId: string,
  respostas: Record<string, unknown>,
  locale: Locale,
): Promise<string | undefined> {
  if (MARCA_ATIVA.chave === "ballad" || locale !== "pt") return undefined;
  if (respostas.tema === "gospel" && respostas.tipo === "louvor") return undefined;
  const nome = sanitizeNome(respostas.nome);
  if (!nome) return undefined;
  try {
    const linha = await linhaDoNomeCantado();
    if (!linha?.ativo) return undefined;
    const { data } = await supabaseAdmin()
      .from("quiz_responses")
      .select("attribution")
      .eq("session_id", sessionId)
      .maybeSingle();
    return nomeCantadoLigado(data?.attribution ?? null, linha) ? nome : undefined;
  } catch (err) {
    console.error("[coautoria] braço do nome_cantado não lido; segue o A:", err);
    return undefined;
  }
}

/** Erro de entrada grande demais. Mensagem única: não descreve o teto. */
function exigirTamanho(valor: unknown, teto: number, campo: string): void {
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor ?? "");
  if ((texto?.length ?? 0) > teto) throw new Error(`${campo} grande demais`);
}


export type RefroesGerados = { titulo: string; estiloSuno: string; refroes: [string, string] };

export const gerarRefroes = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; respostas: Record<string, unknown>; locale?: string }) => data)
  .handler(async ({ data }): Promise<RefroesGerados> => {
    exigirTamanho(data.respostas, MAX_RESPOSTAS, "respostas");
    const locale = normalizarLocale(data.locale);
    // O braço do `nome_cantado` é lido junto com a cobrança: não soma espera.
    const [, nomeCantado] = await Promise.all([
      cobrarLetra(data.sessionId),
      nomeCantadoDaSessao(data.sessionId, data.respostas, locale),
    ]);
    const userMsg = `${buildUserMessage(respostasSanitizadas(data.respostas, locale), locale, { nomeCantado })}

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
      titulo: String(p.titulo ?? (locale === "en" ? "Your song" : locale === "es" ? "Tu canción" : "Sua música")),
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
    const locale = normalizarLocale(data.locale);
    // O braço do `nome_cantado` é lido junto com a cobrança: não soma espera.
    const [, nomeCantado] = await Promise.all([
      cobrarLetra(data.sessionId),
      nomeCantadoDaSessao(data.sessionId, data.respostas, locale),
    ]);
    const userMsg = `${buildUserMessage(respostasSanitizadas(data.respostas, locale), locale, { nomeCantado })}

${INSTRUCOES[locale].montar(data.refrao)}`;

    const { texto, uso, stopReason } = await chamarClaude(userMsg, 4000, locale);
    if (stopReason === "max_tokens") throw new Error("Letra truncada pelo limite de tokens");
    const tituloPadrao = locale === "en" ? "Your song" : locale === "es" ? "Tu canción" : "Sua música";
    let p: LetraGerada;
    try {
      p = extrairJson<LetraGerada>(texto);
    } catch (errJson) {
      // Mesma recuperação do caminho ao vivo: JSON torto não joga fora a letra.
      const recuperada = recuperarLetra(texto, tituloPadrao);
      if (!recuperada) throw errJson;
      p = recuperada;
    }

    await registrarCustoLetra({ quizResponseId: await quizIdParaCusto(data.sessionId), modelo: MODEL, uso });

    return {
      titulo: String(p.titulo ?? tituloPadrao),
      letra: String(p.letra ?? ""),
      estilo_suno: String(p.estilo_suno ?? ""),
      verso_destaque: String(p.verso_destaque ?? ""),
    };
  });

// ── ETAPA 2, EM STREAMING: a letra nascendo na frente da pessoa ──
//
// Medido em 30/08: a chamada leva 13,5s pra 835 tokens. Esse tempo NÃO cai —
// escrever uma letra custa isso. O que muda é o que a pessoa vê enquanto
// acontece: hoje é uma frase parada ("Escrevendo a letra em volta do seu
// refrão…") por treze segundos; aqui é a letra dela aparecendo, verso a
// verso, no ritmo em que é escrita.
//
// REAPROVEITA TUDO de `montarLetra`: mesmo prompt, mesma cobrança de uso,
// mesmo registro de custo, mesmo formato de saída. Duplicar qualquer um deles
// criaria a segunda cópia que sempre diverge.
//
// O CANAL é uma linha de JSON por vez (`{"parcial":"..."}` várias vezes, e um
// `{"final":{...}}` no fim). Não é SSE: não há reconexão nem eventos
// nomeados pra justificar o protocolo, e uma linha por mensagem é o que o
// cliente lê com menos código.
export const montarLetraStream = createServerFn({ method: "POST" })
  .validator(
    (data: { sessionId: string; respostas: Record<string, unknown>; refrao: string; locale?: string }) => data,
  )
  .handler(async ({ data }) => {
    exigirTamanho(data.respostas, MAX_RESPOSTAS, "respostas");
    exigirTamanho(data.refrao, MAX_REFRAO, "refrão");
    const locale = normalizarLocale(data.locale);
    // O braço do `nome_cantado` é lido junto com a cobrança: não soma espera.
    const [, nomeCantado] = await Promise.all([
      cobrarLetra(data.sessionId),
      nomeCantadoDaSessao(data.sessionId, data.respostas, locale),
    ]);
    const userMsg = `${buildUserMessage(respostasSanitizadas(data.respostas, locale), locale, { nomeCantado })}

${INSTRUCOES[locale].montar(data.refrao)}`;

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente no servidor");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        stream: true,
        system: [{ type: "text", text: systemDaLetra(locale), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!r.ok || !r.body) {
      throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const fonte = r.body;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let bruto = "";
        let enviado = "";
        let uso: UsoClaude = {} as UsoClaude;
        let sobra = "";
        const leitor = fonte.getReader();
        try {
          for (;;) {
            const { done, value } = await leitor.read();
            if (done) break;
            sobra += dec.decode(value, { stream: true });
            const linhas = sobra.split("\n");
            sobra = linhas.pop() ?? "";
            for (const linha of linhas) {
              if (!linha.startsWith("data:")) continue;
              const corpo = linha.slice(5).trim();
              if (!corpo || corpo === "[DONE]") continue;
              let ev: Record<string, unknown>;
              try {
                ev = JSON.parse(corpo);
              } catch {
                continue; // pedaço de SSE malformado não derruba o stream
              }
              // SOBRECARGA NO MEIO DO STREAM (16/10). A Anthropic responde 200 e
              // manda o erro como EVENTO (`overloaded_error`). Ignorado, o
              // texto acabava vazio e virava "Resposta do modelo não continha
              // JSON", o que escondia a causa. Agora lança com o motivo e o
              // cliente cai no `montarLetra`, que insiste com espera.
              if (ev.type === "error") {
                const e = (ev.error ?? {}) as { type?: string; message?: string };
                throw new Error(`Anthropic ${e.type ?? "erro"} no stream: ${String(e.message ?? "").slice(0, 120)}`);
              }
              const delta = (ev.delta ?? {}) as { text?: string };
              if (typeof delta.text === "string") bruto += delta.text;
              const u = (ev.usage ?? (ev.message as { usage?: UsoClaude } | undefined)?.usage) as
                | UsoClaude
                | undefined;
              if (u) uso = { ...uso, ...u };

              // Só manda o que CRESCEU. Reenviar a letra inteira a cada token
              // gastaria banda proporcional ao quadrado do tamanho dela.
              const agora = letraParcial(bruto);
              if (agora.length > enviado.length) {
                controller.enqueue(
                  enc.encode(JSON.stringify({ parcial: agora.slice(enviado.length) }) + "\n"),
                );
                enviado = agora;
              }
            }
          }

          const tituloPadrao = locale === "en" ? "Your song" : locale === "es" ? "Tu canción" : "Sua música";
          let final: LetraGerada;
          try {
            const p = extrairJson<LetraGerada>(bruto);
            final = {
              titulo: String(p.titulo ?? tituloPadrao),
              letra: String(p.letra ?? ""),
              estilo_suno: String(p.estilo_suno ?? ""),
              verso_destaque: String(p.verso_destaque ?? ""),
            };
          } catch (errJson) {
            // JSON torto, letra inteira: recupera campo a campo em vez de jogar
            // fora e pagar outra chamada (ver `recuperarLetra`).
            const recuperada = recuperarLetra(bruto, tituloPadrao);
            if (!recuperada) throw errJson;
            console.warn("[coautoria] JSON torto, letra recuperada campo a campo");
            final = recuperada;
          }
          controller.enqueue(enc.encode(JSON.stringify({ final }) + "\n"));

          // Custo por último e sem `await` bloqueando o fechamento: a letra já
          // está na tela, e contabilidade nunca pode atrasar entrega.
          void registrarCustoLetra({
            quizResponseId: await quizIdParaCusto(data.sessionId),
            modelo: MODEL,
            uso,
          });
        } catch (err) {
          // O cliente distingue erro de fim: sem `final`, ele refaz pelo
          // caminho antigo (`montarLetra`), que continua existindo intacto.
          controller.enqueue(
            enc.encode(JSON.stringify({ erro: err instanceof Error ? err.message : "falhou" }) + "\n"),
          );
        } finally {
          leitor.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
    });
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
      .select("id, status, erro")
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
    //
    // ── MAS COM TETO, E NUNCA PRA RECUSA DE CONTEÚDO (08/10) ──────────
    //
    // A espera da oferta pergunta isto de 5 em 5 segundos, e cada pergunta
    // em cima de música `falhou` refazia a música, sem limite: a recusa por
    // conteúdo (termo barrado, 4xx) voltava a falhar do mesmo jeito minutos
    // depois e era refeita de novo, R$ 0,32 por volta, e o `erro` apagado a
    // cada vez escondia o motivo do painel. Agora:
    //   - recusa de conteúdo não é refeita: a mesma letra dá a mesma recusa;
    //   - o resto é refeito até 3 vezes por música por dia.
    // O teto falha ABERTO (banco fora do ar refaz), como o resto do funil.
    if (m && m.status === "falhou") {
      if (recusaDeConteudo(m.erro)) return { existe: false, status: "falhou" };
      const { data: cabe, error: erroTeto } = await db.rpc("consumir_limite", {
        p_chave: `refaz-clique:${m.id}`,
        p_janela_s: 24 * 60 * 60,
        p_teto: 3,
      });
      if (erroTeto) console.error("[coautoria] teto de refação não conferido:", erroTeto.message);
      else if (cabe === false) return { existe: false, status: "falhou" };
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
      /**
       * `false` quando o pedido pago é crédito ou cortesia (R$ 0). A tela de
       * obrigado NÃO manda conversão pro Google e pro TikTok nesse caso: eles
       * aprendiam uma venda de R$ 38 que não existiu (auditoria 30/09).
       */
      dinheiroEntrou: boolean;
      /** O que foi cobrado e onde: o valor da conversão na /obrigado (08/10). */
      valorCentavos: number | null;
      gateway: string | null;
    }> => {
      const vazio = {
        pago: false,
        temLetra: false,
        token: null,
        tokenEdicao: null,
        dinheiroEntrou: false,
        valorCentavos: null,
        gateway: null,
      };
      const db = supabaseAdmin();
      const quizId = await quizIdDaSessao(data.sessionId);
      if (!quizId) return vazio;

      const [{ data: pedido }, { data: m }] = await Promise.all([
        db
          .from("pedidos")
          .select("id, dinheiro_entrou, valor_centavos, gateway")
          .eq("quiz_response_id", quizId)
          .eq("status", "pago")
          // O PRIMEIRO pago é a música; extra, quadro e vídeo vêm depois e
          // não podem virar o valor da conversão (08/10).
          .order("paid_at", { ascending: true, nullsFirst: false })
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
        dinheiroEntrou: Boolean(pedido) && pedido?.dinheiro_entrou !== false && (pedido?.valor_centavos ?? 1) > 0,
        valorCentavos: (pedido?.valor_centavos as number | null | undefined) ?? null,
        gateway: (pedido?.gateway as string | null | undefined) ?? null,
      };
    },
  );

/** A letra sem diferença de espaço, quebra de linha e caixa: o que conta como "outra letra". */
function normalizarLetra(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .toLowerCase();
}

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
      /** Só pra linha que nasce AQUI (29/10). Ver `lead-fallback.ts`. */
      email?: string | null;
      attribution?: Record<string, unknown> | null;
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
    //
    // COM O E-MAIL E A ATRIBUIÇÃO (29/10). Nos casos em que a linha NUNCA
    // nasceu, o navegador tinha perdido a rede: a linha criada aqui saía sem
    // e-mail (sem "letra pronta", sem recuperação) e sem o clique do anúncio.
    // O cliente agora manda os dois; só entram se a linha nasce agora, e o
    // e-mail só preenche campo VAZIO (a captura verdadeira pode chegar no
    // meio e nunca é sobrescrita).
    let quizId = await quizIdDaSessao(data.sessionId);
    if (!quizId) {
      const emailCliente = emailDoCliente(data.email);
      const { error: erroLead } = await db.rpc("upsert_quiz_response", {
        p_session_id: data.sessionId,
        p_respostas: data.respostas,
        p_locale: locale,
        p_attribution: atribuicaoDoCliente(data.attribution),
      });
      if (erroLead) {
        console.error("[coautoria] não deu pra criar o lead da sessão:", erroLead);
      }
      quizId = await quizIdDaSessao(data.sessionId);
      if (quizId && emailCliente) {
        const { error: erroEmail } = await db
          .from("quiz_responses")
          .update({ email: emailCliente })
          .eq("id", quizId)
          .is("email", null);
        if (erroEmail) console.error("[coautoria] e-mail do lead criado aqui não gravou:", erroEmail);
      }
    }
    if (!quizId) {
      console.error("[coautoria] sessão sem quiz_response; letra não persistida", data.sessionId);
      return { musicaId: null, statusMusica: "aguardando" };
    }

    // Idempotência: se já existe música pra esta sessão, NÃO dispara de novo
    // (cada geração custa R$ 0,32). Cobre o duplo-clique no "está pronta".
    const { data: existente } = await db
      .from("musicas")
      .select("id, status, letra")
      .eq("quiz_response_id", quizId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      // ── A MÚSICA DO RESGATE CEDE LUGAR À LETRA DELA (11/10) ─────
      //
      // O teste `resgate_coautoria` escreve a letra e grava a música de quem
      // largou a coautoria há 2h+. Se a pessoa volta e finaliza a letra DELA,
      // a idempotência acima devolveria a NOSSA música com a letra dela na
      // tela. Troca pela dela e regrava, mas só sem execução viva (`pronta` ou
      // `falhou`) e sem compra: pago já é presente entregue.
      //
      // E A LETRA QUE ELA MESMA REFEZ (16/10). Quem muda uma resposta depois de
      // finalizar (o caso típico: viu o nome errado, voltou e corrigiu) tem a
      // `letraFinal` zerada e refaz a coautoria. A idempotência devolvia a
      // música VELHA, com o nome errado, enquanto a tela mostrava a letra nova
      // — o contrário do "a música é igual à letra que você leu" do FAQ. Vale
      // a mesma troca do resgate. A comparação ignora espaço e quebra de
      // linha: reenviar a mesma letra nunca pode custar outra gravação.
      const mesmaLetra = normalizarLetra(existente.letra) === normalizarLetra(data.letra);
      if (!mesmaLetra && (existente.status === "pronta" || existente.status === "falhou")) {
        const { data: pago } = await db
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", quizId)
          .eq("status", "pago")
          .limit(1);
        if (!pago?.length) {
          const { error: eTroca } = await db
            .from("musicas")
            .update({
              titulo: data.titulo,
              letra: data.letra,
              estilo_suno: data.estiloSuno,
              verso_destaque: data.versoDestaque,
              audio_path: null,
              audio_path_v2: null,
              timestamps: null,
              timestamps_v2: null,
              status: "aguardando",
              erro: null,
            })
            .eq("id", existente.id);
          if (!eTroca) {
            await dispararGeracaoMusica(existente.id);
            return { musicaId: existente.id, statusMusica: "aguardando" };
          }
          console.error("[coautoria] troca da música pela letra nova falhou:", eTroca);
        }
      }
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

// `campoDoModelo`, `recuperarLetra` e `letraParcial` moram em `letra-claude.ts`
// desde 11/10 (o resgate da coautoria usa o mesmo leitor de JSON torto).
export { campoDoModelo, recuperarLetra, letraParcial } from "@/lib/letra-claude";

/**
 * ENTRAR NA CONTA a partir da sessão que acabou de pagar.
 *
 * O `/obrigado` tem a sessão do navegador de quem comprou. Isto troca essa
 * prova de pagamento por um login DE VERDADE na conta (Supabase Auth) e
 * devolve o link que já cai no `/dashboard` — o painel principal, com a
 * música, os créditos, os quadros e os upsells. Nasceu pra cortar MED: o
 * público mais velho paga, não acha o e-mail, e acha que não recebeu.
 *
 * ── POR QUE NÃO É SÓ UM `/editar/<token>` ────────────────────────
 * Aquele token abre UM presente, sem conta. O painel precisa de sessão de
 * conta pra listar tudo e mostrar os upsells.
 *
 * ── O TOKEN NUNCA VAI NA URL DO `/obrigado` ──────────────────────
 * O link volta no CORPO da resposta e o clique navega pro Supabase. A rota
 * `/obrigado` dispara a conversão do Google (gtag/UTMify leem a URL dela),
 * então um token de login na barra dela vazaria pra terceiro. Aqui, nunca.
 *
 * ── AMARRA A MÚSICA À CONTA, IGUAL AO send-magic-link ────────────
 * Só o webhook da Perfect Pay amarra música à conta. Quem pagou por PIX
 * (Woovi/Asaas), que hoje é a maioria, não tinha `user_id` na música, e o
 * painel apareceria VAZIO. Por isso este passo é obrigatório, não enfeite.
 */
export const entrarNaConta = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; link?: string }> => {
    const db = supabaseAdmin();
    const quizId = await quizIdDaSessao(data.sessionId);
    if (!quizId) return { ok: false };

    // PROVA DE PAGAMENTO: só quem pagou nesta sessão entra. Mesmo nível de
    // confiança do `sessaoJaPagou`, que já libera o token do presente por aqui.
    const { data: pedido } = await db
      .from("pedidos")
      .select("email")
      .eq("quiz_response_id", quizId)
      .eq("status", "pago")
      .not("email", "is", null)
      .limit(1)
      .maybeSingle();
    const email = String((pedido as { email?: string } | null)?.email ?? "").trim().toLowerCase();
    if (!email) return { ok: false };

    const { data: q } = await db
      .from("quiz_responses")
      .select("locale")
      .eq("id", quizId)
      .maybeSingle();
    const locale = normalizarLocale((q as { locale?: string } | null)?.locale);

    // Garante a conta. Idempotente: se já existe, dá "already registered" e a
    // gente segue — o generateLink funciona pra conta existente.
    await db.auth.admin.createUser({ email, email_confirm: true });

    const SITE = MARCA_ATIVA.url;
    const { data: linkData, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${SITE}/auth/callback?lang=${locale}` },
    });
    const link = linkData?.properties?.action_link;
    const uid = linkData?.user?.id;
    if (error || !link || !uid) return { ok: false };

    // Amarra TODAS as músicas deste e-mail à conta, senão o painel vem vazio
    // pra quem pagou por PIX. Só as sem dono. Idempotente.
    const { data: quizzes } = await db
      .from("quiz_responses")
      .select("id")
      .eq("email", email);
    const quizIds = (quizzes ?? []).map((x) => (x as { id: string }).id);
    if (quizIds.length) {
      await db
        .from("musicas")
        .update({ user_id: uid })
        .in("quiz_response_id", quizIds)
        .is("user_id", null);
    }

    await db.from("funnel_events").insert({
      event_name: "obrigado_entrou_na_conta",
      // Sem o session_id, todos os eventos caíam com o mesmo id e "distintos"
      // dava 1 — a adoção só era legível pelo clique no cliente. Agora bate.
      session_id: data.sessionId,
      event_data: { email, quiz: quizId },
    });

    return { ok: true, link };
  });
