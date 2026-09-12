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
import { ErroGateway, type CobrancaPix, type GatewayPix, type StatusCobranca } from "./gateway.js";
import { cpfValido, soDigitosCpf } from "./cpf.js";

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
 * A cobrança que já existe pra esta referência, se existir.
 *
 * ── ESTE É O CORAÇÃO DA IDEMPOTÊNCIA ─────────────────────────────
 *
 * Sem isto, duplo clique, reload da folha ou retry de rede criam cobranças
 * novas a cada vez — e o pior caso não é bagunça no painel deles, é a pessoa
 * pagando duas vezes o mesmo pedido.
 *
 * A janela não é infinita: `PENDING` e `AWAITING_RISK_ANALYSIS` ainda dão pra
 * reaproveitar; `OVERDUE`, `REFUNDED` e afins não, e aí uma cobrança nova é o
 * certo. Uma já paga também volta daqui, e quem chama decide o que fazer (a
 * tela mostra o mesmo QR e o webhook já entregou).
 */
async function cobrancaExistente(referencia: string): Promise<PagamentoAsaas | null> {
  const r = await chamarAsaas<{ data?: PagamentoAsaas[] }>(
    `/payments?externalReference=${encodeURIComponent(referencia)}&limit=10`,
  );
  const lista = r?.data ?? [];
  if (!lista.length) return null;
  const reaproveitavel = lista.find((p) => {
    const s = String(p.status ?? "").toUpperCase();
    return s === "PENDING" || s === "AWAITING_RISK_ANALYSIS" || asaasPagou(s);
  });
  return reaproveitavel ?? null;
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
    const jaExiste = await cobrancaExistente(args.referencia);
    if (jaExiste?.id) {
      // TRAVA DE VALOR. Se a cobrança viva for de outro valor (o bump do
      // quadro entrou ou saiu depois de gerada), reaproveitar mostraria R$ 38
      // na tela em cima de um código que cobra R$ 62,90. Já aconteceu no
      // primeiro PIX real do bump, com a Woovi.
      const valorLa = Math.round(Number(jaExiste.value ?? 0) * 100);
      if (valorLa === args.valorCentavos) {
        const { payload, expiraEm } = await copiaECola(jaExiste.id);
        return {
          gateway: "asaas",
          idExterno: jaExiste.id,
          copiaECola: payload,
          valorCentavos: valorLa,
          taxaCentavos: taxaDe(jaExiste),
          expiraEm,
        };
      }
      // Valor diferente: a referência ganha sufixo e nasce uma cobrança nova,
      // igual ao que a Woovi obriga a fazer. A antiga morre sozinha no
      // vencimento.
      args = { ...args, referencia: `${args.referencia}:v${args.valorCentavos}` };
    }

    // ── 2. O CLIENTE, QUE O ASAAS EXIGE ANTES DA COBRANÇA ────
    const cliente = await chamarAsaas<{ id?: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: args.nome?.trim() || "Cliente Serenata",
        cpfCnpj: cpf,
        ...(args.email ? { email: args.email } : {}),
        // A chave de reuso é o CPF, não o e-mail: o mesmo CPF comprando de
        // novo tem que cair no mesmo cliente, e e-mail a pessoa troca.
        externalReference: cpf,
        notificationDisabled: true, // quem fala com o comprador somos nós
      }),
    });
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
