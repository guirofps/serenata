import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { iniciarGeracao, consultarGeracao, obterTimestamps } from "../lib/kie.js";
import { acharGenero, estiloParaSuno } from "../../src/lib/generos.js";
import { podeGerar } from "../lib/disjuntor.js";
import { musicaDoQuiz, mandarEmailDeEntrega } from "../../api/lib/entrega.js";

// Job de geração da música. Portado de scratch/pipeline-completo.mjs, que já
// rodou de ponta a ponta na mão (3 músicas aprovadas).
//
// MUDANÇA ARQUITETURAL (do PLANO): dispara na CONCLUSÃO DO QUIZ, não no
// webhook de pagamento. Assim nunca se cobra por algo que não existe: se o
// provedor falhar, o prejuízo é R$ 0,32 pré-venda em vez de reembolso.
//
// Passos separados de propósito: o Inngest reexecuta só o que falhou.

const bucket = "musicas";

// Preço do provedor (tabela pública do kie.ai) e câmbio, espelhando
// src/lib/custos.ts. O custo em BRL é congelado na linha: se o preço mudar,
// o histórico do painel não se reescreve.
// O Suno RECUSA gerar (GENERATE_AUDIO_FAILED) quando o estilo cita artista
// real — e a história do usuário naturalmente cita banda favorita. O prompt
// já proíbe, mas se escapar a música morreria em silêncio. Este fallback
// troca o estilo por um genérico do gênero e tenta de novo.

/**
 * O PROVEDOR DIZ QUAL PALAVRA ELE BARROU. Basta ler.
 *
 * Medido em 14/08, depois que a captura do motivo entrou:
 *   "Your lyrics contain producer tag que delicia - we don't reference..."
 *   "Your tags contain artist name pressa - we don't reference..."
 *
 * O filtro de artista do Suno confunde palavra comum do português com nome de
 * gente. "que delícia" virou produtor e "pressa" virou artista. Nenhum dos dois
 * é referência a artista nenhum, e o `estiloSemReferencias` jamais pegaria isso,
 * porque ele só limpa construções do tipo "no estilo de X".
 *
 * Como a mensagem entrega o termo, dá pra tirar exatamente ele e tentar de
 * novo, em vez de repetir a mesma coisa e torcer.
 */
function termoBarrado(motivo: string | null): string | null {
  if (!motivo) return null;
  const m = motivo.match(/(?:producer tag|artist name|artist)\s+(.+?)\s+-\s+we don't/i);
  const termo = m?.[1]?.trim();
  // Termo curto demais viraria remoção cega no texto inteiro.
  return termo && termo.length >= 3 ? termo : null;
}

/** Tira o termo barrado de um texto, sem deixar espaço duplo nem vírgula solta. */
function semOTermo(texto: string, termo: string): string {
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return texto
    .replace(new RegExp(escapado, "gi"), "")
    .replace(/ {2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^[\s,]+|[\s,]+$/gm, "")
    .trim();
}

function estiloSemReferencias(estilo: string | null, genero: string | null): string {
  const limpo = String(estilo ?? "").replace(
    /,?\s*(refer[êe]ncias?|inspirad[oa]s?|no estilo)\s+(a|de|em|por)?[^,.]*/gi,
    "",
  ).trim();
  return limpo || acharGenero(genero)?.estiloSuno || "música emotiva, arranjo acústico";
}

const USD_POR_CREDITO = 0.005;
const CAMBIO = 5.4;
const CREDITOS = { musica: 12, timestamps: 0.5 };

async function registrarCusto(args: {
  quizResponseId: string | null;
  musicaId: string;
  tipo: "musica" | "timestamps";
  creditos: number;
  modelo?: string;
}) {
  try {
    const usd = args.creditos * USD_POR_CREDITO;
    await db().from("custos").insert({
      quiz_response_id: args.quizResponseId,
      musica_id: args.musicaId,
      tipo: args.tipo,
      provider: "kie.ai",
      modelo: args.modelo ?? null,
      creditos: args.creditos,
      custo_usd: usd,
      custo_brl: usd * CAMBIO,
      cambio: CAMBIO,
    });
  } catch (err) {
    // Custo nunca derruba a entrega.
    console.error("[custos] falha ao registrar:", err);
  }
}

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente no job");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const gerarMusica = inngest.createFunction(
  {
    id: "gerar-musica",
    // ── QUANTAS MÚSICAS DE UMA VEZ ───────────────────────────────
    //
    // Era 5, que é o teto do plano Hobby (subir além dele fazia o registro do
    // app ser recusado INTEIRO no deploy, não só ignorar o número). O plano
    // Pro foi assinado em 04/09/2026 e leva esse teto a 100.
    //
    // Vai pra 25, não pra 100, e o número tem uma medição atrás: o pico real
    // de demanda simultânea medido foi 18. 25 cobre o pico com folga e a
    // fila deixa de existir; 100 só trocaria a nossa fila por uma fila do
    // lado do provedor, cujo limite de taxa a gente não conhece — e descobrir
    // esse limite em produção, num funil que gera antes de cobrar, custaria
    // música falhada em vez de música na espera.
    concurrency: { limit: 25 },
    retries: 2,
    triggers: [{ event: "musica/gerar" }],
  },
  async ({ event, step }) => {
    const musicaId = event.data?.musicaId as string;
    if (!musicaId) throw new Error("evento sem musicaId");

    // ─── 1. Carrega a letra JÁ SALVA e marca como gerando ──────────
    // A letra salva é a fonte de verdade: é a que a pessoa leu.
    const musica = await step.run("carregar-letra", async () => {
      const sb = db();
      const { data, error } = await sb
        .from("musicas")
        .select("id, status, letra, titulo, estilo_suno, genero, quiz_response_id")
        .eq("id", musicaId)
        .single();
      if (error) throw new Error(`musica não encontrada: ${error.message}`);
      if (!data.letra) throw new Error("musica sem letra");
      // Idempotência: se já está pronta, não gera de novo (não queima crédito).
      if (data.status === "pronta") return { ...data, jaPronta: true };
      await sb.from("musicas").update({ status: "gerando" }).eq("id", musicaId);
      return { ...data, jaPronta: false };
    });

    if (musica.jaPronta) return { pulado: "já estava pronta" };

    // ─── 1.5. O DISJUNTOR DE GASTO ────────────────────────────────
    //
    // Aqui, e não na rota que dispara o evento: este é o único ponto por onde
    // TODO crédito do Suno passa, e é servidor puro — nenhum truque do lado do
    // cliente (sessionId novo a cada chamada, IP trocado por proxy) chega até
    // ele. Ver `../lib/disjuntor.ts` pra o raciocínio, inclusive por que quem
    // já pagou nunca é barrado.
    //
    // Depois do `jaPronta` de propósito: música já entregue não consome
    // orçamento nenhum.
    const liberado = await step.run("conferir-teto-do-dia", () =>
      podeGerar(db(), musica.quiz_response_id),
    );
    if (!liberado.ok) {
      // `falhou` e não `aguardando`: o estado tem que ser VISÍVEL. `falhou` é o
      // que o painel mostra em vermelho e o que o caminho de recuperação
      // (`temMusicaDaSessao`) sabe refazer — e, se esta pessoa pagar, o webhook
      // refaz na hora e o disjuntor a deixa passar por ser paga.
      await db()
        .from("musicas")
        .update({
          status: "falhou",
          erro: `teto diário de geração atingido (${liberado.teto}/dia) — não gerado antes do pagamento`,
        })
        .eq("id", musicaId);
      return { pulado: "teto diário atingido", teto: liberado.teto };
    }

    // Voz escolhida no quiz (fica nas respostas do lead).
    const voz = await step.run("ler-voz", async () => {
      const sb = db();
      const { data } = await sb
        .from("quiz_responses")
        .select("respostas")
        .eq("id", musica.quiz_response_id)
        .maybeSingle();
      return (data?.respostas as Record<string, string> | null)?.voz ?? "surpresa";
    });

    // ─── 2 e 3. Dispara e acompanha, com fallback de estilo ────────
    //
    // TRÊS tentativas, e a terceira nasceu de um incidente medido em 12/08:
    // entre 21:37 e 22:21, 5 músicas morreram com "provedor recusou" enquanto
    // 8 outras passavam no mesmo intervalo, com estilos igualmente banais
    // ("MPB intimista, voz feminina suave, violão fingerpicking"). Ou seja: a
    // recusa do provedor NÃO é sempre sobre o conteúdo, às vezes é soluço dele.
    //
    // E o fallback antigo não protegia disso. Ele só trocava o estilo quando
    // havia referência a artista pra limpar; quando não havia, o estilo limpo
    // saía idêntico ao original e o loop dava `break` — as 5 músicas tiveram
    // UMA tentativa só, não duas. Reenfileiradas à mão minutos depois, todas
    // geraram normalmente.
    //
    // Agora: estilo original → estilo limpo (se for diferente) → respiro de
    // 60s e o original de novo. Cada tentativa custa R$ 0,32, e o CLAUDE.md já
    // decidiu que gerar antes de vender é o melhor dinheiro do funil; perder o
    // cliente por um soluço de rede é o pior.
    type Faixa = { id: string; audioUrl: string; duration?: number };
    let faixas: Faixa[] = [];
    let taskId = "";
    let recusou = false;

    let motivoRecusa: string | null = null;

    // ── O GENERO ESCOLHIDO MANDA NO ESTILO ──────────────────────
    //
    // `musica.estilo_suno` e escrito pelo Claude junto com a letra, e ele
    // derrapa. Medido em 14 dias: dos 46 pagodes, 23 (METADE) sairam com
    // "violao de nylon", acompanhado de "suave", "leve", "clima intimista e
    // caseiro", "andamento moderado". Isso descreve balada acustica, e o Suno
    // obedece a descricao e nao a palavra "pagode" que abre a frase — foi
    // assim que uma musica pedida em pagode saiu soando sertanejo.
    //
    // `estiloParaSuno` poe o texto CURADO do catalogo na frente (o Suno pesa
    // o comeco) e guarda do texto do modelo so o timbre da voz. O genero foi
    // escolhido pela PESSOA num campo do quiz; nenhum texto gerado pode
    // contradizer isso.
    const estiloDoGenero = estiloParaSuno({
      genero: musica.genero,
      estiloDoModelo: musica.estilo_suno,
      voz,
    });

    const estilos = [
      { rotulo: "original", valor: estiloDoGenero, esperaAntes: "" },
      { rotulo: "sem-referencias", valor: estiloSemReferencias(estiloDoGenero, musica.genero), esperaAntes: "" },
      { rotulo: "segunda-chance", valor: estiloDoGenero, esperaAntes: "60s" },
      // QUARTA tentativa, dez minutos depois. Medido na madrugada de 13/08: as
      // falhas se concentram na HORA DE PICO (14 prontas e 3 falhas às 23h,
      // zero falha nas horas vazias) e a recusa volta em segundos, não depois
      // de gerar. Isso é fila cheia do provedor, não letra barrada — e fila
      // cheia passa. As quatro que morreram naquela noite geraram de primeira
      // quando reenfileiradas à mão minutos depois.
      //
      // Dez minutos de espera não custam nada pra quem já foi embora da
      // página (o e-mail avisa) e salvam a venda de quem voltar.
      { rotulo: "ultima-chance", valor: estiloDoGenero, esperaAntes: "10m" },
    ];

    // Uma vez por música, não por estilo: se a primeira tentativa já deu
    // prévia, as retentativas não precisam regravar.
    let previaSalva = false;

    for (const [n, estilo] of estilos.entries()) {
      // Timeout (não recusa) é outro problema: insistir só queima crédito.
      if (n > 0 && !recusou) break;
      // Estilo limpo idêntico ao original: pula essa tentativa, mas NÃO
      // desiste. Era exatamente aqui que a geração morria na primeira recusa.
      if (n === 1 && estilo.valor === estilos[0].valor) continue;
      if (estilo.esperaAntes) await step.sleep(`respiro-${estilo.rotulo}`, estilo.esperaAntes);

      // TIRA O QUE O PROVEDOR APONTOU, na letra e no estilo. Se ele disse qual
      // palavra barrou na tentativa anterior, insistir com ela é garantir a
      // mesma recusa. Só a partir da segunda tentativa, porque na primeira
      // ainda não existe motivo nenhum.
      const barrado = termoBarrado(motivoRecusa);
      const letraDaVez = barrado ? semOTermo(musica.letra, barrado) : musica.letra;
      const estiloDaVez = barrado ? semOTermo(estilo.valor, barrado) : estilo.valor;

      taskId = await step.run(`iniciar-${estilo.rotulo}`, async () => {
        const id = await iniciarGeracao({
          letra: letraDaVez,
          titulo: musica.titulo ?? "Sua música",
          estilo: estiloDaVez || musica.genero || "música emotiva, arranjo acústico",
          voz,
        });
        // Cobrado no disparo, independente do resultado.
        await registrarCusto({
          quizResponseId: musica.quiz_response_id,
          musicaId,
          tipo: "musica",
          creditos: CREDITOS.musica,
          modelo: "V4_5PLUS",
        });
        return id;
      });

      recusou = false;
      // Medido: 84s a 250s. Folga de 6 minutos antes de desistir.
      // ── O POLLING E ADAPTATIVO, e o motivo e economico ──────
      //
      // O provedor entrega o `streamAudioUrl` entre 22s e 32s (medido em
      // 30/08). Perguntar de 10 em 10 segundos significa descobrir isso ate
      // 10s depois de acontecer, e o cliente espera esse atraso olhando uma
      // tela de "gerando".
      //
      // Perguntar de 3 em 3 o tempo TODO resolveria e custaria caro: 120
      // passos por musica x 500 musicas/dia = 1,8 milhao de execucoes por
      // mes, acima do incluido no plano Pro (1 milhao). Otimizar a espera
      // estourando a conta nao e otimizar.
      //
      // Entao: 3 em 3 segundos na JANELA em que o stream nasce (os primeiros
      // 60s), e 10 em 10 depois dela, quando o que se espera e o arquivo
      // final e ninguem esta olhando a tela. Da ~20 passos rapidos + ~10
      // lentos = 30 por musica, MENOS que os 36 de hoje.
      const RAPIDO_ATE = 20; // 20 x 3s = os primeiros 60 segundos
      for (let tentativa = 0; tentativa < 56; tentativa++) {
        const r = await step.run(`consultar-${estilo.rotulo}-${tentativa}`, () =>
          consultarGeracao(taskId),
        );

        // ── A PRÉVIA SAI ANTES DO ARQUIVO ────────────────────────
        //
        // O provedor devolve `streamAudioUrl` MUITO antes do MP3 final.
        // Medido em 30/08, duas gerações reais: stream aos 22-32s (tocável,
        // 118s de música baixados na hora), arquivo final aos 57-74s.
        //
        // Gravar aqui é o que corta a espera de ~2 minutos pra ~30 segundos.
        // NÃO mexe no `status`: a música só vira "pronta" quando o arquivo
        // limpo está no nosso Storage, porque é ele que o comprador leva.
        // A prévia é só o que toca enquanto isso.
        if (!previaSalva) {
          // A SEGUNDA VERSÃO, igual à entrega.
          //
          // O Suno devolve duas, e o julgamento do dono (consistente nos
          // testes) é que a segunda sai melhor — por isso ela é a
          // `principal` na seção 4. A prévia tem que tocar a MESMA, senão a
          // pessoa se apaixona por uma gravação e recebe outra.
          //
          // Enquanto só existir uma faixa, espera: as duas aparecem com
          // poucos segundos de diferença, e trocar a versão no meio custaria
          // mais que esperar. Depois de ~60s, aceita o que tiver.
          // ── O LIMITE E DE TEMPO, NAO DE CONTAGEM ──────────
          //
          // Era `tentativa >= 6`, que com o sleep fixo de 10s queria dizer
          // "depois de 60 segundos". Com o polling adaptativo a mesma
          // contagem passaria a significar 18 segundos, e a espera pela
          // segunda faixa — que existe pra a previa ser a MESMA gravacao que
          // a pessoa recebe paga — sumiria sem ninguem decidir isso.
          //
          // Contagem de voltas nao e unidade de tempo. Escrito em segundos,
          // mexer no intervalo do laco nao muda mais a regra de negocio.
          const esperandoHa = (tentativa < RAPIDO_ATE ? tentativa * 3 : 60 + (tentativa - RAPIDO_ATE) * 10);
          const preferida =
            r.faixas.length > 1 ? r.faixas[1] : esperandoHa >= 60 ? r.faixas[0] : null;
          const stream = preferida?.streamUrl;
          if (stream) {
            previaSalva = true;
            await step.run(`previa-${estilo.rotulo}-${tentativa}`, async () => {
              const { error } = await db()
                .from("musicas")
                // `previa_em` junto: sem ele a mudança que corta a espera de
                // ~97s pra ~30s não teria régua nenhuma, e a tabela só sabe
                // dizer quando o ARQUIVO FINAL ficou pronto.
                .update({ previa_url: stream, previa_em: new Date().toISOString() })
                .eq("id", musicaId);
              // Falhar aqui não pode derrubar a geração: a prévia é ganho de
              // velocidade, o arquivo final é o produto.
              if (error) console.error("[musica] prévia não gravou:", error.message);
              return true;
            });
          }
        }

        if (r.status === "SUCCESS" && r.faixas.length) {
          faixas = r.faixas;
          break;
        }
        if (/FAIL|ERROR/i.test(r.status)) {
          recusou = true;
          // O motivo vem do provedor. Guardar isso é o que separa diagnóstico
          // de chute na próxima vez que uma noite inteira falhar.
          motivoRecusa = r.motivo ?? r.status;
          break;
        }
        await step.sleep(
          `espera-${estilo.rotulo}-${tentativa}`,
          tentativa < RAPIDO_ATE ? "3s" : "10s",
        );
      }
      if (faixas.length) break;
    }

    if (!faixas.length) {
      await step.run("marcar-falha", async () => {
        await db()
          .from("musicas")
          .update({
            status: "falhou",
            erro: recusou
              ? `provedor recusou 4x${motivoRecusa ? `: ${motivoRecusa}` : ""}`
              : "timeout no provedor",
          })
          .eq("id", musicaId);
      });

      // AVISA O DONO — mas só quando ele precisa ACORDAR.
      //
      // A falha era muda: a pessoa via "avisamos no seu e-mail" e nenhum
      // e-mail existia. O alerta consertou isso, e criou o problema oposto na
      // mesma noite: cinco e-mails idênticos em duas horas, todos de LEAD que
      // não tinha pago nada. Alerta que chega demais vira alerta que ninguém
      // lê, e aí a próxima falha de comprador passa batido no meio.
      //
      // A régua é o dinheiro: se a pessoa PAGOU, isso é incêndio e o e-mail
      // sai na hora. Se é lead, a falha fica registrada no banco e no painel,
      // sem acordar ninguém de madrugada — ela não perdeu nada além de uma
      // prévia que a gente pode refazer.
      const comprou = await step.run("essa-pessoa-pagou", async () => {
        if (!musica.quiz_response_id) return false;
        const { data } = await db()
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", musica.quiz_response_id)
          .eq("status", "pago")
          .limit(1);
        return Boolean(data?.length);
      });

      if (comprou) {
        await step.run("avisar-dono", async () => {
          try {
            const chave = process.env.RESEND_API_KEY;
            // Mesma caixa que já recebe o alerta de saldo do kie.ai: é a que
            // chega em quem pode agir, e não se perde no meio dos tickets.
            if (!chave) return;
            const { Resend } = await import("resend");
            const motivo = recusou
              ? `provedor recusou 4x${motivoRecusa ? `: ${motivoRecusa}` : ""}`
              : "timeout no provedor";
            await new Resend(chave).emails.send({
              from: "Serenata <contato@serenatagift.com>",
              to: ["guilhermerojasiqueira@gmail.com"],
              subject: `🔴 COMPRADOR sem música: ${musica.titulo ?? "sem título"}`,
              html:
                `<p><strong>Alguém pagou e a música não ficou pronta.</strong></p>` +
                `<p>Título: ${musica.titulo ?? "sem título"}<br>` +
                `Motivo: ${motivo}<br>Gênero: ${musica.genero ?? "-"}<br>id: ${musicaId}</p>` +
                `<p>Pra refazer, reenfileire o evento <code>musica/gerar</code> com esse id.</p>`,
            });
          } catch (err) {
            // Aviso nunca derruba o job.
            console.error("[musica] aviso ao dono falhou:", err);
          }
        });
      }

      throw new Error(recusou ? "provedor recusou" : "timeout esperando a música");
    }

    // ─── 4. Escolhe a PRINCIPAL e guarda no Storage ────────────────
    //
    // O Suno devolve 2 versões. Julgamento do dono, consistente nos testes:
    // a SEGUNDA costuma sair melhor. Então ela vira a principal (entregue e
    // tocada), e a primeira fica como alternativa — útil de dar de brinde
    // quando a pessoa pedir "uma outra versão", já pronta e sem custo novo.
    //
    // A ordem é trocada AQUI, na origem, e não na hora de servir: os
    // timestamps do karaokê são de UMA faixa específica, então principal e
    // timestamps precisam ser sempre a mesma — senão a letra acende fora
    // de sincronia.
    const principal = faixas.length > 1 ? faixas[1] : faixas[0];
    const alternativa = faixas.length > 1 ? faixas[0] : null;

    // As URLs do kie.ai são TEMPORÁRIAS: sem baixar, a música do cliente some.
    const caminhos = await step.run("guardar-audio", async () => {
      const sb = db();
      const salvos: string[] = [];
      const ordenadas = [principal, alternativa].filter(Boolean) as Faixa[];
      for (let i = 0; i < ordenadas.length; i++) {
        const resp = await fetch(ordenadas[i].audioUrl);
        if (!resp.ok) throw new Error(`download falhou: ${resp.status}`);
        const buf = new Uint8Array(await resp.arrayBuffer());
        const caminho = `${musicaId}/v${i + 1}.mp3`;
        const { error } = await sb.storage
          .from(bucket)
          .upload(caminho, buf, { contentType: "audio/mpeg", upsert: true });
        if (error) throw new Error(`upload falhou: ${error.message}`);
        salvos.push(caminho);
      }
      return salvos;
    });

    // ─── 5. Timestamps (karaokê real) das DUAS gravações ───────────
    // Cada gravação tem timing próprio, então precisa dos seus timestamps:
    // usar os da v1 na v2 acenderia a letra fora do que se ouve. ~0,5 crédito
    // (R$ 0,013) cada. Tolerante a falha: sem timestamps a faixa ainda toca,
    // só sem destaque.
    const timestamps = await step.run("timestamps", async () => {
      try {
        const t = await obterTimestamps(taskId, principal.id);
        await registrarCusto({
          quizResponseId: musica.quiz_response_id,
          musicaId,
          tipo: "timestamps",
          creditos: CREDITOS.timestamps,
        });
        return t;
      } catch (err) {
        console.error("[musica] timestamps v1 falharam:", err);
        return null;
      }
    });

    // Timestamps da alternativa (v2). Só se ela existir.
    const timestampsV2 = alternativa
      ? await step.run("timestamps-v2", async () => {
          try {
            const t = await obterTimestamps(taskId, alternativa.id);
            await registrarCusto({
              quizResponseId: musica.quiz_response_id,
              musicaId,
              tipo: "timestamps",
              creditos: CREDITOS.timestamps,
            });
            return t;
          } catch (err) {
            console.error("[musica] timestamps v2 falharam:", err);
            return null;
          }
        })
      : null;

    // ─── 6. Fecha ──────────────────────────────────────────────────
    await step.run("marcar-pronta", async () => {
      const sb = db();
      const { error } = await sb
        .from("musicas")
        .update({
          status: "pronta",
          // audio_path é sempre a PRINCIPAL (a que toca e casa com os
          // timestamps); audio_path_v2 é a alternativa de brinde.
          audio_path: caminhos[0] ?? null,
          audio_path_v2: caminhos[1] ?? null,
          timestamps,
          timestamps_v2: timestampsV2,
          duracao_s: principal.duration ?? null,
          provider: "kie.ai",
          provider_job_id: taskId,
          gerada_em: new Date().toISOString(),
          erro: null,
        })
        .eq("id", musicaId);
      if (error) throw new Error(`update final falhou: ${error.message}`);
    });

    // ─── 7. QUEM JÁ PAGOU E ESPEROU RECEBE AGORA ──────────────────
    //
    // O caso normal é o inverso: a música fica pronta ANTES do pagamento, e
    // o webhook manda a entrega. Este passo é pro caminho que existe quando
    // isso não acontece — o comprador pagou com a música ainda em produção,
    // recebeu o e-mail honesto que diz "está sendo gravada", e agora ela
    // existe. Sem isto, ele ficaria esperando um e-mail que nunca viria.
    //
    // Foi exatamente o buraco de 04/09/2026, quando o Inngest ficou 58
    // minutos fora: um comprador pagou às 15h29 e a música só saiu depois.
    //
    // A TRAVA CONTRA E-MAIL DOBRADO é o registro de envio, não uma flag nova:
    // se já existe uma linha `entrega` pra este quiz, alguém já entregou (o
    // webhook, ou uma rodada anterior deste passo) e aqui não se faz nada. É
    // a mesma tabela que o webhook escreve, então as duas pontas concordam
    // sem precisar se conhecer.
    await step.run("entregar-a-quem-ja-pagou", async () => {
      const sb = db();
      const { data: pedido } = await sb
        .from("pedidos")
        .select("email")
        .eq("musica_id", musicaId)
        .eq("status", "pago")
        .limit(1)
        .maybeSingle();
      if (!pedido?.email) return { entregue: false, motivo: "ninguém pagou ainda" };

      if (musica.quiz_response_id) {
        const { data: jaFoi } = await sb
          .from("emails_enviados")
          .select("email_id")
          .eq("template", "entrega")
          .eq("quiz_response_id", musica.quiz_response_id)
          .limit(1);
        if (jaFoi?.length) return { entregue: false, motivo: "entrega já enviada" };
      }

      const pronta = await musicaDoQuiz(sb, musica.quiz_response_id ?? "");
      if (!pronta) return { entregue: false, motivo: "música não relida" };
      const r = await mandarEmailDeEntrega(sb, { email: pedido.email, musica: pronta });
      if (!r.ok) {
        // Não derruba o job: a música ESTÁ pronta e o link do comprador já
        // funciona. E-mail que falha aqui é recuperável (o vigia de entrega
        // e o `guardeOLink` alcançam a mesma pessoa); job que falha aqui
        // reexecutaria a geração inteira e cobraria de novo.
        console.error("[musica] entrega pós-geração falhou:", r.erro);
        return { entregue: false, motivo: r.erro };
      }
      return { entregue: true, para: pedido.email };
    });

    return { musicaId, taskId, versoes: caminhos.length, palavras: timestamps?.length ?? 0 };
  },
);
