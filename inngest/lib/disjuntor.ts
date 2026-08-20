import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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
const PARA = "guilhermerojasiqueira@gmail.com";

function tetoDoDia(): number {
  const n = Number(process.env.TETO_MUSICAS_DIA);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : TETO_PADRAO;
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

    const chave = process.env.RESEND_API_KEY;
    if (!chave) return;
    await new Resend(chave).emails.send({
      from: "Serenata <contato@serenatagift.com>",
      to: [PARA],
      subject: `🔌 Disjuntor ligou: ${teto} músicas hoje, parei de gerar pra quem não pagou`,
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
 * Esta música pode gastar crédito do Suno agora?
 *
 * Chamada UMA vez por geração, imediatamente antes do primeiro gasto.
 */
export async function podeGerar(
  sb: SupabaseClient,
  quizResponseId: string | null,
): Promise<{ ok: true } | { ok: false; teto: number }> {
  const teto = tetoDoDia();

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

  // ── 2. Ainda cabe no dia? ──
  if (await cabe(sb, `musica-dia:${diaBr()}`, teto)) return { ok: true };

  await avisarUmaVezPorDia(sb, teto);
  return { ok: false, teto };
}
