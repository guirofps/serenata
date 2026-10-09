import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { gatewayPix } from "@/lib/criar-pix";
import { ErroGateway } from "@/lib/gateway";
import { cpfParaGateway } from "@/lib/cpf";
import { conferirOferta } from "@/lib/oferta-assinada";
import { OFERTA, type DegrauEscada } from "../../emails/escada";
import { MARCA_ATIVA } from "./marca-identidade.js";
import { marcarSeVeioDeEmail } from "@/lib/toque-email.server";

// O PIX DO DEGRAU DA ESCADA.
//
// ── O QUE MUDA EM RELAÇÃO AO FUNIL ───────────────────────────────
//
// Só o preço, e de onde ele vem. No funil sai do braço de `preco` que a
// sessão sorteou; aqui sai do DEGRAU, que é quanto o e-mail daquele dia
// prometeu (R$ 38, 29, 19 ou 9).
//
// Todo o resto é igual de propósito: mesma referência-base (`serenata:<quiz>`),
// mesmo pedido pendente, mesmo webhook, mesma entrega. Um caminho paralelo de
// entrega seria a segunda cópia que sempre diverge.
//
// ── E POR QUE ISTO PODE EXISTIR AGORA ────────────────────────────
//
// Enquanto o checkout era hospedado, cada degrau precisava ser um PRODUTO
// cadastrado na Perfect Pay com aquele preço. Com o checkout próprio a Woovi
// cobra qualquer valor, então o degrau vira só um número — e a economia de
// taxa (11,39% contra R$ 0,50) passa a valer também pra recuperação, que é
// justamente onde a margem já está mais fina por causa do desconto.
//
// ── O DEGRAU É ASSINADO ──────────────────────────────────────────
//
// Ver `oferta-assinada.ts`. Se ele viesse cru na URL, a primeira pessoa que
// reparasse compraria tudo a R$ 9.

/** `R$ 29` -> 2900. O texto do degrau é a fonte, pra tela e o caixa não divergirem. */
function centavosDoDegrau(degrau: DegrauEscada): number | null {
  const texto = OFERTA[degrau]?.texto;
  if (!texto) return null;
  const n = Number(texto.replace(/[^\d,]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export type ResultadoPixOferta =
  | {
      ok: true;
      copiaECola: string;
      valorCentavos: number;
      valorTexto: string;
      referencia: string;
      titulo: string | null;
      nome: string;
      email: string;
    }
  // Assinatura que não bate: a sessão do token não é de confiança, e não volta.
  | { ok: false; erro: "token-invalido" }
  /**
   * `cpf-necessario` e `cpf-invalido` NÃO são falha, são pedido de correção,
   * igual ao `criar-pix.ts`. Levam o preço e o título pra a tela do CPF dizer
   * o que está sendo pago: a pessoa chegou de um e-mail com um número no
   * assunto, e um campo de documento solto, sem esse número, parece golpe.
   */
  | {
      ok: false;
      erro: "cpf-necessario" | "cpf-invalido";
      sessao: string;
      valorTexto: string;
      titulo: string | null;
      nome: string;
    }
  /**
   * `sessao` é a do token JÁ CONFERIDO, e serve só pro botão de saída
   * (`caminhoDeVolta`, `/retomar?s=`). Não expõe nada novo: ela já está em
   * claro dentro do próprio token, que é a URL desta página.
   */
  | { ok: false; erro: "sem-musica" | "gateway" | "ja-pago"; sessao: string };

export const criarPixOferta = createServerFn({ method: "POST" })
  // Server function é rota HTTP: o que chega aqui não é promessa de nada.
  // Só o token e o CPF, cortados; o preço NUNCA vem daqui, sai do degrau
  // assinado.
  .validator((data: { token: string; cpf?: string }) => ({
    token: String(data?.token ?? "").slice(0, 300),
    cpf: typeof data?.cpf === "string" ? data.cpf.slice(0, 32) : undefined,
  }))
  .handler(async ({ data }): Promise<ResultadoPixOferta> => {
    const aberto = conferirOferta(data.token);
    if (!aberto) return { ok: false, erro: "token-invalido" };

    const valorCentavos = centavosDoDegrau(aberto.degrau as DegrauEscada);
    if (!valorCentavos) return { ok: false, erro: "token-invalido" };
    const sessao = aberto.sessao;

    const db = supabaseAdmin();
    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, email, respostas")
      .eq("session_id", sessao)
      .maybeSingle();
    if (!quiz?.id) return { ok: false, erro: "sem-musica", sessao };

    // ── QUEM JÁ PAGOU NÃO PAGA DE NOVO ───────────────────────────
    //
    // Os e-mails da escada ficam na caixa de entrada. Quem comprou pelo funil
    // a R$ 38 e dias depois abre o e-mail de R$ 29 que já estava lá geraria
    // uma SEGUNDA cobrança da mesma música; o webhook recusaria a entrega
    // dobrada e o dono teria que devolver na mão. Enquanto esta página estava
    // morta (até 08/10) isso não acontecia; voltando a gerar PIX, acontece.
    // Uma consulta indexada antes de qualquer cobrança.
    const { data: pago } = await db
      .from("pedidos")
      .select("id")
      .eq("quiz_response_id", quiz.id)
      .eq("status", "pago")
      .limit(1)
      .maybeSingle();
    if (pago?.id) return { ok: false, erro: "ja-pago", sessao };

    // A MÚSICA TEM QUE EXISTIR, e aqui ela tem que estar PRONTA: o e-mail da
    // escada promete uma gravação que já foi feita. Cobrar por algo que não
    // ficou pronto é a regra de ouro invertida.
    const { data: musica } = await db
      .from("musicas")
      .select("id, titulo, status")
      .eq("quiz_response_id", quiz.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!musica?.id || musica.status !== "pronta") return { ok: false, erro: "sem-musica", sessao };

    // A REFERÊNCIA CARREGA O DEGRAU, e isso não é enfeite: a mesma pessoa pode
    // ter gerado um PIX de R$ 38 no funil e receber R$ 19 cinco dias depois.
    // Com a referência do funil, a Woovi devolveria a cobrança antiga e a
    // trava de valor recusaria a venda com desconto — a pessoa clicaria no
    // e-mail e veria um erro. O sufixo dá a cada degrau a sua cobrança.
    //
    // O prefixo continua `serenata:` pra o webhook achar o quiz sem saber que
    // a escada existe (ele corta no primeiro dois-pontos).
    const referencia = `serenata:${quiz.id}:e${aberto.degrau}`;
    const nome = ((quiz.respostas ?? {}) as Record<string, string>).nome?.trim() || "quem você ama";
    const email = (quiz.email as string | null) ?? "";

    // ── O GATEWAY DA CONTA, E NAO A WOOVI CRAVADA ────────────────
    //
    // Mesma historia do `criar-pix-upsell`: ate 11/09/2026 este arquivo
    // chamava `woovi.criar` direto, e no dia em que a chave da Woovi parou de
    // resolver no DICT ele seguiu gerando cobranca impagavel.
    const gw = gatewayPix();

    // ── O CPF, QUANDO O GATEWAY PEDE (08/10) ─────────────────────
    //
    // Aqui morava um `if (gw.exigeCpf) return { erro: "gateway" }`, com a
    // ideia de que um link de e-mail não tem passo onde pedir documento. Só
    // que o PIX foi pro Asaas, que SEMPRE exige CPF, e a frase virou "esta
    // página nunca gera PIX": em produção nenhum pedido `serenata:<quiz>:e<n>`
    // nasceu no Asaas, e 43 pessoas abriram a oferta em 7 dias, leram "Esse
    // link não vale mais" e foram pro /criar pagar o preço cheio (quando
    // foram). Agora pede o CPF igual ao funil: primeira chamada sem ele volta
    // `cpf-necessario`, a tela mostra o campo, a segunda leva o número.
    //
    // De quebra: a cobrança só nasce depois de a pessoa digitar o CPF, e não
    // a cada abertura do e-mail (inclusive a de robô de e-mail que pré-abre
    // link).
    const conferido = cpfParaGateway(gw.exigeCpf, data.cpf);
    if (!conferido.ok) {
      return {
        ok: false,
        erro: conferido.erro,
        sessao,
        valorTexto: OFERTA[aberto.degrau as DegrauEscada].texto,
        titulo: (musica.titulo as string | null) ?? null,
        nome,
      };
    }

    let cobranca;
    try {
      cobranca = await gw.criar({
        referencia,
        valorCentavos,
        descricao: `Serenata · ${musica.titulo ?? "sua música"}`,
        nome: nome || null,
        email: email || null,
        cpf: conferido.cpf || null,
      });
    } catch (err) {
      const g = err instanceof ErroGateway ? err : null;
      console.error(`[pix-oferta] ${gw.nome} falhou:`, g?.message ?? err);
      return { ok: false, erro: "gateway", sessao };
    }

    const refFinal = cobranca.idExterno;
    const site = process.env.VITE_APP_URL?.startsWith("http")
      ? process.env.VITE_APP_URL
      : MARCA_ATIVA.url;

    const { error } = await db.from("pedidos").upsert(
      {
        // Prefixo do gateway que respondeu: e por ele que o webhook casa.
        payment_id: `${cobranca.gateway}:${refFinal}`,
        gateway: cobranca.gateway,
        status: "pendente",
        email: email || null,
        nome_pagador: nome || null,
        valor_centavos: valorCentavos,
        taxa_centavos: cobranca.taxaCentavos,
        quiz_response_id: quiz.id,
        musica_id: musica.id,
        pix_codigo: cobranca.copiaECola,
        pix_expira: cobranca.expiraEm,
        pix_url: `${site}/pix/${refFinal}`,
      },
      { onConflict: "payment_id" },
    );
    await marcarSeVeioDeEmail(db, `${cobranca.gateway}:${refFinal}`);
    if (error) console.error("[pix-oferta] pedido pendente não gravou:", error.message);

    return {
      ok: true,
      copiaECola: cobranca.copiaECola,
      valorCentavos,
      valorTexto: OFERTA[aberto.degrau as DegrauEscada].texto,
      referencia: refFinal,
      titulo: (musica.titulo as string | null) ?? null,
      nome,
      email,
    };
  });
