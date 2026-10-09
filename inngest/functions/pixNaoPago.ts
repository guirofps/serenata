import { inngest } from "../client.js";
import { cabecalhosDescadastro } from "../lib/descadastro.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { podeMandarMarketing } from "../lib/frequencia.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { emailPixNaoPago, assuntoPixNaoPago } from "../../emails/pix-nao-pago.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { pareceTypo } from "../../src/lib/email-typo.js";
import { literalLike } from "../../src/lib/sql-like.js";
import { woovi } from "../../src/lib/woovi.js";
import { asaasPix, consultarPorReferencia } from "../../src/lib/asaas-pix.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import {
  codigoDoLembrete,
  linkDoLembrete,
  meioDoPendente,
  reconsultaDoPedido,
  reconsultaPermiteEnvio,
} from "../../src/lib/pix-nao-pago-regras.js";

// O PIX GERADO QUE NÃO FOI PAGO.
//
// ── O BURACO QUE ISTO FECHA ──────────────────────────────────────
//
// Medido em 26/08: 550 pessoas em 14 dias geraram código PIX e não pagaram,
// umas 39 por dia. Nenhuma delas tinha tratamento próprio — caíam na mesma
// régua de quem só leu a letra e foi embora.
//
// Não é a mesma pessoa. Quem gerou PIX clicou em comprar, escolheu o meio de
// pagamento e parou no último centímetro. É o lead mais quente do funil, e era
// o único sem e-mail dedicado.
//
// ── POR QUE 10 MINUTOS ───────────────────────────────────────────
//
// Medido em 27/08, sobre os PIX pendentes que VIRARAM pagamento — a curva de
// quanto tempo depois o dinheiro cai:
//
//   até 5 min    34,5%   (acumulado 34,5%)
//   5 a 10 min   23,6%   (58,2%)
//   10 a 20 min   7,3%   (65,5%)
//   20 a 40 min  10,9%   (76,4%)
//   40 a 60 min   3,6%   (80,0%)
//   depois        20,0%
//
// A intenção decai rápido: 58% de quem paga já pagou aos 10 minutos, e a
// curva achata daí em diante. Esperar 40 era esperar a intenção esfriar.
//
// Foi 40 → 20 → 10, e a última descida veio de um argumento que muda o cálculo:
// aos 10 minutos, 42% de quem AINDA VAI PAGAR recebe o e-mail. Isso era um
// problema ENQUANTO o texto dizia "seu pagamento não entrou" — soa a cobrança
// pra quem está com o app do banco aberto naquele instante.
//
// Só que o texto mudou junto (ver abaixo): ele agora diz que o código dela
// continua valendo e entrega o código. Pra quem está no meio do pagamento,
// isso é ajuda, não cobrança. Removida a ofensa, sobra só o ganho de falar
// enquanto a intenção está quente.
//
// ── E O CÓDIGO NÃO VENCEU ────────────────────────────────────────
//
// O primeiro texto deste e-mail dizia "o código anterior pode ter vencido".
// Era falso: medido, o PIX da Perfect Pay vale ~55 HORAS (mínimo 45, máximo
// 71). O código que a pessoa gerou continua bom por dois dias.
//
// Isso muda o e-mail de "gere um novo" para "ele está te esperando", que é
// uma promessa melhor e verdadeira. E muda o link: em vez de mandar pro
// checkout começar de novo, manda pro `pix_url`, a tela do PIX que ela já
// abriu, com o código dela. Um toque, sem redigitar nada, e o pagamento cai
// no MESMO pedido — o webhook já sabe o que fazer com ele.
//
// ── PREÇO CHEIO, SEM EXCEÇÃO ─────────────────────────────────────
//
// A tentação é descontar aqui. Descontar 40 minutos depois ensina que basta
// abrir o PIX e esperar, e quem aprende isso não paga o preço cheio nunca
// mais — inclusive quem ainda nem abandonou, porque as pessoas conversam.
// A escada (`escada.ts`) desce o preço DIAS depois, que é onde desconto é
// resposta e não reflexo.
//
// O link é o do MESMO valor que a pessoa ia pagar, lido da config viva
// (tabela `experimentos`) e não de `preco.ts`: importar aquele módulo aqui
// traria `experimentos.ts` inteiro, que é isomórfico e lê `window`. A tabela
// é a fonte de verdade dos dois jeitos.
//
// ── PORTUGUÊS SÓ ─────────────────────────────────────────────────
//
// O espanhol fica de fora pelo mesmo motivo da escada: volume pequeno demais
// pra sustentar régua própria, e o checkout de lá é outro gateway com outra
// moeda. Quando o volume justificar, é uma variante a mais aqui.

const MIN_MIN = 10;
/**
 * Quantos toques no máximo, e quanto tempo entre eles. Ver `podeMandar`.
 *
 * TRÊS TOQUES: 10 min, ~20h e ~72h (28/09, decisão do dono). Medido de 14 a
 * 27/09: o 1º toque (10 min) converte 10,2% (64/628) e o 2º, que saía 48h
 * depois, só 2,8% (15/544). O código do Asaas continua valendo muito além
 * disso, então o limite nunca foi o código: era a atenção da pessoa, que
 * esfria rápido. O 2º vem pro dia seguinte (20h), e o 3º fecha em ~72h.
 */
const MAX_TOQUES = 3;
/** Horas depois do toque anterior: [antes do 2º, antes do 3º]. */
const ESPERA_ENTRE_TOQUES_H = [20, 52];
// Janela de 80h: a pessoa precisa continuar visível na busca até o 3º toque
// (~72h depois do primeiro). O que impede o e-mail de virar cobrança não é a
// janela, é o teto de três toques.
const MAX_H = 80;
// Teto por rodada, pelo mesmo motivo do `volteCriar`: `serenatagift.com` é
// domínio novo, e pico de volume em remetente sem histórico é a assinatura de
// lista comprada. A 12 por rodada de meia hora, a fila de ~39/dia se esvazia
// no mesmo dia sem nenhum pico.
const MAX_POR_RODADA = 12;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Já mandamos pra esta sessão?
 *
 * O registro vive em `funnel_events`, como o do lembrete e o da recompra: um
 * booleano em `pedidos` exigiria migration e não deixaria histórico. A chave é
 * o `quiz_response_id` e não o pedido: quem tenta pagar três vezes gera três
 * pedidos pendentes e não pode receber três e-mails.
 */
/** Quantos destes e-mails a PESSOA recebeu nos últimos 14 dias, de qualquer pedido. */
/**
 * A PESSOA já comprou nos últimos 14 dias, por qualquer quiz?
 *
 * A trava por quiz não basta: em 26/09 uma compradora fez dois quizzes, pagou
 * um às 18h13, recebeu a entrega, e às 19h00 levou "seu PIX não foi pago"
 * pelo pendente do outro. Respondeu "já paguei e não recebi". Pra quem acabou
 * de comprar, este e-mail é acusação, não lembrete.
 */
async function pessoaJaComprou(sb: ReturnType<typeof db>, email: string): Promise<boolean> {
  const { data } = await sb
    .from("pedidos")
    .select("id, email")
    .ilike("email", literalLike(email))
    .eq("status", "pago")
    .gte("paid_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .limit(5);
  // Confere em JS também: o `ilike` é sem caixa, e aqui o alvo é a pessoa.
  return (data ?? []).some((x) => String(x.email ?? "").trim().toLowerCase() === email.trim().toLowerCase());
}

async function toquesDaPessoa(sb: ReturnType<typeof db>, email: string): Promise<number> {
  const { count, error } = await sb
    .from("funnel_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "pix_nao_pago_enviado")
    .contains("event_data", { email })
    .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString());
  if (error) return Number.MAX_SAFE_INTEGER; // Na dúvida, já mandou (04/10): consulta que falha não pode virar reenvio.
  return count ?? 0;
}

async function toquesJaDados(sb: ReturnType<typeof db>, quizId: string) {
  const { data, error } = await sb
    .from("funnel_events")
    .select("created_at")
    .eq("event_name", "pix_nao_pago_enviado")
    .contains("event_data", { quiz_response_id: quizId })
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return { quantos: Number.MAX_SAFE_INTEGER, ultimo: Date.now() }; // Na dúvida, já mandou (04/10): consulta que falha não pode virar reenvio.
  return {
    quantos: (data ?? []).length,
    ultimo: data?.[0]?.created_at ? new Date(data[0].created_at as string).getTime() : 0,
  };
}

/**
 * Pode mandar agora? Até três toques: 10 min, ~20h e ~72h — e nada além disso.
 *
 * O SEGUNDO EXISTE porque o primeiro sai minutos depois do abandono, e quem
 * estava no meio de outra coisa naquele minuto pode nunca ter aberto. Vinte
 * horas cai no dia seguinte, num horário diferente, enquanto a intenção
 * ainda está quente (a 48h ele convertia 2,8%; ver MAX_TOQUES).
 *
 * O TERCEIRO fecha a janela em ~72h. Depois dele, nada: a diferença entre
 * lembrete e perseguição é o teto, e a pessoa segue na escada, que é outro
 * assunto e outro texto.
 */
function podeMandar(toques: { quantos: number; ultimo: number }, agora: number) {
  if (toques.quantos === 0) return true;
  if (toques.quantos >= MAX_TOQUES) return false;
  const esperaH = ESPERA_ENTRE_TOQUES_H[toques.quantos - 1] ?? Infinity;
  return agora - toques.ultimo >= esperaH * 3600000;
}

// O destino de quem não tem PIX guardado é o `/retomar` da sessão dela, no
// nosso domínio. Até 08/10 era o checkout da Perfect Pay (`checkoutDoValor`),
// que saiu: ver o cabeçalho de `src/lib/pix-nao-pago-regras.ts`.
const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : MARCA_ATIVA.url;

export const pixNaoPago = inngest.createFunction(
  {
    id: "pix-nao-pago",
    // Uma rodada por vez: duas sobrepostas montam a mesma fila e mandam em dobro.
    concurrency: { limit: 1 },
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "*/30 * * * *" }], // de meia em meia hora
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-pix-abandonado", async () => {
      const sb = db();
      const agora = Date.now();

      const { data: pendentes } = await sb
        .from("pedidos")
        .select("id, email, quiz_response_id, valor_centavos, created_at, pix_url, pix_codigo, payment_id, gateway, cupom")
        .eq("status", "pendente")
        .gte("created_at", new Date(agora - MAX_H * 3600000).toISOString())
        .lte("created_at", new Date(agora - MIN_MIN * 60000).toISOString())
        .order("created_at", { ascending: false });

      const out: Array<{
        email: string; nome: string; titulo: string;
        linkCheckout: string; codigo: string | null;
        quizId: string; locale: "pt" | "es"; meio: "pix" | "cartao";
      }> = [];
      const vistos = new Set<string>();

      for (const p of pendentes ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!p.email || !p.quiz_response_id) continue;
        // Endereço com typo de provedor não entra: bounce em domínio novo é o
        // dano mais caro que existe. Mesma trava do `mandarLetra` e da escada.
        if (pareceTypo(p.email)) continue;
        // Uma tentativa por pessoa nesta rodada: três pedidos pendentes da
        // mesma sessão são três tentativas do mesmo pagamento.
        if (vistos.has(p.quiz_response_id)) continue;
        vistos.add(p.quiz_response_id);

        // PAGOU DEPOIS? O pendente fica no banco pra sempre; o que decide é
        // existir um pago na mesma sessão. Mandar "seu pagamento não entrou"
        // pra quem pagou é o erro mais caro que este job pode cometer.
        const { data: pago } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", p.quiz_response_id)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();
        if (pago?.id) continue;
        if (p.email && (await pessoaJaComprou(sb, p.email))) continue;

        if (!podeMandar(await toquesJaDados(sb, p.quiz_response_id), agora)) continue;

        // A MÚSICA PRECISA EXISTIR. O e-mail promete "está pronta esperando",
        // e prometer isso sem arquivo é a única mentira que este texto pode
        // contar. Sem música pronta, a pessoa não entra na fila.
        const { data: m } = await sb
          .from("musicas")
          .select("titulo, status")
          .eq("quiz_response_id", p.quiz_response_id)
          .maybeSingle();
        if (!m || m.status !== "pronta") continue;

        const { data: q } = await sb
          .from("quiz_responses")
          .select("respostas, locale, session_id")
          .eq("id", p.quiz_response_id)
          .maybeSingle();

        // O idioma vem do registro: cron não tem requisição de onde deduzir.
        // Ver a migration 20260807000000_locale.
        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";
        if (locale === "es") continue; // ver o cabeçalho

        // ── O LINK: o PIX DELA primeiro ──────────────────────────
        //
        // `pix_url` é a tela do PIX que ela já abriu, com o código dela. Um
        // toque e ela paga, sem redigitar nada, e o dinheiro cai no MESMO
        // pedido: o webhook já sabe casar aquele `payment_id` com a música.
        //
        // ── INTERRUPTOR: CÓDIGO GERADO QUE NÃO PODE SER PAGO ────
        //
        // `RECUPERACAO_SEM_PIX=1` ignora o `pix_url` e o código. Existe por
        // causa de 11/09/2026: a chave PIX da Woovi parou de resolver no DICT
        // às 16:44 e todo código gerado no dia virou papel. Sem isto, este
        // e-mail mandaria quem já tentou pagar de volta pro MESMO pagamento
        // impossível, prometendo no rodapé que o código continua valendo.
        //
        // ── SEM PIX GUARDADO: DE VOLTA PRA MÚSICA DELA (08/10) ──
        //
        // Cartão, pedido sem URL ou interruptor ligado: `/retomar` da sessão,
        // onde ela paga no Asaas (PIX ou cartão). Até 08/10 era a Perfect Pay
        // com `src=<quiz>`, que o webhook de lá não casa. Ver
        // `src/lib/pix-nao-pago-regras.ts`.
        const meio = meioDoPendente(p);
        const link = linkDoLembrete({
          meio,
          pixUrl: p.pix_url as string | null,
          semPix: process.env.RECUPERACAO_SEM_PIX === "1",
          site: SITE,
          sessao: (q as { session_id?: string | null } | null)?.session_id,
          cupom: (p as { cupom?: string | null }).cupom,
        });
        if (!link) continue;

        // ── E SE O NOSSO BANCO ESTIVER ERRADO? ──────────────────
        //
        // A trava acima confia em `pedidos`, e em 06/09/2026 `pedidos` mentiu:
        // duas clientes tinham pago, o webhook se perdeu, e as duas
        // continuaram recebendo ESTE e-mail dizendo que o pagamento não
        // entrou. Uma delas respondeu indignada, com o comprovante anexado —
        // depois de dois dias sendo cobrada por algo que já tinha pagado.
        //
        // Uma consulta ao gateway por envio (dezenas por dia, não milhares)
        // é barata perto de acusar um comprador de não ter pago. Por isso ela
        // vem DEPOIS das travas baratas (toques, música, idioma, link): com o
        // Asaas incluído, perguntar por todo pendente da janela seriam
        // centenas de chamadas por rodada.
        //
        // FALHA ABERTA: se o gateway não responder, o e-mail sai. A
        // alternativa seria uma indisponibilidade deles calar a recuperação
        // inteira, e o caso comum é a pessoa não ter pago mesmo.
        //
        // OS DOIS GATEWAYS (08/10). Até aqui só a Woovi era perguntada, e o
        // PIX é do Asaas desde 11/09: a trava de 06/09 não valia pra quase
        // ninguém. Ver `reconsultaDoPedido`.
        const alvo = reconsultaDoPedido(p.payment_id as string | null);
        if (alvo) {
          try {
            const st =
              alvo.gateway === "woovi"
                ? await woovi.consultar(alvo.id)
                : alvo.porReferencia
                  ? await consultarPorReferencia(alvo.id)
                  : await asaasPix.consultar(alvo.id);
            if (!reconsultaPermiteEnvio(st)) {
              if (st?.pago) {
                console.error(`[pix-nao-pago] ${p.payment_id} está PAGO no gateway e pendente aqui: o vigia de pagamento conserta`);
              }
              continue;
            }
          } catch (err) {
            console.error("[pix-nao-pago] reconsulta falhou, seguindo:", err);
          }
        }

        out.push({
          email: p.email,
          locale: locale as "pt" | "es",
          // `.trim()`: o nome do quiz vem com espaço sobrando ("Cardoso ") e o
          // assunto sairia com espaço duplo.
          nome: ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() || "quem você ama",
          titulo: m.titulo ?? "Sua música",
          linkCheckout: link,
          meio: meio === "cartao" ? "cartao" : "pix",
          // O CÓDIGO COPIÁVEL, e não só o link.
          //
          // Abrir link, esperar carregar e achar o botão é trabalho. Copiar e
          // colar no app do banco é o gesto que a pessoa já domina, e é o
          // caminho mais curto entre o e-mail e o dinheiro.
          //
          // Só sai junto do `pix_url` DELE: misturar código de um pedido
          // com link de outro lugar é a receita do "paguei e não caiu".
          codigo: codigoDoLembrete(link, p.pix_url as string | null, p.pix_codigo as string | null),
          quizId: p.quiz_response_id,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    // Um passo POR PESSOA: se um envio falhar, o Inngest reexecuta só aquele e
    // ninguém recebe o e-mail duas vezes.
    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`pix-${c.quizId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();

        // Recheca na hora do envio: a pessoa pode ter pago entre a busca e
        // agora, e nada é pior que cobrar quem já pagou.
        const { data: pago } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", c.quizId)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();
        if (pago?.id) return false;
        if (await pessoaJaComprou(sb, c.email)) return false;
        const toquesAntes = await toquesJaDados(sb, c.quizId);
        if (!podeMandar(toquesAntes, Date.now())) return false;
        // POR PESSOA, não só por pedido (25/09): quem gerava vários PIX em
        // dias diferentes recebia 3 a 10 destes em 14 dias, porque a trava
        // acima conta por quiz. Dois por pessoa na quinzena, e pronto.
        if ((await toquesDaPessoa(sb, c.email)) >= MAX_TOQUES) return false;
        if (await estaBloqueado(sb, c.email)) return false;
        // Teste `limite_frequencia` (08/10): o PRIMEIRO toque é o código que a
        // pessoa gerou e passa sempre; do segundo em diante é lembrete, e no
        // braço B respeita o teto de 2 de marketing em 24h (sem marca, volta
        // na próxima rodada). No A não vai ao banco.
        if (toquesAntes.quantos >= 1 && !(await podeMandarMarketing(sb, c.email, c.quizId, { locale: c.locale }))) {
          return false;
        }

        // ── A TRAVA ANTES DO ENVIO, E CONFERIDA (08/10) ─────────
        //
        // A marca de "já mandei" era gravada DEPOIS do envio e sem olhar o
        // erro. Se a gravação falhasse, nada contava o toque: a próxima rodada
        // (meia hora depois) mandava de novo, o mesmo formato do incidente de
        // 04/10 com a letra repetida. Agora ela vem antes e falha FECHADA:
        // sem marca gravada, não sai e-mail. Se o envio falhar depois, a marca
        // é desfeita pra o toque não se perder.
        const { data: marca, error: erroMarca } = await sb
          .from("funnel_events")
          .insert({
            event_name: "pix_nao_pago_enviado",
            event_data: { quiz_response_id: c.quizId, email: c.email, meio: c.meio },
          })
          .select("id")
          .maybeSingle();
        if (erroMarca || !marca?.id) {
          console.error("[pix-nao-pago] trava não gravou, não envio:", erroMarca?.message ?? "sem id");
          return false;
        }

        const { data: enviado, error } = await comUtm(new Resend(chave)).emails.send({
          tags: [{ name: "template", value: "pix_nao_pago" }],
          from: MARCA_ATIVA.remetenteTransacional,
          to: [c.email],
          headers: cabecalhosDescadastro(c.email),
          subject: assuntoPixNaoPago(c.nome, c.locale, c.meio),
          html: emailPixNaoPago({
            nome: c.nome,
            titulo: c.titulo,
            linkCheckout: c.linkCheckout,
            // Faltava (auditoria 30/09): o código era calculado, ia só no
            // texto puro, e o HTML caía sempre no botão sem copia-e-cola.
            codigo: c.codigo,
            locale: c.locale,
            meio: c.meio,
          }),
          text:
            c.meio === "cartao"
              ? `A música de ${c.nome} ficou pronta, mas a compra no cartão não chegou a ser concluída.\n\n` +
                `Nada se perdeu: a música está gravada e é a mesma que você vai receber.\n\n` +
                `Conclua o pagamento aqui, por PIX ou cartão:\n${c.linkCheckout}`
              : `A música de ${c.nome} ficou pronta, mas o pagamento não chegou a cair.\n\n` +
                (c.codigo
                  ? `Nada se perdeu: a música está gravada e o seu código PIX continua valendo.\n\n` +
                    `Pague com o seu PIX aqui:\n${c.linkCheckout}\n\n` +
                    `Ou copie o código e cole no app do seu banco:\n${c.codigo}\n\n` +
                    `Se preferir cartão, a opção aparece na mesma tela.`
                  : `Nada se perdeu: a música está gravada.\n\n` +
                    `Conclua o pagamento aqui, por PIX ou cartão:\n${c.linkCheckout}`),
        });
        if (error) {
          console.error("[pix-nao-pago] envio falhou:", error.message);
          // Desfaz a marca: o toque não saiu. Se o desfazer falhar, perde-se
          // um toque, que é o lado barato do erro.
          await sb.from("funnel_events").delete().eq("id", marca.id);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "pix_nao_pago",
          para: c.email,
          quizResponseId: c.quizId,
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
