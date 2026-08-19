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

/**
 * O prazo da leitura no CAMINHO DO RENDER.
 *
 * O cliente do Supabase usa `fetch` sem deadline nenhum: sem isto, um
 * Supabase lento (não fora do ar — LENTO, que é o caso comum e o que não
 * dispara alarme nenhum) segura o primeiro render de TODA página até o
 * timeout da própria plataforma. E o site tem fallback pra config ausente
 * justamente pra não precisar esperar: 1,5s já é mais do que o banco leva
 * quando está bem, e desistir aqui custa no máximo 60s de config velha.
 */
const TIMEOUT_RENDER_MS = 1_500;

/**
 * O prazo de quem está EDITANDO no painel.
 *
 * Bem maior de propósito: aqui tem gente esperando na frente da tela, e uma
 * config que não carregou é melhor que uma que carregou pela metade — o
 * painel não tem fallback nenhum pra cair, ele mostra o erro. Desistir em
 * 1,5s só produziria "Config não carregou" num dia de banco lento.
 */
export const TIMEOUT_PAINEL_MS = 15_000;

// `carregouUmaVez` é o "instância fria?" desta tarefa — não dá pra perguntar
// isso olhando o snapshot em `experimentos.ts`, porque ele é privado de
// propósito (só `configAtual()` e `definirConfigDoServidor()` mexem nele; ver
// o comentário lá sobre por quê). Junto com `lidoEm`, os dois reproduzem
// exatamente o relógio que existia aqui antes de o snapshot se mudar.
let carregouUmaVez = false;
let lidoEm = 0;
let emVoo: Promise<void> | null = null;

/** SÓ PARA TESTE: devolve o relógio ao estado de instância recém-nascida. */
export function _resetRelogioParaTeste(): void {
  carregouUmaVez = false;
  lidoEm = 0;
  emVoo = null;
}

/**
 * Lê do banco, sem cache. O painel usa isto: quem edita não vê estado velho.
 *
 * `timeoutMs` existe porque os dois chamadores têm pressa oposta — ver
 * `TIMEOUT_RENDER_MS` e `TIMEOUT_PAINEL_MS`. O padrão é o do render, que é o
 * caminho onde esperar custa caro; quem pode esperar pede mais tempo
 * explicitamente.
 */
export async function lerConfigFresca(
  timeoutMs: number = TIMEOUT_RENDER_MS,
): Promise<ExperimentoConfig[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("experimentos")
    .select("id, ativo, exposicao_pct, nota, variantes")
    .order("id")
    .abortSignal(AbortSignal.timeout(timeoutMs));
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
    // TENTATIVA FEITA, mesmo tendo falhado — os dois marcadores, não só um.
    //
    // `lidoEm` sozinho era código morto exatamente na falha pra qual foi
    // escrito: ele só é lido no ramo QUENTE de `garantirConfig`, e sem
    // `carregouUmaVez` a instância nunca saía do ramo frio. O resultado era o
    // oposto do que o comentário prometia — enquanto a tabela não existisse
    // (deploy antes da migration) ou o Supabase estivesse fora, TODA
    // requisição fazia `await` de uma consulta condenada, e a primeira tela
    // de cada visitante esperava por ela. Marcar aqui é o que faz o relógio
    // de 60s passar a governar as retentativas e o fallback do código
    // (`configDoCodigo`, tudo desligado) valer de verdade.
    carregouUmaVez = true;
    lidoEm = Date.now();
  } finally {
    emVoo = null;
  }
}

/**
 * Garante que existe snapshot. Chamada pelo middleware, antes do render.
 *
 * Espera SÓ na instância fria — e "fria" quer dizer "ainda não TENTOU ler",
 * não "ainda não conseguiu": uma tentativa que falhou também esquenta a
 * instância (ver o `catch` de `recarregar`). Sem isso, banco fora do ar
 * transformava esta espera de uma-vez-só em toda-requisição, que é o oposto
 * de degradar.
 *
 * Depois disso, uma config velha é devolvida na hora e a releitura acontece
 * por trás — ninguém fica esperando por config.
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
 *
 * E isso é só a história de UMA instância. `lidoEm`/`snapshotDoServidor` são
 * variáveis de MÓDULO — em produção (Vercel), cada lambda tem a sua cópia,
 * sem nada em comum entre elas. `invalidarConfig()` zera o relógio só do
 * processo que atendeu o `salvarExperimento`; as outras lambdas (que
 * atenderam outras visitas, ou vão atender a próxima) nem sabem que isto
 * rodou, e continuam servindo o snapshot antigo até a PRÓPRIA janela de 60s
 * de cada uma vencer. Ou seja: mesmo pra quem não é o dono salvando, a
 * defasagem real depois de um save pode chegar aos 60s inteiros — é o
 * mesmo `VALIDADE_MS` de sempre, só que sem atalho nenhum pra encurtá-lo.
 */
export function invalidarConfig(): void {
  lidoEm = 0;
}
