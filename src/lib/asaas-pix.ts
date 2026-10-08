// O ASAAS, implementando `GatewayPix`.
//
// ── POR QUE ELE EXISTE ───────────────────────────────────────────
//
// Em 11/09/2026 a Woovi parou de receber às 16:44 e ficou quase três horas
// sem confirmar um único pagamento, com as cobranças todas `ACTIVE` na API
// deles. O funil caiu no checkout hospedado da Perfect Pay, que funciona mas
// custa 11,39% contra 0,8% — uns R$ 3,83 a mais por venda.
//
// O `gateway.ts` foi escrito prometendo que trocar de gateway seria mudar um
// valor. Naquela noite a promessa não valeu nada, porque só existia UM
// gateway de PIX. Este arquivo é a segunda perna.
//
// ── AS TRÊS DIFERENÇAS PRA WOOVI, E NENHUMA É DETALHE ────────────
//
// 1. O ASAAS EXIGE CPF. A cobrança pendura num cliente, e `POST /customers`
//    tem `cpfCnpj` como obrigatório na especificação deles. A folha
//    transparente nasceu sem pedir CPF de propósito; com este gateway, o
//    campo aparece. Quem decide isso é `exigeCpf`, não o checkout.
//
// 2. O ASAAS NÃO É IDEMPOTENTE POR `externalReference`. A Woovi pelo menos
//    RECUSA o correlationID repetido com 400 (e a gente reconsulta em cima
//    do erro). O Asaas aceita e cria OUTRA cobrança, em silêncio. Dois
//    cliques no botão virariam dois PIX vivos do mesmo pedido, e a pessoa
//    poderia pagar os dois. A idempotência aqui é NOSSA, por consulta
//    prévia, e é a parte mais importante deste arquivo.
//
// 3. O CÓDIGO COPIA-E-COLA VEM NUMA SEGUNDA CHAMADA. `POST /payments` devolve
//    a cobrança sem o EMV; o payload sai em `GET /payments/{id}/pixQrCode`.
//    São duas idas à rede com a pessoa olhando a tela esperando o QR.
//
// ── NÃO USA `@/` ─────────────────────────────────────────────────
//
// Mesma regra do `woovi.ts` e do `asaas.ts`: isto é importado pelo webhook em
// `api/`, que roda no runtime Node da Vercel, onde o alias não resolve. Foi
// assim que o `/api/inngest` ficou quatro horas fora do ar em 26/08.

import { chamarAsaas, asaasPagou } from "./asaas.js";
import { semPontoNoFim } from "./email-limpo.js";
import {
  COBRANCA_JA_PAGA,
  ErroGateway,
  type CobrancaPix,
  type GatewayPix,
  type StatusCobranca,
} from "./gateway.js";
import { cpfValido, soDigitosCpf } from "./cpf.js";
import { decidirCobrancaExistente, type DecisaoCobranca } from "./asaas-regras.js";

type PagamentoAsaas = {
  id?: string;
  status?: string;
  value?: number;
  netValue?: number;
  dateCreated?: string;
  confirmedDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  externalReference?: string;
};

/**
 * A taxa, quando dá pra saber.
 *
 * O Asaas devolve `netValue` (o que cai na conta). A diferença pro `value` é
 * a taxa. Só que `netValue` nem sempre vem preenchido na CRIAÇÃO — aí fica
 * `null`, que é honesto, em vez de zero, que seria mentira no relatório de
 * lucro.
 */
function taxaDe(p: PagamentoAsaas): number | null {
  const bruto = Number(p.value);
  const liquido = Number(p.netValue);
  if (!Number.isFinite(bruto) || !Number.isFinite(liquido)) return null;
  const taxa = Math.round((bruto - liquido) * 100);
  return taxa >= 0 ? taxa : null;
}

/**
 * As cobranças que o Asaas já tem pra esta referência.
 *
 * ── ESTE É O CORAÇÃO DA IDEMPOTÊNCIA ─────────────────────────────
 *
 * Sem isto, duplo clique, reload da folha ou retry de rede criam cobranças
 * novas a cada vez — e o pior caso não é bagunça no painel deles, é a pessoa
 * pagando duas vezes o mesmo pedido.
 *
 * O que fazer com a lista (reaproveitar, recusar porque já foi paga, cancelar
 * as que ficaram pra trás) é decidido em `decidirCobrancaExistente`, pura e
 * testada (`asaas-regras.ts`).
 *
 * ── O QUE ESTAVA ERRADO ATÉ 08/10 ────────────────────────────────
 *
 * 1. `OVERDUE` era tratada como morta ("uma cobrança nova é o certo"), e a
 *    vencida ficava viva no Asaas: PIX vencido lá CONTINUA PAGÁVEL. O quiz
 *    bb9effb8… pagou a de 03/10 e, em 06/10, a de 01/10.
 * 2. Uma cobrança JÁ PAGA voltava daqui como "reaproveitável", e o
 *    `criar-pix` gravava `pendente` por cima do pedido pago. Agora é recusa
 *    (`COBRANCA_JA_PAGA`), igual à Woovi.
 */
async function cobrancasDaReferencia(referencia: string): Promise<PagamentoAsaas[]> {
  const r = await chamarAsaas<{ data?: PagamentoAsaas[] }>(
    `/payments?externalReference=${encodeURIComponent(referencia)}&limit=10`,
  );
  return r?.data ?? [];
}

/**
 * Apaga as cobranças que ficaram pra trás (`DELETE /payments/{id}`), sem
 * nunca jogar.
 *
 * MELHOR ESFORÇO, de propósito: a pessoa está olhando a tela esperando o QR
 * novo, e uma falha aqui não pode impedir a venda. Se o DELETE falhar, a
 * próxima abertura da folha tenta de novo (a vencida continua na lista), e o
 * webhook ainda tem a trava "um quiz, uma entrega" como última rede.
 */
async function cancelarSuperadas(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const r = await Promise.allSettled(
    ids.map((id) => chamarAsaas(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" })),
  );
  r.forEach((x, i) => {
    if (x.status === "rejected") {
      const msg = x.reason instanceof Error ? x.reason.message : String(x.reason);
      console.warn(`[asaas-pix] não consegui cancelar a cobrança superada ${ids[i]}:`, msg);
    } else {
      console.log(`[asaas-pix] cobrança superada cancelada: ${ids[i]}`);
    }
  });
}

/** O EMV, que vem numa chamada separada da criação. */
async function copiaECola(idPagamento: string): Promise<{ payload: string; expiraEm: string | null }> {
  const qr = await chamarAsaas<{ success?: boolean; payload?: string; expirationDate?: string }>(
    `/payments/${encodeURIComponent(idPagamento)}/pixQrCode`,
  );
  const payload = String(qr?.payload ?? "").trim();
  // Cobrança criada e sem EMV é pior que erro: a tela mostraria um QR vazio e
  // a pessoa iria embora achando que o site quebrou. Falha alto.
  if (!payload.startsWith("000201")) {
    throw new ErroGateway("asaas não devolveu o copia e cola do PIX", "asaas", true);
  }
  return { payload, expiraEm: qr?.expirationDate ?? null };
}

/**
 * A data de HOJE em horario de Brasilia, "AAAA-MM-DD".
 *
 * `new Date().toISOString()` e UTC. Das 21h a meia-noite de Brasilia o UTC ja
 * esta no dia SEGUINTE, entao um `dueDate` montado assim vira data futura pro
 * Asaas — que opera em BRT e trata cobranca com vencimento futuro como
 * AGENDADA. Cobranca agendada nasce, aparece no painel deles, e nao tem QR
 * pra buscar: o `pixQrCode` falha e a pessoa fica sem codigo.
 *
 * Descoberto em 11/09/2026, as 21h50: cobranca criada com sucesso no Asaas e
 * `pixQrCode` recusando, todas as tentativas depois das 21h. Antes desse
 * horario o bug nao aparece, porque UTC e BRT ainda estao no mesmo dia.
 */
function hojeEmBrasilia(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

/**
 * O dia do pagamento, do jeito que o Asaas manda, virado instante seguro.
 *
 * `confirmedDate` e `paymentDate` vêm como DIA, sem hora: "2026-09-11". Gravar
 * isso cru em `paid_at` vira meia-noite UTC, que é 21h do dia ANTERIOR em
 * Brasília — e o painel financeiro agrupa por `paid_at`. Uma venda das 23:57
 * de 11/09 apareceria no faturamento de 10/09.
 *
 * Meio-dia de Brasília (15:00 UTC) mantém o dia certo em qualquer fuso que o
 * painel use, e não finge uma hora que o gateway não informou. Valor que já
 * vem com hora passa intacto.
 */
export function diaAsaasParaInstante(cru: string | null | undefined): string | null {
  const s = String(cru ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T15:00:00.000Z`;
  return Number.isNaN(Date.parse(s)) ? null : s;
}

/**
 * O passo 2 em diante da criação: devolve a viva do mesmo valor, recusa se já
 * foi paga, ou cria cliente e cobrança novos.
 */
async function criarOuReaproveitar(
  args: Parameters<GatewayPix["criar"]>[0],
  cpf: string,
  decisao: DecisaoCobranca<PagamentoAsaas>,
): Promise<CobrancaPix> {
  if (decisao.tipo === "paga") {
    // Já foi paga. Gerar outra seria cobrar duas vezes pela mesma coisa, e
    // devolver esta como "reaproveitável" fazia o `criar-pix` gravar
    // `pendente` por cima do pedido pago. Mesma recusa da Woovi.
    throw new ErroGateway(COBRANCA_JA_PAGA, "asaas", false);
  }
  if (decisao.tipo === "reusar" && decisao.cobranca.id) {
    const viva = decisao.cobranca;
    const { payload, expiraEm } = await copiaECola(viva.id as string);
    return {
      gateway: "asaas",
      idExterno: viva.id as string,
      copiaECola: payload,
      valorCentavos: Math.round(Number(viva.value ?? 0) * 100),
      taxaCentavos: taxaDe(viva),
      expiraEm,
    };
  }

  // ── 2. O CLIENTE, QUE O ASAAS EXIGE ANTES DA COBRANÇA ────
  //
  // O E-MAIL É OPCIONAL PRO ASAAS, e não pode derrubar a venda. Em 26/09 uma
  // pessoa tentou comprar três vezes com "...@hotmail.com." (ponto no fim):
  // o Asaas respondia "O email informado é inválido.", o PIX não nascia, e
  // desde que a Perfect Pay saiu do plano B ela não tinha pra onde ir. Quem
  // avisa o comprador somos nós (`notificationDisabled`), então o e-mail lá
  // é só cadastro: limpa o óbvio e, se ainda assim for recusado, vai sem.
  const emailLimpo = args.email ? semPontoNoFim(args.email) || undefined : undefined;
  const criarCliente = (comEmail: boolean) =>
    chamarAsaas<{ id?: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: args.nome?.trim() || "Cliente Serenata",
        cpfCnpj: cpf,
        ...(comEmail && emailLimpo ? { email: emailLimpo } : {}),
        // A chave de reuso é o CPF, não o e-mail: o mesmo CPF comprando de
        // novo tem que cair no mesmo cliente, e e-mail a pessoa troca.
        externalReference: cpf,
        notificationDisabled: true, // quem fala com o comprador somos nós
      }),
    });
  let cliente: { id?: string };
  try {
    cliente = await criarCliente(true);
  } catch (err) {
    if (!(err instanceof ErroGateway) || !/e-?mail/i.test(err.message) || !emailLimpo) throw err;
    console.warn("[asaas-pix] e-mail recusado pelo Asaas, criando o cliente sem ele:", err.message);
    cliente = await criarCliente(false);
  }
  if (!cliente?.id) throw new ErroGateway("asaas não devolveu id de cliente", "asaas", false);

  // ── 3. A COBRANÇA ────────────────────────────────────────
  //
  // `dueDate` é hoje EM BRASÍLIA, e a distinção não é preciosismo: ver
  // `hojeEmBrasilia`. Data futura faz o Asaas tratar como agendamento, e
  // agendamento não tem QR.
  const hoje = hojeEmBrasilia();
  const p = await chamarAsaas<PagamentoAsaas>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: cliente.id,
      billingType: "PIX",
      value: args.valorCentavos / 100,
      dueDate: hoje,
      description: args.descricao.slice(0, 500),
      externalReference: args.referencia,
    }),
  });
  if (!p?.id) throw new ErroGateway("asaas não devolveu id de cobrança", "asaas", false);

  const { payload, expiraEm } = await copiaECola(p.id);
  return {
    gateway: "asaas",
    idExterno: p.id,
    copiaECola: payload,
    valorCentavos: Math.round(Number(p.value ?? args.valorCentavos / 100) * 100),
    taxaCentavos: taxaDe(p),
    expiraEm,
  };
}

export const asaasPix: GatewayPix = {
  nome: "asaas",
  exigeCpf: true,

  async criar(args): Promise<CobrancaPix> {
    const cpf = soDigitosCpf(args.cpf);
    // `tentarOutro: false` de propósito: repetir noutro gateway não conserta
    // CPF que não fecha. Quem chama traduz isto pra um pedido de correção na
    // tela, não pra "erro no pagamento".
    if (!cpfValido(cpf)) {
      throw new ErroGateway("CPF ausente ou inválido pro Asaas", "asaas", false);
    }

    // ── 1. JÁ EXISTE COBRANÇA PRA ESTA REFERÊNCIA? ───────────
    //
    // TRAVA DE VALOR: só se reaproveita a viva do MESMO valor. Se o bump do
    // quadro entrou ou saiu depois de gerada, reaproveitar mostraria R$ 38 na
    // tela em cima de um código que cobra R$ 62,90 (já aconteceu no primeiro
    // PIX real do bump, com a Woovi).
    //
    // As superadas (vencida, viva de outro valor) são canceladas EM PARALELO
    // com o resto, e esperadas só no fim: a pessoa não espera o DELETE pra ver
    // o QR, e a função não termina com chamada pendurada (na Vercel ela
    // congela depois de responder).
    const decisao = decidirCobrancaExistente(
      await cobrancasDaReferencia(args.referencia),
      args.valorCentavos,
    );
    const cancelando = cancelarSuperadas(decisao.cancelar);
    try {
      return await criarOuReaproveitar(args, cpf, decisao);
    } finally {
      await cancelando;
    }
  },

  async consultar(idExterno): Promise<StatusCobranca> {
    const p = await chamarAsaas<PagamentoAsaas>(`/payments/${encodeURIComponent(idExterno)}`);
    return {
      pago: asaasPagou(p?.status),
      statusCru: String(p?.status ?? "desconhecido"),
      valorCentavos: Number.isFinite(Number(p?.value)) ? Math.round(Number(p.value) * 100) : null,
      taxaCentavos: taxaDe(p ?? {}),
      // O Asaas não informa o titular da conta pagadora no PIX. Nulo é a
      // resposta certa: inventar aqui estragaria o dossiê de contestação, que
      // usa este campo como prova de que a conta é do titular.
      titularPix: null,
      // A data DELES. Sem isto, um conserto de dias depois jogaria venda
      // antiga no faturamento de hoje — o painel agrupa por `paid_at`.
      pagoEm: diaAsaasParaInstante(p?.confirmedDate ?? p?.paymentDate ?? p?.clientPaymentDate ?? null),
    };
  },
};

/**
 * A cobrança pela NOSSA referência, e não pelo id do Asaas.
 *
 * O PIX de upsell (`criar-pix-upsell.ts`) grava `asaas:up:<oferta>:<uuid>`, e
 * `consultar` só entende o id deles (`pay_...`). Até 15/09/2026 o vigia mandava
 * a referência pro `GET /payments/{id}`, levava erro e seguia em frente: 11
 * upsells pagos entre 12 e 14/09 ficaram sem crédito e sem quadro.
 */
export async function consultarPorReferencia(referencia: string): Promise<StatusCobranca | null> {
  const r = await chamarAsaas<{ data?: PagamentoAsaas[] }>(
    `/payments?externalReference=${encodeURIComponent(referencia)}&limit=10`,
  );
  const lista = r?.data ?? [];
  const p = lista.find((x) => asaasPagou(x.status)) ?? lista[0];
  if (!p?.id) return null;
  return asaasPix.consultar(p.id);
}
