import type { SupabaseClient } from "@supabase/supabase-js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";

// O DISJUNTOR DE GASTO DO SUNO.
//
// O problema que ele resolve: a música é gerada ANTES do pagamento (regra de
// ouro do CLAUDE.md, e ela está certa), e o gatilho é uma rota HTTP anônima.
// Quem quiser queimar dinheiro nosso só precisa terminar o quiz muitas vezes —
// R$ 0,32 por vez, e nada no caminho dizia "chega".
//
// Os tetos por sessão e por IP (`src/lib/limite-uso.server.ts`) encarecem o
// ataque e não o impedem: o `sessionId` é escolhido pelo cliente, e IP se troca
// com proxy. Este aqui é diferente — ele não tenta identificar quem está
// abusando, ele limita QUANTO se perde. É a última linha, e é a única que
// nenhum truque do lado do cliente contorna, porque roda dentro do job.
//
// ── PAGO NÃO PASSA POR AQUI ─────────────────────────────────────
//
// A trava mais importante deste arquivo é a que ele NÃO aplica. Se o disjuntor
// valesse pra quem já pagou, um dia de abuso viraria um dia de comprador sem
// entrega — trocaríamos um prejuízo de R$ 96 por reembolso, ticket de suporte
// e avaliação ruim, que é exatamente o que a regra de ouro existe pra evitar.
//
// Pelo mesmo motivo, geração paga também NÃO consome o contador. Se
// consumisse, um dia de muitas vendas gastaria o orçamento e o disjuntor
// desligaria o funil justo no dia bom. O que este teto mede é o gasto que
// ainda não virou receita.
//
// ── O NÚMERO ────────────────────────────────────────────────────
//
// Padrão 300/dia. A operação real gera 119/dia (medido em 13/08, ver
// `vigiarSaldo.ts`), então são 2,5x de folga — cabe crescer o dobro sem
// encostar. Com ele, o pior dia possível custa ~R$ 96 em vez de ilimitado.
// Ajustável por env sem deploy: `TETO_MUSICAS_DIA`.

const TETO_PADRAO = 300;
/** Janela larga: quem separa um dia do outro é a CHAVE, não a janela. */
const JANELA_S = 60 * 60 * 48;

/** A chave em `config_operacao`. Mesma string que o painel escreve. */
export const CHAVE_TETO = "teto_musicas_dia";

/**
 * O teto de hoje, na ordem BANCO > ENV > PADRÃO.
 *
 * O banco vem primeiro porque é o único dos três que o dono alcança do
 * celular, e a hora de mexer neste número é a hora em que o disjuntor acabou
 * de desligar o funil.
 *
 * A env FICA como segundo lugar, e não como lixo do passado: se o banco
 * responder errado ou a tabela sumir, ela é a saída de emergência que não
 * depende de nada além de um redeploy.
 */
export async function tetoDoDia(sb: SupabaseClient): Promise<number> {
  try {
    const { data } = await sb
      .from("config_operacao")
      .select("valor")
      .eq("chave", CHAVE_TETO)
      .maybeSingle();
    const n = Number(data?.valor);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  } catch (err) {
    console.error("[disjuntor] teto do banco não lido; caindo pra env:", err);
  }
  const n = Number(process.env.TETO_MUSICAS_DIA);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : TETO_PADRAO;
}

/** A chave do contador do dia. Exportada pra o painel poder ler o consumo. */
export function chaveDoDia(): string {
  return `musica-dia:${diaBr()}`;
}

/** O dia no fuso do Brasil (UTC-3). Em UTC, o teto viraria às 21h. */
function diaBr(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

async function cabe(sb: SupabaseClient, chave: string, teto: number): Promise<boolean> {
  const { data, error } = await sb.rpc("consumir_limite", {
    p_chave: chave,
    p_janela_s: JANELA_S,
    p_teto: teto,
  });
  if (error) {
    // FALHA ABERTA, e o log é gritado de propósito: este caminho inclui "a
    // migration 20260820000000 ainda não rodou", e nesse caso o disjuntor não
    // está protegendo nada. Melhor gerar música demais que parar de entregar
    // por causa de um soluço do banco — mas é preciso que apareça.
    console.error("[disjuntor] TETO NÃO CONFERIDO (limite não pôde ser lido):", error.message);
    return true;
  }
  return data !== false;
}

async function avisarUmaVezPorDia(sb: SupabaseClient, teto: number): Promise<void> {
  try {
    // O próprio contador serve de trava do aviso: teto 1 na chave do dia, e só
    // a primeira chamada passa. Sem isto, um ataque em curso viraria um e-mail
    // por música bloqueada.
    const primeira = await cabe(sb, `alerta-teto-musica:${diaBr()}`, 1);
    if (!primeira) return;

    await avisarDonos({
      assunto: `🔌 Disjuntor ligou: ${teto} músicas hoje, parei de gerar pra quem não pagou`,
      html:
        `<p><strong>O teto diário de geração foi atingido: ${teto} músicas.</strong></p>` +
        `<p>A partir de agora, e até a virada do dia, o funil PAROU de gerar música ` +
        `pra quem ainda não pagou. Quem paga continua recebendo normalmente — ` +
        `o webhook refaz a música na hora da compra.</p>` +
        `<p>Duas causas possíveis, e elas pedem coisas opostas:</p>` +
        `<ul>` +
        `<li><strong>Dia bom de verdade</strong> (subiu tráfego, campanha nova): o teto está ` +
        `apertado. Suba <code>TETO_MUSICAS_DIA</code> na Vercel — não precisa de deploy.</li>` +
        `<li><strong>Abuso</strong>: alguém rodando o funil em laço. Abra o painel e olhe ` +
        `quantas dessas sessões viraram lead de verdade. Se for laço, o teto fez o trabalho dele.</li>` +
        `</ul>` +
        `<p>Pra decidir qual é: no painel, compare as músicas geradas hoje com os leads ` +
        `com e-mail. Operação normal roda perto de 119 músicas/dia.</p>`,
    });
  } catch (err) {
    // Aviso nunca derruba o job.
    console.error("[disjuntor] aviso falhou:", err);
  }
}

/**
 * O AVISO DE 80%, uma vez por dia.
 *
 * Falha em silêncio de propósito: um aviso que derruba a geração é pior que
 * aviso nenhum.
 */
async function avisarPerto(sb: SupabaseClient, teto: number): Promise<void> {
  try {
    const alerta = Math.floor(teto * 0.8);
    if (alerta < 1) return;
    // Enquanto couber nos 80%, não há o que avisar.
    if (await cabe(sb, `perto-teto-musica:${diaBr()}`, alerta)) return;
    // Cruzou. A trava do e-mail é a mesma dos outros: contador de teto 1.
    if (!(await cabe(sb, `alerta-perto-musica:${diaBr()}`, 1))) return;

    await avisarDonos({
      assunto: `⚠️ 80% do teto de músicas usado hoje (${alerta} de ${teto})`,
      html:
        `<p><strong>Já foram ${alerta} das ${teto} músicas do dia.</strong> ` +
        `Ainda está gerando normal, mas no ritmo de hoje o disjuntor desarma antes ` +
        `da virada.</p>` +
        `<p>Quando desarmar, quem pagar continua recebendo (o webhook refaz na hora), ` +
        `mas passa a esperar uns 90 segundos em vez de receber pronto — e a regra de ` +
        `nunca cobrar por algo que ainda não existe fica invertida.</p>` +
        `<p>Se o dia está bom de verdade, suba o teto agora, no painel ou em ` +
        `<code>TETO_MUSICAS_DIA</code> na Vercel. Não precisa de deploy e vale na hora.</p>`,
    });
  } catch (err) {
    console.error("[disjuntor] aviso de 80% falhou:", err);
  }
}

/** A marca "esta música já foi contada hoje". */
export function chaveDaMusicaNoDia(musicaId: string): string {
  return `musica-contada:${diaBr()}:${musicaId}`;
}

/**
 * Esta música já consumiu o orçamento de hoje?
 *
 * LÊ sem somar, de propósito: o `consumir_limite` soma ao perguntar, e uma
 * marca consumida numa execução que o teto BARROU deixaria a música passar de
 * graça no redisparo seguinte. A marca só nasce depois que o contador do dia
 * aceitou (ver `podeGerar`).
 *
 * Na dúvida, responde "não": contar duas vezes custa um pouco de folga do
 * teto; não contar abriria uma porta pra gasto sem limite.
 */
async function jaContadaHoje(sb: SupabaseClient, musicaId: string): Promise<boolean> {
  try {
    const { data, error } = await sb
      .from("limites_uso")
      .select("contagem")
      .eq("chave", chaveDaMusicaNoDia(musicaId))
      .maybeSingle();
    if (error) return false;
    return Number(data?.contagem) > 0;
  } catch {
    return false;
  }
}

/**
 * Esta música pode gastar crédito do Suno agora?
 *
 * Chamada UMA vez por execução, imediatamente antes do primeiro gasto.
 *
 * ── CONTA MÚSICA, NÃO EXECUÇÃO (08/10) ──────────────────────────
 *
 * Até aqui cada execução cobrava o contador, e a mesma música pode rodar
 * várias vezes no dia: o vigia redispara a parada, a repescagem volta na que
 * falhou por timeout, o clique de comprar refaz a falhada. Em 02/10 o
 * contador marcou 3.609 pra 2.498 músicas, e 37 leads foram barrados por um
 * orçamento que estava, na verdade, sobrando.
 *
 * Com `musicaId`, a música é contada UMA vez por dia: a primeira execução que
 * passa marca a música, e as seguintes do mesmo dia passam sem somar. O teto
 * continua medindo o que ele foi feito pra medir, quantas músicas de quem não
 * pagou saíram hoje. As retentativas DENTRO de uma execução (o estilo limpo,
 * a segunda chance) sempre estiveram fora da conta; agora os redisparos
 * também.
 */
export async function podeGerar(
  sb: SupabaseClient,
  quizResponseId: string | null,
  musicaId?: string | null,
): Promise<{ ok: true } | { ok: false; teto: number }> {
  const teto = await tetoDoDia(sb);

  // ── 1. Já pagou? Então nem pergunta. ──
  if (quizResponseId) {
    try {
      const { data: pago } = await sb
        .from("pedidos")
        .select("id")
        .eq("quiz_response_id", quizResponseId)
        .eq("status", "pago")
        .limit(1)
        .maybeSingle();
      if (pago) return { ok: true };
    } catch (err) {
      // Não deu pra saber se pagou. Na dúvida, ENTREGA: o custo de errar pra
      // este lado é R$ 0,32; pro outro é um comprador sem o presente.
      console.error("[disjuntor] status de pagamento não lido; liberando:", err);
      return { ok: true };
    }
  }

  // ── 2. Esta música já foi contada hoje? Então já está dentro do teto. ──
  if (musicaId && (await jaContadaHoje(sb, musicaId))) return { ok: true };

  // ── 3. Ainda cabe no dia? ──
  if (await cabe(sb, chaveDoDia(), teto)) {
    // Marca DEPOIS de caber: música barrada não leva marca, e o redisparo
    // dela é conferido de novo contra o teto (que o dono pode ter subido).
    // Marca que não grava só faz a música ser contada de novo, o lado seguro.
    if (musicaId) await cabe(sb, chaveDaMusicaNoDia(musicaId), 1);
    // O AVISO CHEGA ANTES DE MORDER.
    //
    // Em 21/08 o teto desarmou às 13:11 e o dono descobriu pelo funil, não
    // pelo e-mail: o alerta existia, mas só saía DEPOIS que a geração já
    // estava bloqueada, e a essa altura o estrago do dia já está feito.
    //
    // Este aqui avisa aos 80%, que é quando ainda dá pra subir o teto sem
    // ninguém sentir. O truque é um SEGUNDO contador com teto menor: ele
    // incrementa junto com o principal, então o instante em que ele recusa é
    // exatamente o instante em que 80% foram usados.
    await avisarPerto(sb, teto);
    return { ok: true };
  }

  await avisarUmaVezPorDia(sb, teto);
  return { ok: false, teto };
}
