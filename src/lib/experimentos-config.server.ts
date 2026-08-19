import { definirConfigDoServidor, type ExperimentoConfig, type Variante } from "@/lib/experimentos";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A LEITURA DO BANCO, E SÓ ELA.
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
// ── ONDE MORA O SNAPSHOT, E POR QUE NÃO É AQUI ────────────────────
//
// Este arquivo NÃO guarda a config viva. Quem guarda é `experimentos.ts`,
// isomórfica (`configAtual()`, `definirConfigDoServidor()`) — porque quem lê o
// snapshot é `RootShell` (`__root.tsx`), e `RootShell` renderiza no servidor E
// hidrata no cliente. Se `configAtual()` morasse aqui, `__root.tsx` teria que
// importar este `.server.ts` pra chamá-la, e aí o BUILD DO CLIENTE ganharia
// este arquivo (e o `supabaseAdmin` que ele importa) dentro do bundle que vai
// pro navegador. Pior ainda: o cliente e o servidor leriam config de lugares
// diferentes, e o <script>/<style> que saem no <head> divergiriam entre o
// HTML que o servidor mandou e o que o React monta ao hidratar — erro de
// hidratação em TODA página, o defeito que a máquina de A/B inteira existe
// pra não ter (ver o topo de `experimentos.ts`).
//
// Este arquivo faz só duas coisas: lê o banco (`lerConfigFresca`) e mantém o
// relógio de validade do snapshot (`garantirConfig`, `invalidarConfig`) — o
// snapshot em si é escrito do lado de lá, via `definirConfigDoServidor`.

const VALIDADE_MS = 60_000;

// `carregouUmaVez` é o "instância fria?" desta tarefa — não dá pra perguntar
// isso olhando o snapshot em `experimentos.ts`, porque ele é privado de
// propósito (só `configAtual()` e `definirConfigDoServidor()` mexem nele; ver
// o comentário lá sobre por quê). Junto com `lidoEm`, os dois reproduzem
// exatamente o relógio que existia aqui antes de o snapshot se mudar.
let carregouUmaVez = false;
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
    definirConfigDoServidor(nova);
    carregouUmaVez = true;
    lidoEm = Date.now();
  } catch (err) {
    // Falhou: NÃO chama `definirConfigDoServidor`, então o snapshot antigo
    // (ou o fallback do código, se nunca chegou a existir um) continua
    // valendo. Ficar sem config seria tirar gente do teste em silêncio, que é
    // pior que dado com até 5 min de atraso.
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
  if (!carregouUmaVez) {
    emVoo = emVoo ?? recarregar();
    await emVoo;
    return;
  }
  if (Date.now() - lidoEm > VALIDADE_MS) {
    emVoo = emVoo ?? recarregar();
    // sem await: stale-while-revalidate
  }
}

/**
 * Depois de salvar no painel: derruba a validade do snapshot.
 *
 * NÃO faz a próxima visita ler o novo. `garantirConfig` é stale-while-
 * revalidate (ver o comentário dela): zerar `lidoEm` só faz a visita
 * SEGUINTE disparar `recarregar()` por trás, sem esperar por ela — quem
 * gerou essa visita ainda recebe o snapshot ANTIGO na hora, igual a qualquer
 * outra visita que cai fora da janela de validade. O dono salvando e abrindo
 * a página em seguida pode ver o preço velho por mais uma carga. Quem
 * precisa do dado fresco na hora é o painel, e o painel não passa por aqui:
 * ele chama `lerConfigFresca()` direto, sem cache nenhum.
 */
export function invalidarConfig(): void {
  lidoEm = 0;
}
