import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { todasAsPaginas } from "../lib/paginar.js";
import { jaTravado, soltarTrava, travarEnvio } from "../lib/trava-envio.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { enviarPelaCaixaContato } from "../../api/lib/entrega-outlook.js";
import {
  LIGADO, MAX_H, MAX_POR_RODADA, MIN_H,
  assuntoAcesso, bracoAcesso, semSinalDeAcesso, textoAcesso,
} from "../../src/lib/acesso-lembrete.js";

// "VOCÊ AINDA NÃO OUVIU A SUA MÚSICA" (teste `acesso_lembrete`, 10/11). A regra, os
// braços e o porquê moram em `src/lib/acesso-lembrete.ts`.
//
// De hora em hora, só Serenata e só português. Pega quem pagou há 24 a 72h e não
// deu NENHUM sinal de chegar no que comprou (editor, página do presente, clique em
// e-mail, presente montado). Os dois braços gravam a trava; só o B recebe.

const SITE = MARCA_ATIVA.url;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

type Candidato = {
  musicaId: string; quizId: string; email: string; nome: string; titulo: string | null; linkEditor: string; braco: "A" | "B";
};

export const lembrarAcesso = inngest.createFunction(
  {
    id: "lembrar-acesso",
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ cron: "25 * * * *" }], // de hora em hora, fora do minuto cheio dos outros
  },
  async ({ step }) => {
    if (MARCA_ATIVA.chave !== "serenata") return { pulou: "marca" };

    const candidatos = await step.run("achar-quem-nao-chegou", async () => {
      const sb = db();
      const agora = Date.now();
      const desde = new Date(agora - (MAX_H + 2) * 3600000).toISOString();

      const pedidos = await todasAsPaginas<{
        email: string | null; musica_id: string | null; quiz_response_id: string | null; paid_at: string; payment_id: string;
      }>((de, ate) =>
        sb.from("pedidos")
          .select("email, musica_id, quiz_response_id, paid_at, payment_id")
          .eq("status", "pago")
          .gte("paid_at", new Date(agora - MAX_H * 3600000).toISOString())
          .lte("paid_at", new Date(agora - MIN_H * 3600000).toISOString())
          .order("paid_at", { ascending: true })
          .order("id", { ascending: true })
          .range(de, ate),
      );
      // Só a compra da música (o extra, o quadro e o vídeo nascem dentro do editor).
      const porMusica = new Map<string, (typeof pedidos)[number]>();
      for (const p of pedidos) {
        if (!p.email || !p.musica_id || !p.quiz_response_id || p.payment_id.includes(":up:")) continue;
        if (!porMusica.has(p.musica_id)) porMusica.set(p.musica_id, p);
      }
      if (!porMusica.size) return [] as Candidato[];

      // Quem já entrou no teste (os dois braços gravam). Erro = para a rodada.
      const ja = new Set(
        (await todasAsPaginas<{ event_data: { musica_id?: string } | null }>((de, ate) =>
          sb.from("funnel_events").select("event_data").eq("event_name", "acesso_lembrete")
            .gte("created_at", new Date(agora - (MAX_H + 48) * 3600000).toISOString())
            .order("created_at", { ascending: true }).order("id", { ascending: true }).range(de, ate),
        )).map((e) => e.event_data?.musica_id).filter(Boolean) as string[],
      );

      // Os acessos da janela, numa leitura só: editor e página do presente.
      const acessos = await todasAsPaginas<{ event_data: { path?: string } | null; created_at: string }>((de, ate) =>
        sb.from("funnel_events").select("event_data, created_at")
          .in("event_name", ["editor_aberto", "presente_aberto"])
          .gte("created_at", desde)
          .order("created_at", { ascending: true }).order("id", { ascending: true }).range(de, ate),
      );
      const ultimoAcesso = new Map<string, number>(); // token (editor ou público) -> último acesso
      for (const a of acessos) {
        const path = a.event_data?.path ?? "";
        const tk = path.startsWith("/editar/") ? path.slice(8) : path.startsWith("/p/") ? path.slice(3) : "";
        const limpo = tk.split(/[?#/]/)[0];
        if (limpo) ultimoAcesso.set(limpo, Math.max(ultimoAcesso.get(limpo) ?? 0, Date.parse(a.created_at)));
      }

      const out: Candidato[] = [];
      const fila = [...porMusica.values()].filter((p) => !ja.has(p.musica_id as string));
      for (let i = 0; i < fila.length && out.length < MAX_POR_RODADA; i += 100) {
        const lote = fila.slice(i, i + 100);
        const { data: linhas, error } = await sb.from("musicas")
          .select("id, token, token_edicao, titulo, status, locale, personalizada_em, foto_path, dedicatoria, galeria")
          .in("id", lote.map((p) => p.musica_id as string));
        if (error) throw new Error(error.message);
        const porId = new Map((linhas ?? []).map((m) => [m.id as string, m]));
        for (const p of lote) {
          if (out.length >= MAX_POR_RODADA) break;
          const m = porId.get(p.musica_id as string);
          if (!m || m.status !== "pronta" || !m.token_edicao) continue;
          const { data: q } = await sb.from("quiz_responses").select("respostas, locale").eq("id", p.quiz_response_id as string).maybeSingle();
          if (((q?.locale as string | null) ?? m.locale ?? "pt") !== "pt") continue;
          const pago = Date.parse(p.paid_at);
          const abriu = (tk: string | null) => Boolean(tk && (ultimoAcesso.get(tk) ?? 0) >= pago - 60000);

          // Clique em qualquer e-mail mandado a ela depois do pagamento.
          const { data: envios } = await sb.from("emails_enviados").select("email_id")
            .eq("para", p.email as string).gte("created_at", new Date(pago - 60000).toISOString()).limit(50);
          const ids = (envios ?? []).map((e) => e.email_id).filter((x): x is string => Boolean(x) && !String(x).startsWith("hostinger"));
          let clicou = false;
          if (ids.length) {
            const { data: cliques, error: eCl } = await sb.from("funnel_events").select("id")
              .eq("event_name", "email_clicked").gte("created_at", new Date(pago - 60000).toISOString())
              .in("event_data->>email_id", ids).limit(1);
            if (eCl) continue; // na dúvida, não manda
            clicou = (cliques ?? []).length > 0;
          }

          const montou = Boolean(m.personalizada_em) || Boolean(m.foto_path) || Boolean(m.dedicatoria) ||
            ((m.galeria as string[] | null)?.length ?? 0) > 0;
          if (!semSinalDeAcesso({ abriuEditor: abriu(m.token_edicao), abriuPagina: abriu(m.token), clicouEmail: clicou, montou })) continue;

          out.push({
            musicaId: m.id as string,
            quizId: p.quiz_response_id as string,
            email: (p.email as string).trim(),
            nome: (((q?.respostas ?? {}) as Record<string, string>).nome ?? "").trim() || "quem você ama",
            titulo: (m.titulo as string | null) ?? null,
            linkEditor: `${SITE}/editar/${m.token_edicao}`,
            braco: bracoAcesso(p.quiz_response_id),
          });
        }
      }
      return out;
    });

    let enviados = 0, controle = 0;
    for (const c of candidatos) {
      const r = await step.run(`acesso-${c.musicaId}`, async () => {
        const sb = db();
        const desde = new Date(Date.now() - (MAX_H + 48) * 3600000).toISOString();
        if (await jaTravado(sb, "acesso_lembrete", { musica_id: c.musicaId }, desde)) return "ja";
        const ligado = LIGADO && String(process.env.ACESSO_LEMBRETE_OFF ?? "").trim() !== "1";
        const braco = ligado ? c.braco : "A";
        if (braco === "B" && (await estaBloqueado(sb, c.email))) return "bloqueado";
        // A trava antes do envio, nos dois braços: é ela que a leitura usa.
        const trava = await travarEnvio(sb, {
          event_name: "acesso_lembrete",
          event_data: { musica_id: c.musicaId, quiz_response_id: c.quizId, braco, email: c.email },
        });
        if (!trava) return "sem-trava";
        if (braco === "A") return "A";
        const ok = await enviarPelaCaixaContato({ to: c.email, subject: assuntoAcesso(c.nome), text: textoAcesso(c) });
        if (!ok) {
          await soltarTrava(sb, trava);
          return "falhou";
        }
        await registrarEnvio(sb, { emailId: `hostinger-acesso:${c.quizId}`, template: "acesso_lembrete", para: c.email, quizResponseId: c.quizId });
        return "B";
      });
      if (r === "B") enviados++;
      if (r === "A") controle++;
    }
    return { candidatos: candidatos.length, enviados, controle };
  },
);
