import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { lerOsSinais as avaliarSinais } from "../../src/lib/sinais-geracao.js";

// O VIGIA DA GERAÇÃO — e ele CONSERTA antes de avisar.
//
// ── O QUE ELE EXISTE PRA IMPEDIR ─────────────────────────────────
//
// Em 26/08 às 21:00 um import quebrado derrubou o `/api/inngest` inteiro. O
// endpoint ficou QUATRO HORAS fora, 65 músicas pararam em `aguardando`, e
// nada avisou: a falha só apareceu quando alguém foi rodar outro comando.
//
// Já existia vigia pro webhook do gateway (`vigiaWebhook`), pro saldo do
// kie.ai (`vigiarSaldo`) e pra entrega de e-mail (`vigiaEntrega`). Não havia
// nenhum pro coração do produto, que é a música sair.
//
// ── POR QUE ELE CONSERTA, E NÃO SÓ GRITA ─────────────────────────
//
// Alerta que só avisa depende de alguém acordado pra virar conserto. Na
// madrugada de 26/08 esse alguém não existia, e as 65 ficaram paradas até de
// manhã.
//
// A maior parte desses casos se resolve sozinha reenfileirando: música em
// `aguardando` com letra pronta só precisa do evento que se perdeu. Então
// este job REDISPARA primeiro, e só chama o dono quando o conserto automático
// não deu conta — que é quando o problema é de verdade.
//
// A hierarquia é a mesma do disjuntor e da repescagem: quem PAGOU vai na
// frente da fila.
//
// ── POR QUE ELE NÃO SE ENGANA COM MADRUGADA VAZIA ────────────────
//
// "Nenhuma música em 20 minutos" às 4h da manhã é normal, não é falha. O
// gatilho é a COMPARAÇÃO: existe letra nova sendo escrita (ou seja, tem
// gente no funil) E nenhuma música ficou pronta no mesmo período. Sem
// tráfego, o vigia dorme junto.

// DOIS ENDERECOS, e nao e desleixo. Este alerta existe pra uma decisao com
// hora marcada — pausar as campanhas —, e um e-mail que cai na caixa errada
// ou empaca num filtro custa o dia inteiro de midia. Redundancia aqui e
// barata; o alerta que nao chega nao e.
const PARA = ["guilhermerojasiqueira@gmail.com", "agenciarocketfy@gmail.com"];

/** Quanto tempo sem música pronta, HAVENDO tráfego, já é suspeito. */
const JANELA_MIN = 20;
/** Presa há mais que isso é candidata a redisparo. */
const PRESA_MIN = 12;
/**
 * Quanto tempo em `gerando` já é travamento, e não geração normal.
 *
 * O pipeline real leva 84s a 110s do pedido ao arquivo (medido em 23/07).
 * 25 minutos são 13x isso: qualquer coisa parada além disso não está
 * gerando, está morta — e redisparar antes seria pagar R$ 0,32 duas vezes
 * por uma música que ia sair sozinha.
 */
const GERANDO_MIN = 25;
/** Teto por rodada: numa queda longa a fila engorda, e despejar tudo de uma
 *  vez quando o provedor volta é a melhor forma de derrubá-lo de novo. */
const MAX_REDISPARO = 25;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Os sinais que valem acordar o dono, separados do job pra poderem ser
 * testados sem Inngest, sem banco e sem e-mail.
 *
 * Sao TRES, e o terceiro nasceu em 03/09 porque os dois primeiros tinham um
 * ponto cego caro:
 *
 *   `nada-saiu`      tem gente escrevendo letra e nao saiu musica nenhuma
 *   `fila-grande`    tanta coisa presa que nao e soluco
 *   `provedor-recusando`  as musicas FALHAM em vez de travar
 *
 * O terceiro e o formato de quebra de quem MUDA DE CONTRATO: o job fala com
 * o provedor, toma erro e marca `falhou`. Nada fica preso, entao nao ha o que
 * redisparar; e como alguma coisa ainda sai, "nada saiu" nunca acende. Uma
 * quebra parcial passava inteira por baixo do radar, e metade das musicas
 * falhando e venda perdida do mesmo jeito.
 *
 * Tres falhas e o piso pra nao gritar com um soluco isolado; a maioria
 * falhando e o que separa "uma musica deu azar" de "o provedor mudou debaixo
 * de nos".
 */
// A LEITURA DOS SINAIS MORA FORA DESTE ARQUIVO.
//
// Ela saiu daqui em 04/09/2026, quando uma queda de 58 minutos do proprio
// Inngest provou que um vigia que roda DENTRO do Inngest nao cobre a falha
// que mais custa. Agora quem lê os sinais é `src/lib/sinais-geracao.ts`, e
// dois vigias a chamam: este (que tambem conserta redisparando) e o de fora,
// em Vercel Cron, que sobrevive a queda do orquestrador.
export { lerOsSinais } from "../../src/lib/sinais-geracao.js";

export const vigiaGeracao = inngest.createFunction(
  {
    id: "vigia-geracao",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "*/10 * * * *" }], // de 10 em 10 minutos
  },
  async ({ step }) => {
    const diagnostico = await step.run("medir", async () => {
      const sb = db();
      const agora = Date.now();
      const desde = new Date(agora - JANELA_MIN * 60000).toISOString();

      // TEM GENTE NO FUNIL? Letra escrita é a prova de tráfego vivo, e é o
      // que separa "quebrou" de "são quatro da manhã".
      const { count: letrasNovas } = await sb
        .from("musicas")
        .select("id", { count: "exact", head: true })
        .gte("created_at", desde)
        .not("letra", "is", null);

      // SAIU ALGUMA MÚSICA?
      const { count: prontasNaJanela } = await sb
        .from("musicas")
        .select("id", { count: "exact", head: true })
        .gte("gerada_em", desde);

      // ── E QUANTAS FALHARAM, E POR QUÊ ─────────────────────────
      //
      // Este vigia nasceu olhando pra `aguardando` e `gerando`, porque foi
      // escrito depois de uma queda em que o job nem chegava a rodar. Ele
      // NUNCA olhou `falhou` — e é ali que cai o provedor que responde, mas
      // responde diferente.
      //
      // A diferença importa: se o contrato da API muda, o job fala com o
      // provedor, toma erro e marca `falhou`. Nada fica preso, então o
      // redisparo não tem o que consertar e o sinal de "nada saiu" só acende
      // se TODAS falharem. Uma quebra parcial (metade das músicas) passava
      // inteira por baixo do radar.
      //
      // O `erro` vem junto porque é ele que diz se é o provedor ou nós.
      const { data: falhadas } = await sb
        .from("musicas")
        .select("erro, created_at")
        .eq("status", "falhou")
        .gte("created_at", desde);

      // TETO DIÁRIO NÃO É QUEDA. O disjuntor marca `falhou` quando o limite
      // de gasto do dia estoura, e isso é o sistema funcionando como
      // projetado. Contar essas como pane faria o alerta gritar justamente
      // no dia de maior volume — e alerta que mente uma vez deixa de ser
      // lido.
      const falhasReais = (falhadas ?? []).filter(
        (f) => !String(f.erro ?? "").toLowerCase().includes("teto diário"),
      );
      const motivos = [...new Set(falhasReais.map((f) => String(f.erro ?? "sem motivo")))].slice(0, 4);

      // O QUE ESTÁ PRESO, com quem pagou na frente.
      //
      // ── DOIS ESTADOS, NÃO UM ─────────────────────────────────
      //
      // A primeira versão só olhava `aguardando`, porque foi escrita olhando
      // pras 65 músicas da queda de 26/08, que pararam todas ali. Em 27/08
      // às 02h apareceu uma parada em `gerando` HÁ UMA HORA, com
      // `provider_job_id` nulo — o job morreu ANTES de falar com o provedor,
      // que é exatamente o formato da queda do `/api/inngest`. O vigia
      // construído pra pegar aquilo não a via.
      //
      // `aguardando` é "o evento se perdeu". `gerando` velha é "o job
      // começou e morreu". As duas se consertam do mesmo jeito, e nenhuma se
      // conserta sozinha.
      //
      // Os prazos são diferentes de propósito: `aguardando` nunca deveria
      // durar, `gerando` dura ~2 minutos por natureza. Ver `GERANDO_MIN`.
      const janelaLonga = new Date(agora - 12 * 3600000).toISOString();
      const [{ data: aguardando }, { data: gerandoVelhas }] = await Promise.all([
        sb
          .from("musicas")
          .select("id, titulo, quiz_response_id, created_at")
          .eq("status", "aguardando")
          .not("letra", "is", null)
          .lte("created_at", new Date(agora - PRESA_MIN * 60000).toISOString())
          .gte("created_at", janelaLonga)
          .order("created_at", { ascending: true })
          .limit(MAX_REDISPARO * 3),
        sb
          .from("musicas")
          .select("id, titulo, quiz_response_id, created_at")
          .eq("status", "gerando")
          .not("letra", "is", null)
          // `gerada_em` nulo: se ela já tem hora de geração, o arquivo saiu e
          // o status é que ficou pra trás — redisparar aí seria gerar de novo
          // uma música que já existe.
          .is("gerada_em", null)
          .lte("created_at", new Date(agora - GERANDO_MIN * 60000).toISOString())
          .gte("created_at", janelaLonga)
          .order("created_at", { ascending: true })
          .limit(MAX_REDISPARO * 3),
      ]);
      const presas = [...(aguardando ?? []), ...(gerandoVelhas ?? [])];

      const lista: Array<{ id: string; titulo: string | null; pago: boolean }> = [];
      for (const m of presas ?? []) {
        if (lista.length >= MAX_REDISPARO) break;
        const { data: pago } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", m.quiz_response_id)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();
        lista.push({ id: m.id, titulo: m.titulo, pago: Boolean(pago?.id) });
      }
      lista.sort((a, b) => Number(b.pago) - Number(a.pago));

      return {
        letrasNovas: letrasNovas ?? 0,
        prontasNaJanela: prontasNaJanela ?? 0,
        presas: lista,
        totalPresas: (presas ?? []).length,
        falhas: falhasReais.length,
        motivos,
      };
    });

    // Funil parado E ninguém entrando: madrugada. Não é falha.
    if (!diagnostico.presas.length && diagnostico.letrasNovas === 0) {
      return { ok: true, motivo: "sem tráfego" };
    }

    // ── 1. CONSERTA ────────────────────────────────────────────────
    const redisparadas = await step.run("redisparar-presas", async () => {
      const eventKey = process.env.INNGEST_EVENT_KEY;
      if (!eventKey || !diagnostico.presas.length) return 0;
      let n = 0;
      for (const m of diagnostico.presas) {
        const r = await fetch(`https://inn.gs/e/${eventKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "musica/gerar", data: { musicaId: m.id } }),
        });
        if (r.ok) n += 1;
      }
      if (n) {
        await db()
          .from("funnel_events")
          .insert({
            event_name: "vigia_geracao_redisparou",
            event_data: { quantas: n, pagos: diagnostico.presas.filter((m) => m.pago).length },
          });
      }
      return n;
    });

    // ── 2. SÓ AVISA SE O CONSERTO NÃO EXPLICA ──────────────────────
    //
    // Uma fila pequena que voltou pra fila é operação normal. O que merece
    // acordar alguém é o sinal de PARADA: tem gente escrevendo letra e não
    // saiu música nenhuma, ou a fila presa é grande demais pra ser soluço.
    const veredito = avaliarSinais(diagnostico);
    const maioriaFalhando = veredito.motivo === "provedor-recusando";

    if (!veredito.avisar) return { ok: true, redisparadas, falhas: diagnostico.falhas };

    await step.run("avisar-dono", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) return;
      const pagos = diagnostico.presas.filter((m) => m.pago).length;
      await new Resend(chave).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: PARA,
        subject: maioriaFalhando
          ? `🔴 PAUSE AS CAMPANHAS — o provedor está recusando (${diagnostico.falhas} falhas)`
          : `🔴 PAUSE AS CAMPANHAS — a geração de música parou (${diagnostico.totalPresas} presas)`,
        html:
          // A AÇÃO VEM ANTES DO DIAGNÓSTICO. Este e-mail é lido no celular,
          // provavelmente no meio de outra coisa. Cada minuto de campanha
          // rodando sem música saindo é dinheiro comprando lead que não vai
          // ser atendido — e, pior, comprador que paga por algo que não
          // existe, que é a única regra que este projeto não quebra.
          `<p style="font-size:17px"><strong>Pause as campanhas do Google.</strong> ` +
          `Enquanto elas rodam, cada lead que entra vira música que não sai.</p>` +
          `<p><strong>Nos últimos ${JANELA_MIN} minutos:</strong><br>` +
          `${diagnostico.letrasNovas} letras novas · ` +
          `${diagnostico.prontasNaJanela} músicas prontas · ` +
          `<strong>${diagnostico.falhas} falhas</strong> · ` +
          `${diagnostico.totalPresas} presas (${pagos} de quem já pagou)</p>` +
          (diagnostico.motivos.length
            ? `<p><strong>O que o provedor respondeu:</strong><br>` +
              diagnostico.motivos.map((m) => `<code>${m}</code>`).join("<br>") +
              `</p>`
            : "") +
          `<p>Redisparei ${redisparadas} agora; se este e-mail se repetir na ` +
          `próxima rodada, o redisparo não está resolvendo.</p>` +
          `<p>Onde olhar, na ordem:<br>` +
          `1. O provedor mudou de contrato? (o motivo acima diz)<br>` +
          `2. <code>/api/inngest</code> responde? (500 ali derruba TODAS as ` +
          `funções — foi o que aconteceu em 26/08, quatro horas fora)<br>` +
          `3. Saldo do kie.ai</p>`,
      });
    });

    return { ok: false, redisparadas, presas: diagnostico.totalPresas, falhas: diagnostico.falhas };
  },
);
