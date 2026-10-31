// PODE MANDAR MAIS UM E-MAIL DE MARKETING PRA ESTE ENDEREÇO? A conta mora em
// `src/lib/limite-frequencia.ts`; aqui é só a leitura.
//
// ── VALE PRA TODOS DESDE 31/10 ───────────────────────────────────
//
// O teste `limite_frequencia` empatou na venda (R$ 5,45 × R$ 5,44 por lead, ~8.500
// leads por braço), e o B manda menos e-mail: o teto virou regra (dono). Fora do
// português, e na Ballad, continua sem teto.
//
// ── NA DÚVIDA, NÃO MANDA ─────────────────────────────────────────
//
// Consulta que falha devolve `false`. Quem chama é régua de marketing, e o
// custo de não mandar NESTA rodada é a rodada seguinte mandar (nenhuma das
// réguas grava trava antes de passar por aqui). O mesmo raciocínio das travas
// de "já mandei" depois do incidente de 04/10.
//
// ── A JANELA PELO ÍNDICE DE TEMPO ────────────────────────────────
//
// `emails_enviados` tem índice em `created_at` e em `(lower(para),
// created_at)`. O PostgREST não filtra por `lower(para)`, então a consulta
// entra pela janela de 24h (`created_at`, alguns milhares de linhas no máximo)
// e filtra o endereço com `ilike` literal; a igualdade é conferida em JS,
// como no `jaComprou`.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JANELA_FREQUENCIA_MS,
  cabeMaisUmMarketing,
  type EnvioRecente,
} from "../../src/lib/limite-frequencia.js";
import { literalLike } from "../../src/lib/sql-like.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";

export async function podeMandarMarketing(
  sb: SupabaseClient,
  email: string,
  quizId: string | null | undefined,
  opcoes: { locale?: string | null } = {},
): Promise<boolean> {
  if (MARCA_ATIVA.chave === "ballad") return true;
  if ((opcoes.locale ?? "pt") !== "pt") return true;

  const alvo = email.trim().toLowerCase();
  if (!alvo) return false;
  const agora = Date.now();
  try {
    const { data, error } = await sb
      .from("emails_enviados")
      .select("template, created_at, para")
      .gte("created_at", new Date(agora - JANELA_FREQUENCIA_MS).toISOString())
      .ilike("para", literalLike(alvo))
      .limit(50);
    if (error) {
      console.error("[frequencia] janela ilegível, sem marketing nesta rodada:", alvo, error.message);
      return false;
    }
    const linhas = ((data ?? []) as Array<EnvioRecente & { para: string | null }>).filter(
      (l) => String(l.para ?? "").trim().toLowerCase() === alvo,
    );
    const pode = cabeMaisUmMarketing(linhas, agora);
    if (!pode) console.log("[frequencia] teto de 24h, fica pra depois:", alvo);
    return pode;
  } catch (err) {
    console.error("[frequencia] janela ilegível, sem marketing nesta rodada:", alvo, err);
    return false;
  }
}
