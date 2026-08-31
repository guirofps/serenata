import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// O EXPERIMENTO QUE DERRUBA A VENDA, DESLIGADO SEM NINGUÉM OLHANDO.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// Em 31/08 a guarda do `zap_previa` vivia num laço `node` rodando na máquina
// do dono. O PC travou, ele reiniciou, e a guarda morreu junto — com o
// experimento seguindo vivo em produção a 50%, sem ninguém medindo.
//
// Guarda de produção não pode depender de um processo no laptop de alguém.
//
// Antes disso, em 10/08, desligar um experimento pelo lugar errado publicou o
// braço ERRADO pra 100% do tráfego; e o incidente do `bump_quadro` custou uns
// 50 minutos de venda porque a queda só foi vista por acaso. Os dois pedem a
// mesma coisa: alguém contando sozinho, o tempo todo.
//
// ── O QUE ELE VIGIA, E O QUE ELE IGNORA ──────────────────────────
//
// Uma conta só: `checkout_click / oferta_vista` por braço. É a régua que já
// decidiu preço nesta operação, e é a única que fala de dinheiro.
//
// Ele NÃO julga se o experimento "deu certo" — isso é leitura do dono, com o
// contexto todo. Ele só responde a pergunta binária que ninguém quer descobrir
// tarde: este braço está fazendo a gente vender menos?
//
// ── AS TRAVAS QUE IMPEDEM ELE DE FAZER BESTEIRA ──────────────────
//
// 1. `ativo:false`, NUNCA peso. Só o `ativo` vence o sorteio já gravado no
//    navegador de quem foi sorteado; mexer no peso deixaria a pessoa presa no
//    braço ruim até trocar de aparelho.
// 2. Nunca desliga o CONTROLE. Se o braço perdedor é o controle, o desfecho
//    certo é o dono promover o vencedor, não a máquina apagar a referência.
// 3. Amostra mínima de verdade nos dois braços. Sem isso, "0 de 3" numa
//    madrugada calma desligaria um experimento saudável.
// 4. Ele desliga E avisa, na mesma passada. Desligar em silêncio é como não
//    ter desligado: o dono precisa saber por que o funil mudou sozinho.

const MIN_POR_BRACO = 120; // sessões que viram a oferta, por braço
const Z_CORTE = -2.5; // o braço testado convertendo pior que o controle

type Ev = { session_id: string; event_name: string; event_data: Record<string, unknown> | null };

/** Erro padrão da diferença de duas proporções. `null` quando é cedo demais. */
export function zDiferenca(a: number, na: number, b: number, nb: number): number | null {
  if (na < MIN_POR_BRACO || nb < MIN_POR_BRACO) return null;
  const p = (a + b) / (na + nb);
  const se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
  return se ? (b / nb - a / na) / se : null;
}

async function avisar(assunto: string, html: string) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return;
  await new Resend(chave).emails.send({
    from: "Serenata <contato@serenatagift.com>",
    to: ["guilhermerojasiqueira@gmail.com"],
    subject: assunto,
    html,
  });
}

export const vigiaExperimento = inngest.createFunction(
  {
    id: "vigia-experimento",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "25 * * * *" }], // de hora em hora, fora do minuto cheio
  },
  async ({ step }) => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { pulado: "sem credenciais" };
    const db = createClient(url, key, { auth: { persistSession: false } });

    const ligados = await step.run("experimentos-ligados", async () => {
      const { data } = await db.from("experimentos").select("id, variantes").eq("ativo", true);
      return (data ?? []) as Array<{ id: string; variantes: Array<{ nome?: string }> }>;
    });
    if (!ligados.length) return { vigiados: 0 };

    // ── A JANELA ────────────────────────────────────────────────
    //
    // 24h. Curta o bastante pra pegar um braço ruim no mesmo dia, longa o
    // bastante pra juntar amostra num funil de ~160 leads/dia. E ela é móvel:
    // um experimento não fica preso ao passado dele.
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const eventos = await step.run("ler-eventos", async () => {
      const linhas: Ev[] = [];
      // PostgREST corta em 1000 linhas e `.limit()` não levanta o teto:
      // paginar é obrigatório, não zelo.
      for (let de = 0; de < 40000; de += 1000) {
        const { data, error } = await db
          .from("funnel_events")
          .select("session_id, event_name, event_data")
          .in("event_name", ["oferta_vista", "checkout_click"])
          .gte("created_at", desde)
          .order("created_at")
          .range(de, de + 999);
        if (error) throw new Error(error.message);
        linhas.push(...((data ?? []) as Ev[]));
        if ((data ?? []).length < 1000) break;
      }
      return linhas;
    });

    const relatos: string[] = [];
    for (const exp of ligados) {
      // O controle é o PRIMEIRO da lista, que é como o resto do projeto trata.
      const controle = exp.variantes?.[0]?.nome;
      if (!controle) continue;

      // Braço de cada sessão, do carimbo que viaja em `attribution.exp`.
      const braco = new Map<string, string>();
      for (const e of eventos) {
        const att = e.event_data?.attribution as { exp?: Record<string, string> } | undefined;
        const v = att?.exp?.[exp.id];
        if (typeof v === "string" && v) braco.set(e.session_id, v);
      }

      const viu: Record<string, Set<string>> = {};
      const clicou: Record<string, Set<string>> = {};
      for (const e of eventos) {
        const b = braco.get(e.session_id);
        if (!b) continue;
        viu[b] ??= new Set();
        clicou[b] ??= new Set();
        if (e.event_name === "oferta_vista") viu[b].add(e.session_id);
        if (e.event_name === "checkout_click") clicou[b].add(e.session_id);
      }
      // O numerador mora DENTRO do denominador: quem clicou sem ter registrado
      // `oferta_vista` na janela faria a razão passar de 100%.
      const n = (b: string) => viu[b]?.size ?? 0;
      const k = (b: string) => [...(clicou[b] ?? [])].filter((s) => viu[b]?.has(s)).length;

      let desligou = false;
      for (const v of exp.variantes ?? []) {
        const nome = v.nome;
        if (!nome || nome === controle) continue; // trava 2: controle é intocável
        const zz = zDiferenca(k(controle), n(controle), k(nome), n(nome));
        if (zz === null) continue; // trava 3: amostra insuficiente
        relatos.push(
          `${exp.id}/${nome}: ${k(nome)}/${n(nome)} vs ${controle} ${k(controle)}/${n(controle)} (z=${zz.toFixed(2)})`,
        );
        if (zz >= Z_CORTE || desligou) continue;
        desligou = true;

        // trava 1: `ativo`, nunca peso.
        await step.run(`desligar-${exp.id}`, async () => {
          await db.from("experimentos").update({ ativo: false }).eq("id", exp.id);
        });
        await step.run(`avisar-${exp.id}`, async () => {
          const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + "%" : "--");
          await avisar(
            `EXPERIMENTO DESLIGADO: ${exp.id} (braco ${nome} vendia menos)`,
            `<p>O braço <b>${nome}</b> do experimento <b>${exp.id}</b> estava convertendo pior que o ` +
              `controle, e a vigia desligou o experimento pelo <code>ativo</code>.</p>` +
              `<table cellpadding="6" border="1" style="border-collapse:collapse">` +
              `<tr><th>braço</th><th>clicou em comprar</th><th>viu a oferta</th><th>taxa</th></tr>` +
              `<tr><td>${controle} (controle)</td><td>${k(controle)}</td><td>${n(controle)}</td>` +
              `<td>${pct(k(controle), n(controle))}</td></tr>` +
              `<tr><td>${nome}</td><td>${k(nome)}</td><td>${n(nome)}</td>` +
              `<td>${pct(k(nome), n(nome))}</td></tr>` +
              `</table>` +
              `<p>z = ${zz.toFixed(2)} na janela de 24 horas. O corte é ${Z_CORTE}.</p>` +
              `<p>Quem já tinha o braço sorteado no navegador volta pro controle sozinho, porque ` +
              `sem experimento ativo o HTML não recebe carimbo.</p>`,
          );
        });
      }
    }

    return { vigiados: ligados.length, leituras: relatos };
  },
);
