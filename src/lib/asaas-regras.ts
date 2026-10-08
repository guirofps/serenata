// AS REGRAS DE DINHEIRO DO ASAAS QUE NÃO PRECISAM DE REDE (08/10).
//
// Tudo aqui é puro de propósito: o webhook (`api/webhook/asaas.ts`), a criação
// do PIX (`asaas-pix.ts`, `criar-pix.ts`) e o cartão (`criar-cartao.ts`)
// decidem com estas funções, e o teste (`asaas-regras.test.ts`) congela as
// decisões sem precisar de banco nem de gateway.
//
// ── POR QUE ELAS NASCERAM ────────────────────────────────────────
//
// Em 06/10 o quiz bb9effb8… recebeu o SEGUNDO pagamento de R$ 38: o PIX gerado
// em 01/10 tinha vencido (OVERDUE), a folha gerou outro, a pessoa pagou o novo
// em 03/10, e o QR VELHO continuou pagável no Asaas. Ela pagou de novo em
// 06/10, recebeu dois e-mails de entrega, e ninguém foi avisado. A Woovi e o
// Stripe já tinham a trava "um quiz, uma entrega"; o Asaas não.
//
// ── NÃO USA `@/` ─────────────────────────────────────────────────
//
// Importado pelo webhook em `api/`, no runtime Node da Vercel, onde o alias
// não resolve (ver o cabeçalho do `asaas-pix.ts`).

import { asaasPagou } from "./asaas.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O quiz de uma referência nossa, ou `null`.
 *
 * Toda cobrança do funil nasce como `serenata:<quiz_id>` com sufixos depois do
 * id (`:q`, `:v`, `:c`, `:i`, `:d`, `:e2`, `:v3800`): corta no primeiro
 * dois-pontos, igual ao webhook da Woovi. Sem adivinhação: o que não é UUID
 * não é quiz, e upsell (`up:...`) não tem quiz.
 *
 * Existe porque o webhook do Asaas só lia o quiz do pedido PENDENTE. Sem essa
 * linha (gravação que falhou no `criar-pix`, cobrança antiga), o pagamento
 * entrava como "pago sem música" e ia embora em silêncio.
 */
export function quizDaReferencia(referencia: string | null | undefined): string | null {
  const r = String(referencia ?? "").trim();
  if (!r.startsWith("serenata:")) return null;
  const id = r.slice("serenata:".length).split(":")[0] ?? "";
  return UUID.test(id) ? id.toLowerCase() : null;
}

/** Uma linha de `pedidos`, só o que a trava precisa ler. */
export type PedidoDoQuiz = {
  payment_id: string | null;
  status: string | null;
  dinheiro_entrou?: boolean | null;
};

/**
 * O OUTRO pagamento que já liberou este quiz, se houver.
 *
 * A idempotência do webhook é por COBRANÇA (`payment_id`). Ela não vê um
 * segundo pagamento do MESMO quiz por outra cobrança, que é exatamente o caso
 * do QR vencido que continua pagável. Conta como "já pago":
 *
 * - status `pago`, de outra cobrança que não a de agora;
 * - que NÃO seja upsell (`...:up:...`): crédito e quadro comprados no painel
 *   não são a música deste quiz;
 * - que NÃO seja cortesia (`dinheiro_entrou = false`): liberação sem dinheiro
 *   não é pagamento, e o pagamento de verdade que chega depois não é
 *   "pagou duas vezes".
 */
export function outroPagamentoDoQuiz<T extends PedidoDoQuiz>(
  linhas: readonly T[] | null | undefined,
  paymentIdAtual: string | null,
): T | null {
  for (const p of linhas ?? []) {
    if (p.status !== "pago") continue;
    const id = String(p.payment_id ?? "");
    if (paymentIdAtual && id === paymentIdAtual) continue;
    if (/(^|:)up:/.test(id)) continue;
    if (p.dinheiro_entrou === false) continue;
    return p;
  }
  return null;
}

// ── ESTORNO E CHARGEBACK ─────────────────────────────────────────
//
// Até 08/10 o webhook só olhava pagamento e recusa do antifraude: estorno e
// chargeback do Asaas nunca chegavam ao `pedidos`, e o painel seguia contando
// como venda o dinheiro que já tinha voltado. A Perfect Pay já marcava
// `reembolsado` (`perfectpay.ts`); aqui é a mesma coluna.
//
// Os nomes são os da documentação do Asaas (eventos de cobrança). Precisam
// estar MARCADOS no painel do webhook deles, senão nem chegam.

export type TipoEstorno = "estorno" | "chargeback" | "parcial";

const EVENTOS_ESTORNO: Record<string, TipoEstorno> = {
  PAYMENT_REFUNDED: "estorno",
  PAYMENT_REFUND_IN_PROGRESS: "estorno",
  PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
  PAYMENT_CHARGEBACK_DISPUTE: "chargeback",
  // Parcial NÃO vira `reembolsado`: parte do dinheiro ficou. Só avisa.
  PAYMENT_PARTIALLY_REFUNDED: "parcial",
};

/** O evento é de dinheiro voltando? Qual tipo? */
export function eventoDeEstorno(evento: string | null | undefined): TipoEstorno | null {
  return EVENTOS_ESTORNO[String(evento ?? "").toUpperCase()] ?? null;
}

/**
 * O status RECONSULTADO confirma que o dinheiro saiu?
 *
 * O webhook do Asaas não tem assinatura, só token estático (ver o cabeçalho de
 * `api/webhook/asaas.ts`): um postback forjado de estorno marcaria venda boa
 * como reembolsada. Mesma regra do pagamento: o corpo diz QUAL cobrança
 * olhar, quem responde é a API.
 *
 * `AWAITING_CHARGEBACK_REVERSAL` fica de fora: é disputa GANHA esperando o
 * dinheiro voltar pra nós.
 */
export function statusConfirmaEstorno(statusCru: string | null | undefined): boolean {
  const s = String(statusCru ?? "").toUpperCase();
  return (
    s === "REFUNDED" ||
    s === "REFUND_IN_PROGRESS" ||
    s === "CHARGEBACK_REQUESTED" ||
    s === "CHARGEBACK_DISPUTE"
  );
}

// ── A COBRANÇA PIX QUE JÁ EXISTE PRA UMA REFERÊNCIA ──────────────

export type CobrancaListada = { id?: string; status?: string; value?: number };

export type DecisaoCobranca<P extends CobrancaListada> =
  /** Uma delas já foi paga: gerar outra é cobrar duas vezes. */
  | { tipo: "paga"; paga: P; cancelar: string[] }
  /** Uma viva, do MESMO valor: devolve o mesmo QR. */
  | { tipo: "reusar"; cobranca: P; cancelar: string[] }
  /** Nenhuma serve: nasce uma nova, com a MESMA referência. */
  | { tipo: "nova"; cancelar: string[] };

const VIVA = new Set(["PENDING", "AWAITING_RISK_ANALYSIS"]);

/**
 * O que fazer com as cobranças que o Asaas já tem pra esta referência.
 *
 * `cancelar` são as que ficaram pra trás e AINDA SE PAGAM:
 *
 * - `OVERDUE`: no Asaas, PIX vencido continua pagável. Era a premissa errada
 *   do comentário antigo ("a antiga morre sozinha no vencimento"), e foi o
 *   caminho do segundo pagamento do quiz bb9effb8… (cobrança de 01/10 paga em
 *   06/10, depois de a de 03/10 já ter sido paga).
 * - viva de OUTRO valor: a tela já mostra o código novo, e o antigo seria um
 *   segundo jeito de pagar o mesmo pedido.
 *
 * Paga NUNCA entra em `cancelar` (não se apaga cobrança com dinheiro), e
 * a presença de uma paga ganha de tudo: quem chama recusa gerar outra.
 *
 * ── A NOVA NASCE COM A MESMA REFERÊNCIA, SEM `:v<valor>` ─────────
 *
 * O sufixo de valor era cópia da Woovi, que RECUSA correlationID repetido. O
 * Asaas aceita, e o webhook casa por `asaas:<id da cobrança>`, não pela
 * referência. Com o sufixo, a reabertura seguinte procurava pela referência
 * SEM ele, não achava a viva e criava mais uma a cada abertura, todas
 * pagáveis. Na mesma referência, a próxima consulta enxerga todas: reaproveita
 * a do valor certo e cancela o resto.
 */
export function decidirCobrancaExistente<P extends CobrancaListada>(
  lista: readonly P[] | null | undefined,
  valorCentavos: number,
): DecisaoCobranca<P> {
  const todas = (lista ?? []).filter((p) => p?.id);
  const status = (p: P) => String(p.status ?? "").toUpperCase();
  const centavos = (p: P) => Math.round(Number(p.value ?? 0) * 100);

  const vencidas = todas.filter((p) => status(p) === "OVERDUE").map((p) => p.id as string);
  const paga = todas.find((p) => asaasPagou(status(p)));
  if (paga) return { tipo: "paga", paga, cancelar: vencidas };

  const vivas = todas.filter((p) => VIVA.has(status(p)));
  const mesmoValor = vivas.find((p) => centavos(p) === valorCentavos);
  const outroValor = vivas
    .filter((p) => p !== mesmoValor && centavos(p) !== valorCentavos)
    .map((p) => p.id as string);
  // Antifraude pendente é cartão em análise: não se apaga, ela pode virar paga.
  const outroValorPix = outroValor.filter((id) => {
    const p = todas.find((x) => x.id === id);
    return p ? status(p) === "PENDING" : false;
  });
  const cancelar = [...vencidas, ...outroValorPix];

  if (mesmoValor) return { tipo: "reusar", cobranca: mesmoValor, cancelar };
  return { tipo: "nova", cancelar };
}
