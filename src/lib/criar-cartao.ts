import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { asaas } from "@/lib/asaas";
import { ErroGateway, type DadosCartao, type TitularCartao } from "@/lib/gateway-cartao";
import { valorComBump } from "@/lib/criar-pix";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "../../api/lib/entrega";

// A COBRANÇA NO CARTÃO, transparente.
//
// ── POR QUE ESTE ARQUIVO EXISTE SEPARADO DO `criar-pix` ──────────
//
// Os dois cobram, mas não são a mesma coisa. O PIX cria uma cobrança e espera;
// o cartão tenta autorizar e responde na hora, sim ou não. E este aqui recebe
// NÚMERO DE CARTÃO, o que impõe regras que o outro não tem: nada do que chega
// aqui pode ser gravado, logado ou repetido numa mensagem de erro.
//
// Manter separado também é o que um auditor de PCI-DSS pede pra ver — quanto
// menor a superfície que toca cartão, menor o escopo.
//
// ── O QUE ELE HERDA DO PIX, E NÃO É NEGOCIÁVEL ───────────────────
//
// O PREÇO NUNCA VEM DO CLIENTE. Sai do braço de `preco` que aquela sessão
// sorteou, lido no servidor, exatamente como no `criar-pix.ts`. Se viesse do
// navegador, o DevTools levaria a música por R$ 1.

/**
 * O preço daquela pessoa, do braço que ela sorteou.
 *
 * Cópia deliberada da lógica do `criar-pix.ts` em vez de import: aquele módulo
 * carrega o cliente da Woovi junto, e este caminho não tem por que conhecer o
 * gateway de PIX. O que os dois compartilham de verdade — a soma do bump — vem
 * de `valorComBump`, que é testada.
 */
/**
 * O checkout hospedado da Perfect Pay do braço de preço desta sessão.
 *
 * ── POR QUE ELE VOLTA A EXISTIR ──────────────────────────────
 *
 * O cartão saiu da Perfect Pay e virou nosso, transparente, a 100%. Mas o
 * checkout dela continua de pé (ele atende o funil espanhol e quem chega com
 * cupom), e continua sendo o único outro lugar onde uma pessoa consegue pagar
 * com cartão hoje. Se o Asaas não responde, é isso ou nada.
 *
 * NUNCA confia no que está gravado: o campo é editável pelo painel de teste
 * A/B, e mandar a pessoa pra uma URL vinda do banco sem conferir é redirect
 * aberto. A distância entre "failover" e "phishing hospedado por nós" é essa
 * validação.
 */
export function checkoutAntigoDoBraco(variantes: unknown, braco: string): string | null {
  const lista = (variantes ?? []) as Array<{ nome?: string; plano?: { checkout?: unknown } }>;
  const achado = lista.find((v) => v.nome === braco) ?? lista.find((v) => v.nome === "A");
  const url = achado?.plano?.checkout;
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    // Só HTTPS e só o domínio que a gente conhece.
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "go.perfectpay.com.br") return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function valorCentavosDaSessao(
  db: ReturnType<typeof supabaseAdmin>,
  attribution: unknown,
): Promise<{ centavos: number | null; checkoutAntigo: string | null }> {
  const braco = (attribution as { exp?: Record<string, string> } | null)?.exp?.preco ?? "A";
  const { data } = await db.from("experimentos").select("variantes").eq("id", "preco").maybeSingle();
  const variantes = (data?.variantes ?? []) as Array<{
    nome?: string;
    plano?: { valor?: number | string };
  }>;
  const achado = variantes.find((v) => v.nome === braco) ?? variantes.find((v) => v.nome === "A");
  const valor = Number(achado?.plano?.valor);
  return {
    centavos: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null,
    // Sai da MESMA leitura: o failover não pode custar outra ida ao banco
    // dentro de um caminho que já está acontecendo porque algo caiu.
    checkoutAntigo: checkoutAntigoDoBraco(data?.variantes, braco),
  };
}

/**
 * O IP de QUEM COMPRA, que a API do Asaas exige.
 *
 * A documentação deles é explícita: "Informe em `remoteIp` o IP do dispositivo
 * do pagador, não o IP do servidor." Mandar o IP da função serverless faria
 * todo comprador parecer a mesma pessoa e envenenaria o antifraude deles
 * contra a gente — recusa em massa, sem explicação.
 *
 * Mesma extração do `limite-uso.server.ts`: na Vercel o `x-forwarded-for` é
 * reescrito na borda, então não dá pra forjar de fora, e o primeiro item da
 * lista é o cliente.
 *
 * Aqui ele vai EM CLARO pro gateway (é o que a API pede) mas não é gravado por
 * nós — diferente do `limite-uso`, que guarda hash porque persiste.
 */
function ipDoPagador(): string | null {
  try {
    const bruto =
      getRequestHeader("x-forwarded-for") ??
      getRequestHeader("x-real-ip") ??
      getRequestHeader("cf-connecting-ip");
    const ip = String(bruto ?? "")
      .split(",")[0]
      ?.trim();
    if (ip) return ip;
    // ── SÓ EM DESENVOLVIMENTO ──────────────────────────────
    //
    // Em `vite dev` não existe `x-forwarded-for`, então a trava abaixo barrava
    // toda tentativa e o formulário nunca chegava a falar com o Asaas — o
    // sintoma era "não consegui processar agora" sem nenhuma linha de log.
    //
    // `import.meta.env.DEV` é falso no build da Vercel, então em produção a
    // regra continua inteira: sem IP do pagador, não cobra.
    if (import.meta.env?.DEV) return "127.0.0.1";
    return null;
  } catch {
    return null;
  }
}

export type ResultadoCartao =
  | { ok: true; pago: boolean; idExterno: string }
  | {
      ok: false;
      erro: "sem-sessao" | "sem-musica" | "sem-preco" | "sem-ip" | "gateway";
      /**
       * Pra onde mandar quem ficou sem caminho, quando houver.
       *
       * Só vem preenchido no `gateway`, e só depois das três travas abaixo.
       * `null` significa "não tem volta segura" — a tela então mostra o erro
       * e o PIX, que é o que ela já fazia.
       */
      outroCaminho?: string | null;
    }
  | { ok: false; erro: "recusado"; motivo: string };

export const cobrarCartao = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      quadro?: boolean;
      cartao: DadosCartao;
      titular: TitularCartao;
    }) => data,
  )
  .handler(async ({ data }): Promise<ResultadoCartao> => {
    const db = supabaseAdmin();

    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, email, respostas, attribution, whatsapp")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!quiz?.id) return { ok: false, erro: "sem-sessao" };

    // A MÚSICA TEM QUE EXISTIR. Mesma trava do PIX, e pelo mesmo motivo: a
    // regra de ouro do projeto é nunca cobrar por algo que ainda não foi
    // produzido.
    const { data: musica } = await db
      .from("musicas")
      .select("id, titulo")
      .eq("quiz_response_id", quiz.id)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!musica?.id) return { ok: false, erro: "sem-musica" };

    const { centavos: base, checkoutAntigo } = await valorCentavosDaSessao(db, quiz.attribution);
    if (!base) return { ok: false, erro: "sem-preco" };
    const valorCentavos = valorComBump(base, data.quadro === true);

    const ip = ipDoPagador();
    // SEM IP NÃO TENTA. O Asaas exige o campo, e mandar o IP do servidor é
    // pior que não mandar: passaria a análise dele a ver milhares de compras
    // da mesma origem.
    if (!ip) return { ok: false, erro: "sem-ip" };

    // ── A VOLTA PRO CHECKOUT ANTIGO, E AS TRÊS TRAVAS ────────────
    //
    // Se o Asaas não responde, o cartão morre num beco: a pessoa fica com a
    // mensagem de erro e nenhum outro lugar pra pagar. Cartão é ~10% das
    // vendas, uns R$ 8.000/mês, então o beco custa dinheiro de verdade.
    //
    // Mas failover largo aqui COBRA DUAS VEZES, então ele é estreito:
    //
    // 1. Só quando o erro é de INFRA. Recusa do banco jamais: mandar um cartão
    //    recusado pra outro gateway é segunda recusa e marca no antifraude.
    //    Falta de música, preço ou sessão também não — ali a pré-condição
    //    nossa falhou, e cobrar seria vender o que não foi produzido.
    // 2. Só depois de PERGUNTAR ao Asaas se a cobrança nasceu. Timeout diz que
    //    a gente não recebeu resposta, não que nada aconteceu. Se apareceu
    //    cobrança com a nossa referência, a volta está proibida.
    // 3. Só SEM o quadro. O checkout hospedado cobra o preço do plano e não
    //    conhece o order bump; mandar pra lá quem escolheu o quadro cobraria
    //    valor diferente do que ela marcou na tela. Com quadro, o caminho
    //    continua sendo o PIX, que carrega o bump certo.
    const referencia = `serenata:${quiz.id}`;
    const voltaSegura = async (): Promise<string | null> => {
      if (!checkoutAntigo) return null;
      if (data.quadro === true) return null;
      if (await asaas.existeCobranca(referencia)) return null;
      return checkoutAntigo;
    };

    let r;
    try {
      r = await asaas.cobrar({
        valorCentavos,
        descricao: `Serenata · ${musica.titulo ?? "sua música"}`,
        referencia,
        cartao: data.cartao,
        titular: data.titular,
        ipDoPagador: ip,
      });
    } catch (err) {
      // NUNCA repete o corpo enviado: ele carrega o número do cartão. Só o
      // nome do gateway e a mensagem que ele devolveu.
      console.error(
        "[cartao] asaas falhou:",
        err instanceof ErroGateway ? err.message : "erro desconhecido",
      );
      return { ok: false, erro: "gateway", outroCaminho: await voltaSegura() };
    }

    if (!r.ok) return { ok: false, erro: "recusado", motivo: r.motivo };

    // ── A TAXA, QUE A COBRANÇA NÃO DEVOLVE ───────────────────────
    //
    // Descoberto olhando a PRIMEIRA venda real de cartão: `taxa_centavos`
    // estava null nos 3 pedidos do Asaas, contra 13/13 gravadas na Woovi. Com
    // a taxa em branco o painel lê a venda de cartão como se o gateway fosse
    // de graça, e o lucro do dia sai inflado.
    //
    // A resposta da cobrança não traz `netValue` — ela nasce no mesmo
    // instante e o líquido ainda não foi calculado. Por isso é uma segunda
    // pergunta, e ela só acontece em venda CONFIRMADA: é uma chamada a mais
    // num caminho que acabou de dar certo, nunca no caminho de recusa.
    //
    // Falha aqui não pode custar a entrega: sem taxa o pedido continua pago e
    // o número entra depois pelo webhook. Perder a venda por causa de um dado
    // contábil seria a troca errada.
    let taxaCentavos: number | null = null;
    try {
      taxaCentavos = (await asaas.consultar(r.idExterno)).taxaCentavos;
    } catch (err) {
      console.error("[cartao] taxa nao lida:", (err as Error).message);
    }

    // ── O PEDIDO ─────────────────────────────────────────────
    //
    // `payment_id` no mesmo formato do resto (`gateway:id`) pra o painel e a
    // idempotência do webhook lerem tudo do mesmo jeito.
    //
    // O e-mail da venda é o do TITULAR do cartão, que é quem pagou — mas a
    // entrega segue pelo e-mail do quiz. São coisas diferentes e já nos
    // custaram uma hora de investigação numa disputa: `nome_pagador` guardava
    // a homenageada e ninguém achava o comprador.
    // ── `paid_at` NÃO PODE SER REESCRITO ─────────────────────
    //
    // O CSV de conversões do Google usa `horaGoogle(paid_at)` como horário da
    // conversão, e a deduplicação do Google é por `gclid` + nome + HORÁRIO.
    // Enquanto o horário é o mesmo, subir a mesma venda dez vezes conta uma —
    // que é o que permite agendar o upload várias vezes por dia.
    //
    // Se este upsert rodar de novo (retentativa da rede, duplo-clique que
    // passou pela trava da tela) e reescrever `paid_at`, a MESMA venda passa a
    // ter dois horários e entra duas vezes no Google. O Smart Bidding aprende
    // uma receita que não existe e sobe lance em cima dela.
    //
    // O webhook da Woovi já se protege disso saindo cedo quando o pedido está
    // pago; aqui a proteção é ler antes e só carimbar na primeira vez.
    const { data: jaExiste } = await db
      .from("pedidos")
      .select("paid_at")
      .eq("payment_id", `asaas:${r.idExterno}`)
      .maybeSingle();

    const { error } = await db.from("pedidos").upsert(
      {
        payment_id: `asaas:${r.idExterno}`,
        gateway: "asaas",
        status: r.confirmado ? "pago" : "pendente",
        status_gateway: r.statusCru,
        email: quiz.email ?? data.titular.email,
        titular_pix: data.titular.nome,
        telefone: (quiz.whatsapp as string | null) || data.titular.telefone,
        valor_centavos: valorCentavos,
        bump_quadro: data.quadro === true,
        ...(taxaCentavos != null ? { taxa_centavos: taxaCentavos } : {}),
        quiz_response_id: quiz.id,
        musica_id: musica.id,
        // `paid_at` SÓ NA PRIMEIRA VEZ. Ver o bloco abaixo.
        ...(r.confirmado && !jaExiste ? { paid_at: new Date().toISOString() } : {}),
      },
      { onConflict: "payment_id" },
    );
    if (error) {
      // A COBRANÇA JÁ PASSOU no gateway. Sumir com o resultado seria cobrar e
      // não registrar — o pior desfecho possível. Grita no log e devolve o
      // sucesso; o webhook conserta a linha depois.
      console.error("[cartao] gravar pedido falhou:", error.message);
    }

    // ── A ENTREGA, NA HORA ───────────────────────────────────
    //
    // Diferente do PIX. Lá o pagamento é assíncrono e o webhook é o único
    // sinal que existe; aqui a autorização é SÍNCRONA — a gente acabou de
    // saber que pagou. Esperar um webhook pra mandar o e-mail seria escolher
    // o caminho mais lento e mais frágil de propósito, ainda mais com uma
    // fila que a documentação do Asaas diz que PARA depois de 15 falhas.
    //
    // O webhook continua entregando também, e isso não duplica: o
    // `mandarEmailDeEntrega` é o mesmo módulo nos dois, e o webhook sai cedo
    // quando o pedido já está pago.
    //
    // A entrega NUNCA derruba a resposta: se o e-mail falhar, a pessoa pagou e
    // precisa ver a confirmação mesmo assim. O erro vira log e o webhook (ou o
    // painel) reenvia.
    if (r.confirmado) {
      try {
        const musicaPronta = await musicaDoQuiz(db, quiz.id);
        if (musicaPronta) {
          await refazerSeFaltou(db, quiz.id);
          await mandarEmailDeEntrega(db, {
            email: (quiz.email as string | null) ?? data.titular.email,
            musica: musicaPronta,
            nomePagador: data.titular.nome,
          });
        }
      } catch (err) {
        console.error("[cartao] entrega falhou:", (err as Error).message);
      }
    }

    return { ok: true, pago: r.confirmado, idExterno: r.idExterno };
  });
