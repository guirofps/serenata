import { inngest } from "../client.js";
import { cabecalhosDescadastro } from "../lib/descadastro.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { podeMandarMarketing } from "../lib/frequencia.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { emailQuaseComprou, assuntoQuaseComprou } from "../../emails/quase-comprou.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { pareceTypo } from "../../src/lib/email-typo.js";
import { literalLike } from "../../src/lib/sql-like.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { normalizarLocale } from "../../src/lib/i18n.js";
import { caminhoDeVolta } from "../../src/lib/volta-ao-funil.js";
import { jaTravado, soltarTrava, travarEnvio } from "../lib/trava-envio.js";

/** A pessoa (por e-mail, qualquer quiz) comprou nos últimos 14 dias? */
async function pessoaJaComprou(sb: ReturnType<typeof db>, email: string): Promise<boolean> {
  const { data, error } = await sb
    .from("pedidos")
    .select("id, email")
    .ilike("email", literalLike(email))
    .eq("status", "pago")
    .gte("paid_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .limit(5);
  // Na dúvida, comprou (08/10): o erro virava "lista vazia" e a pessoa que
  // tinha acabado de pagar recebia o "libere a sua música".
  if (error) return true;
  // Confere em JS também: o `ilike` é sem caixa, e aqui o alvo é a pessoa.
  return (data ?? []).some((x) => String(x.email ?? "").trim().toLowerCase() === email.trim().toLowerCase());
}

// CLICOU EM COMPRAR E NÃO GEROU PEDIDO NENHUM.
//
// ── O MAIOR VAZAMENTO SEM TRATAMENTO ─────────────────────────────
//
// Medido em 27/08, 7 dias: 2.577 clicaram em comprar e 1.509 (58,6%) nunca
// geraram pedido, nem PIX pendente. São ~215 por dia contra ~39 do PIX
// abandonado. Dessas, 1.486 têm música pronta e 1.504 deixaram e-mail.
//
// Elas caíam na escada genérica, junto de quem só leu a letra e foi embora —
// e a escada converte 0,92% no melhor degrau. Quem clicou em comprar é outra
// pessoa.
//
// ── POR QUE 30 MINUTOS ───────────────────────────────────────────
//
// O PIX abandonado dispara aos 10, porque lá a pessoa já escolheu como pagar
// e a janela de decisão é curta. Aqui ela parou ANTES, na tela do gateway:
// pode estar lendo, comparando, ou preenchendo o formulário devagar. Meia
// hora dá tempo dela concluir sozinha, e quem não concluiu em 30 minutos
// dificilmente conclui na hora seguinte.
//
// ── O CRUZAMENTO É COM `pedidos`, NÃO COM `checkout_click` ───────
//
// Quem GEROU pedido pendente é do `pixNaoPago`, que tem texto próprio e
// devolve o código dela. Este job só pega quem não tem NENHUMA linha em
// `pedidos` — senão os dois e-mails saem pra mesma pessoa no mesmo dia.
//
// ── O LINK VOLTA PRA MÚSICA DELA ─────────────────────────────────
//
// `/retomar?s=<sessão>` reidrata a sessão, a letra e o braço de preço e abre
// a oferta da música JÁ GERADA, no idioma dela. A pessoa não refaz o quiz,
// não gera outra música e não espera de novo: ela paga e recebe a que já é
// dela, e é a sessão que casa o pagamento com a música.

const MIN_MIN = 30;
// Janela de 48h: mais velho que isso a pessoa já esqueceu, e a escada assume.
const MAX_H = 48;
// ── O TETO POR RODADA, E POR QUE ELE SUBIU ───────────────────────
//
// Era 8, escolhido quando `serenatagift.com` tinha 20 dias de vida e pico de
// volume em domínio novo é a assinatura de lista comprada. O medo era certo
// na época.
//
// Medido em 07/09, o medo passou: 12.837 e-mails em 14 dias, **zero**
// reclamação de spam e 96,6% de entrega. O domínio manda ~917/dia e aguenta.
//
// E o teto estava custando caro. O grupo que este e-mail atende — música
// pronta, PIX não gerado — recebe 463 pessoas por dia. A 8 por rodada de hora
// em hora, a capacidade era 192/dia: o e-mail que converte a 2,7% alcançava,
// no máximo, 41% de quem deveria. Medido: 8.337 pessoas nesse degrau em 18
// dias, 33,9% com algum contato, 5.509 sem nada.
//
// 16 por rodada são ~384/dia, +21% no volume do remetente. Sobe em dois
// passos de propósito: a taxa de 2,7% foi medida em quem é alcançado HOJE,
// que é a fatia mais quente da fila. A margem pode converter pior, e é isso
// que o passo seguinte (16 -> 24) vai dizer.
const MAX_POR_RODADA = 16;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * O pedido que tira a pessoa da recuperação: o PAGO (venda feita) e o pendente
 * de PIX (quem cuida dele é o `pixNaoPago`). O pendente do STRIPE fica de fora
 * (Ballad, 03/10): lá não existe `pixNaoPago`, e pular ele deixava todo
 * checkout abandonado sem nenhum e-mail. As DUAS checagens (a busca e a
 * conferência antes de enviar) usam esta regra; a primeira versão do conserto
 * mudou só a busca e o envio continuava barrando.
 */
async function temPedidoQueBarra(sb: ReturnType<typeof db>, quizId: string): Promise<boolean> {
  const { data, error } = await sb.from("pedidos").select("status, gateway").eq("quiz_response_id", quizId);
  // Na dúvida, barra (08/10): consulta que falha não pode virar "não comprou".
  if (error) return true;
  return (data ?? []).some((p) => p.status === "pago" || p.gateway !== "stripe");
}

/**
 * Já mandamos este e-mail pra este quiz? Uma vez por quiz, pra sempre.
 *
 * A janela começa no nascimento do quiz (08/10): o aviso não existe antes
 * dele, então o limite é exato e a consulta usa o índice de tempo em vez de
 * varrer a trilha inteira. Erro conta como já mandou (04/10).
 */
function jaAvisado(sb: ReturnType<typeof db>, quizId: string, quizCriadoEm: string) {
  return jaTravado(sb, "quase_comprou_enviado", { quiz_response_id: quizId }, quizCriadoEm);
}

// Mesmo padrão dos outros jobs: `VITE_APP_URL` quando ela existe e é URL,
// e o domínio fixo como piso. Cron não tem cabeçalho de host de onde deduzir,
// e em produção host de requisição não pode decidir destino.
const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : MARCA_ATIVA.url;

export const quaseComprou = inngest.createFunction(
  {
    id: "quase-comprou",
    // Uma rodada por vez: duas sobrepostas montam a mesma fila e mandam em dobro.
    concurrency: { limit: 1 },
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "50 * * * *" }], // de hora em hora, fora do minuto cheio
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quem-clicou-e-sumiu", async () => {
      const sb = db();
      const agora = Date.now();

      // Os cliques da janela. `session_id` é a chave do funil inteiro.
      const { data: cliques } = await sb
        .from("funnel_events")
        .select("session_id, created_at")
        .eq("event_name", "checkout_click")
        .gte("created_at", new Date(agora - MAX_H * 3600000).toISOString())
        .lte("created_at", new Date(agora - MIN_MIN * 60000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1200);

      const out: Array<{
        email: string; nome: string; titulo: string;
        link: string; quizId: string; quizCriadoEm: string; locale: "pt" | "es" | "en";
      }> = [];
      const vistos = new Set<string>();

      for (const c of cliques ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        const sid = c.session_id as string | null;
        if (!sid || vistos.has(sid)) continue;
        vistos.add(sid);

        const { data: q } = await sb
          .from("quiz_responses")
          .select("id, session_id, email, respostas, locale, created_at")
          .eq("session_id", sid)
          .maybeSingle();
        if (!q?.id || !q.email) continue;
        // ENDEREÇO QUEBRADO NÃO ENTRA. Saiu um disparo pra
        // `sp.paulista2020@wotlook.com` (outlook com typo) na primeira rodada:
        // bounce garantido, e bounce em domínio de 20 dias é o dano mais caro
        // que existe. Mesma trava do `mandarLetra` e da escada.
        if (pareceTypo(q.email as string)) continue;

        // TEM PEDIDO? Pago é venda feita; pendente é do `pixNaoPago`. Nos dois
        // casos esta mensagem seria a errada.
        //
        // EXCETO o pendente do STRIPE (Ballad, 03/10): o `pixNaoPago` só roda
        // na Serenata, e o pedido do Stripe nasce pendente quando a folha de
        // pagamento abre. Pulando ele, quem abriu o checkout da Ballad e não
        // pagou (cartão recusado, desistiu) não recebia nada: 9 de 9 pedidos
        // pendentes até 02/10 ficaram sem nenhum e-mail.
        if (await temPedidoQueBarra(sb, q.id)) continue;

        // A PESSOA JÁ COMPROU, por outro quiz? A trava acima é por quiz, e não
        // basta: em 28/09 um cliente pagou a SEGUNDA música dele e continuou
        // recebendo o "libere a sua música" da PRIMEIRA, cujo botão leva ao
        // pagamento. Pra quem acabou de comprar isso é pedir pra pagar de
        // novo. Mesma trava do `pixNaoPago`: e-mail sem caixa, 14 dias.
        if (await pessoaJaComprou(sb, q.email as string)) continue;

        if (await jaAvisado(sb, q.id, q.created_at as string)) continue;

        // A MÚSICA PRECISA ESTAR PRONTA. O e-mail diz "ela já existe, está
        // gravada": sem arquivo isso é mentira, e é a única que este texto
        // pode contar.
        const { data: m } = await sb
          .from("musicas")
          .select("titulo, status")
          .eq("quiz_response_id", q.id)
          .maybeSingle();
        if (!m || m.status !== "pronta") continue;

        // O idioma vem do registro: cron não tem requisição de onde deduzir.
        // Sem idioma gravado, o PADRÃO DA MARCA (en na Ballad), não "pt".
        const locale = normalizarLocale((q as { locale?: string }).locale);

        // ── PRA ONDE ESTE E-MAIL MANDA: PRA MÚSICA DELA ─────────
        //
        // Em português, pro NOSSO funil. Este e-mail recupera a preço CHEIO,
        // sem cupom, então nada prende ele ao checkout hospedado — e a
        // diferença é grande: R$ 4,38 de taxa na Perfect Pay contra R$ 0,50
        // no PIX transparente. Medido em 31/08: 4 vendas assim em 4 dias,
        // uns R$ 116/mês jogados fora.
        //
        // O `/retomar` repõe o braço sorteado: quem abrir o e-mail noutro
        // aparelho vê o mesmo preço que viu na oferta.
        //
        // ── O ESPANHOL TAMBÉM (08/10) ──────────────────────────
        //
        // Quem não caía no `/retomar` ia direto pro checkout da Perfect Pay
        // com `src=<id do quiz>`. O webhook de lá casa o `src` com o
        // `session_id`, nunca com o id do quiz: a compra entraria como "pago
        // sem música casada" e alguém entregaria à mão. E, desde 26/09,
        // nenhum caminho brasileiro leva mais à Perfect Pay. O `/retomar`
        // abre a oferta no idioma do lead: o espanhol chega no checkout em
        // dólar dele, já com a sessão certa.
        //
        // Sem sessão não há como voltar pra música: fica de fora, em
        // qualquer idioma (o candidato vem de um `checkout_click` por sessão,
        // então isso não deve acontecer).
        const volta = caminhoDeVolta(q.session_id as string | null);
        if (!volta.startsWith("/retomar")) continue;
        const link = `${SITE}${volta}&de=quase`;

        out.push({
          email: q.email as string,
          locale,
          // `.trim()`: o nome do quiz vem com espaço sobrando ("Cardoso ").
          nome:
            ((q.respostas ?? {}) as Record<string, string>).nome?.trim() ||
            // `tú`, nunca `vos` (o funil é mexicano): "quien vos querés"
            // era rioplatense.
            (locale === "es" ? "esa persona" : locale === "en" ? "someone you love" : "quem você ama"),
          titulo: m.titulo ?? (locale === "en" ? "Your song" : locale === "es" ? "Tu canción" : "Sua música"),
          link,
          quizId: q.id as string,
          quizCriadoEm: q.created_at as string,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`quase-${c.quizId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();

        // Recheca na hora: a pessoa pode ter comprado entre a busca e agora, e
        // "sua música está esperando" pra quem já pagou é o pior desfecho.
        if (await temPedidoQueBarra(sb, c.quizId)) return false;
        if (await pessoaJaComprou(sb, c.email)) return false;
        if (await jaAvisado(sb, c.quizId, c.quizCriadoEm)) return false;
        // Endereço que já voltou não recebe de novo: 51 destes foram pra
        // endereço morto em 14 dias, e é a reputação que paga. Desde 08/10
        // também quem se descadastrou e os `excluidos_email` (liberados na
        // recuperação têm a música inteira sem pedido pago).
        if (await estaBloqueado(sb, c.email, { incluirExcluidos: true })) return false;
        // Teste `limite_frequencia` (08/10): no braço B, no máximo 2 e-mails
        // de marketing por endereço em 24h. Barrado aqui não grava marca, e
        // volta na próxima rodada. No A não vai ao banco.
        if (!(await podeMandarMarketing(sb, c.email, c.quizId, { locale: c.locale }))) return false;

        // A TRAVA ANTES DO ENVIO (08/10): ela era gravada depois do Resend e
        // sem ler o erro, e uma gravação perdida mandava o mesmo e-mail na
        // rodada seguinte. Não gravou, não manda.
        const trava = await travarEnvio(sb, {
          event_name: "quase_comprou_enviado",
          event_data: { quiz_response_id: c.quizId, email: c.email },
        });
        if (!trava) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "quase_comprou" }],
          // REMETENTE DE RECUPERAÇÃO, não o transacional.
          //
          // A doutrina está em `emails/remetentes.ts`: o domínio raiz carrega
          // o que a pessoa PAGOU pra receber, o subdomínio carrega o que ela
          // não pediu. Este e-mail é oferta, não entrega — mandá-lo pelo raiz
          // aposta a caixa de entrada do comprador (o único e-mail que não
          // pode falhar) pra sustentar um disparo de marketing.
          //
          // `reply_to` é obrigatório: o subdomínio só manda, não recebe.
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: [c.email],
          headers: cabecalhosDescadastro(c.email),
          subject: assuntoQuaseComprou(c.nome, c.locale),
          html: emailQuaseComprou({
            nome: c.nome,
            titulo: c.titulo,
            link: c.link,
            locale: c.locale,
          }),
          text: c.locale === "en"
            ? `${c.nome}'s song already exists: it was recorded from the story you told.\n\n` +
              `You get the full song in both versions, the gift page with a link and ` +
              `QR code, and the MP3 to keep.\n\n` +
              `${c.link}\n\n` +
              `The lyrics are yours either way, and the link never expires.`
            :
            `A música de ${c.nome} já existe: foi gravada com a história que você contou.\n\n` +
            `Você recebe a música completa nas duas versões, a página presente com link e ` +
            `QR Code, e o MP3 pra guardar.\n\n` +
            `${c.link}\n\n` +
            `A letra continua sua de qualquer jeito, e o link não expira.`,
        });
        if (error) {
          console.error("[quase-comprou] envio falhou:", error.message);
          await soltarTrava(sb, trava);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "quase_comprou",
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
