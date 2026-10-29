// A CONVERSA COM O CLAUDE DA LETRA, sem tela e sem `createServerFn`.
//
// Morava dentro de `coautoria.ts`. Saiu pra cá em 11/10 porque o resgate de
// quem larga a coautoria no meio (`inngest/functions/resgatarCoautoria.ts`)
// escreve a letra no SERVIDOR, sem a pessoa, e precisa do MESMO prompt, do
// mesmo modelo e da mesma retentativa. Duas cópias divergiriam na primeira
// mudança de prompt. `coautoria.ts` importa tudo daqui.
import type { Locale } from "./i18n.js";
import { extrairJsonTolerante } from "./json-tolerante.js";
import { MODELO_LETRA, MODELO_LETRA_CURTA, type UsoClaude } from "./custos.js";
import { systemDaLetra, sanitizeNome, buildUserMessage, type LetraGerada } from "./letra-prompt.js";

// As strings vivem em `custos.ts`, coladas na tabela de preço: trocar o modelo
// sem trocar o preço faz o painel contabilizar errado sem avisar.
//
// SÃO DOIS, e a divisão foi medida (ver o comentário longo em `custos.ts`):
// a letra inteira, que o cliente lê e o Suno canta, vai no modelo bom; as três
// opções de refrão vão no barato. Cada chamador diz qual usa, e passa o MESMO
// valor pro `registrarCustoLetra` — é o único jeito de o painel não mentir.
export const MODEL = MODELO_LETRA;
export const MODEL_CURTO = MODELO_LETRA_CURTA;

export type RespClaude = { texto: string; uso: UsoClaude; stopReason: string | null };

// Uma chamada ao Claude, no formato já validado (medir-custo-letra.mjs):
// system cacheável + pedido de JSON no fim. Devolve o texto cru; cada
// chamador parseia o que precisa.
/**
 * Monta e dispara a requisição. Separada de `chamarClaude` só pra o laço de
 * retentativa poder repetir a chamada sem duplicar o corpo.
 */
function fetchClaude(
  key: string,
  modelo: string,
  maxTokens: number,
  locale: Locale,
  userMsg: string,
  pais?: string | null,
): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
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
      // O `cache_control` abaixo VALE na letra inteira: o Sonnet cria entrada
      // de cache a partir de 1.024 tokens de prefixo e este system tem ~1.200.
      // Nas opções de refrão continua sem efeito, porque o Haiku 4.5 exige
      // 4.096 (ver `custos.ts`).
      system: [{ type: "text", text: systemDaLetra(locale, pais), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    }),
  });
}

export async function chamarClaude(
  userMsg: string,
  maxTokens: number,
  locale: Locale = "pt",
  // O padrão é o modelo BOM. Etapa nova que esquecer de escolher cai no caro e
  // certo, nunca no barato e raso — o erro que ninguém percebe olhando a tela.
  modelo: string = MODEL,
  // O país gravado no quiz (29/10, `pais-quiz.ts`): escolhe o espanhol do
  // prompt na Ballad. Sem ele, vale o país da requisição (`mercado-es.ts`).
  pais?: string | null,
): Promise<RespClaude> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ausente no servidor");

  // ── TENTA DE NOVO QUANDO O ERRO É PASSAGEIRO ─────────────────
  //
  // Medido em 30/08: de 213 pessoas que escolheram o refrão, 19 (9%) nunca
  // chegaram na letra. Elas viram "Não consegui montar a letra. Tente de
  // novo." — e o "de novo" era trabalho DELAS, porque aqui não havia
  // nenhuma segunda tentativa: uma resposta não-ok estourava direto.
  //
  // A causa provável é sobrecarga do provedor (529) em horário de pico, que
  // por definição passa em segundos. Insistir duas vezes converte a maior
  // parte disso em letra entregue.
  //
  // NÃO tenta de novo em 400/401/403: chave errada, saldo acabado ou pedido
  // inválido falham igual na segunda vez, e repetir só atrasa o usuário e
  // esconde o defeito real.
  const PASSAGEIRO = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
  // 16/10: [700, 2000] → mais uma, de 5s. Nos picos de sobrecarga (15h de
  // 14 e 15/10) 2,7s de insistência não bastavam: 29 sessões perderam a
  // letra ao vivo e 9 delas (31%) desistiram, contra 2,9% normal.
  const ESPERAS = [700, 2000, 5000];
  let r: Response | null = null;
  let ultimoErro: unknown = null;
  let ultimoStatus: number | null = null;
  for (let tentativa = 0; tentativa <= ESPERAS.length; tentativa++) {
    if (tentativa > 0) await new Promise((s) => setTimeout(s, ESPERAS[tentativa - 1]));
    try {
      r = await fetchClaude(key, modelo, maxTokens, locale, userMsg, pais);
    } catch (err) {
      // Rede caiu no meio: é o caso mais passageiro de todos.
      ultimoErro = err;
      r = null;
      continue;
    }
    if (r.ok || !PASSAGEIRO.has(r.status)) break;
    ultimoStatus = r.status;
    console.warn(`[coautoria] Anthropic ${r.status}, tentando de novo (${tentativa + 1})`);
    r = null;
  }
  if (!r) {
    // ── O ALERTA TAMBÉM VALE AQUI ────────────────────────────
    //
    // Sem isto, a retentativa criava um silêncio novo: erro passageiro que
    // se repete TRÊS vezes não é passageiro, é queda — e era exatamente o
    // caso que precisava acordar alguém, agora escondido atrás do laço.
    const motivo =
      ultimoStatus !== null
        ? `${ultimoStatus} em ${ESPERAS.length + 1} tentativas`
        : `rede: ${ultimoErro instanceof Error ? ultimoErro.message : "desconhecido"}`;
    void import("./alerta-operacao.js")
      .then((m) =>
        m.alertarFalhaClaude({ status: ultimoStatus ?? 0, corpo: motivo, onde: "coautoria (esgotou retentativas)" }),
      )
      .catch(() => {});
    throw new Error(`Anthropic indisponível — ${motivo}`);
  }

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
    void import("./alerta-operacao.js")
      .then((m) => m.alertarFalhaClaude({ status: r.status, corpo, onde: "coautoria" }))
      .catch(() => {});
    throw new Error(`Anthropic ${r.status}: ${corpo.slice(0, 200)}`);
  }
  const j = await r.json();
  const texto: string = j.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
  return { texto, uso: (j.usage ?? {}) as UsoClaude, stopReason: j.stop_reason ?? null };
}

// Extrai o primeiro objeto JSON da resposta (o modelo às vezes embrulha em
// texto apesar da instrução). Tolerante desde 27/09: 6 a 7% das letras vinham
// com defeito miúdo no JSON (aspa sem escape na letra) e refaziam do zero. Ver
// `json-tolerante.ts`. Quando nem o conserto salva, o log guarda o começo do
// que o modelo mandou, pra dar pra entender o caso.
export function extrairJson<T>(texto: string): T {
  try {
    return extrairJsonTolerante<T>(texto);
  } catch (err) {
    console.error("[coautoria] JSON ilegível do modelo:", (err as Error).message, "| começo:", texto.slice(0, 300));
    throw err;
  }
}

export function respostasSanitizadas(respostas: Record<string, unknown>, locale: Locale = "pt") {
  const nome = sanitizeNome(respostas.nome);
  // O FALLBACK TEM IDIOMA, e este aqui é o mais caro dos dois: ele não vai
  // pra tela, vai pro PROMPT. Sem o idioma, uma letra espanhola sem nome
  // recebia "essa pessoa" em português e o modelo cantava isso.
  //
  // `letra-prompt.ts` já tinha `fallbackNome` por idioma; ele nunca era usado
  // porque esta função preenchia antes.
  return {
    ...respostas,
    nome: nome || (locale === "es" ? "esa persona" : locale === "en" ? "this person" : "essa pessoa"),
  };
}

// ── ETAPA 1: dois refrões ────────────────────────────────────────
// As INSTRUÇÕES de cada etapa, por idioma.
//
// Não é preciosismo: o system prompt manda escrever em espanhol, mas uma
// instrução em português na última mensagem puxa o modelo de volta — ele
// responde no idioma do que acabou de ler. Medido nos testes.
export const INSTRUCOES: Record<Locale, {
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
  // Inglês (Ballad Gift). As chaves do JSON continuam em português: é o
  // contrato com o código que lê a resposta, não texto pro modelo cantar.
  en: {
    refroes:
      'Write TWO chorus options for this song that are clearly different from each other: one more direct and one more lyrical, each anchored in a DIFFERENT concrete detail from the story. Each chorus has 4 lines. Also give a title and the estilo_suno (the style prompt for the music generator, in English). Reply ONLY with valid JSON: {"titulo","estilo_suno","refroes":["chorus 1","chorus 2"]}',
    montar: (refrao) =>
      `The CHORUS has already been chosen. Use EXACTLY this chorus, without changing a single word, every time [Chorus] appears:

${refrao}

Write the full lyrics around it (short intro, verses, bridge, outro) using the tags [Short Intro - max 8s] [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Chorus] [Outro]. Reply ONLY with valid JSON: {"titulo","letra","estilo_suno","verso_destaque"}`,
    aprimorar:
      'Here are song lyrics. Improve them: make the images more concrete, cut any cliché, tighten the rhythm of the lines. KEEP the structure (the [Verse], [Chorus] tags etc.) and the chorus exactly as they are. Reply ONLY with valid JSON: {"letra"}',
  },
};

// ── A LETRA DE DENTRO DE UM JSON PELA METADE ─────────────────────
//
// O modelo devolve `{"titulo": "...", "letra": "...", ...}`. Em streaming,
// os pedaços chegam como JSON INVÁLIDO — `{"titulo": "Vira`, depois
// `{"titulo": "Viradinho", "letra": "Você chegou dev` — e nada disso pode
// ir pra tela do jeito que está.
//
// Esta função lê o que já existe do campo `letra` e devolve só isso, com as
// escapadas desfeitas. É o que permite mostrar a letra NASCENDO sem trocar o
// formato de saída do modelo — o que mexeria em música, karaokê e e-mails.
//
// Ela é deliberadamente tolerante: string sem fechar, escapada cortada no
// meio, campo ainda inexistente. Tudo isso é estado NORMAL no meio de um
// stream, não erro.
/**
 * Lê UM campo de texto do JSON do modelo, mesmo com o resto do JSON torto.
 * `fechado` diz se a aspa final chegou: campo cortado não vale como final.
 */
export function campoDoModelo(bruto: string, chave: string): { texto: string; fechado: boolean } {
  const m = bruto.match(new RegExp(`"${chave}"\\s*:\\s*"`));
  if (!m || m.index === undefined) return { texto: "", fechado: false };
  let i = m.index + m[0].length;
  let saida = "";
  while (i < bruto.length) {
    const c = bruto[i];
    if (c === "\\") {
      if (i + 1 >= bruto.length) break;
      const p = bruto[i + 1];
      saida += p === "n" ? "\n" : p === "t" ? "\t" : p === "r" ? "" : p;
      i += 2;
      continue;
    }
    if (c === '"') return { texto: saida, fechado: true };
    saida += c;
    i += 1;
  }
  return { texto: saida, fechado: false };
}

/**
 * A LETRA QUE JÁ CHEGOU NÃO VAI FORA (01/10).
 *
 * 6% das letras ao vivo caíam no caminho antigo (uma segunda chamada ao
 * Claude, ~13s a mais) porque o JSON final vinha torto ("Expected ':' after
 * property name", 130 em 24h) ou sem JSON nenhum (34). A letra em si estava
 * inteira na tela. Aqui ela é recuperada campo a campo; e, sem JSON, aceita o
 * texto puro quando ele tem cara de letra (as marcações [Verse]/[Chorus]).
 * Devolve null quando não há letra confiável, e aí o caminho antigo assume.
 */
export function recuperarLetra(bruto: string, tituloPadrao: string): LetraGerada | null {
  const letra = campoDoModelo(bruto, "letra");
  if (letra.fechado && letra.texto.trim().length >= 200) {
    const titulo = campoDoModelo(bruto, "titulo");
    const estilo = campoDoModelo(bruto, "estilo_suno");
    const verso = campoDoModelo(bruto, "verso_destaque");
    return {
      titulo: (titulo.fechado && titulo.texto.trim()) || tituloPadrao,
      letra: letra.texto.trim(),
      estilo_suno: estilo.fechado ? estilo.texto : "",
      verso_destaque: verso.fechado ? verso.texto : "",
    };
  }
  if (!bruto.includes("{") && /\[(Verse|Chorus|Verso|Refr[aã]o|Coro|Estrofa)/i.test(bruto) && bruto.trim().length >= 200) {
    return { titulo: tituloPadrao, letra: bruto.trim(), estilo_suno: "", verso_destaque: "" };
  }
  return null;
}

export function letraParcial(bruto: string): string {
  const m = bruto.match(/"letra"\s*:\s*"/);
  if (!m || m.index === undefined) return "";
  let i = m.index + m[0].length;
  let saida = "";
  while (i < bruto.length) {
    const c = bruto[i];
    if (c === "\\") {
      // Escapada cortada no fim do pedaço: para aqui e espera o resto chegar.
      if (i + 1 >= bruto.length) break;
      const p = bruto[i + 1];
      saida += p === "n" ? "\n" : p === "t" ? "\t" : p === "r" ? "" : p;
      i += 2;
      continue;
    }
    if (c === '"') break; // fim do campo
    saida += c;
    i += 1;
  }
  return saida;
}

export type LetraSozinha = LetraGerada & { usos: Array<{ modelo: string; uso: UsoClaude }> };

/**
 * A LETRA INTEIRA SEM A PESSOA NA TELA: as mesmas duas etapas da coautoria
 * (refrões no modelo barato, letra no bom), escolhendo o PRIMEIRO refrão, que
 * a instrução pede "mais direto". Usada pelo resgate de quem largou a
 * coautoria no meio. Lança se o modelo não devolver letra utilizável: quem
 * chama desiste daquele lead, nunca grava letra pela metade.
 */
export async function escreverLetraSozinha(
  respostas: Record<string, unknown>,
  locale: Locale,
): Promise<LetraSozinha> {
  const base = buildUserMessage(respostasSanitizadas(respostas, locale), locale);
  const r1 = await chamarClaude(`${base}\n\n${INSTRUCOES[locale].refroes}`, 1500, locale, MODEL_CURTO);
  const p1 = extrairJson<{ titulo?: string; estilo_suno?: string; refroes?: string[] }>(r1.texto);
  const refrao = (p1.refroes ?? []).map((s) => String(s).trim()).find(Boolean);
  if (!refrao) throw new Error("modelo não devolveu refrão");

  const r2 = await chamarClaude(`${base}\n\n${INSTRUCOES[locale].montar(refrao)}`, 4000, locale, MODEL);
  if (r2.stopReason === "max_tokens") throw new Error("Letra truncada pelo limite de tokens");
  const tituloPadrao = locale === "en" ? "Your song" : locale === "es" ? "Tu canción" : "Sua música";
  // JSON torto com a letra inteira: recupera campo a campo, como a tela faz.
  let p2: Partial<LetraGerada>;
  try {
    p2 = extrairJson<Partial<LetraGerada>>(r2.texto);
  } catch (errJson) {
    const recuperada = recuperarLetra(r2.texto, tituloPadrao);
    if (!recuperada) throw errJson;
    p2 = recuperada;
  }
  const letra = String(p2.letra ?? "").trim();
  if (letra.length < 200) throw new Error("letra curta demais");
  return {
    titulo: String(p2.titulo ?? p1.titulo ?? tituloPadrao),
    letra,
    estilo_suno: String(p2.estilo_suno ?? p1.estilo_suno ?? ""),
    verso_destaque: String(p2.verso_destaque ?? ""),
    usos: [
      { modelo: MODEL_CURTO, uso: r1.uso },
      { modelo: MODEL, uso: r2.uso },
    ],
  };
}
