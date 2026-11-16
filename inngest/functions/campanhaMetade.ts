import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { inngest } from "../client.js";
import { cabecalhosDescadastro, linkDescadastroUmClique } from "../lib/descadastro.js";
import { bloqueados } from "../lib/emails-mortos.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { assuntoCampanhaMetade, emailCampanhaMetade } from "../../emails/campanha-metade.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { primeiroNome } from "../../src/lib/ocasioes.js";
import { METADE, validadeCurta } from "../../src/lib/cupom.js";
import { emLotes, freioAcionado, idsDoLote, separarPorValidade } from "../../src/lib/campanha-musica10.js";
import {
  CAMPANHA_METADE as CAMPANHA,
  CONTROLE_PCT,
  POR_RODADA_METADE as POR_RODADA,
  TEMPLATE_METADE,
  linkContaMetade,
  linkCriarMetade,
  podeEnviarMetade,
} from "../../src/lib/campanha-metade.js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";

// A CAMPANHA METADE (16/11/2026, Ralph): 50% em música, vídeo e quadro, SÓ pra
// quem já comprou, com 10% de controle que não recebe.
//
// É o job da MUSICA10 (`campanhaMusica10.ts`) copiado, com as mesmas três travas
// contra mandar duas vezes (`enviado_em`, chave de idempotência, `concurrency: 1`)
// e o mesmo freio de bounce e reclamação. O que muda:
//
//   - a fila é só de compradores (`montar_campanha_compradores`), e o grupo de
//     controle já nasce nela com `pulado = 'controle'`: o job nunca pega linha
//     com `pulado`, então o controle nunca recebe;
//   - 300 por rodada, metade do ritmo;
//   - para sozinho quando o cupom tem menos de 3 dias pela frente
//     (`podeEnviarMetade`): não promete desconto que morre amanhã.
//
// Liga com `CAMPANHA_METADE_ON=1` na Vercel. A FILA deve ser montada antes, no
// SQL Editor (`select montar_campanha_compradores('metade')`): pelo job a função
// roda sob o corte de 8s do PostgREST e pode não terminar.

const SITE = process.env.VITE_APP_URL?.startsWith("http") ? process.env.VITE_APP_URL : MARCA_ATIVA.url;

/** "Domingo na Casa da Eva" (mãe), de `exemplos-pt.ts`: quem fez pra esposa vê a próxima pessoa. */
const LINK_EXEMPLO = `${SITE}/p/533db522753f423e8b2227`;

type Linha = { email: string; versao: "comprador"; quiz_response_id: string | null; nome: string | null };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function montarEmail(l: Linha) {
  const nome = primeiroNome(l.nome);
  return {
    from: REMETENTE_RECUPERACAO,
    replyTo: RESPONDER_PARA,
    to: l.email,
    headers: cabecalhosDescadastro(l.email),
    subject: assuntoCampanhaMetade(nome),
    html: emailCampanhaMetade({
      nome,
      linkCriar: linkCriarMetade(SITE),
      linkConta: linkContaMetade(SITE),
      linkExemplo: LINK_EXEMPLO,
      linkDescadastro: linkDescadastroUmClique(l.email) ?? `${SITE}/descadastrar`,
      valeAte: validadeCurta(METADE),
    }),
  };
}

export const campanhaMetade = inngest.createFunction(
  {
    id: "campanha-metade",
    concurrency: { limit: 1 },
    retries: 1,
    // 9h40 às 20h40 de Brasília, como os outros e-mails de marketing.
    triggers: [{ cron: "40 12-23 * * *" }, { event: "campanha/metade.teste" }],
  },
  async ({ event, step }) => {
    // ── TESTE: o e-mail pra UM endereço, com [TESTE] no assunto ──
    if (event?.name === "campanha/metade.teste") {
      const para = String((event.data as { para?: string } | undefined)?.para ?? "").trim().toLowerCase();
      if (!para.includes("@")) return { erro: "evento sem `para`" };
      return step.run("teste", async () => {
        const resend = comUtm(new Resend(process.env.RESEND_API_KEY));
        const e = montarEmail({ email: para, versao: "comprador", quiz_response_id: null, nome: "Maria" });
        const r = await resend.emails.send({ ...e, subject: `[TESTE] ${e.subject}` });
        return { id: r.data?.id ?? null, erro: r.error?.message ?? null };
      });
    }

    if (process.env.CAMPANHA_METADE_ON !== "1") return { desligado: true };
    // Cupom vencendo: para de mandar. Quem ficou na fila não recebe promessa morta.
    if (!podeEnviarMetade()) return { cupomNoFim: true };

    const total = await step.run("montar-fila-se-vazia", async () => {
      const sb = db();
      const { count, error } = await sb
        .from("campanha_envios")
        .select("email", { count: "exact", head: true })
        .eq("campanha", CAMPANHA);
      if (error) throw new Error(error.message);
      if ((count ?? 0) > 0) return count ?? 0;
      const r = await sb.rpc("montar_campanha_compradores", { p_campanha: CAMPANHA, p_controle_pct: CONTROLE_PCT });
      if (r.error) throw new Error(r.error.message);
      return Number(r.data ?? 0);
    });

    const parado = await step.run("freio", async () => {
      const sb = db();
      const r = await sb.rpc("taxas_campanha", {
        p_campanha: CAMPANHA,
        p_desde: new Date(Date.now() - 86_400_000).toISOString(),
      });
      if (r.error) throw new Error(r.error.message);
      const t = (r.data as Array<{ enviados: number; bounces: number; reclamacoes: number }> | null)?.[0];
      const taxas = {
        enviados: Number(t?.enviados ?? 0),
        bounces: Number(t?.bounces ?? 0),
        reclamacoes: Number(t?.reclamacoes ?? 0),
      };
      const motivo = freioAcionado(taxas);
      if (!motivo) return null;
      // Avisa só na rodada em que PAROU (houve envio na última hora); nas
      // seguintes, parada já avisada, fica quieto. Volta sozinho quando a
      // janela de 24h sai do vermelho.
      const hora = await sb
        .from("campanha_envios")
        .select("email", { count: "exact", head: true })
        .eq("campanha", CAMPANHA)
        .gte("enviado_em", new Date(Date.now() - 70 * 60_000).toISOString());
      if ((hora.count ?? 0) > 0) {
        await avisarDonos({
          assunto: "Campanha METADE parou sozinha",
          html:
            `<p>${motivo}.</p>` +
            `<p>Últimas 24h: ${taxas.enviados} enviados, ${taxas.bounces} bounces, ${taxas.reclamacoes} reclamações.</p>` +
            `<p>Ela volta sozinha quando a taxa das últimas 24h cair. Pra parar de vez: tirar CAMPANHA_METADE_ON na Vercel.</p>`,
        });
      }
      return motivo;
    });
    if (parado) return { parado, total };

    const fila = await step.run("pegar-fila", async () => {
      const { data, error } = await db()
        .from("campanha_envios")
        .select("email, versao, quiz_response_id, nome")
        .eq("campanha", CAMPANHA)
        .is("enviado_em", null)
        .is("pulado", null)
        .order("email", { ascending: true })
        .limit(POR_RODADA);
      if (error) throw new Error(error.message);
      return (data ?? []) as Linha[];
    });
    if (!fila.length) return { terminou: true, total };

    let enviados = 0;
    let pulados = 0;
    let lotesFalhos = 0;
    let ultimoErro = "";
    for (const [i, lote] of emLotes(fila).entries()) {
      const r = await step.run(`lote-${i}-${lote[0].email}`, async () => {
        const sb = db();
        const marcar = (emails: string[], motivo: string) =>
          emails.length
            ? sb.from("campanha_envios").update({ pulado: motivo }).eq("campanha", CAMPANHA).in("email", emails)
            : null;

        // Rechecagem NA HORA: quem se descadastrou ou voltou desde a montagem.
        const fora = await bloqueados(sb, lote.map((l) => l.email));
        await marcar([...fora], "bloqueado");
        // E o que NUNCA é endereço (`x@hotmail.com.`): sai antes de chegar no
        // Resend, senão derrubaria o lote inteiro e voltaria toda hora.
        const { validos, invalidos } = separarPorValidade(lote.filter((l) => !fora.has(l.email)));
        await marcar(invalidos.map((l) => l.email), "invalido");
        const puladosAqui = fora.size + invalidos.length;
        if (!validos.length) return { enviados: 0, pulados: puladosAqui, erro: null as string | null };

        const chave = createHash("sha256").update(validos.map((l) => l.email).join(",")).digest("hex").slice(0, 40);
        const resend = comUtm(new Resend(process.env.RESEND_API_KEY));
        // PERMISSIVE: um endereço que o Resend recusar não leva os outros 99
        // junto; ele volta em `errors` com o índice e vira `pulado`.
        const resp = await resend.batch.send(validos.map(montarEmail), {
          idempotencyKey: `metade-${chave}`,
          batchValidation: "permissive",
        });
        if (resp.error) {
          // Sem marcar: a próxima rodada tenta de novo. Lançar derrubaria os
          // outros lotes; o aviso sai no fim da rodada se NADA tiver saído.
          console.error("[campanha] resend recusou o lote:", resp.error.message);
          return { enviados: 0, pulados: puladosAqui, erro: resp.error.message };
        }
        const ids = idsDoLote(validos.length, resp.data?.data ?? [], resp.data?.errors ?? []);
        const recusados = validos.filter((_, k) => !ids[k]);
        if (recusados.length) {
          console.error("[campanha] resend recusou endereços:", JSON.stringify(resp.data?.errors ?? []).slice(0, 500));
          await marcar(recusados.map((l) => l.email), "recusado");
        }
        const aceitos = validos.map((l, k) => ({ l, id: ids[k] })).filter((x) => x.id);
        const agora = new Date().toISOString();
        const { error: erroMarca } = await sb.from("campanha_envios").upsert(
          aceitos.map(({ l, id }) => ({ ...l, campanha: CAMPANHA, enviado_em: agora, email_id: id })),
          { onConflict: "campanha,email" },
        );
        if (erroMarca) {
          // O Resend JÁ mandou. A chave de idempotência segura a repetição por
          // 24h; isto aqui precisa de gente olhando antes disso.
          console.error("[campanha] ENVIADO e não marcado:", erroMarca.message, validos[0].email);
          await avisarDonos({
            assunto: "Campanha METADE: lote enviado e não marcado",
            html: `<p>${erroMarca.message}</p>`,
          });
        }
        for (const { l, id } of aceitos) {
          await registrarEnvio(sb, {
            emailId: id,
            template: TEMPLATE_METADE,
            para: l.email,
            quizResponseId: l.quiz_response_id,
          });
        }
        return { enviados: aceitos.length, pulados: puladosAqui + recusados.length, erro: null as string | null };
      });
      enviados += r.enviados;
      pulados += r.pulados;
      if (r.erro) {
        lotesFalhos += 1;
        ultimoErro = r.erro;
      }
    }

    // RODADA QUE NÃO MANDOU NADA COM FILA CHEIA é campanha parada sem ninguém
    // saber (chave, domínio, Resend fora). Grita, uma vez por rodada.
    if (enviados === 0 && lotesFalhos > 0) {
      await step.run("avisar-rodada-falha", () =>
        avisarDonos({
          assunto: "Campanha METADE: rodada sem envio",
          html: `<p>${lotesFalhos} lote(s) recusado(s) pelo Resend nesta rodada, nenhum e-mail saiu.</p><p>Último erro: ${ultimoErro.replace(/</g, "&lt;")}</p>`,
        }),
      );
    }

    console.log(`[campanha] metade enviados=${enviados} pulados=${pulados} total=${total}`);
    return { enviados, pulados, total };
  },
);
