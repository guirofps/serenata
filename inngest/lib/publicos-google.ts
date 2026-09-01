import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// AS LISTAS DE PÚBLICO NO GOOGLE, MONTADAS DO NOSSO BANCO.
//
// ── POR QUE CUSTOMER MATCH, E NÃO LISTA POR REGRA ────────────────
//
// Lista por regra é o caminho normal, e aqui ela não alcança nada do que
// interessa. Os três públicos abaixo dependem de coisas que a TAG do Google
// nunca viu:
//
//   - `checkout_click` é evento NOSSO, gravado em `funnel_events`.
//   - As ações `GAds - begin_checkout` e `GAds - add_to_cart` existem na conta
//     e marcam ZERO: aquelas tags não disparam.
//   - Clicar em comprar não muda a URL. A folha de PIX abre na mesma página,
//     então nem regra de endereço pega.
//
// Customer Match resolve porque a definição do público é nossa: sai de
// `pedidos`, `musicas` e `quiz_responses`, que é onde a verdade mora.
//
// ── AS DEFINIÇÕES, E POR QUE PEDIDO E NÃO CLIQUE ─────────────────
//
// `pedidos` com status `pendente` é gente que clicou em comprar E gerou o
// código de PIX. É sinal mais forte que o clique: 70% de quem clica nem chega
// a gerar pedido. Mais forte e menor, e o menor cobrou o preço: em 90 dias
// são ~712 pessoas, abaixo do mínimo de 1.000 que o Google exige pra mirar.
// A lista é criada assim mesmo, a pedido do dono, pra já ir acumulando: ela
// cresce ~8/dia e cruza o mínimo sozinha em umas cinco semanas.
//
// ── O E-MAIL CRU NUNCA SAI DAQUI ─────────────────────────────────
//
// Sobe SHA-256. A normalização que o Customer Match exige (minúscula, sem
// espaço nas pontas) acontece ANTES do hash — se acontecesse depois, o mesmo
// endereço geraria hash diferente e não casaria com ninguém do lado deles.
//
// ── COMPRADOR SAI DAS OUTRAS DUAS, SEMPRE ────────────────────────
//
// Toda rodada manda `remove` dos compradores nas duas listas de não
// compradores. Sem isso, quem abandonou e depois comprou continuaria sendo
// perseguido por anúncio pago — que é exatamente o defeito que a conta já tem
// ao mirar "All Converters" numa campanha de aquisição.

const API = "https://googleads.googleapis.com/v25";
const DIAS = 90;
const FATIA = 10;
/** O Google aceita 100 mil por requisição; 10 mil é o tamanho recomendado. */
const LOTE = 10000;

export type Publico = {
  /** Nome exato no Google. É a chave: o job procura por ele antes de criar. */
  nome: string;
  descricao: string;
  /** Dias que a pessoa fica na lista. 540 é o teto do Customer Match. */
  vidaDias: number;
};

export const PUBLICOS = {
  abandonou: {
    nome: "Serenata · Gerou PIX e não pagou",
    descricao: "Clicou em comprar e gerou o código, e o pagamento não entrou. Montada do banco.",
    vidaDias: 180,
  },
  naoPediu: {
    nome: "Serenata · Música pronta, não comprou",
    descricao: "Terminou a letra, a música ficou pronta e nunca pediu pagamento. Montada do banco.",
    vidaDias: 180,
  },
  compradores: {
    nome: "Serenata · Compradores",
    descricao: "Quem pagou. Serve de semente para público semelhante e de exclusão.",
    vidaDias: 540,
  },
} satisfies Record<string, Publico>;

const normaliza = (e: unknown) => String(e ?? "").trim().toLowerCase();
const hash = (e: unknown) => createHash("sha256").update(normaliza(e)).digest("hex");
const emailOk = (e: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliza(e));

async function token(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const j = (await r.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error("OAuth do Google Ads falhou: " + (j.error_description ?? "sem token"));
  return j.access_token;
}

/** Os três conjuntos de hashes, já sem sobreposição entre eles. */
export async function segmentos(): Promise<{
  abandonou: string[];
  naoPediu: string[];
  compradores: string[];
  semEmail: number;
}> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  const db = createClient(url, key, { auth: { persistSession: false } });

  // ── FATIADO POR DEZ DIAS, E PAGINADO DENTRO DA FATIA ──────────
  //
  // Duas travas diferentes do PostgREST, e as duas mordem aqui: o corte de
  // 8 SEGUNDOS por consulta (90 dias de uma vez estoura) e o teto de 1000
  // LINHAS por resposta, que `.limit()` não levanta porque é do servidor.
  async function porFatias<T>(tabela: string, sel: string, filtro?: (q: never) => never): Promise<T[]> {
    const out: T[] = [];
    for (let d = DIAS; d > 0; d -= FATIA) {
      const de = new Date(Date.now() - d * 86400000).toISOString();
      const ate = new Date(Date.now() - Math.max(0, d - FATIA) * 86400000).toISOString();
      for (let i = 0; i < 200000; i += 1000) {
        let q = db.from(tabela).select(sel).gte("created_at", de).lt("created_at", ate)
          .order("created_at").range(i, i + 999) as never;
        if (filtro) q = filtro(q);
        const { data, error } = (await q) as unknown as { data: T[] | null; error: { message: string } | null };
        if (error) throw new Error(`${tabela} [${de.slice(0, 10)}]: ${error.message}`);
        const lote = data ?? [];
        out.push(...lote);
        if (lote.length < 1000) break;
      }
    }
    return out;
  }

  const ped = await porFatias<{ quiz_response_id: string | null; status: string }>("pedidos", "quiz_response_id, status");
  const mus = await porFatias<{ quiz_response_id: string | null; status: string }>("musicas", "quiz_response_id, status");
  const leads = await porFatias<{ id: string; email: string | null }>("quiz_responses", "id, email");

  const pagou = new Set<string>();
  const pediu = new Set<string>();
  for (const p of ped) {
    if (!p.quiz_response_id) continue;
    pediu.add(p.quiz_response_id);
    if (p.status === "pago") pagou.add(p.quiz_response_id);
  }
  const temMusica = new Set(
    mus.filter((m) => m.status === "pronta").map((m) => m.quiz_response_id).filter(Boolean) as string[],
  );

  const compradores = new Set<string>();
  const abandonou = new Set<string>();
  const naoPediu = new Set<string>();
  let semEmail = 0;
  for (const l of leads) {
    if (!emailOk(l.email)) { semEmail++; continue; }
    const h = hash(l.email);
    if (pagou.has(l.id)) { compradores.add(h); continue; }
    if (pediu.has(l.id)) abandonou.add(h);
    else if (temMusica.has(l.id)) naoPediu.add(h);
  }
  // Comprador manda: quem pagou sai das outras duas, e quem gerou PIX não
  // aparece também na de "nem tentou". Uma pessoa, uma lista.
  for (const h of compradores) { abandonou.delete(h); naoPediu.delete(h); }
  for (const h of abandonou) naoPediu.delete(h);

  return {
    abandonou: [...abandonou],
    naoPediu: [...naoPediu],
    compradores: [...compradores],
    semEmail,
  };
}

type Ctx = { cid: string; H: Record<string, string> };

async function chamar<T>(ctx: Ctx, caminho: string, corpo: unknown): Promise<T> {
  const r = await fetch(`${API}/customers/${ctx.cid}/${caminho}`, {
    method: "POST", headers: ctx.H, body: JSON.stringify(corpo),
  });
  const j = (await r.json()) as { error?: { message?: string } } & T;
  if (j.error) throw new Error(`${caminho}: ${(j.error.message ?? "").slice(0, 200)}`);
  return j;
}

/** Acha a lista pelo nome, ou cria. O nome é a chave e não deve mudar. */
async function garantirLista(ctx: Ctx, p: Publico): Promise<string> {
  const busca = await chamar<{ results?: Array<{ userList: { resourceName: string } }> }>(
    ctx, "googleAds:search",
    { query: `SELECT user_list.resource_name, user_list.name FROM user_list WHERE user_list.name = '${p.nome.replace(/'/g, "\\'")}'` },
  );
  const achada = busca.results?.[0]?.userList?.resourceName;
  if (achada) return achada;

  const criada = await chamar<{ results?: Array<{ resourceName: string }> }>(ctx, "userLists:mutate", {
    operations: [{ create: {
      name: p.nome,
      description: p.descricao,
      membershipLifeSpan: String(p.vidaDias),
      crmBasedUserList: { uploadKeyType: "CONTACT_INFO", dataSourceType: "FIRST_PARTY" },
    } }],
  });
  const rn = criada.results?.[0]?.resourceName;
  if (!rn) throw new Error("não consegui criar a lista " + p.nome);
  return rn;
}

/**
 * Manda os membros. `remover` sai primeiro na mesma carga, e a ordem importa:
 * o Google aplica as operações na sequência em que chegam, então remover
 * depois de adicionar tiraria quem acabou de entrar.
 */
async function enviar(ctx: Ctx, lista: string, adicionar: string[], remover: string[]): Promise<void> {
  if (!adicionar.length && !remover.length) return;
  const job = await chamar<{ resourceName?: string }>(ctx, "offlineUserDataJobs:create", {
    job: { type: "CUSTOMER_MATCH_USER_LIST", customerMatchUserListMetadata: { userList: lista } },
  });
  const rn = job.resourceName;
  if (!rn) throw new Error("não consegui abrir o job de upload");

  const ops = [
    ...remover.map((h) => ({ remove: { userIdentifiers: [{ hashedEmail: h }] } })),
    ...adicionar.map((h) => ({ create: { userIdentifiers: [{ hashedEmail: h }] } })),
  ];
  for (let i = 0; i < ops.length; i += LOTE) {
    const r = await fetch(`${API}/${rn}:addOperations`, {
      method: "POST", headers: ctx.H,
      body: JSON.stringify({ operations: ops.slice(i, i + LOTE), enablePartialFailure: true }),
    });
    const j = (await r.json()) as { error?: { message?: string } };
    if (j.error) throw new Error(`addOperations: ${(j.error.message ?? "").slice(0, 200)}`);
  }
  await fetch(`${API}/${rn}:run`, { method: "POST", headers: ctx.H, body: "{}" });
}

export async function sincronizarPublicos(opts: { seco?: boolean } = {}) {
  const cid = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (!cid) return { pulado: "sem GOOGLE_ADS_CUSTOMER_ID" };

  const seg = await segmentos();
  if (opts.seco) {
    return {
      seco: true,
      abandonou: seg.abandonou.length,
      naoPediu: seg.naoPediu.length,
      compradores: seg.compradores.length,
      semEmail: seg.semEmail,
    };
  }

  const acesso = await token();
  const H: Record<string, string> = {
    Authorization: `Bearer ${acesso}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "content-type": "application/json",
  };
  // A conta é filha de uma MCC: sem este cabeçalho a consulta volta VAZIA em
  // vez de dar erro, e a lista seria criada duplicada a cada rodada.
  if (mcc) H["login-customer-id"] = mcc;
  const ctx: Ctx = { cid, H };

  const saida: Record<string, { membros: number; removidos: number; lista: string }> = {};
  for (const [chave, p] of Object.entries(PUBLICOS)) {
    const lista = await garantirLista(ctx, p);
    const membros = seg[chave as keyof typeof PUBLICOS];
    // Comprador nunca fica nas listas de não comprador.
    const remover = chave === "compradores" ? [] : seg.compradores;
    await enviar(ctx, lista, membros, remover);
    saida[chave] = { membros: membros.length, removidos: remover.length, lista };
  }
  return { ...saida, semEmail: seg.semEmail };
}
