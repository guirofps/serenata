import { createServerFn } from "@tanstack/react-start";
import { bracoCobravel } from "@/lib/braco-cobravel";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OFERTAS } from "@/lib/creditos";
import { centavosComCupom, codigoAplicado } from "@/lib/cupom";
import { emailPlausivel, semPontoNoFim } from "@/lib/email-limpo";
import { BUMPS, ehItemBump, referenciaComItem, valorComItem, type ItemBump } from "@/lib/bump";
import { cpfValido, soDigitosCpf } from "@/lib/cpf";
import { paraE164, telefoneValido } from "@/lib/telefone";
import { woovi } from "@/lib/woovi";
import { asaasPix } from "@/lib/asaas-pix";
import { COBRANCA_JA_PAGA, ErroGateway, type GatewayPix } from "@/lib/gateway";
import { outroPagamentoDoQuiz } from "@/lib/asaas-regras";
import { conviteDaCompra } from "@/lib/indicacao-db";
import { descontoDoConvite } from "@/lib/indicacao";
import { MARCA_ATIVA } from "./marca-identidade.js";
import { marcarSeVeioDeEmail } from "@/lib/toque-email.server";

// GERA O PIX DO CHECKOUT TRANSPARENTE.
//
// ── O PREÇO NÃO VEM DO CLIENTE ───────────────────────────────────
//
// É a regra mais importante deste arquivo. Se o navegador mandasse o valor,
// bastaria abrir o DevTools e pedir uma cobrança de R$ 1 pra levar um produto
// de R$ 54,90. O valor sai daqui, do braço de preço que aquela pessoa
// sorteou, lido da `attribution` que o servidor gravou.
//
// ── E A MÚSICA PRECISA EXISTIR ───────────────────────────────────
//
// Mesma trava do checkout atual, pela mesma razão de sempre: nunca cobrar por
// algo que ainda não foi produzido. Aqui ela vale ainda mais, porque no
// transparente a cobrança nasce do nosso lado.

// ── O WEBHOOK NÃO SE ESCOLHE AQUI ────────────────────────────────
//
// Na MillionsPay a URL do postback ia no corpo de cada cobrança, e por isso
// dava pra apontar um teste pro preview sem tocar em produção. Na Woovi não:
// o webhook é UM, registrado na conta, e vale pra todas as cobranças.
//
// Consequência prática pra testar: ou o webhook da conta aponta pro preview
// (e aí produção fica sem receber), ou aponta pra produção. Não dá os dois ao
// mesmo tempo com uma conta só.

/** O domínio do site, pro link que a pessoa recebe por e-mail. */
function urlDoSite(): string {
  const u = process.env.VITE_APP_URL;
  return u?.startsWith("http") ? u : MARCA_ATIVA.url;
}

/**
 * O preço DAQUELA pessoa, do jeito que ela viu na tela.
 *
 * Lê o braço sorteado em `attribution.exp.preco` e o valor na config viva de
 * `experimentos`. Mandar outro valor seria trocar o preço depois de a pessoa
 * ter decidido, que é o jeito mais rápido de transformar uma venda numa
 * reclamação.
 */
async function valorCentavosDaSessao(
  db: ReturnType<typeof supabaseAdmin>,
  attribution: unknown,
): Promise<number | null> {
  const braco = (attribution as { exp?: Record<string, string> } | null)?.exp?.preco ?? "A";
  const { data } = await db
    .from("experimentos")
    .select("variantes")
    .eq("id", "preco")
    .maybeSingle();
  const variantes = (data?.variantes ?? []) as Array<{
    nome?: string;
    plano?: { valor?: number | string };
  }>;
  const achado = bracoCobravel(variantes, braco);
  const valor = Number(achado?.plano?.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 100);
}

export type ResultadoPix =
  | {
      ok: true;
      copiaECola: string;
      valorCentavos: number;
      expiraEm: string | null;
      referencia: string;
    }
  | {
      ok: false;
      /**
       * `cpf-necessario` e `cpf-invalido` NÃO são falha: são pedido de
       * correção. A tela mostra o campo em vez do aviso de erro, e quem
       * decide que eles existem é o gateway (`exigeCpf`), não o checkout.
       */
      erro:
        | "sem-sessao"
        | "sem-musica"
        | "sem-preco"
        | "gateway"
        | "cpf-necessario"
        | "cpf-invalido"
        /** Este quiz já foi pago: a tela leva pra /obrigado, igual ao Stripe. */
        | "ja-pago";
    };

/**
 * QUEM PROCESSA O PIX AGORA.
 *
 * `PIX_GATEWAY=asaas` troca o gateway inteiro sem deploy de código — que é a
 * promessa escrita no topo do `gateway.ts` e que, em 11/09/2026, não valeu
 * nada: a Woovi ficou três horas sem receber e não havia segunda perna.
 *
 * Padrão é a Woovi porque a taxa dela é R$ 0,50 contra o R$ 1,99 do Asaas, e
 * porque ela não pede CPF. O Asaas é o plano B, não o plano A.
 */
/**
 * O WhatsApp do quiz em E.164, ou `null` se nao der pra confiar.
 *
 * Reusa o `telefone.ts` que ja existia (mascara, validacao e DDI por
 * mercado). Eu cheguei a escrever um segundo modulo de telefone sem procurar
 * o primeiro, e pior: sobrescrevi o original, que era mais completo. Ficou
 * aqui como lembrete de procurar antes de criar.
 */
function telefoneParaGateway(cru: unknown, locale: "pt" | "es"): string | null {
  const v = String(cru ?? "").trim();
  if (!v || !telefoneValido(v, locale)) return null;
  const e164 = paraE164(v, locale);
  // `paraE164` devolve so digitos com DDI; a Woovi quer com o `+` (medido
  // contra a API deles em 11/09/2026).
  return e164 ? `+${e164}` : null;
}

export function gatewayPix(): GatewayPix {
  return process.env.PIX_GATEWAY === "asaas" ? asaasPix : woovi;
}

/**
 * O QUADRO COMPRADO JUNTO, no mesmo PIX.
 *
 * ── POR QUE ELE VEM PRA CA ───────────────────────────────────────
 *
 * O quadro (R$ 24,90) so era vendido DEPOIS da compra, no editor e no painel.
 * Medido de 17 a 31/08, PIX gerados contra pagos:
 *
 *   R$ 38,00 (base)     821 -> 462   56,3%
 *   R$ 29,00            311 -> 188   60,5%
 *   R$ 19,00            210 -> 143   68,1%
 *   R$ 24,90 (quadro)   117 ->  31   26,5%
 *
 * Todo preco do funil paga entre 56% e 70%; o quadro paga 26,5%, e sao 86
 * cobrancas mortas em 14 dias. A diferenca nao e o preco, e a INTENCAO: no
 * funil a pessoa ja decidiu pagar, e no painel ela abre a folha so pra ver
 * quanto custa (a cobranca nasce sozinha no `useEffect` de montagem).
 *
 * Aqui ele entra no MESMO pagamento: sem segunda decisao, sem segundo PIX,
 * sem cobranca morta na conta da Woovi.
 *
 * ── O CLIENTE MANDA UM SIM OU NAO, NUNCA UM VALOR ────────────────
 *
 * A invariante do CLAUDE.md continua de pe: o preco sai do braco sorteado,
 * lido no servidor. O navegador so diz SE quer o quadro; quanto custa e o
 * catalogo daqui que decide. Se o valor viesse de la, o DevTools levaria
 * musica e quadro por R$ 1.
 */
export const CENTAVOS_QUADRO = Math.round(
  (OFERTAS.find((o) => o.id === "quadro")?.precoBrl ?? 24.9) * 100,
);

/**
 * O valor final da cobranca. Exportado pra ter teste: e a unica conta deste
 * arquivo que, errada, cobra da pessoa um numero diferente do que ela viu.
 */
export function valorComBump(baseCentavos: number, quadro: boolean): number {
  return valorComItem(baseCentavos, quadro ? "quadro" : null);
}

/**
 * A referencia, que e a chave de idempotencia.
 *
 * O sufixo NAO e cosmetico: a Woovi recusa reaproveitar um correlationID com
 * outro valor, entao sem ele quem abrisse a folha sem o quadro e voltasse pra
 * marcar cairia num erro em cima de uma cobranca que existe.
 *
 * O webhook corta no primeiro dois-pontos depois do prefixo pra achar o quiz,
 * entao o sufixo tem que vir DEPOIS do id, nunca no meio.
 */
export function referenciaDoPix(quizId: string, quadro: boolean): string {
  return referenciaComItem(quizId, quadro ? "quadro" : null);
}

/**
 * INTERRUPTOR DE EMERGENCIA DO PIX TRANSPARENTE, no SERVIDOR.
 *
 * `PIX_TRANSPARENTE_OFF=1` faz esta funcao recusar antes de tocar no gateway.
 * A folha cai na tela de erro, que oferece "Continuar pelo checkout" e leva
 * pra Perfect Pay — ninguem fica sem caminho pra pagar.
 *
 * ── POR QUE EXISTE, ALEM DO `ativo` DO PAINEL ────────────────────
 *
 * Em 11/09/2026 a Woovi parou de receber as 16:44 (2h52 sem um unico
 * pagamento, 14 cobrancas recentes todas ACTIVE na API deles). O `ativo` do
 * `checkout_pix` foi desligado no painel e a config propagou na hora.
 *
 * REGISTRO HONESTO DE UMA CONCLUSAO ERRADA: eu escrevi aqui, e disse pro
 * dono, que o painel "nao tinha alcancado" quem ja estava no funil, citando
 * pedidos que continuaram nascendo na Woovi depois do desligamento. Estava
 * errado — eu tinha anotado 18:58 como a hora da mexida, e o
 * `experimentos.atualizado_em` diz 19:30:37. Os pedidos que usei como prova
 * sao de sessoes ANTERIORES a ela, e os tres que vieram depois cabem
 * inteiros nos 3 minutos que eu esperei, com cache de 60s por lambda.
 *
 * O painel, ao que tudo indica, estava funcionando.
 *
 * Entao o motivo deste interruptor nao e "o painel falha". E:
 *
 *   - ele nao depende de estado no navegador de ninguem. O `varianteDe` le um
 *     carimbo do `<html>` de uma pagina que pode ter sido carregada ha meia
 *     hora; isto aqui vale na proxima chamada, para todo mundo, sem excecao.
 *   - ele fecha ANTES de tocar no gateway, entao nao nasce cobranca morta pra
 *     entupir a fila do vigia de pagamento.
 *   - numa queda de gateway, "todo mundo agora" e exatamente o que se quer, e
 *     nao da pra ficar torcendo pro cache virar.
 *
 * Ligar e desligar pela env na Vercel, sem mexer em codigo. E lembrar que sao
 * DOIS interruptores agora: este e o `ativo` do painel.
 */
function pixTransparenteDesligado(): boolean {
  return process.env.PIX_TRANSPARENTE_OFF === "1";
}

export const criarPix = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      email?: string;
      /** Legado (quadro sim/nao). O caminho novo e `bump`. */
      quadro?: boolean;
      /** QUAL item extra ela marcou. O preco dele sai de `BUMPS`, daqui. */
      bump?: ItemBump;
      cpf?: string;
      /** WhatsApp digitado na folha, cru. Normalizado aqui, nunca no cliente. */
      telefone?: string;
      /** Cupom (recuperação ou campanha). Só o CÓDIGO: o desconto sai de `cupom.ts`, daqui. */
      cupom?: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<ResultadoPix> => {
    // Antes de qualquer leitura: nao adianta montar cobranca que o banco do
    // cliente vai recusar, e cobranca morta ainda entope a fila do vigia.
    if (pixTransparenteDesligado()) {
      console.warn("[criar-pix] PIX_TRANSPARENTE_OFF=1, recusando e mandando pro checkout");
      return { ok: false, erro: "gateway" };
    }

    const db = supabaseAdmin();

    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, email, respostas, attribution, whatsapp, nome_comprador, locale")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!quiz?.id) return { ok: false, erro: "sem-sessao" };

    // A MÚSICA TEM QUE EXISTIR. Mesma pergunta que `temMusicaDaSessao` faz no
    // checkout de hoje, e pelo mesmo motivo.
    const { data: musica } = await db
      .from("musicas")
      .select("id, titulo")
      .eq("quiz_response_id", quiz.id)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!musica?.id) return { ok: false, erro: "sem-musica" };

    // ── ESTE QUIZ JÁ FOI PAGO? (08/10) ───────────────────────────
    //
    // Antes, a folha gerava PIX novo pra quem já tinha pago, e o QR novo era
    // um segundo jeito de pagar a mesma música. Foi a porta do quiz bb9effb8…
    // (R$ 38 em 03/10 e de novo em 06/10). O Stripe da Ballad já devolvia
    // `ja-pago` (`stripe-checkout.ts`); aqui é a mesma resposta, e a tela leva
    // pra /obrigado. Upsell e cortesia não contam (`outroPagamentoDoQuiz`).
    const { data: pagosDoQuiz } = await db
      .from("pedidos")
      .select("payment_id, status, dinheiro_entrou")
      .eq("quiz_response_id", quiz.id)
      .eq("status", "pago")
      .limit(20);
    if (outroPagamentoDoQuiz(pagosDoQuiz, null)) return { ok: false, erro: "ja-pago" };

    const semCupom = await valorCentavosDaSessao(db, quiz.attribution);
    if (!semCupom) return { ok: false, erro: "sem-preco" };
    const agora = new Date();
    const base = centavosComCupom(semCupom, data.cupom, agora, "musica");
    const cupomAplicado = codigoAplicado(semCupom, data.cupom, agora, "musica");
    // Uma pagina carregada antes do deploy ainda manda `quadro: true`.
    const item: ItemBump | null = ehItemBump(data.bump)
      ? data.bump
      : data.quadro === true
        ? "quadro"
        : null;
    // O NOME DO COMPRADOR, quando ele existe.
    //
    // `respostas.nome` e a pessoa HOMENAGEADA, e mandar ela como `customer.name`
    // e o que encheu `pedidos.nome_pagador` de "Amorzao" e "MINHA NEGA" — 80%
    // dos pedidos com o nome errado, e uma contestacao que levou uma hora pra
    // ser achada porque o pedido estava gravado como "Manuela".
    //
    // Continua caindo na homenageada quando o comprador nao disse o nome dele:
    // e melhor que vazio pra quem olha o painel, e o `titular_pix` guarda o
    // pagador de verdade assim que o pagamento entra.
    const nome =
      (quiz.nome_comprador as string | null)?.trim() ||
      ((quiz.respostas ?? {}) as Record<string, string>).nome?.trim();

    // ── O E-MAIL CONFERIDO NA TELA DE RESUMO ─────────────────────
    //
    // A pessoa acabou de ver pra onde a música vai, e pôde corrigir. Se ela
    // corrigiu, o endereço novo vale — e vale ANTES do pagamento, que é a
    // diferença entre um toque e uma conversa com o suporte.
    //
    // O suporte já mostrou qual é o gargalo desta operação: quase nunca é
    // defeito de produto, é comprador que não achou o caminho de volta. E a
    // origem mais comum disso é endereço digitado errado no quiz.
    //
    // Valida aqui também, e não só na tela: server function é rota HTTP, e o
    // que chega dela não é promessa de nada. Endereço inválido é ignorado em
    // silêncio — melhor manter o antigo que gravar lixo por cima.
    const emailNovo = data.email ? semPontoNoFim(data.email).toLowerCase() : undefined;
    const emailVale =
      !!emailNovo &&
      emailNovo.length <= 254 &&
      emailPlausivel(emailNovo) &&
      emailNovo !== (quiz.email as string | null);
    if (emailVale) {
      const { error } = await db
        .from("quiz_responses")
        .update({ email: emailNovo })
        .eq("id", quiz.id);
      if (error) console.error("[criar-pix] trocar e-mail falhou:", error.message);
    }
    const emailDaVenda = emailVale ? emailNovo! : ((quiz.email as string | null) ?? null);

    // ── O WHATSAPP, MESMA LOGICA DO E-MAIL ─────────────────
    //
    // O que a pessoa digitou na folha vence o que o quiz tinha, porque e mais
    // recente e foi digitado olhando a cobranca. Invalido nao sobrescreve
    // nada: melhor manter o antigo do que gravar lixo por cima.
    //
    // O idioma da venda mora na COLUNA, nao na URL — mesma regra do resto do
    // projeto — e aqui decide o DDI do numero.
    const locale = (quiz as { locale?: string }).locale === "es" ? "es" : "pt";
    const telefoneDaVenda =
      telefoneParaGateway(data.telefone, locale) ?? telefoneParaGateway(quiz.whatsapp, locale);
    // Numero novo e valido volta pro quiz, pra recuperacao e pro suporte
    // acharem a pessoa depois. Sem await bloqueante na venda: falha aqui nao
    // pode impedir a cobranca de nascer.
    const telefoneCru = String(data.telefone ?? "").trim();
    if (
      telefoneCru &&
      telefoneParaGateway(telefoneCru, locale) &&
      telefoneCru !== (quiz.whatsapp ?? "")
    ) {
      const { error } = await db
        .from("quiz_responses")
        .update({ whatsapp: telefoneCru })
        .eq("id", quiz.id);
      if (error) console.error("[criar-pix] gravar whatsapp falhou:", error.message);
    }

    // ── O CONVITE (member get member) ────────────────────────────
    //
    // Conferido DEPOIS do e-mail da venda, porque é ele que diz se esta é a
    // primeira compra e se a pessoa não está usando o próprio link. O
    // desconto sai só do preço da música; o item extra não tem desconto.
    //
    // Cupom e convite NÃO se somam: com o cupom da recuperação aplicado
    // (`base` abaixo do preço do braço), o convite nem é consultado.
    const convite =
      base === semCupom
        ? await conviteDaCompra(db, { attribution: quiz.attribution, email: emailDaVenda, locale })
        : null;
    const descontoConvite = convite ? descontoDoConvite(base) : 0;
    const valorCentavos = valorComItem(base - descontoConvite, item);

    // A REFERÊNCIA É A CHAVE DE IDEMPOTÊNCIA, e por isso é o id do quiz e não
    // um aleatório: duplo-clique, reload e voltar-e-avançar devolvem A MESMA
    // cobrança, com o mesmo QR. Sem isso a pessoa acumularia PIX abertos e
    // poderia pagar dois.
    // ── A REFERENCIA CARREGA O BUMP ──────────────────────────────
    //
    // Ela e a chave de idempotencia, e o valor faz parte da identidade da
    // cobranca: a Woovi RECUSA reaproveitar um correlationID com outro valor
    // ("cobranca existente e de X, esperado Y", em `woovi.ts`). Sem o sufixo,
    // quem abrisse a folha sem o quadro e voltasse pra marcar cairia num erro
    // em cima de uma cobranca que existe.
    //
    // Consequencia aceita, e por isso a trava por quiz entrou no webhook
    // junto com isto: duas cobrancas VIVAS do mesmo quiz passam a ser
    // possiveis (R$ 38 e R$ 62,90). Pagar as duas exige pagar dois codigos
    // PIX de proposito, mas exige. O webhook agora recusa entregar de novo e
    // avisa o dono pra devolver, em vez de mandar dois presentes e a pessoa
    // descobrir a cobranca dobrada no extrato.
    const referencia = referenciaComItem(String(quiz.id), item, Boolean(convite), Boolean(cupomAplicado));

    // ── O CPF, QUANDO O GATEWAY PEDE ─────────────────────────
    //
    // Conferido AQUI, antes de tocar na rede: CPF errado vira pedido de
    // correção na tela, com a pessoa ainda olhando o campo. Se fosse o Asaas
    // recusando, ela veria "não consegui gerar o PIX agora" — o aviso
    // genérico, que não diz o que fazer e vira abandono.
    const gw = gatewayPix();
    const cpf = soDigitosCpf(data.cpf);
    if (gw.exigeCpf) {
      if (!cpf) return { ok: false, erro: "cpf-necessario" };
      if (!cpfValido(cpf)) return { ok: false, erro: "cpf-invalido" };
    }

    let cobranca;
    try {
      cobranca = await gw.criar({
        referencia,
        valorCentavos,
        descricao: `Serenata · ${musica.titulo ?? "sua música"}`,
        nome: nome || null,
        email: emailDaVenda,
        cpf: cpf || null,
        // O telefone que o quiz ja tem, normalizado com o LOCALE da venda.
        //
        // E o mesmo numero que vai pro `pedidos.telefone` logo abaixo; a
        // diferenca e que agora ele tambem CHEGA no gateway, que e quem
        // dispara a mensagem de WhatsApp com o codigo do PIX.
        //
        // Invalido vira `null` e o campo e OMITIDO: a Woovi recusa a cobranca
        // inteira com telefone torto, e perder a venda pra mandar um numero
        // errado seria o pior negocio possivel.
        telefone: telefoneDaVenda,
      });
    } catch (err) {
      // Sem failover automático de propriedade: os dois gateways pedem coisas
      // diferentes (o Asaas exige CPF, a Woovi não), então cair de um pro
      // outro no meio da chamada pediria um dado que a tela nem mostrou. A
      // troca é pelo `PIX_GATEWAY`, consciente, e aqui a falha é limpa: a
      // tela oferece o checkout antigo, que sempre funciona.
      const g = err instanceof ErroGateway ? err : null;
      const motivo = String(g?.message ?? (err as Error)?.message ?? err).slice(0, 300);
      // O GATEWAY SABE QUE JÁ FOI PAGA e o nosso banco não (webhook perdido,
      // ou atrasado). Não é falha: é a mesma resposta da trava acima, e o
      // "não consegui gerar o PIX" seria mentira pra quem já pagou. O vigia de
      // pagamento reconcilia o pedido.
      if (g?.message === COBRANCA_JA_PAGA) {
        console.warn(`[criar-pix] ${gw.nome}: a referência ${referencia} já foi paga no gateway`);
        void db
          .from("funnel_events")
          .insert({
            event_name: "pix_ja_pago_no_gateway",
            event_data: { gateway: gw.nome, referencia, sessionId: data.sessionId },
          })
          .then(({ error }) => {
            if (error) console.error("[criar-pix] gravar ja-pago falhou:", error.message);
          });
        return { ok: false, erro: "ja-pago" };
      }
      console.error(`[criar-pix] ${gw.nome} falhou:`, motivo);
      // ── A MENSAGEM DO GATEWAY VAI PRO BANCO, NAO SO PRO LOG ────
      //
      // Em 11/09/2026 o Asaas comecou a recusar a criacao de cobranca e a
      // unica coisa que restava era `erro: "gateway"` no funnel_events, que
      // nao diz NADA. `vercel logs` nao devolveu o console.error, e sem a
      // mensagem deles nao da pra saber se e chave PIX ausente, escopo,
      // conta sem permissao ou corpo invalido.
      //
      // Gravar aqui e barato e e o que transforma "falhou" em "falhou
      // porque". Sem await bloqueante: diagnostico nunca pode atrasar (nem
      // derrubar) a resposta pra quem esta esperando o QR.
      void db
        .from("funnel_events")
        .insert({
          event_name: "pix_gateway_recusou",
          event_data: { gateway: gw.nome, motivo, valorCentavos, sessionId: data.sessionId },
        })
        .then(({ error }) => {
          if (error) console.error("[criar-pix] gravar recusa falhou:", error.message);
        });
      return { ok: false, erro: "gateway" };
    }

    // A REFERÊNCIA QUE VALE É A QUE VOLTOU, não a que mandamos: quando a
    // cobrança anterior daquele quiz venceu, a Woovi recusa reaproveitar o id
    // e `woovi.criar` gera outra com sufixo (`serenata:<id>:r2`). Gravar o
    // pedido com a original faria o webhook escrever numa linha e a tela
    // esperar em outra — a pessoa pagaria e a tela ficaria girando.
    const refFinal = cobranca.idExterno;

    // ── NUNCA REBAIXAR UM PEDIDO PAGO (08/10) ────────────────────
    //
    // O upsert abaixo grava `pendente`. Até 08/10 o Asaas podia devolver como
    // "reaproveitável" uma cobrança JÁ PAGA, e o pedido pago voltava a
    // pendente: some do faturamento, some o acesso. O gateway agora recusa
    // (`COBRANCA_JA_PAGA`); esta leitura é a segunda rede, pela mesma chave.
    const { data: linhaAtual } = await db
      .from("pedidos")
      .select("status")
      .eq("payment_id", `${cobranca.gateway}:${refFinal}`)
      .maybeSingle();
    if (linhaAtual?.status === "pago") return { ok: false, erro: "ja-pago" };

    // ── O PEDIDO PENDENTE NASCE AQUI ─────────────────────────────
    //
    // Não é burocracia: é o que faz o `pixNaoPago` existir (recuperação em 10
    // minutos), o que dá o valor esperado pro webhook conferir contra, e o
    // que faz o painel enxergar a etapa. Sem ele, PIX gerado e não pago seria
    // invisível, como era na Perfect Pay até 10/08.
    const { error } = await db.from("pedidos").upsert(
      {
        // O PREFIXO SAI DO GATEWAY, não de literal: o webhook do Asaas casa
        // por `asaas:<id>` e o da Woovi por `woovi:<ref>`. Cravar "woovi" aqui
        // faria o pagamento pelo Asaas chegar e não achar pedido nenhum.
        payment_id: `${cobranca.gateway}:${refFinal}`,
        gateway: cobranca.gateway,
        status: "pendente",
        email: emailDaVenda,
        nome_pagador: nome || null,
        // O TELEFONE, QUE A MIGRACAO TINHA PERDIDO SEM NINGUEM VER.
        //
        // O checkout da Perfect Pay pedia telefone e o webhook dela gravava
        // aqui: 100% dos pedidos deles tem o campo, todo dia. A nossa folha de
        // PIX nao pede — e ninguem preenchia isto. Medido em 31/08: dos
        // pedidos pela Woovi, de 27/08 em diante, ZERO tinham telefone.
        //
        // O efeito aparece no painel de recuperacao: uma das listas de la monta
        // o botao de WhatsApp a partir de `pedidos.telefone`, entao o botao
        // sumiu pra ~85% dos pedidos. Nao foi o publico que parou de deixar o
        // numero (33,8% das sessoes ainda deixam) — era o dado existindo no
        // quiz e nao chegando no pedido.
        //
        // Vem do `whatsapp` do quiz, que a pessoa deixou na tela de espera — ou
        // da propria folha, quando ela digitou aqui. O objeto `quiz` foi lido
        // ANTES dessa digitacao, entao usar so ele gravaria o numero velho (ou
        // nenhum) num pedido que acabou de receber o novo.
        telefone: telefoneCru || (quiz.whatsapp as string | null) || null,
        valor_centavos: valorCentavos,
        // O convite validado AQUI, e não o `ref` cru da attribution: é o que
        // a trigger da comissão lê quando o pagamento entrar.
        //
        // SÓ COM CONVITE, e não `null` sempre: assim este upsert não depende
        // da migração das colunas. Antes dela não existe convite (a leitura
        // do código falha e `conviteDaCompra` devolve null), e o pedido
        // pendente continua nascendo igual — sem ele o webhook não tem valor
        // pra conferir.
        ...(convite
          ? { indicacao_codigo: convite.codigo, desconto_indicacao_centavos: descontoConvite }
          : {}),
        // O cupom que BAIXOU o preço, normalizado. É o que mede a campanha e o
        // que o webhook do upsell confere. Só quando existe, como o convite.
        ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
        bump_quadro: item ? BUMPS[item].quadro : false,
        bump_video: item ? BUMPS[item].video : false,
        taxa_centavos: cobranca.taxaCentavos,
        quiz_response_id: quiz.id,
        musica_id: musica.id,
        pix_codigo: cobranca.copiaECola,
        pix_expira: cobranca.expiraEm,
        // ── A URL PRA VOLTAR ─────────────────────────────────
        //
        // É o que o e-mail de PIX abandonado usa (39 pessoas por dia). Ele
        // promete "o seu código continua valendo, é o mesmo que você gerou",
        // e sem isto aqui o `pixNaoPago` cai no fallback e manda a pessoa pro
        // checkout gerar um código NOVO — a frase vira mentira e a venda
        // volta a custar 11,39% em vez de R$ 0,50.
        //
        // Serve pro caso mais comum também: quem abriu o PIX, foi no
        // aplicativo do banco, e voltou pra aba fechada.
        pix_url: `${urlDoSite()}/pix/${refFinal}`,
      },
      { onConflict: "payment_id" },
    );
    await marcarSeVeioDeEmail(db, `${cobranca.gateway}:${refFinal}`);
    if (error) {
      // A cobrança JÁ EXISTE no gateway. Não dá pra desfazer, e sumir com o
      // QR seria pior: a pessoa pagaria por outro caminho e ninguém saberia.
      // Segue entregando o PIX e grita no log.
      console.error("[criar-pix] pedido pendente não gravou:", error.message);
    }

    return {
      ok: true,
      // `refFinal` também aqui: é por esta chave que a tela pergunta "já
      // caiu?", e ela tem que ser a mesma que o pedido gravou.
      copiaECola: cobranca.copiaECola,
      valorCentavos,
      expiraEm: cobranca.expiraEm,
      referencia: refFinal,
    };
  });

/** A tela pergunta isto de tempos em tempos enquanto o QR está aberto. */
export const pixFoiPago = createServerFn({ method: "POST" })
  .validator((data: { referencia: string }) => data)
  .handler(async ({ data }): Promise<{ pago: boolean }> => {
    // Lê do NOSSO banco, não do gateway. Quem escreve ali é o webhook, que já
    // conferiu assinatura e valor. Bater na Woovi a cada 5 segundos, por
    // pessoa, seria gastar a API deles pra saber o que a gente já sabe.
    //
    // OS DOIS PREFIXOS, e não só o do gateway de agora. Trocar de gateway não
    // pode deixar quem está com o QR aberto girando pra sempre: a folha dele
    // nasceu no gateway antigo e a pergunta chega depois da troca. São dois
    // valores numa consulta indexada, custo zero.
    const db = supabaseAdmin();
    const ler = async () =>
      (
        await db
          .from("pedidos")
          .select("status, payment_id, created_at")
          .in("payment_id", [`woovi:${data.referencia}`, `asaas:${data.referencia}`])
          .maybeSingle()
      ).data;
    const pedido = await ler();
    if (pedido?.status === "pago") return { pago: true };

    // ── O POSTBACK ATRASADO (09/10) ─────────────────────────────────
    //
    // Em 09/10 o Asaas segurou os postbacks e soltou em lotes: 11 de 52
    // vendas da manhã só foram confirmadas pelo vigia, de 30 em 30 minutos, e
    // quem pagava ficava esse tempo olhando a folha. Agora, com a folha aberta
    // e o banco ainda pendente, a sonda pede ao vigia a conferência DESTE
    // pedido no gateway (mesmas travas e mesma entrega do webhook). Só no
    // Asaas, só depois de 25s (o postback normal chega antes), e no máximo
    // uma vez a cada 20s por cobrança nesta instância: a sonda bate de 4 em 4.
    if (pedido?.status === "pendente" && String(pedido.payment_id).startsWith("asaas:pay_")) {
      const idade = Date.now() - Date.parse(String(pedido.created_at));
      const ultima = CONFERIDO_EM.get(pedido.payment_id) ?? 0;
      if (idade > 25_000 && idade < 3 * 3600_000 && Date.now() - ultima > 20_000 && process.env.CRON_SECRET) {
        CONFERIDO_EM.set(pedido.payment_id, Date.now());
        if (CONFERIDO_EM.size > 500) CONFERIDO_EM.clear();
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 9000);
          await fetch(`${urlDoSite()}/api/vigia-pagamento?pedido=${encodeURIComponent(pedido.payment_id)}`, {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
            signal: ctl.signal,
          }).finally(() => clearTimeout(t));
        } catch (err) {
          // Não derruba a sonda: a próxima tenta de novo, e o cron segue de pé.
          console.warn("[pix-foi-pago] conferência no vigia falhou:", (err as Error).message);
        }
        const depois = await ler();
        return { pago: depois?.status === "pago" };
      }
    }
    return { pago: false };
  });

/** Última conferência no gateway por cobrança, nesta instância (ver `pixFoiPago`). */
const CONFERIDO_EM = new Map<string, number>();
