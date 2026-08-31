import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";

// A TAXA QUE FALTA NO PEDIDO.
//
// ── O QUE ISTO CONSERTA ──────────────────────────────────────────
//
// Achado conferindo a PRIMEIRA venda real de cartão (31/08, 18:03): os três
// pedidos do Asaas estavam com `taxa_centavos` null, contra 13/13 gravadas na
// Woovi. Com a taxa em branco, o painel lê a venda de cartão como se o
// gateway fosse de graça — e o lucro do dia sai inflado justamente na forma
// de pagamento MAIS cara que a gente tem.
//
// ── POR QUE NÃO DÁ PRA GRAVAR SÓ NA HORA DA VENDA ────────────────
//
// A resposta da cobrança não traz `netValue`: a cobrança nasce naquele
// instante e o líquido ainda não foi calculado. O caminho da venda já faz uma
// segunda pergunta pra pegar a taxa, mas essa pergunta pode falhar — e falhar
// nela NÃO pode custar a entrega, então ela é engolida com log.
//
// É exatamente esse buraco que esta função fecha: o que a venda não
// conseguiu ler, ela lê depois, de hora em hora, até conseguir.
//
// ── SÓ PREENCHE O QUE ESTÁ VAZIO ─────────────────────────────────
//
// Nunca reescreve taxa existente. O número é contábil e a fonte é o gateway;
// um job que corrige o que já está certo é um job que pode estragar o que já
// está certo.

const ASAAS_PROD = "https://api.asaas.com/v3";
const ASAAS_SANDBOX = "https://api-sandbox.asaas.com/v3";

export const taxasFaltando = inngest.createFunction(
  {
    id: "taxas-faltando",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    // De hora em hora, fora do minuto cheio: mesmo hábito dos outros vigias,
    // pra não empilhar todo mundo no mesmo segundo do provedor.
    triggers: [{ cron: "35 * * * *" }],
  },
  async ({ step }) => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const chave = process.env.ASAAS_API_KEY;
    if (!url || !key || !chave) return { pulado: "sem credenciais" };
    const db = createClient(url, key, { auth: { persistSession: false } });
    const base = chave.startsWith("$aact_prod_") ? ASAAS_PROD : ASAAS_SANDBOX;

    const pendentes = await step.run("listar", async () => {
      const { data } = await db
        .from("pedidos")
        .select("id, payment_id, valor_centavos")
        .eq("gateway", "asaas")
        .eq("status", "pago")
        .is("taxa_centavos", null)
        // Teto pequeno de propósito: se um dia houver muito, é sinal de que a
        // venda parou de gravar e o conserto é lá, não aqui.
        .limit(50);
      return data ?? [];
    });

    let gravadas = 0;
    for (const p of pendentes) {
      const id = String(p.payment_id ?? "").replace(/^asaas:/, "");
      if (!id) continue;
      const ok = await step.run(`taxa-${id}`, async () => {
        const r = await fetch(`${base}/payments/${id}`, { headers: { access_token: chave } });
        if (!r.ok) return false;
        const j = (await r.json()) as { value?: unknown; netValue?: unknown };
        const valor = Number(j.value);
        const liquido = Number(j.netValue);
        // `netValue` só existe depois que eles calculam. Sem ele, não inventa:
        // fica null e a próxima rodada tenta de novo.
        if (!Number.isFinite(valor) || !Number.isFinite(liquido)) return false;
        const taxa = Math.round((valor - liquido) * 100);
        if (taxa < 0) return false;
        await db.from("pedidos").update({ taxa_centavos: taxa }).eq("id", p.id);
        return true;
      });
      if (ok) gravadas++;
    }

    return { encontrados: pendentes.length, gravadas };
  },
);
