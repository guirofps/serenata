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
async function valorCentavosDaSessao(
  db: ReturnType<typeof supabaseAdmin>,
  attribution: unknown,
): Promise<number | null> {
  const braco = (attribution as { exp?: Record<string, string> } | null)?.exp?.preco ?? "A";
  const { data } = await db.from("experimentos").select("variantes").eq("id", "preco").maybeSingle();
  const variantes = (data?.variantes ?? []) as Array<{
    nome?: string;
    plano?: { valor?: number | string };
  }>;
  const achado = variantes.find((v) => v.nome === braco) ?? variantes.find((v) => v.nome === "A");
  const valor = Number(achado?.plano?.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 100);
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
  | { ok: false; erro: "sem-sessao" | "sem-musica" | "sem-preco" | "sem-ip" | "gateway" }
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

    const base = await valorCentavosDaSessao(db, quiz.attribution);
    if (!base) return { ok: false, erro: "sem-preco" };
    const valorCentavos = valorComBump(base, data.quadro === true);

    const ip = ipDoPagador();
    // SEM IP NÃO TENTA. O Asaas exige o campo, e mandar o IP do servidor é
    // pior que não mandar: passaria a análise dele a ver milhares de compras
    // da mesma origem.
    if (!ip) return { ok: false, erro: "sem-ip" };

    let r;
    try {
      r = await asaas.cobrar({
        valorCentavos,
        descricao: `Serenata · ${musica.titulo ?? "sua música"}`,
        referencia: `serenata:${quiz.id}`,
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
      return { ok: false, erro: "gateway" };
    }

    if (!r.ok) return { ok: false, erro: "recusado", motivo: r.motivo };

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
