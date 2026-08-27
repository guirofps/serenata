// AS VENDAS PAGAS, NO FORMATO QUE O GOOGLE ADS IMPORTA SOZINHO.
//
// ── O BURACO QUE ISTO FECHA ──────────────────────────────────────
//
// A conversão de compra dispara no `gtag` da `/obrigado`, que é o destino do
// redirect pós-pagamento. Só que quem paga PIX pelo aplicativo do banco
// muitas vezes NÃO volta pro site, e essa venda nunca é contada.
//
// Medido em 27/08, 7 dias: 591 vendas e R$ 19.518,80 de receita real, contra
// 436 vendas e R$ 14.579,20 que a `/obrigado` viu. São 155 vendas e
// R$ 4.939,60 por semana que o Google não sabe que existiram, e o lance do
// Smart Bidding é dado em cima do que ele recebe. O sinal está 26% baixo, e
// baixo demais faz campanha boa parecer ruim.
//
// 97% das vendas têm `gclid` guardado (573 de 591), capturado no first-touch
// por `session-context.ts`. É isso que torna este arquivo possível.
//
// ── POR QUE ARQUIVO E NÃO API ────────────────────────────────────
//
// A API do Google Ads (`uploadClickConversions`) sobe a venda em segundos,
// dentro do webhook, e é pra onde isto vai um dia. Ela exige token de
// desenvolvedor, que só se pede de uma conta de ADMINISTRADOR (MCC) e que em
// 2026 está com fila e verificação de anunciante. Semanas.
//
// A importação agendada por URL não exige nada disso: o Google busca este
// endereço no horário marcado e lê o CSV. É diária em vez de instantânea, e
// diária com 100% das vendas vale muito mais que instantânea com 74%.
//
// Quando o token sair, troca-se o TRANSPORTE e não os dados: a mesma consulta
// vira o corpo de um `uploadClickConversions`.
//
// ── POR QUE NÃO EXISTE FILA NEM TABELA ───────────────────────────
//
// O Google DEDUPLICA por `gclid` + nome da conversão + horário, e ainda
// aceita `Order ID` como trava explícita, que este arquivo manda. Reentregar
// as mesmas linhas todo dia é seguro por desenho.
//
// Uma tabela de fila só acrescentaria um estado pra sair de sincronia com a
// verdade, que é `pedidos`. Sem estado, não há o que reconciliar.
//
// ── CONFIGURAÇÃO ─────────────────────────────────────────────────
//
// 1. No Google Ads: Objetivos › Conversões › Nova ação › Importar ›
//    De cliques. O NOME que você der lá tem que ser igual ao de
//    `GOOGLE_ADS_CONVERSAO_NOME` (ou ao padrão abaixo), letra por letra.
// 2. Conversões › Uploads › Agendar › HTTPS, apontando pra:
//      https://www.serenatagift.com/api/conversoes?k=<CONVERSOES_SECRET>
// 3. CUIDADO COM CONTAGEM DUPLA: enquanto o `gtag` da `/obrigado` continuar
//    como conversão PRINCIPAL junto com esta, a mesma venda entra duas vezes
//    e o ROAS sobe sem ter subido. Uma das duas tem que virar secundária.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { segredoConfere } from "./lib/segredo.js";

type Req = IncomingMessage & {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & {
  status: (c: number) => Res;
  json: (b: unknown) => void;
  send: (b: string) => void;
};

/** Nome da ação de conversão no Google Ads. Tem que bater letra por letra. */
const NOME_PADRAO = "Compra Serenata (importada)";

/**
 * Janela padrão. O `gclid` vale 90 dias no Google, então nada além disso
 * adianta mandar: seria recusado do outro lado e só engordaria o arquivo.
 */
const DIAS_PADRAO = 30;
const DIAS_MAX = 90;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Campo CSV seguro.
 *
 * O `gclid` é URL-safe e o `Order ID` é uuid, então nenhum dos dois morde. O
 * NOME DA CONVERSÃO morde: ele vem de env, é escrito por uma pessoa, e um
 * nome com vírgula ("Compra, Serenata") deslocaria todas as colunas à direita
 * em silêncio — o Google leria o horário como valor.
 */
function csv(valor: string): string {
  return /[",\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * `2026-08-27 13:36:00+00:00`, que é um dos formatos que o Google aceita.
 *
 * COM O DESLOCAMENTO EXPLÍCITO, sempre. A alternativa documentada é declarar
 * `Parameters:TimeZone=` no topo e mandar hora local, e ela depende de duas
 * partes concordarem sobre qual é o fuso. Em 27/08 eu perdi tempo nesta mesma
 * sessão porque uma consulta devolvia UTC e eu li como horário de Brasília;
 * num arquivo que decide lance de campanha, esse erro sairia caro e mudo.
 */
function horaGoogle(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 19).replace("T", " ")}+00:00`;
}

type PedidoComLead = {
  id: string;
  paid_at: string | null;
  valor_centavos: number | null;
  quiz_responses: { attribution: Record<string, unknown> | null; locale: string | null } | null;
};

/**
 * Usuário e senha do HTTP Basic, que é como o Google se autentica aqui.
 *
 * A primeira versão punha o segredo na URL (`?k=`), por eu supor que a
 * importação agendada só sabia buscar um endereço. Errado: o formulário do
 * Google pede **URL, nome de usuário e senha**, e recusa sem os dois últimos.
 *
 * O `?k=` fica como segunda porta, porque é o que permite conferir o arquivo
 * com um `curl` sem montar cabeçalho. As duas comparam em tempo constante.
 */
function autorizado(req: Req, url: URL, esperado: string): boolean {
  if (segredoConfere(url.searchParams.get("k"), esperado)) return true;

  const cru = req.headers["authorization"];
  const cabecalho = typeof cru === "string" ? cru : Array.isArray(cru) ? cru[0] : null;
  if (!cabecalho?.toLowerCase().startsWith("basic ")) return false;

  let decodificado: string;
  try {
    decodificado = Buffer.from(cabecalho.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  // `indexOf` e não `split(":")`: senha PODE conter dois-pontos, e partir em
  // todos truncaria a senha em silêncio — o pior tipo de recusa, a que parece
  // "credencial errada" quando na verdade é o nosso parser.
  const corte = decodificado.indexOf(":");
  if (corte < 0) return false;
  const usuario = decodificado.slice(0, corte);
  const senha = decodificado.slice(corte + 1);

  const usuarioEsperado = process.env.CONVERSOES_USUARIO || "google";
  // Os dois em tempo constante, e sem `&&` que saia cedo: um curto-circuito
  // depois do usuário deixaria o tempo de resposta contar se ele acertou.
  const okUsuario = segredoConfere(usuario, usuarioEsperado);
  const okSenha = segredoConfere(senha, esperado);
  return okUsuario && okSenha;
}

export default async function handler(req: Req, res: Res) {
  // ── QUEM BATEU AQUI, E COM O QUÊ ─────────────────────────────
  //
  // Em 27/08 a importação do Google falhou com "Arquivo não encontrado"
  // DEPOIS de ter lido o mesmo arquivo com sucesso na configuração, e o
  // `curl` continuava respondendo 200 em 0,5s. Sem ver a requisição dele não
  // dá pra passar de palpite.
  //
  // Só metadado: método, caminho, agente, e se veio credencial. NUNCA o
  // conteúdo do `Authorization` nem o `k` da query — log de produção é lido
  // por mais gente que o banco.
  const cru = req.headers["authorization"];
  const temBasic = typeof cru === "string" && cru.toLowerCase().startsWith("basic ");
  const agente = req.headers["user-agent"];
  console.log(
    "[conversoes] req",
    JSON.stringify({
      metodo: req.method ?? "?",
      caminho: (req.url ?? "").split("?")[0],
      temQuery: (req.url ?? "").includes("?"),
      temBasic,
      agente: typeof agente === "string" ? agente.slice(0, 120) : null,
    }),
  );

  const esperado = process.env.CONVERSOES_SECRET;
  if (!esperado) {
    // FECHA. Sem segredo configurado isto serviria a receita da operação pra
    // quem adivinhasse o caminho. É o erro herdado que o CLAUDE.md proíbe
    // (`!secretEsperado ||` aceitando qualquer requisição).
    return res.status(503).json({ error: "CONVERSOES_SECRET não configurado" });
  }
  const url = new URL(req.url ?? "/", "https://serenatagift.com");
  if (!autorizado(req, url, esperado)) {
    // 401 COM DESAFIO, e não o 404 discreto da primeira versão: o Basic só
    // interopera assim. Cliente que não mandou credencial precisa saber que
    // existe credencial pra mandar, senão nunca tenta.
    res.setHeader("WWW-Authenticate", 'Basic realm="conversoes"');
    return res.status(401).json({ error: "credenciais inválidas" });
  }

  const dias = Math.min(
    DIAS_MAX,
    Math.max(1, Number(url.searchParams.get("dias")) || DIAS_PADRAO),
  );
  const nome = process.env.GOOGLE_ADS_CONVERSAO_NOME || NOME_PADRAO;

  let linhas: PedidoComLead[] = [];
  try {
    const sb = db();
    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    // ── PAGINADO, E ISSO NÃO É ZELO EXCESSIVO ────────────────────
    //
    // O PostgREST corta em 1000 linhas e `.limit(5000)` NÃO levanta esse
    // teto: ele é do servidor. A primeira versão deste arquivo pediu 5000,
    // recebeu exatamente 1000, e teria entregue ao Google só as vendas mais
    // recentes, calada. 30 dias de operação passam de 2.500 pedidos.
    //
    // É o mesmo defeito que em 27/08 escondia 13% dos compradores da trava do
    // `mandarLetra` e fez um cliente que já tinha pago receber o e-mail de
    // quem não pagou. Duas vezes no mesmo dia é padrão, não coincidência:
    // toda leitura de `pedidos` que não pagina mente quando a tabela cresce.
    const PAGINA = 1000;
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await sb
        .from("pedidos")
        // O lead vem embutido pela chave estrangeira: o `gclid` mora na
        // `attribution` dele, e o idioma decide a moeda.
        .select("id, paid_at, valor_centavos, quiz_responses(attribution, locale)")
        .eq("status", "pago")
        // Resgate de crédito não é dinheiro novo entrando: contar como
        // conversão ensinaria o Google a comprar tráfego pra uma venda que já
        // tinha sido paga antes.
        .not("dinheiro_entrou", "is", false)
        .gte("paid_at", desde)
        .order("paid_at", { ascending: false })
        .range(de, de + PAGINA - 1);
      if (error) throw new Error(error.message);
      const lote = (data ?? []) as unknown as PedidoComLead[];
      linhas.push(...lote);
      // Última página quando vem incompleta. O teto de 90 dias já limita o
      // total, então não há laço infinito possível aqui.
      if (lote.length < PAGINA) break;
    }
  } catch (err) {
    console.error("[conversoes] consulta falhou:", err);
    // 500 e NÃO um CSV vazio: arquivo vazio é resposta válida pro Google, e
    // ele registraria "0 conversões hoje" como se fosse verdade. Erro alto faz
    // a importação aparecer como falha no painel, que é o que ela é.
    return res.status(500).json({ error: "falha ao ler as vendas" });
  }

  const saida: string[] = [
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID",
  ];
  let semGclid = 0;

  for (const p of linhas) {
    const attr = p.quiz_responses?.attribution as Record<string, unknown> | null;
    const gclid = typeof attr?.gclid === "string" ? attr.gclid.trim() : "";
    // Sem `gclid` a linha não serve: o Google casa a conversão com o clique
    // por ele, e uma linha sem clique é recusada do outro lado.
    if (!gclid || !p.paid_at || !p.valor_centavos) {
      semGclid += 1;
      continue;
    }
    // O IDIOMA DECIDE A MOEDA, e ele mora no lead. Mandar tudo em BRL faria
    // uma venda de US$ 9 entrar como R$ 9 e o Google otimizaria o funil
    // espanhol por um retorno cinco vezes menor do que o real.
    const moeda = p.quiz_responses?.locale === "es" ? "USD" : "BRL";
    saida.push(
      [
        csv(gclid),
        csv(nome),
        csv(horaGoogle(p.paid_at)),
        (p.valor_centavos / 100).toFixed(2),
        moeda,
        csv(p.id),
      ].join(","),
    );
  }

  console.log(
    `[conversoes] ${saida.length - 1} conversões em ${dias} dias; ${semGclid} sem gclid`,
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  // Nunca cacheado: o Google busca uma vez por dia e tem que ver a venda de
  // ontem, não a resposta guardada da semana passada por uma borda da Vercel.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Disposition", 'attachment; filename="conversoes.csv"');
  return res.status(200).send(saida.join("\n") + "\n");
}
