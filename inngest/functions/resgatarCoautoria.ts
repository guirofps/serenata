import { inngest } from "../client.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bloqueados } from "../lib/emails-mortos.js";
import { jaComprou } from "../lib/ja-comprou.js";
import { pareceTypo } from "../../src/lib/email-typo.js";
import { filtroCursor, lerJanela } from "../../src/lib/ler-janela.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { escreverLetraSozinha } from "../../src/lib/letra-claude.js";
import { registrarCustoLetra } from "../../src/lib/custos.js";
import {
  bracoResgate,
  entraNoResgate,
  INATIVO_MIN,
  JANELA_H,
  MAX_POR_RODADA,
  PASSO_CONTATO,
} from "../../src/lib/resgate-coautoria.js";

// O RESGATE DE QUEM LARGOU A COAUTORIA NO MEIO. Teste A × C; a regra, o
// porquê e o sorteio estão em `src/lib/resgate-coautoria.ts`.
//
// O C só cria a música (`aguardando`) e dispara a geração. O e-mail é o
// "letra pronta" de sempre, que o `mandarLetra` manda sozinho pra todo quiz
// das últimas 48h com letra e sem compra: nenhuma copy nova, e o lead do C
// cai exatamente no caminho de quem finalizou a letra na tela.
//
// SÓ SERENATA, SÓ PORTUGUÊS. Desliga sem deploy com `RESGATE_COAUTORIA_OFF=1`.

function db(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

type Lead = { id: string; created_at: string; session_id: string | null; email: string | null; locale: string | null; furthest_step: number | null };

export const resgatarCoautoria = inngest.createFunction(
  {
    id: "resgatar-coautoria",
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ cron: "7,22,37,52 * * * *" }],
  },
  async ({ step }) => {
    if (process.env.RESGATE_COAUTORIA_OFF === "1" || MARCA_ATIVA.chave !== "serenata") return { pulou: "desligado" };

    const escolhidos = await step.run("achar-quem-largou", async () => {
      const sb = db();
      const agora = Date.now();
      const leads = await lerJanela<Lead>(
        ({ desde, ate, cursor, limite }) => {
          const base = sb
            .from("quiz_responses")
            .select("id, created_at, session_id, email, locale, furthest_step")
            .not("email", "is", null)
            .gte("furthest_step", PASSO_CONTATO)
            .gte("created_at", desde)
            .lt("created_at", ate);
          return (cursor ? base.or(filtroCursor(cursor)) : base).order("created_at").order("id").limit(limite) as never;
        },
        new Date(agora - JANELA_H * 3600000),
        new Date(agora - INATIVO_MIN * 60000),
      );
      const candidatos = leads.filter(
        (l) => l.email && !pareceTypo(l.email) && (l.locale ?? "pt") === "pt",
      );

      // Em lote: quem já tem música e quem já passou pelo teste. Erro LANÇA:
      // lista pela metade resgataria quem já tem música (e o Suno cobra).
      const comMusica = new Set<string>();
      const jaResgatado = new Set<string>();
      for (let i = 0; i < candidatos.length; i += 100) {
        const ids = candidatos.slice(i, i + 100).map((l) => l.id);
        const [m, r] = await Promise.all([
          sb.from("musicas").select("quiz_response_id").in("quiz_response_id", ids),
          sb.from("coautoria_resgates").select("quiz_response_id").in("quiz_response_id", ids),
        ]);
        if (m.error || r.error) throw new Error(`[resgate] triagem falhou: ${m.error?.message ?? r.error?.message}`);
        for (const x of m.data ?? []) comMusica.add(String(x.quiz_response_id));
        for (const x of r.data ?? []) jaResgatado.add(String(x.quiz_response_id));
      }
      const restantes = candidatos.filter((l) => !comMusica.has(l.id) && !jaResgatado.has(l.id));
      const bloq = await bloqueados(sb, restantes.map((l) => l.email as string), { incluirExcluidos: true });

      // Mais novo primeiro: lead fresco vale mais que lead de ontem.
      restantes.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const out: Array<{ id: string; braco: "A" | "C" }> = [];
      for (const l of restantes) {
        if (out.length >= MAX_POR_RODADA) break;
        const email = (l.email as string).trim();
        if (bloq.has(email.toLowerCase())) continue;

        // Ainda mexendo? O último gesto da sessão decide. Sem sessão, conta a criação.
        let ultimo: number | null = null;
        if (l.session_id) {
          const { data: ev, error } = await sb
            .from("funnel_events")
            .select("created_at")
            .eq("session_id", l.session_id)
            .gte("created_at", new Date(agora - (JANELA_H + 2) * 3600000).toISOString())
            .order("created_at", { ascending: false })
            .limit(1);
          if (error) continue; // na dúvida, a pessoa pode estar na tela
          ultimo = ev?.[0] ? Date.parse(ev[0].created_at as string) : null;
        }
        const entra = entraNoResgate(
          {
            furthestStep: l.furthest_step,
            email,
            locale: l.locale,
            criadoEm: Date.parse(l.created_at),
            ultimoEventoEm: ultimo,
            temMusica: false,
            jaResgatado: false,
          },
          agora,
        );
        if (!entra) continue;
        if (await jaComprou(sb, l.id, email)) continue;

        // Fez OUTRA música com o mesmo e-mail nos últimos 3 dias: não largou, recomeçou.
        const { data: outros, error: eo } = await sb
          .from("quiz_responses")
          .select("id")
          .eq("email", l.email as string)
          .neq("id", l.id)
          .gte("created_at", new Date(agora - 3 * 86400000).toISOString())
          .limit(20);
        if (eo) continue;
        if (outros?.length) {
          const { data: mm } = await sb.from("musicas").select("id").in("quiz_response_id", outros.map((o) => o.id)).limit(1);
          if (mm?.length) continue;
        }

        // A TRAVA vem ANTES de gastar, nos dois braços: o A também precisa de
        // linha, senão a leitura não tem contra quem comparar.
        const braco = bracoResgate(l.id);
        const { error: ei } = await sb.from("coautoria_resgates").insert({ quiz_response_id: l.id, braco });
        if (ei) continue; // conflito de chave = outra rodada já pegou
        out.push({ id: l.id, braco });
      }
      return out;
    });

    let gravadas = 0;
    for (const e of escolhidos.filter((x) => x.braco === "C")) {
      const musicaId = await step.run(`letra-${e.id}`, async () => {
        const sb = db();

        // JÁ EXISTE MÚSICA DESTE QUIZ? (29/10) O passo pode ser repetido pelo
        // Inngest DEPOIS do insert (a função morreu antes de devolver o id), e
        // a repetição escrevia outra letra e inseria OUTRA música: duas
        // gravações pagas no Suno pro mesmo lead. E a pessoa pode ter voltado e
        // finalizado a letra DELA entre a fila e este passo. Nos dois casos não
        // insere. Se a que existe é a nossa (o `musica_id` do resgate aponta
        // pra ela), devolve o id e o `gerarMusica` (singleton por música)
        // cuida do resto; se não, sai calado. Consulta que falha também não
        // insere: duplicar custa Suno, e música `aguardando` parada o gerador
        // reserva pega.
        const [{ data: existentes, error: eExiste }, { data: resgate }] = await Promise.all([
          sb.from("musicas").select("id, status").eq("quiz_response_id", e.id).limit(5),
          sb.from("coautoria_resgates").select("musica_id").eq("quiz_response_id", e.id).maybeSingle(),
        ]);
        if (eExiste) {
          console.error("[resgate] não deu pra conferir música existente, sem inserir:", e.id, eExiste.message);
          return null;
        }
        if (existentes?.length) {
          const nossa = existentes.find((x) => x.id === resgate?.musica_id);
          return nossa && nossa.status === "aguardando" ? (nossa.id as string) : null;
        }

        const { data: q } = await sb.from("quiz_responses").select("respostas").eq("id", e.id).maybeSingle();
        try {
          const respostas = (q?.respostas ?? {}) as Record<string, unknown>;
          const l = await escreverLetraSozinha(respostas, "pt");
          const { data: m, error } = await sb
            .from("musicas")
            .insert({
              quiz_response_id: e.id,
              token: crypto.randomUUID().replace(/-/g, "").slice(0, 22),
              status: "aguardando",
              titulo: l.titulo,
              letra: l.letra,
              estilo_suno: l.estilo_suno,
              verso_destaque: l.verso_destaque,
              genero: String(respostas.estilo ?? ""),
              locale: "pt",
            })
            .select("id")
            .single();
          if (error || !m) throw new Error(error?.message ?? "insert sem linha");
          await sb.from("coautoria_resgates").update({ musica_id: m.id }).eq("quiz_response_id", e.id);
          for (const u of l.usos) await registrarCustoLetra({ quizResponseId: e.id, musicaId: m.id, modelo: u.modelo, uso: u.uso });
          return m.id as string;
        } catch (err) {
          const msg = (err as Error).message.slice(0, 300);
          console.error("[resgate] letra falhou:", e.id, msg);
          await sb.from("coautoria_resgates").update({ erro: msg }).eq("quiz_response_id", e.id);
          return null;
        }
      });
      if (!musicaId) continue;
      await step.sendEvent(`gerar-${e.id}`, { name: "musica/gerar", data: { musicaId } });
      gravadas++;
    }
    return { entraram: escolhidos.length, c: escolhidos.filter((x) => x.braco === "C").length, gravadas };
  },
);
