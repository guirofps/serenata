import { inngest } from "../client.js";
import { Resend } from "resend";

// VIGIA DO SALDO do kie.ai.
//
// Existe por causa de 08/08. O saldo zerou às 21:47 e o pipeline parou por
// TREZE HORAS sem ninguém notar: 38 músicas presas em "gerando", 7 delas já
// pagas, a mais antiga esperando 4h20 pela música que já tinha comprado.
//
// Nada falhou de forma visível, e é isso que torna essa falha pior que um
// erro: o job não estourava, não marcava `falhou`, não escrevia log. Só
// deixava de produzir. O painel mostrava "gerando", que é o mesmo que ele
// mostra quando está tudo certo.
//
// O cartão no painel (adicionado junto) resolve metade: mostra o número, mas
// depende de alguém abrir a tela. Este cron é a outra metade — ele procura o
// dono em vez de esperar.

// O AVISO É EM DIAS, NÃO EM MÚSICAS.
//
// Era um número fixo: avisar abaixo de 20 músicas restantes. Fazia sentido
// quando o funil gerava 8 por dia — 20 músicas eram dois dias e meio de folga.
//
// Em 13/08 o ritmo é 119 músicas/dia. As mesmas 20 músicas viraram QUATRO
// HORAS de operação, e o cron rodava de 6 em 6: o aviso podia chegar depois
// do pipeline já parado. Limiar fixo envelhece junto com o negócio, e esse já
// tinha envelhecido sem ninguém perceber.
//
// Agora o limiar acompanha o consumo real dos últimos dias. 1,5 dia é tempo
// de sobra pra recarregar sem correr, e o piso de 40 músicas protege o caso
// do dia fraco (senão, num domingo devagar, o alerta só sairia quase no fim).
const DIAS_DE_FOLGA = 1.5;
const PISO_MUSICAS = 40;
const CREDITO_POR_MUSICA = 12; // tabela pública do kie.ai (2 versões)
// O e-mail PESSOAL do dono, não o contato@. Alerta de operação tem que
// chegar em quem pode recarregar, e a caixa de suporte é onde ele se perderia
// no meio dos tickets — que foi mais ou menos o que aconteceu em 08/08.
const PARA = "guilhermerojasiqueira@gmail.com";

export const vigiarSaldo = inngest.createFunction(
  {
    id: "vigiar-saldo-kie",
    retries: 1,
    // De 2 em 2 horas. Era de 6 em 6, o que num dia de 119 músicas deixava
    // uma janela de silêncio maior que a folga de crédito inteira.
    triggers: [{ cron: "0 */2 * * *" }],
  },
  async ({ step }) => {
    const saldo = await step.run("ler-saldo", async () => {
      const chave = process.env.KIE_API_KEY;
      if (!chave) throw new Error("KIE_API_KEY ausente");
      const r = await fetch("https://api.kie.ai/api/v1/chat/credit", {
        headers: { Authorization: `Bearer ${chave}` },
      });
      if (!r.ok) throw new Error(`kie.ai ${r.status}`);
      const j = (await r.json()) as { data?: number };
      if (typeof j?.data !== "number") throw new Error("resposta sem saldo");
      return j.data;
    });

    const musicas = Math.floor(saldo / CREDITO_POR_MUSICA);

    // Quantas músicas o funil consumiu por dia na última semana. É o que
    // transforma "20 músicas restantes" em "quatro horas" ou "dois dias".
    const porDia = await step.run("ritmo-recente", async () => {
      const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return 0;
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { count } = await sb
        .from("musicas")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      return Math.round((count ?? 0) / 7);
    });

    const limite = porDia > 0 ? Math.max(PISO_MUSICAS, Math.ceil(porDia * DIAS_DE_FOLGA)) : PISO_MUSICAS;
    const diasRestantes = porDia > 0 ? musicas / porDia : null;
    if (musicas >= limite) {
      return { saldo, musicas, porDia, limite, avisou: false };
    }

    await step.run("avisar", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) throw new Error("RESEND_API_KEY ausente");
      const acabou = musicas === 0;
      await new Resend(chave).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: [PARA],
        // Assunto direto: este e-mail chega no meio de outros e precisa ser
        // lido no título, sem abrir.
        subject: acabou
          ? "PAROU: sem crédito no kie.ai, nenhuma música está sendo gerada"
          : `Crédito do kie.ai acabando: restam ${musicas} músicas${diasRestantes !== null ? ` (~${diasRestantes.toFixed(1)} dia${diasRestantes < 2 ? "" : "s"})` : ""}`,
        html: `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2a1518;">
          <p style="font-size:18px;font-weight:600;margin:0 0 12px;">
            ${acabou ? "O pipeline está parado." : "O crédito está acabando."}
          </p>
          <p style="margin:0 0 12px;">
            Saldo no kie.ai: <strong>${saldo} créditos</strong> — dá para
            <strong>${musicas} música${musicas === 1 ? "" : "s"}</strong>
            (${CREDITO_POR_MUSICA} créditos cada).
          </p>
          ${
            diasRestantes !== null
              ? `<p style="margin:0 0 12px;">
                   No ritmo dos últimos 7 dias (<strong>${porDia} músicas/dia</strong>),
                   isso é cerca de <strong>${diasRestantes.toFixed(1)} dia${diasRestantes < 2 ? "" : "s"}</strong>.
                 </p>`
              : ""
          }
          ${
            acabou
              ? `<p style="margin:0 0 12px;color:#7d2b3a;font-weight:600;">
                   Sem saldo, o job NÃO falha: ele deixa a música em "gerando"
                   para sempre, e quem pagou fica esperando sem aviso nenhum.
                   Foi o que aconteceu em 08/08, por 13 horas.
                 </p>`
              : ""
          }
          <p style="margin:0 0 12px;">
            Recarregue em <a href="https://kie.ai">kie.ai</a>. Depois,
            para destravar o que ficou parado:
          </p>
          <pre style="background:#f2e9dc;padding:12px;border-radius:8px;font-size:13px;overflow:auto;">node scratch/refazer-travadas.mjs todas</pre>
        </div>`,
      });
    });

    return { saldo, musicas, porDia, limite, avisou: true };
  },
);
