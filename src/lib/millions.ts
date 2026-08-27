// O CLIENTE DA MILLIONSPAY.
//
// Usado dos DOIS lados: pela função de servidor que gera o PIX no checkout
// transparente, e pelo webhook em `api/webhook/millions.ts`. Por isso este
// arquivo NÃO pode usar o alias `@/`: o runtime Node da Vercel não resolve
// ele, e foi assim que o `/api/inngest` ficou quatro horas fora do ar em
// 26/08. Só import relativo, e com `.js` quando houver.
//
// ── DOCUMENTAÇÃO ─────────────────────────────────────────────────
//
// https://millionspay.readme.io/reference/introducao
//   POST /transactions          cria a cobrança
//   GET  /transactions/{id}     consulta (é o que salva o webhook sem assinatura)
//
// Autenticação: Basic com `base64(SECRET_KEY:x)`. O `:x` não é engano, é o
// formato que eles documentam (senha vazia representada por um caractere).

const BASE = "https://api.conta.millionspay.com.br/v1";

/** Erro de gateway que NÃO derruba a venda: o chamador decide o fallback. */
export class ErroMillions extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ErroMillions";
  }
}

function autorizacao(): string {
  const chave = process.env.MILLIONS_SECRET_KEY;
  if (!chave) throw new ErroMillions("MILLIONS_SECRET_KEY ausente", null);
  return "Basic " + Buffer.from(`${chave}:x`).toString("base64");
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  // TIMEOUT CURTO E DELIBERADO. Esta chamada acontece com a pessoa olhando a
  // tela esperando o QR aparecer. Oito segundos é mais do que a API leva e
  // menos do que a paciência de quem está comprando; passou disso, o
  // chamador cai pro outro gateway em vez de deixar a tela girando.
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), 8000);
  try {
    const r = await fetch(`${BASE}${caminho}`, {
      ...init,
      signal: controle.signal,
      headers: {
        authorization: autorizacao(),
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const texto = await r.text();
    if (!r.ok) {
      throw new ErroMillions(`${r.status} ${texto.slice(0, 200)}`, r.status);
    }
    return (texto ? JSON.parse(texto) : {}) as T;
  } catch (err) {
    if (err instanceof ErroMillions) throw err;
    const nome = err instanceof Error ? err.name : "";
    throw new ErroMillions(
      nome === "AbortError" ? "tempo esgotado" : String(err),
      null,
    );
  } finally {
    clearTimeout(relogio);
  }
}

export type TransacaoMillions = {
  id: number;
  amount: number;
  status: string;
  paymentMethod?: string;
  pix?: {
    /**
     * O EMV do PIX, que é o copia-e-cola.
     *
     * O nome do campo engana: `qrcode` não é imagem, é a string
     * `00020126580014br.gov.bcb.pix...`. O desenho do QR a gente faz no
     * cliente a partir dela, o que é melhor de qualquer jeito (imagem
     * remota numa tela de pagamento é mais um ponto que pode falhar).
     */
    qrcode?: string;
    url?: string;
    expirationDate?: string;
  } | null;
  customer?: { name?: string; email?: string };
  metadata?: unknown;
};

/**
 * Cria a cobrança PIX e devolve o copia-e-cola.
 *
 * `valorCentavos` porque é assim que a API recebe (500 = R$ 5,00) e é assim
 * que `pedidos.valor_centavos` guarda: não existe conversão no meio pra
 * errar.
 */
export async function criarPixMillions(args: {
  valorCentavos: number;
  nome: string;
  email: string;
  descricao: string;
  /** Volta no postback. É por ele que a venda casa com a sessão do funil. */
  sessionId: string;
  postbackUrl: string;
  expiraEmDias?: number;
}): Promise<TransacaoMillions> {
  return chamar<TransacaoMillions>("/transactions", {
    method: "POST",
    body: JSON.stringify({
      amount: args.valorCentavos,
      paymentMethod: "pix",
      pix: { expiresInDays: args.expiraEmDias ?? 3 },
      customer: { name: args.nome, email: args.email },
      items: [
        {
          title: args.descricao,
          unitPrice: args.valorCentavos,
          quantity: 1,
          // `tangible: false` porque é produto digital. Não é detalhe: em
          // muitos gateways isso muda a classificação de risco e a
          // exigência de dados de entrega.
          tangible: false,
        },
      ],
      postbackUrl: args.postbackUrl,
      // O `src` do nosso funil. É o que o webhook usa pra achar a música
      // já gravada, e sem ele a compra vira "pago sem música casada".
      metadata: JSON.stringify({ src: args.sessionId }),
    }),
  });
}

/**
 * Consulta a transação na fonte.
 *
 * ── POR QUE ISTO É OBRIGATÓRIO, E NÃO UM LUXO ────────────────────
 *
 * O postback da MillionsPay NÃO É ASSINADO. A documentação não descreve
 * cabeçalho de assinatura, chave de validação nem nada equivalente.
 *
 * Sem assinatura, quem descobrir a URL do webhook pode POSTar um "paid"
 * inventado e receber música de graça. E o CLAUDE.md trata como
 * inegociável: nunca liberar sem confirmação.
 *
 * A defesa é esta: o postback vale como AVISO, nunca como prova. Ao
 * receber, a gente pergunta à API qual é o status de verdade, e só libera
 * pelo que ela responder. Quem forjar o POST consegue no máximo nos fazer
 * gastar uma consulta.
 */
export async function buscarTransacaoMillions(id: number | string): Promise<TransacaoMillions> {
  return chamar<TransacaoMillions>(`/transactions/${encodeURIComponent(String(id))}`);
}

/** Os status que significam DINHEIRO NA CONTA. Qualquer outro não libera. */
export function pagaMillions(status: string | undefined | null): boolean {
  return ["paid", "approved"].includes(String(status ?? "").toLowerCase());
}
