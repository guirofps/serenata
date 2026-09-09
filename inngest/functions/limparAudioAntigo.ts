import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";

// APAGA O ÁUDIO DE QUEM NUNCA COMPROU, e só ele.
//
// ── O NÚMERO QUE JUSTIFICA ───────────────────────────────────────
//
// Medido em 09/09/2026, depois do aviso de Fair Use do Supabase:
//
//   de quem COMPROU .......   2.477 músicas    21,3 GB   13,6%
//   de quem NÃO comprou ...  15.720 músicas   135,4 GB   86,4%
//
// São 595 músicas novas por dia contra ~190 vendas: dois terços do que a
// gente gera e guarda é de gente que passou e não voltou. O bucket engorda
// **5,2 GB por dia**, sem teto.
//
// A regra de ouro do projeto manda GERAR antes de cobrar, e ela continua de
// pé: R$ 0,32 de prejuízo pré-venda compra a eliminação de reembolso e
// avaliação ruim. Mas ela fala de gerar, não de guardar para sempre.
//
// ── OS DOIS PRAZOS, E POR QUE NÃO É UM SÓ ────────────────────────
//
// Quanto tempo depois da música a pessoa compra, medido em 2.507 compras:
//
//   mediana ............ 6 minutos
//   99% compram até .... 5,2 dias
//   o mais demorado .... 18,4 dias
//
// Isso sozinho autorizaria apagar tudo aos 20 dias. Mas há uma segunda
// trava, que é uma PROMESSA e não uma estatística: o `sequenciaRecuperacao`
// manda e-mail até **45 dias** dizendo "sua música está gravada aqui,
// esperando". Apagar antes disso faz a gente mentir para o cliente.
//
// Daí dois estágios, cada um preso à sua trava:
//
//   V2 aos 20 dias   Nada antes da compra toca a segunda gravação. O
//                    karaokê recebe UMA url (`tocavel` em
//                    MusicaDaSessao.tsx:139) e as telas de recuperação
//                    apenas ASSINAM a v2 sem buscar os bytes. Assinar é de
//                    graça. E 20 dias passa do recordista de 18,4.
//
//   V1 aos 50 dias   Depois do último e-mail da régua (45 dias), com folga.
//
// ── O QUE NUNCA É APAGADO ────────────────────────────────────────
//
// Letra, título, token e a linha inteira ficam. Quem voltar depois abre a
// página, lê a própria letra e pode gerar de novo por R$ 0,32 — em vez de
// encontrar um vazio. E comprador nunca entra aqui, em nenhum prazo: a
// música que ele pagou é dele para sempre.
//
// O código já aguenta áudio ausente sem quebrar: `carregarPresente` só
// assina quando o caminho existe (`presente.ts:97`) e a página só monta o
// player quando há url (`p.$token.tsx:411`). Falha fechada, tela sem som,
// nunca erro.
//
// ── COMEÇA DESLIGADO ─────────────────────────────────────────────
//
// `LIMPAR_AUDIO_ATIVO=1` liga. Sem isso ele roda em SECO: conta, escreve no
// log o que faria, e não apaga nada. É deleção de arquivo do cliente, não
// estreia em produção sem alguém ler o número primeiro.

const V2_DIAS = 20;
const V1_DIAS = 50;
/**
 * Teto por rodada, dimensionado pelo REGIME PERMANENTE e não pela fila
 * inicial. São ~400 músicas por dia que não viram compra, então ~400 v2
 * vencem por dia. A primeira versão disto usava 200 numa rodada diária, e o
 * ensaio mostrou o erro: a fila cresceria mais rápido que a drenagem.
 *
 * 500 por rodada, de 6 em 6 horas, dá 2.000/dia. Cobre os 400 do regime com
 * folga de 5x e ainda drena o represamento inicial (3.312 arquivos) em dois
 * dias.
 */
const MAX_POR_RODADA = 500;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Todo quiz que tem pedido pago. Comprador nunca perde áudio. */
async function quizzesQueCompraram(sb: ReturnType<typeof db>): Promise<Set<string>> {
  const pagos = new Set<string>();
  for (let i = 0; i < 200000; i += 1000) {
    const { data, error } = await sb.from("pedidos").select("quiz_response_id")
      .eq("status", "pago").not("dinheiro_entrou", "is", false)
      .order("created_at").range(i, i + 999);
    if (error) throw new Error("pedidos: " + error.message);
    for (const p of data ?? []) if (p.quiz_response_id) pagos.add(p.quiz_response_id);
    if ((data ?? []).length < 1000) break;
  }
  return pagos;
}

export const limparAudioAntigo = inngest.createFunction(
  {
    id: "limpar-audio-antigo",
    retries: 1,
    // De 6 em 6 horas. Ver `MAX_POR_RODADA`: uma rodada diária não acompanha
    // o ritmo de vencimento. Minuto 20 pra não cair no minuto cheio junto
    // com os outros crons.
    triggers: [{ cron: "20 */6 * * *" }],
  },
  async ({ step }) => {
    const seco = process.env.LIMPAR_AUDIO_ATIVO !== "1";

    const alvos = await step.run("achar-audio-vencido", async () => {
      const sb = db();
      const pagos = await quizzesQueCompraram(sb);
      const agora = Date.now();

      const musicas: Array<{
        id: string; quiz_response_id: string | null; created_at: string;
        audio_path: string | null; audio_path_v2: string | null;
      }> = [];
      for (let i = 0; i < 200000; i += 1000) {
        const { data, error } = await sb.from("musicas")
          .select("id, quiz_response_id, created_at, audio_path, audio_path_v2")
          .eq("status", "pronta")
          .lte("created_at", new Date(agora - V2_DIAS * 86400000).toISOString())
          .order("created_at").range(i, i + 999);
        if (error) throw new Error("musicas: " + error.message);
        musicas.push(...(data ?? []));
        if ((data ?? []).length < 1000) break;
      }

      const idade = (c: string) => (agora - Date.parse(c)) / 86400000;
      const fila: Array<{ id: string; caminhos: string[]; campos: string[]; dias: number }> = [];

      for (const m of musicas) {
        if (fila.length >= MAX_POR_RODADA) break;
        // COMPRADOR NUNCA. A checagem é por quiz porque é assim que pedido e
        // música se ligam; sem `quiz_response_id` não dá pra provar que NÃO
        // comprou, então o registro fica.
        if (!m.quiz_response_id || pagos.has(m.quiz_response_id)) continue;

        const dias = idade(m.created_at);
        const caminhos: string[] = [];
        const campos: string[] = [];
        if (dias > V1_DIAS && m.audio_path) { caminhos.push(m.audio_path); campos.push("audio_path"); }
        if (dias > V2_DIAS && m.audio_path_v2) { caminhos.push(m.audio_path_v2); campos.push("audio_path_v2"); }
        if (caminhos.length) fila.push({ id: m.id, caminhos, campos, dias });
      }
      return fila;
    });

    if (!alvos.length) return { seco, apagados: 0, motivo: "nada vencido" };

    const arquivos = alvos.reduce((s, a) => s + a.caminhos.length, 0);
    if (seco) {
      console.log(`[limpar-audio] SECO: apagaria ${arquivos} arquivo(s) de ${alvos.length} musica(s).`
        + ` Mais antiga: ${Math.round(Math.max(...alvos.map((a) => a.dias)))} dias.`
        + ` Ligue com LIMPAR_AUDIO_ATIVO=1.`);
      return { seco: true, apagariaArquivos: arquivos, apagariaMusicas: alvos.length };
    }

    let apagados = 0;
    for (const a of alvos) {
      await step.run(`apagar-${a.id}`, async () => {
        const sb = db();
        // Storage PRIMEIRO. Se o banco fosse primeiro e o storage falhasse,
        // ficaria arquivo órfão que ninguém mais encontra pra apagar.
        const { error } = await sb.storage.from("musicas").remove(a.caminhos);
        if (error) throw new Error(`storage ${a.id}: ${error.message}`);
        // Anula só os campos que foram apagados de verdade.
        const patch: Record<string, null> = {};
        for (const c of a.campos) patch[c] = null;
        await sb.from("musicas").update(patch).eq("id", a.id);
        apagados += a.caminhos.length;
      });
    }

    console.log(`[limpar-audio] ${apagados} arquivo(s) apagados de ${alvos.length} musica(s) sem compra.`);
    return { seco: false, apagados, musicas: alvos.length };
  },
);
