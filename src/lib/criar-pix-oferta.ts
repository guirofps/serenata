import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { woovi } from "@/lib/woovi";
import { ErroGateway } from "@/lib/gateway";
import { conferirOferta } from "@/lib/oferta-assinada";
import { OFERTA, type DegrauEscada } from "../../emails/escada";

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
  | { ok: false; erro: "token-invalido" | "sem-musica" | "gateway" };

export const criarPixOferta = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<ResultadoPixOferta> => {
    const aberto = conferirOferta(data.token);
    if (!aberto) return { ok: false, erro: "token-invalido" };

    const valorCentavos = centavosDoDegrau(aberto.degrau as DegrauEscada);
    if (!valorCentavos) return { ok: false, erro: "token-invalido" };

    const db = supabaseAdmin();
    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, email, respostas")
      .eq("session_id", aberto.sessao)
      .maybeSingle();
    if (!quiz?.id) return { ok: false, erro: "sem-musica" };

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
    if (!musica?.id || musica.status !== "pronta") return { ok: false, erro: "sem-musica" };

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

    let cobranca;
    try {
      cobranca = await woovi.criar({
        referencia,
        valorCentavos,
        descricao: `Serenata · ${musica.titulo ?? "sua música"}`,
        nome: nome || null,
        email: email || null,
      });
    } catch (err) {
      const g = err instanceof ErroGateway ? err : null;
      console.error("[pix-oferta] gateway falhou:", g?.message ?? err);
      return { ok: false, erro: "gateway" };
    }

    const refFinal = cobranca.idExterno;
    const site = process.env.VITE_APP_URL?.startsWith("http")
      ? process.env.VITE_APP_URL
      : "https://www.serenatagift.com";

    const { error } = await db.from("pedidos").upsert(
      {
        payment_id: `woovi:${refFinal}`,
        gateway: "woovi",
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
