// A WOOVI, implementando o contrato de gateway.
//
// Documentação: https://developers.woovi.com
//   POST /api/v1/charge                cria a cobrança
//   GET  /api/v1/charge/{id}           consulta
//   GET  /api/v1/webhook/public-keys   chave pública pra validar assinatura
//
// Autenticação: o AppID vai CRU no header `Authorization`. Sem `Bearer`, e a
// documentação faz questão de avisar isso.
//
// ── POR QUE ELA VIROU A PRINCIPAL ────────────────────────────────
//
// Medido em 27/08, criando cobranças de verdade:
//   taxa           0,8% com mínimo de R$ 0,50 (R$ 0,50 num ticket de R$ 38)
//   Perfect Pay    ~11,6% (R$ 4,41 no mesmo ticket)
//   MillionsPay    5% (R$ 1,90)
// No volume de agosto, 1.150 vendas, a diferença pra Perfect Pay é de cerca
// de R$ 3.800 por mês. Maior que qualquer ganho de conversão em discussão.
//
// E o PIX cai DIRETO na chave do dono, sem intermediário. A MillionsPay
// liquida pela Efí, e foi exatamente aí que a conciliação quebrou no
// primeiro teste: R$ 1 debitado do pagador e `end2EndId` nulo do lado deles.

import { ErroGateway, type CobrancaPix, type GatewayPix, type StatusCobranca } from "./gateway.js";

const BASE = "https://api.woovi.com/api/v1";

function appId(): string {
  const id = process.env.WOOVI_APP_ID;
  if (!id) throw new ErroGateway("WOOVI_APP_ID ausente", "woovi", false);
  return id;
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  // 8 segundos: a chamada acontece com a pessoa olhando a tela esperando o
  // QR. Mais que isso e ela desiste antes da resposta chegar.
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), 8000);
  try {
    const r = await fetch(`${BASE}${caminho}`, {
      ...init,
      signal: controle.signal,
      headers: {
        Authorization: appId(),
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const texto = await r.text();
    if (!r.ok) {
      // 5xx e 429 são do lado deles e passam com outro gateway. 4xx é erro
      // nosso (escopo, corpo inválido) e repetir em outro não conserta.
      const tentarOutro = r.status >= 500 || r.status === 429;
      throw new ErroGateway(`${r.status} ${texto.slice(0, 200)}`, "woovi", tentarOutro);
    }
    return (texto ? JSON.parse(texto) : {}) as T;
  } catch (err) {
    if (err instanceof ErroGateway) throw err;
    const abortou = err instanceof Error && err.name === "AbortError";
    throw new ErroGateway(abortou ? "tempo esgotado" : String(err), "woovi", true);
  } finally {
    clearTimeout(relogio);
  }
}

type ChargeWoovi = {
  correlationID?: string;
  status?: string;
  value?: number;
  fee?: number;
  brCode?: string;
  expiresDate?: string;
  identifier?: string;
  transactionID?: string;
};

/**
 * O 400 de "já existe cobrança com este correlationID".
 *
 * Casado pelo TEXTO porque é o que eles dão: o corpo é
 * `{"error":"Já existe uma cobrança com este Correlação ID"}`, sem código
 * nenhum pra distinguir de qualquer outro 400. Por isso o teste cobre as
 * duas grafias (com e sem acento) e o inglês: um dia eles arrumam a mensagem
 * e este caminho não pode virar erro na cara de quem ia pagar.
 */
export function jaExiste(mensagem: string): boolean {
  const t = mensagem
    .toLowerCase()
    .normalize("NFD")
    // `\p{M}` e não um intervalo de acentos combinantes escrito à mão: o
    // intervalo literal fica invisível no editor e é a primeira coisa a
    // sumir quando um arquivo passa por uma conversão de encoding errada.
    .replace(/\p{M}/gu, "");
  if (!t.startsWith("400")) return false;
  return /ja existe|already exists|duplicate/.test(t) && /correla/.test(t);
}

/** `COMPLETED` é pago. `ACTIVE` é esperando, `EXPIRED` venceu. */
function pagou(status: string | undefined): boolean {
  return String(status ?? "").toUpperCase() === "COMPLETED";
}

export const woovi: GatewayPix = {
  nome: "woovi",

  async criar(args): Promise<CobrancaPix> {
    // ── A WOOVI NÃO É IDEMPOTENTE, E ISSO CUSTA CARO ───────────
    //
    // A documentação chama o `correlationID` de "identificador único da
    // cobrança", o que se lê como idempotência. Não é. Medido em 27/08,
    // repetindo o mesmo id:
    //
    //   HTTP 400 {"error":"Já existe uma cobrança com este Correlação ID"}
    //
    // Descoberto no teste de ponta a ponta, fechando e reabrindo a folha do
    // PIX: a primeira vez mostrava o QR, a segunda mostrava "não consegui
    // gerar o PIX agora". Em produção isso seria a pessoa que trocou de aba,
    // voltou, e encontrou um erro em cima de uma cobrança que EXISTE.
    //
    // O conserto é reler: `GET /charge/{correlationID}` devolve a cobrança
    // inteira, `brCode` incluído. Então a idempotência passa a ser nossa, e
    // não dela.
    const corpo = JSON.stringify({
      correlationID: args.referencia,
      value: args.valorCentavos,
      comment: args.descricao.slice(0, 140),
      // Uma hora. Tempo de sobra pra quem vai pagar agora, e curto o
      // bastante pra não encher a conta de cobrança morta. Quem some e
      // volta depois gera outra.
      expiresIn: 3600,
      ...(args.nome || args.email
        ? { customer: { name: args.nome ?? undefined, email: args.email ?? undefined } }
        : {}),
    });

    let c: ChargeWoovi;
    let brCodeSolto: string | undefined;
    try {
      const r = await chamar<{ charge?: ChargeWoovi; brCode?: string }>("/charge", {
        method: "POST",
        body: corpo,
      });
      c = r.charge ?? {};
      brCodeSolto = r.brCode;
    } catch (err) {
      if (!(err instanceof ErroGateway) || !jaExiste(err.message)) throw err;
      // Já existe: devolve a MESMA cobrança, com o MESMO QR. Não é uma
      // segunda tentativa, é a resposta certa pra segunda pergunta.
      const r = await chamar<{ charge?: ChargeWoovi }>(
        `/charge/${encodeURIComponent(args.referencia)}`,
      );
      c = r.charge ?? {};
      // O VALOR TEM QUE BATER. Se a cobrança viva é de outro valor (o preço
      // mudou entre as duas aberturas, ou o braço de preço foi trocado), a
      // pessoa veria um número na tela e pagaria outro. Falha alto.
      if (typeof c.value === "number" && c.value !== args.valorCentavos) {
        throw new ErroGateway(
          `cobrança existente é de ${c.value}, esperado ${args.valorCentavos}`,
          "woovi",
          false,
        );
      }
      // E se ela já foi paga ou expirou, não dá pra reaproveitar o QR.
      const st = String(c.status ?? "").toUpperCase();
      if (st && st !== "ACTIVE") {
        throw new ErroGateway(`cobrança existente está ${st}`, "woovi", false);
      }
    }

    const copiaECola = c.brCode ?? brCodeSolto;
    if (!copiaECola) {
      // Sem o copia-e-cola não existe cobrança útil: a tela não tem o que
      // mostrar. Falha alto pra cair no outro gateway.
      throw new ErroGateway("resposta sem brCode", "woovi", true);
    }
    return {
      gateway: "woovi",
      idExterno: String(c.correlationID ?? args.referencia),
      copiaECola,
      valorCentavos: c.value ?? args.valorCentavos,
      taxaCentavos: typeof c.fee === "number" ? c.fee : null,
      expiraEm: c.expiresDate ?? null,
    };
  },

  async consultar(idExterno): Promise<StatusCobranca> {
    const r = await chamar<{ charge?: ChargeWoovi }>(
      `/charge/${encodeURIComponent(idExterno)}`,
    );
    const c = r.charge ?? {};
    return {
      pago: pagou(c.status),
      statusCru: String(c.status ?? "desconhecido"),
      valorCentavos: typeof c.value === "number" ? c.value : null,
      taxaCentavos: typeof c.fee === "number" ? c.fee : null,
    };
  },
};

/**
 * VALIDA A ASSINATURA DO WEBHOOK.
 *
 * A Woovi assina cada postback com RSA-SHA256, e manda a assinatura em
 * `x-webhook-signature`, em base64. A chave PÚBLICA vem deles.
 *
 * Isto é o que a MillionsPay não tem, e a diferença é grande: lá eu precisei
 * inventar duas travas (segredo na URL e reconsulta obrigatória) pra suprir a
 * falta. Aqui a assinatura prova a origem de verdade.
 *
 * A reconsulta CONTINUA acontecendo mesmo assim, e não é redundância: a
 * assinatura prova que a mensagem veio da Woovi, a consulta prova que o
 * dinheiro entrou. São perguntas diferentes.
 *
 * A chave é buscada em `/webhook/public-keys` e guardada em memória: se eles
 * rodarem a chave, o processo novo pega a nova sozinho. A estática fica como
 * reserva pra quando a busca falhar, senão uma indisponibilidade deles viraria
 * recusa de venda paga.
 */
const CHAVE_RESERVA =
  "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlHZk1BMEdDU3FHU0liM0RRRUJBUVVBQTRHTkFEQ0JpUUtCZ1FDLytOdElranpldnZxRCtJM01NdjNiTFhEdApwdnhCalk0QnNSclNkY2EzcnRBd01jUllZdnhTbmQ3amFnVkxwY3RNaU94UU84aWVVQ0tMU1dIcHNNQWpPL3paCldNS2Jxb0c4TU5waS91M2ZwNnp6MG1jSENPU3FZc1BVVUcxOWJ1VzhiaXM1WloySVpnQk9iV1NwVHZKMGNuajYKSEtCQUE4MkpsbitsR3dTMU13SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=";

let chavesEmMemoria: string[] | null = null;

async function chavesPublicas(): Promise<string[]> {
  if (chavesEmMemoria) return chavesEmMemoria;
  const chaves: string[] = [];
  try {
    // O CAMPO É `public_keys`, com cada item trazendo `key` já em PEM.
    // Conferido contra a API real em 27/08; a documentação escrita sugeria
    // `publicKeys`/`publicKey`, que não existem. As duas formas ficam aceitas
    // pra sobreviver a eles padronizarem depois.
    type Item = { key?: string; publicKey?: string; is_current?: boolean };
    const r = await chamar<{ public_keys?: Array<Item | string>; publicKeys?: Array<Item | string> }>(
      "/webhook/public-keys",
    );
    const lista = r.public_keys ?? r.publicKeys ?? [];
    // A corrente primeiro: rotação de chave deixa as antigas na lista, e
    // tentar a certa antes economiza uma verificação por webhook.
    const ordenada = [...lista].sort((a, b) => {
      const ca = typeof a === "object" && a?.is_current ? 1 : 0;
      const cb = typeof b === "object" && b?.is_current ? 1 : 0;
      return cb - ca;
    });
    for (const k of ordenada) {
      const bruta = typeof k === "string" ? k : (k?.key ?? k?.publicKey);
      if (bruta) chaves.push(bruta);
    }
  } catch {
    // Indisponibilidade deles não pode virar recusa de venda paga.
  }
  chaves.push(CHAVE_RESERVA);
  chavesEmMemoria = chaves;
  return chaves;
}

export async function assinaturaWooviConfere(
  corpoCru: string,
  assinatura: string | null,
): Promise<boolean> {
  if (!assinatura) return false;
  // `node:crypto` importado aqui dentro: este módulo também é carregado pelo
  // bundle do cliente pelo caminho da função de servidor, e um import de topo
  // arrastaria o módulo de node pra lá.
  const { createVerify } = await import("node:crypto");
  for (const chaveBase64 of await chavesPublicas()) {
    try {
      const pem = chaveBase64.includes("BEGIN")
        ? chaveBase64
        : Buffer.from(chaveBase64, "base64").toString("ascii");
      const v = createVerify("sha256");
      v.write(Buffer.from(corpoCru));
      v.end();
      if (v.verify(pem, assinatura, "base64")) return true;
    } catch {
      // Chave malformada: tenta a próxima.
    }
  }
  return false;
}
