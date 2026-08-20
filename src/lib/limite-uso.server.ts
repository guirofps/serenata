import { createHash } from "node:crypto";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// O TETO DE USO DOS ENDPOINTS QUE CUSTAM DINHEIRO.
//
// Server function é rota HTTP. As três da coautoria (`gerarRefroes`,
// `montarLetra`, `aprimorarLetra`) e o disparo da música não pedem conta nem
// senha — não podem mesmo pedir, o funil inteiro é anônimo de propósito —, e
// até aqui também não tinham teto nenhum. Quem descobrisse o endereço chamava
// à vontade: o Claude sai da nossa conta e cada música são R$ 0,32 no kie.ai.
//
// A contabilidade fica em `limites_uso` (migration 20260820000000). Ver lá o
// porquê de ser tabela e não memória, e o porquê do incremento atômico.
//
// ARQUIVO `.server.ts` E IMPORTADO DINAMICAMENTE, pela mesma razão de
// `admin-auth.server.ts`: ele puxa `node:crypto` e o contexto de requisição do
// TanStack, e `coautoria.ts` — que é quem chama — é importado por componente
// de tela. Import estático arrastaria os dois pro bundle do cliente e quebraria
// o build.
//
// ── DUAS CHAVES, E A SEGUNDA É QUE IMPORTA ──────────────────────
//
// Por SESSÃO segura o caso comum (laço numa aba, duplo-clique, script bobo).
// Não segura o atacante: `session_id` é gerado no navegador dele, então basta
// sortear um UUID novo a cada chamada.
//
// Por ORIGEM (IP) é a que aguenta peso. O teto é largo o bastante pra não
// pegar uma família no mesmo Wi-Fi nem um celular atrás de CGNAT da operadora
// — o alvo é o laço automatizado, não o dia movimentado.
//
// ── FALHA ABERTA, DE PROPÓSITO ──────────────────────────────────
//
// Se o banco não responde, a chamada PASSA. É a mesma escolha do resto do
// projeto (`temMusicaDaSessao`, `registrarCustoLetra`): soluço de banco não
// pode barrar venda. O risco que isso deixa em aberto — atacante que derruba
// a checagem pra escapar do teto — é menor que o risco de recusar a letra de
// quem está com o dedo no botão de comprar.

/** Uma hora. Todos os tetos daqui usam a mesma janela. */
const JANELA_S = 60 * 60;

export type Teto = {
  /** Prefixo da chave. Separa os contadores um do outro. */
  nome: string;
  /** Quantas chamadas a MESMA sessão pode fazer na janela. */
  porSessao: number;
  /** Quantas chamadas o mesmo IP pode fazer na janela. */
  porOrigem: number;
};

/**
 * A letra é construída em etapas e a pessoa pode voltar atrás: dois refrões,
 * montar, aprimorar, refazer. Um funil honesto usa entre 3 e 8 chamadas.
 * 24 dá folga de sobra pra quem é indeciso e ainda assim fecha a torneira.
 */
export const TETO_LETRA: Teto = { nome: "ia", porSessao: 24, porOrigem: 120 };

/**
 * Música é dinheiro saindo (R$ 0,32). O caminho normal gera UMA por sessão
 * (`finalizarLetra` é idempotente); o resto é refação de música que falhou.
 */
export const TETO_MUSICA: Teto = { nome: "musica", porSessao: 6, porOrigem: 40 };

/** Erro que a tela sabe distinguir de "o modelo falhou". */
export class LimiteEstourado extends Error {
  constructor() {
    super("limite-de-uso");
    this.name = "LimiteEstourado";
  }
}

/**
 * O IP de quem chamou, como a Vercel entrega.
 *
 * `x-forwarded-for` pode vir com uma lista ("cliente, proxy1, proxy2"); o
 * primeiro é o cliente. Na Vercel o cabeçalho é reescrito na borda, então não
 * dá pra forjar de fora — mas o `.split` continua sendo o certo a fazer.
 *
 * GUARDADO EM HASH, nunca em claro: o IP é dado pessoal (LGPD) e esta tabela
 * não tem por que virar registro de quem acessou de onde. O hash serve pra
 * contar, que é tudo que se precisa aqui.
 */
function chaveDaOrigem(): string | null {
  try {
    const bruto =
      getRequestHeader("x-forwarded-for") ??
      getRequestHeader("x-real-ip") ??
      getRequestHeader("cf-connecting-ip");
    const ip = String(bruto ?? "")
      .split(",")[0]
      ?.trim();
    if (!ip) return null;
    // O sal amarra o hash a esta instalação: sem ele, uma tabela vazada vira
    // uma lista de IPs recuperável por força bruta (o espaço do IPv4 inteiro
    // sai em segundos).
    const sal = process.env.ADMIN_SECRET ?? "sem-sal";
    return createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);
  } catch {
    // Fora de um contexto de requisição (teste, script). Sem origem, o teto
    // por sessão continua valendo.
    return null;
  }
}

async function cabe(chave: string, teto: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("consumir_limite", {
    p_chave: chave,
    p_janela_s: JANELA_S,
    p_teto: teto,
  });
  if (error) {
    // Inclui o caso "a migration ainda não rodou": a função não existe, o
    // erro volta, e a chamada passa. Ver "falha aberta" no topo.
    console.error("[limite] consumir_limite falhou:", error.message);
    return true;
  }
  return data !== false;
}

/**
 * Cobra uma chamada nos dois contadores. Lança `LimiteEstourado` quando
 * qualquer um dos dois estoura.
 *
 * Os dois são cobrados SEMPRE, mesmo quando o primeiro já reprovou: parar no
 * primeiro deixaria o contador de origem parado enquanto o atacante troca de
 * sessão a cada tentativa — justamente o movimento que o contador de origem
 * existe pra pegar.
 */
export async function cobrarUso(teto: Teto, sessionId: string): Promise<void> {
  const origem = chaveDaOrigem();
  const [cabeSessao, cabeOrigem] = await Promise.all([
    sessionId ? cabe(`${teto.nome}:${sessionId}`, teto.porSessao) : Promise.resolve(true),
    origem ? cabe(`${teto.nome}-ip:${origem}`, teto.porOrigem) : Promise.resolve(true),
  ]);
  if (!cabeSessao || !cabeOrigem) throw new LimiteEstourado();
}
