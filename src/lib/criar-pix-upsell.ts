import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { literalLike } from "@/lib/sql-like";
import { woovi } from "@/lib/woovi";
import { ErroGateway } from "@/lib/gateway";
import { OFERTAS, type Oferta } from "@/lib/creditos";

// O PIX DOS UPSELLS: música extra, três músicas e quadro.
//
// ── POR QUE ELE É OUTRO ARQUIVO, E NÃO O MESMO `criar-pix` ───────
//
// O do funil e este respondem a perguntas diferentes em quase tudo:
//
//                    funil                        upsell
//   quem é           sessão anônima do quiz       conta logada (Supabase Auth)
//   preço            braço do experimento         catálogo fixo (`OFERTAS`)
//   o que entrega    a música daquele quiz        crédito ou direito ao quadro
//   quantas vezes    uma                          quantas ela quiser
//
// Essa última linha é a que mais separa os dois. No funil a referência PODE
// ser o id do quiz, e isso é uma virtude: duplo-clique devolve a mesma
// cobrança. Aqui não pode — a pessoa tem direito de comprar dois créditos
// extras, e uma referência derivada do e-mail colidiria com a compra
// anterior, que já está COMPLETED. A `criar` da Woovi recusaria, e a segunda
// venda simplesmente não aconteceria.
//
// ── ENTÃO A IDEMPOTÊNCIA MUDA DE LUGAR ───────────────────────────
//
// A referência carrega um uuid novo por COMPRA (`up:<oferta>:<uuid>`), e o
// que protege contra duplo-clique é outra coisa: antes de criar, procura um
// pedido pendente DA MESMA oferta, DA MESMA pessoa, da última hora. Achou,
// devolve o PIX dele. É a mesma garantia, movida pro nosso lado.
//
// Uma hora não é chute: é o tempo que o código PIX da Woovi vale (`expiresIn`
// 3600 em `woovi.ts`). Reaproveitar um mais velho seria entregar um QR morto.
//
// ── E O PREÇO NUNCA VEM DO CLIENTE ───────────────────────────────
//
// Mesma regra do funil, e aqui é ainda mais direta: o valor sai de `OFERTAS`,
// pelo id. O navegador escolhe QUAL oferta, nunca QUANTO ela custa.

/** O domínio do site, pro link que vai no e-mail de PIX abandonado. */
function urlDoSite(): string {
  const u = process.env.VITE_APP_URL;
  return u?.startsWith("http") ? u : "https://www.serenatagift.com";
}

/**
 * A oferta, pelo id, vinda do catálogo e não do cliente.
 *
 * Recusa as ocultas: `tres` está escondida desde 25/08 por não vender, e uma
 * oferta escondida na tela mas comprável pela rota é exatamente o tipo de
 * porta que ninguém lembra que existe.
 */
function ofertaValida(id: string): Oferta | null {
  return OFERTAS.find((o) => o.id === id && !o.oculta) ?? null;
}

export type ResultadoPixUpsell =
  | {
      ok: true;
      copiaECola: string;
      valorCentavos: number;
      referencia: string;
      reaproveitado: boolean;
    }
  | { ok: false; erro: "sem-sessao" | "oferta-invalida" | "gateway" };

export const criarPixUpsell = createServerFn({ method: "POST" })
  // O TOKEN, não o e-mail. Server function é rota HTTP: aceitar o e-mail
  // deixaria qualquer um gerar cobrança (e crédito) no nome de outro. Mesma
  // regra de `meusCreditos`.
  .validator((data: { token: string; ofertaId: string }) => data)
  .handler(async ({ data }): Promise<ResultadoPixUpsell> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { ok: false, erro: "sem-sessao" };

    const oferta = ofertaValida(data.ofertaId);
    if (!oferta) return { ok: false, erro: "oferta-invalida" };

    const db = supabaseAdmin();
    const valorCentavos = Math.round(oferta.precoBrl * 100);

    // ── DUPLO-CLIQUE: reaproveita o PIX ainda vivo ───────────────
    const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
    const { data: vivo } = await db
      .from("pedidos")
      .select("payment_id, pix_codigo")
      .eq("gateway", "woovi")
      .eq("status", "pendente")
      .eq("valor_centavos", valorCentavos)
      .ilike("email", literalLike(email))
      .gte("created_at", umaHoraAtras)
      .like("payment_id", `woovi:up:${oferta.id}:%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vivo?.pix_codigo) {
      return {
        ok: true,
        copiaECola: vivo.pix_codigo as string,
        valorCentavos,
        referencia: (vivo.payment_id as string).slice("woovi:".length),
        reaproveitado: true,
      };
    }

    // `crypto.randomUUID` roda no servidor (Node 19+), e é o que dá à segunda
    // compra da MESMA oferta uma referência própria.
    const referencia = `up:${oferta.id}:${crypto.randomUUID()}`;

    let cobranca;
    try {
      cobranca = await woovi.criar({
        referencia,
        valorCentavos,
        descricao: `Serenata · ${oferta.id === "quadro" ? "Quadro para imprimir" : "Música extra"}`,
        nome: null,
        email,
      });
    } catch (err) {
      const g = err instanceof ErroGateway ? err : null;
      console.error("[pix-upsell] gateway falhou:", g?.message ?? err);
      return { ok: false, erro: "gateway" };
    }

    const { error } = await db.from("pedidos").upsert(
      {
        payment_id: `woovi:${referencia}`,
        gateway: "woovi",
        status: "pendente",
        email,
        valor_centavos: valorCentavos,
        taxa_centavos: cobranca.taxaCentavos,
        pix_codigo: cobranca.copiaECola,
        pix_expira: cobranca.expiraEm,
        pix_url: `${urlDoSite()}/pix/${referencia}`,
      },
      { onConflict: "payment_id" },
    );
    if (error) {
      // A cobrança JÁ EXISTE no gateway; sumir com o QR seria pior. Entrega e
      // grita no log — mesma decisão do `criar-pix` do funil.
      console.error("[pix-upsell] pedido pendente não gravou:", error.message);
    }

    return { ok: true, copiaECola: cobranca.copiaECola, valorCentavos, referencia, reaproveitado: false };
  });
