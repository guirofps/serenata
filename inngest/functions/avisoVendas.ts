import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { avisarWhats } from "../../src/lib/avisar-donos.js";
import { balanco, meiaNoiteBr, textoDoAviso } from "../../src/lib/resumo-vendas.js";

// O PULSO DE VENDAS NO WHATSAPP: 12h e 22h (27/09/2026, pedido do dono).
//
// ── POR QUE UTC NO CRON, E NÃO "12" ──────────────────────────────
//
// O Inngest agenda em UTC e a Vercel roda em UTC. Escrever `0 12 * * *` aqui
// mandaria o aviso às 9h da manhã no Brasil — parece certo no código e está
// errado no celular, que é o defeito mais difícil de ver porque nada falha.
//
// Brasil é UTC-3 fixo (o horário de verão acabou em 2019), então:
//   12h BR = 15:00 UTC
//   22h BR = 01:00 UTC do dia seguinte
//
// ── SÓ WHATSAPP ──────────────────────────────────────────────────
//
// O resumo diário por e-mail já existe (`resumoDiario`). Somar dois e-mails
// por dia em cima dele encheria a caixa de rotina, e caixa cheia de rotina é
// exatamente como o aviso que IMPORTA passa despercebido.

export const avisoVendas = inngest.createFunction(
  {
    id: "aviso-vendas-whats",
    retries: 1,
    triggers: [{ cron: "0 15 * * *" }, { cron: "0 1 * * *" }],
  },
  async ({ step }) => {
    const texto = await step.run("contar", async () => {
      const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Supabase env ausente");
      const sb = createClient(url, key, { auth: { persistSession: false } });

      const agora = Date.now();
      // Desde a meia-noite de ONTEM: é o mínimo que cobre a comparação com
      // "ontem a esta hora".
      const desde = new Date(meiaNoiteBr(agora) - 86400000).toISOString();

      const { data, error } = await sb
        .from("pedidos")
        .select("paid_at, valor_centavos")
        .eq("status", "pago")
        .gt("valor_centavos", 0)
        .not("gateway", "in", "(credito,manual)")
        .or("dinheiro_entrou.is.null,dinheiro_entrou.eq.true")
        .gte("paid_at", desde)
        .limit(2000);
      if (error) throw new Error(`pedidos: ${error.message}`);

      const vendas = (data ?? []).map((p) => ({
        pago_em: p.paid_at as string,
        valor_centavos: p.valor_centavos as number | null,
      }));
      return textoDoAviso(balanco(vendas, agora), agora);
    });

    await step.run("mandar", async () => {
      await avisarWhats(texto);
      return { texto };
    });

    return { ok: true };
  },
);
