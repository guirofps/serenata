import { inngest } from "../client.js";
import { cabecalhosDescadastro, linkDescadastroUmClique } from "../lib/descadastro.js";
import { bloqueados, estaBloqueado } from "../lib/emails-mortos.js";
import { todasAsPaginas } from "../lib/paginar.js";
import { jaTravado, soltarTrava, travarEnvio } from "../lib/trava-envio.js";
import { podeMandarMarketing } from "../lib/frequencia.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import {
  assuntoPedidoReacao,
  emailPedidoReacao,
  textoPedidoReacao,
} from "../../emails/pedido-reacao.js";
import {
  PEDIDO_REACAO_MAX_H,
  PEDIDO_REACAO_MIN_H,
  filaPedidoReacao,
  type PedidoParaReacao,
} from "../../src/lib/pedido-reacao.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";

// O PEDIDO DO VÍDEO DE REAÇÃO (teste `pedido_reacao`, 08/10).
//
// Metade dos compradores do português (caractere 3 do fim do id do quiz
// ímpar) recebe, no 3º dia depois da compra, um e-mail pedindo o vídeo de
// quem ganhou a música, com R$ 10 na próxima em troca. A outra metade não
// recebe nada, como hoje. Quem decide é `src/lib/pedido-reacao.ts`.
//
// O que se mede: quantos vídeos chegam (respostas no suporte), quantos viram
// anúncio, e se a segunda compra do B sobe com o cupom prometido. E o custo:
// descadastro e reclamação desse e-mail.
//
// ── AS TRAVAS, NA ORDEM DE 08/10 ─────────────────────────────────
//
// Uma vez por PESSOA (o evento `pedido_reacao_enviado` com o e-mail, numa
// janela de 180 dias), gravada ANTES do Resend (`trava-envio.ts`); bloqueio
// (descadastro, bounce, excluídos) que falha fechado; o teto de frequência do
// `limite_frequencia` no braço B dele; teto por rodada. Toda leitura tem
// janela de tempo.

const SITE = process.env.VITE_APP_URL?.startsWith("http") ? process.env.VITE_APP_URL : MARCA_ATIVA.url;

/** Por rodada. 11 rodadas por dia (9h35 a 19h35) dão 110/dia, contra ~75 esperados. */
const MAX_POR_RODADA = 10;

/** Uma vez por pessoa: quem compra de novo em seis meses não recebe outro. */
const TRAVA_DIAS = 180;

/** Quantos ids por `.in()`. */
const LOTE = 100;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function jaPedido(sb: ReturnType<typeof db>, email: string) {
  return jaTravado(
    sb,
    "pedido_reacao_enviado",
    { email },
    new Date(Date.now() - TRAVA_DIAS * 86400000).toISOString(),
  );
}

export const pedirReacao = inngest.createFunction(
  {
    id: "pedir-reacao",
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ cron: "35 12-22 * * *" }], // 9h35 às 19h35 de Brasília, fora do minuto cheio
  },
  async ({ step }) => {
    // Só a Serenata. Na Ballad nem é registrada (`api/inngest.ts`), e esta
    // linha segura um registro por engano.
    if (MARCA_ATIVA.chave === "ballad") return { pulado: "so serenata" };
    if (!linkDescadastroUmClique("teste@exemplo.com")) {
      console.error("[reacao] RECUPERACAO_SECRET ausente, marketing recusado");
      return { pulado: "sem descadastro" };
    }

    const fila = await step.run("achar-compradores-do-dia-3", async () => {
      const sb = db();
      const agora = Date.now();
      const pedidos = await todasAsPaginas<PedidoParaReacao & { id: string }>((de, ate) =>
        sb
          .from("pedidos")
          .select("id, email, quiz_response_id, musica_id, paid_at")
          .eq("status", "pago")
          .gt("valor_centavos", 0)
          .not("gateway", "in", "(credito,manual)")
          .or("dinheiro_entrou.is.null,dinheiro_entrou.eq.true")
          .not("musica_id", "is", null)
          .gte("paid_at", new Date(agora - PEDIDO_REACAO_MAX_H * 3600000).toISOString())
          .lte("paid_at", new Date(agora - PEDIDO_REACAO_MIN_H * 3600000).toISOString())
          .order("paid_at", { ascending: true })
          .order("id", { ascending: true })
          .range(de, ate),
      );
      if (!pedidos.length) return [];

      const quizIds = [...new Set(pedidos.map((p) => p.quiz_response_id).filter((x): x is string => Boolean(x)))];
      const musicaIds = [...new Set(pedidos.map((p) => p.musica_id).filter((x): x is string => Boolean(x)))];
      const quizzes = new Map<string, { locale: string | null; nome: string | null }>();
      for (let i = 0; i < quizIds.length; i += LOTE) {
        const { data, error } = await sb
          .from("quiz_responses")
          .select("id, locale, nome:respostas->>nome")
          .in("id", quizIds.slice(i, i + LOTE));
        if (error) throw new Error(`[reacao] quiz_responses: ${error.message}`);
        for (const q of (data ?? []) as Array<{ id: string; locale: string | null; nome: string | null }>) {
          quizzes.set(q.id, { locale: q.locale, nome: q.nome });
        }
      }
      const prontas = new Set<string>();
      for (let i = 0; i < musicaIds.length; i += LOTE) {
        const { data, error } = await sb
          .from("musicas")
          .select("id")
          .in("id", musicaIds.slice(i, i + LOTE))
          .eq("status", "pronta");
        if (error) throw new Error(`[reacao] musicas: ${error.message}`);
        for (const m of (data ?? []) as Array<{ id: string }>) prontas.add(m.id);
      }
      // Lança se não conseguir ler: o passo não monta fila e tenta de novo.
      const fora = await bloqueados(
        sb,
        pedidos.map((p) => p.email ?? ""),
        { incluirExcluidos: true },
      );
      return filaPedidoReacao({ pedidos, quizzes, prontas, bloqueados: fora, agora, max: MAX_POR_RODADA * 3 });
    });

    if (!fila.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of fila) {
      if (enviados >= MAX_POR_RODADA) break;
      const ok = await step.run(`reacao-${c.quizId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        if (await jaPedido(sb, c.email)) return false;
        if (await estaBloqueado(sb, c.email, { incluirExcluidos: true })) return false;
        // Teste `limite_frequencia`: no braço B dele, este e-mail espera a
        // janela de 24h abrir (sem trava, volta na próxima rodada).
        if (!(await podeMandarMarketing(sb, c.email, c.quizId, { locale: "pt" }))) return false;

        const trava = await travarEnvio(sb, {
          event_name: "pedido_reacao_enviado",
          event_data: { email: c.email, quiz_response_id: c.quizId, musica_id: c.musicaId },
        });
        if (!trava) return false;

        const assunto = assuntoPedidoReacao(c.nome);
        const linkResposta = `mailto:${MARCA_ATIVA.emailContato}?subject=${encodeURIComponent(`Re: ${assunto}`)}`;
        const linkDescadastro = linkDescadastroUmClique(c.email) ?? `${SITE}/descadastrar`;
        const { data: enviado, error } = await comUtm(new Resend(chave)).emails.send({
          tags: [
            { name: "template", value: "pedido_reacao" },
            { name: "teste", value: "pedido_reacao_b" },
          ],
          from: REMETENTE_RECUPERACAO,
          // A resposta COM O VÍDEO chega aqui. A triagem do suporte separa
          // pro dono (`ehRespostaDeReacao`), que confere e manda o cupom.
          replyTo: RESPONDER_PARA,
          to: [c.email],
          headers: cabecalhosDescadastro(c.email),
          subject: assunto,
          html: emailPedidoReacao({ nome: c.nome, linkResposta, linkDescadastro }),
          text: textoPedidoReacao({ nome: c.nome }),
        });
        if (error) {
          console.error("[reacao] envio falhou:", c.email, error.message);
          await soltarTrava(sb, trava);
          return false;
        }
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "pedido_reacao",
          para: c.email,
          quizResponseId: c.quizId,
        });
        return true;
      });
      if (ok) enviados += 1;
    }
    return { naFila: fila.length, enviados };
  },
);
