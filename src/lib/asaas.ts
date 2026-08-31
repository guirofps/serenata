// O ASAAS, implementando `GatewayCartao`.
//
// ── POR QUE ELE ENTROU ───────────────────────────────────────────
//
// O cartão é ~15% das vendas e saía pela Perfect Pay. A tabela deles diz
// 7,90%, mas o que sai da conta é outra coisa, medido em 31 vendas reais:
//
//   7,90% + R$ 1,22 de taxa fixa = 11,14% no ticket de R$ 38
//
// A fixa é o que mata: R$ 1,22 num ticket de R$ 38 são 3,2 pontos. O Asaas
// cobra 1,99% + R$ 0,49 (promocional até 30/11/2026; depois 2,99% + R$ 0,49),
// o que dá R$ 1,25 contra R$ 4,07. São R$ 2,82 por venda, ~R$ 627/mês.
//
// Prazo de recebimento: 32 dias, contra 30 da Perfect Pay. Dois dias de
// diferença — irrelevante, e foi conferido antes de decidir porque uma
// diferença grande aqui valeria mais que a economia da taxa.
//
// ── NÃO USA `@/` ─────────────────────────────────────────────────
//
// Mesma regra do `woovi.ts`: carregado pelo runtime Node da Vercel.

import {
  ErroGateway,
  type GatewayCartao,
  type ResultadoCartao,
} from "./gateway-cartao.js";

/**
 * Sandbox ou produção, decidido pelo PREFIXO DA CHAVE e não por env própria.
 *
 * As chaves do Asaas se identificam: `$aact_hmlg_` é homologação, `$aact_prod_`
 * é produção. Derivar a URL daí torna impossível o erro clássico de apontar a
 * chave de sandbox pro endpoint de produção (que responde 401 e parece
 * "credencial errada") ou, muito pior, o contrário.
 */
function base(chave: string): string {
  return chave.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

function chaveDoAmbiente(): string {
  const k = process.env.ASAAS_API_KEY ?? process.env.ASAAS_API_KEY_SANDBOX;
  if (!k) throw new ErroGateway("ASAAS_API_KEY ausente", "asaas", false);
  return k;
}

/**
 * Uma chamada à API deles.
 *
 * ── O CORPO DO ERRO NUNCA SOBE INTEIRO ───────────────────────────
 *
 * A requisição de cobrança CARREGA o número do cartão. Se um `catch` genérico
 * jogasse o corpo enviado numa mensagem de erro, o número acabaria no log da
 * Vercel — que é exatamente o que não pode acontecer com o PCI-DSS em cima.
 * Por isso o erro só carrega status e a mensagem que o Asaas devolve.
 */
async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const chave = chaveDoAmbiente();
  let r: Response;
  try {
    r = await fetch(base(chave) + caminho, {
      ...init,
      headers: {
        access_token: chave,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    // Rede: vale tentar de novo ou cair pro checkout antigo.
    throw new ErroGateway(`asaas indisponível: ${(err as Error).message}`, "asaas", true);
  }

  const txt = await r.text();
  let corpo: unknown = null;
  try {
    corpo = txt ? JSON.parse(txt) : null;
  } catch {
    corpo = null;
  }

  if (!r.ok) {
    const erros = (corpo as { errors?: Array<{ description?: string; code?: string }> })?.errors;
    const desc = erros?.[0]?.description ?? `HTTP ${r.status}`;
    // 5xx e 429 valem outra tentativa; 4xx é pedido nosso errado ou recusa.
    throw new ErroGateway(desc, "asaas", r.status >= 500 || r.status === 429);
  }
  return corpo as T;
}

/**
 * Só dígitos. O formulário deixa a pessoa digitar do jeito dela.
 *
 * CPF com ponto, CEP com traço e telefone com parêntese são o normal de quem
 * digita no celular, e a API deles recusa tudo isso. Limpar aqui, uma vez, é
 * melhor que confiar em máscara — máscara some quando a pessoa cola.
 */
const soDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

/**
 * O status do Asaas quer dizer que o dinheiro está garantido?
 *
 * `CONFIRMED` é autorizado e capturado; `RECEIVED` é liquidado. Os dois valem
 * entrega. `PENDING` e `AWAITING_RISK_ANALYSIS` NÃO — o segundo é a análise
 * antifraude deles, que pode terminar em `REPROVED_BY_RISK_ANALYSIS` depois.
 * Entregar em cima de análise pendente é entregar e depois perder o dinheiro.
 */
function pagou(status: unknown): boolean {
  const s = String(status ?? "").toUpperCase();
  return s === "CONFIRMED" || s === "RECEIVED" || s === "RECEIVED_IN_CASH";
}

/**
 * A recusa, traduzida pra quem está com o cartão na mão.
 *
 * O texto do gateway ("Transação não autorizada", códigos) não ajuda ninguém a
 * resolver. A pessoa precisa saber se tenta de novo, se troca de cartão ou se
 * liga pro banco. Genérico só como último caso.
 */
function motivoHumano(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("saldo") || d.includes("insufficient") || d.includes("limite"))
    return "O banco recusou por limite. Tenta outro cartão?";
  if (d.includes("expir") || d.includes("venc")) return "A validade do cartão não confere.";
  if (d.includes("cvv") || d.includes("security") || d.includes("código de segurança"))
    return "O código de segurança não confere.";
  if (d.includes("número") || d.includes("number") || d.includes("invalid card"))
    return "O número do cartão não confere.";
  if (d.includes("cpf")) return "O CPF não confere com o titular do cartão.";
  return "O banco não autorizou. Tenta outro cartão, ou paga por PIX.";
}

export const asaas: GatewayCartao = {
  nome: "asaas",

  async cobrar(args): Promise<ResultadoCartao> {
    // ── 1. O CLIENTE, QUE O ASAAS EXIGE ANTES DA COBRANÇA ────
    //
    // `externalReference` é a nossa chave: reusar o mesmo cliente evita
    // encher a base deles de duplicata a cada compra da mesma pessoa, e é o
    // que permite tokenizar o cartão dela depois sem pedir tudo de novo.
    const cpf = soDigitos(args.titular.cpf);
    const cliente = await chamar<{ id?: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: args.titular.nome,
        email: args.titular.email,
        cpfCnpj: cpf,
        mobilePhone: soDigitos(args.titular.telefone),
        externalReference: args.titular.email.toLowerCase(),
        notificationDisabled: true, // quem fala com o comprador somos nós
      }),
    });
    if (!cliente?.id) throw new ErroGateway("asaas não devolveu id de cliente", "asaas", false);

    // ── 2. A COBRANÇA ────────────────────────────────────────
    //
    // `dueDate` é hoje: cartão autoriza na hora, e data futura faria o Asaas
    // tratar como agendamento.
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      const p = await chamar<{
        id?: string;
        status?: string;
        value?: number;
        creditCard?: { creditCardNumber?: string; creditCardBrand?: string };
      }>("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: cliente.id,
          billingType: "CREDIT_CARD",
          value: args.valorCentavos / 100,
          dueDate: hoje,
          description: args.descricao.slice(0, 500),
          externalReference: args.referencia,
          // O IP É DO PAGADOR, exigência da API deles. Ver o contrato.
          remoteIp: args.ipDoPagador,
          ...(args.parcelas && args.parcelas > 1 ? { installmentCount: args.parcelas } : {}),
          creditCard: {
            holderName: args.cartao.titular,
            number: soDigitos(args.cartao.numero),
            expiryMonth: args.cartao.validadeMes,
            expiryYear: args.cartao.validadeAno,
            ccv: args.cartao.cvv,
          },
          creditCardHolderInfo: {
            name: args.titular.nome,
            email: args.titular.email,
            cpfCnpj: cpf,
            postalCode: soDigitos(args.titular.cep),
            addressNumber: args.titular.numeroEndereco,
            phone: soDigitos(args.titular.telefone),
          },
        }),
      });

      if (!p?.id) throw new ErroGateway("asaas não devolveu id de cobrança", "asaas", false);
      return {
        ok: true,
        gateway: "asaas",
        idExterno: p.id,
        confirmado: pagou(p.status),
        statusCru: String(p.status ?? "desconhecido"),
        valorCentavos: Math.round(Number(p.value ?? 0) * 100),
        // Só isto pode ser guardado. Nunca o número inteiro, nunca o CVV.
        ultimos4: p.creditCard?.creditCardNumber ?? null,
        bandeira: p.creditCard?.creditCardBrand ?? null,
      };
    } catch (err) {
      // ── RECUSA NÃO É FALHA DE INTEGRAÇÃO ───────────────────
      //
      // A documentação deles: transação recusada devolve 400 e a cobrança NÃO
      // é persistida. Se isso subisse como `ErroGateway`, a tela mostraria
      // "erro no pagamento" pra quem só precisa tentar outro cartão — e a
      // gente perderia a venda por causa da palavra errada.
      if (err instanceof ErroGateway && !err.tentarOutro) {
        return { ok: false, motivo: motivoHumano(err.message), statusCru: err.message };
      }
      throw err;
    }
  },

  async consultar(idExterno) {
    const p = await chamar<{ status?: string; value?: number; netValue?: number }>(
      `/payments/${encodeURIComponent(idExterno)}`,
    );
    const bruto = Number(p?.value ?? 0);
    const liquido = Number(p?.netValue ?? 0);
    return {
      confirmado: pagou(p?.status),
      statusCru: String(p?.status ?? "desconhecido"),
      valorCentavos: bruto ? Math.round(bruto * 100) : null,
      // O Asaas não devolve a taxa direto: ela é a diferença pro líquido.
      taxaCentavos: bruto && liquido ? Math.round((bruto - liquido) * 100) : null,
    };
  },
};
