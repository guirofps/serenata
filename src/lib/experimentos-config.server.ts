import { EXPERIMENTOS, type ExperimentoConfig, type Variante } from "@/lib/experimentos";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A CONFIGURAÇÃO VIVA DOS EXPERIMENTOS.
//
// `.server.ts` de propósito: importa o cliente com service role, que nunca
// pode entrar no bundle do cliente.
//
// ── POR QUE UM SNAPSHOT E NÃO UMA CONSULTA POR REQUISIÇÃO ────────
//
// `scriptExperimentos()` e `cssExperimentos()` escrevem o <script> e o <style>
// que abrem o <head> de TODA página do site, antes do primeiro pixel, e são
// síncronas. Consultar o banco ali significaria +10 a 20ms em toda visita
// (inclusive a do anúncio, onde velocidade é dinheiro) e faria o Supabase
// virar dependência de o site abrir.
//
// O snapshot troca isso por até 60s de defasagem, que é a decisão registrada
// na spec.
//
// ── POR QUE `configAtual()` É SÍNCRONA E EXPORTADA ASSIM ──────────
//
// Fica assim de propósito pra Task 4 conseguir espelhar este mesmo snapshot
// em `window.__SRN_CFG__` no HTML renderizado no servidor: o `__root.tsx`
// (que roda dos dois lados) NUNCA pode importar este arquivo `.server.ts` —
// se importasse, o cliente leria a config de um lugar diferente do servidor
// e nasceria erro de hidratação em toda página, o defeito que a própria
// máquina de A/B existe pra evitar (ver o topo de `experimentos.ts`). Quem
// vai ler `configAtual()` aqui é sempre código de servidor (loader de rota,
// a própria injeção do `<script>`); o espelho pro cliente é responsabilidade
// de outro módulo, isomórfico, que a Task 4 escreve.

const VALIDADE_MS = 60_000;

/** O que vale quando o banco não respondeu ainda. Tudo desligado. */
function doCodigo(): ExperimentoConfig[] {
  return EXPERIMENTOS.map((e) => ({
    id: e.id,
    ativo: false, // NUNCA true no fallback. Ver restrições globais do plano.
    exposicaoPct: 100,
    nota: e.nota,
    variantes: e.variantes.map((nome, i) => ({ nome, peso: e.peso?.[i] ?? 1 })),
  }));
}

let snapshot: ExperimentoConfig[] | null = null;
let lidoEm = 0;
let emVoo: Promise<void> | null = null;

/** Lê do banco, sem cache. O painel usa isto: quem edita não vê estado velho. */
export async function lerConfigFresca(): Promise<ExperimentoConfig[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("experimentos")
    .select("id, ativo, exposicao_pct, nota, variantes")
    .order("id");
  if (error) throw new Error(`config de experimentos: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    ativo: Boolean(r.ativo),
    exposicaoPct: Number(r.exposicao_pct ?? 100),
    nota: String(r.nota ?? ""),
    variantes: Array.isArray(r.variantes) ? (r.variantes as Variante[]) : [],
  }));
}

async function recarregar(): Promise<void> {
  try {
    const nova = await lerConfigFresca();
    snapshot = nova;
    lidoEm = Date.now();
  } catch (err) {
    // Falhou: o snapshot antigo continua valendo. Ficar sem config seria
    // tirar gente do teste em silêncio, que é pior que dado com 5 min.
    console.error("[experimentos] config não recarregada:", err);
    // Marca a tentativa mesmo assim, pra não martelar o banco a cada visita
    // enquanto ele estiver fora.
    lidoEm = Date.now();
  } finally {
    emVoo = null;
  }
}

/**
 * Garante que existe snapshot. Chamada pelo middleware, antes do render.
 *
 * Espera SÓ na instância fria. Depois disso, uma config velha é devolvida na
 * hora e a releitura acontece por trás — ninguém fica esperando por config.
 */
export async function garantirConfig(): Promise<void> {
  if (!snapshot) {
    emVoo = emVoo ?? recarregar();
    await emVoo;
    return;
  }
  if (Date.now() - lidoEm > VALIDADE_MS) {
    emVoo = emVoo ?? recarregar();
    // sem await: stale-while-revalidate
  }
}

/** O snapshot. Síncrona de propósito — é o que o <head> chama. */
export function configAtual(): ExperimentoConfig[] {
  return snapshot ?? doCodigo();
}

/** Depois de salvar no painel: a próxima visita já lê o novo. */
export function invalidarConfig(): void {
  lidoEm = 0;
}
