import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { cabecalhosDescadastro, linkDescadastroUmClique } from "../lib/descadastro.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { assuntoIndicacao, emailIndicacao, textoIndicacao } from "../../emails/indicacao.js";
import { gerarCodigo, linkDoConvite } from "../../src/lib/indicacao.js";
import { loteDaVez, montarFila } from "../../src/lib/fila-convite.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// O CONVITE DE INDICAÇÃO, disparo único pra quem já comprou (27/09/2026).
//
// ── É UM DISPARO ÚNICO VESTIDO DE CRON ───────────────────────────
//
// Não existe "mandar pra base toda" num clique aqui, e não é limitação: é o
// desenho. O cron roda de 30 em 30 minutos, manda `LOTE` por rodada e PARA
// SOZINHO quando não sobra ninguém — a fila é construída do banco a cada
// rodada, não guardada em lugar nenhum.
//
// Isso dá três coisas que um disparo em bloco não dá: a reputação do domínio
// não leva um pico (a régua de recuperação já ocupa o mesmo remetente), uma
// falha no meio não perde nem repete o resto, e dá pra olhar o primeiro lote
// antes de o segundo sair — se a copy estiver errada, o estrago parou em
// `LOTE` pessoas e não na base inteira.
//
// ── O CÓDIGO NASCE AQUI, ANTES DO E-MAIL ─────────────────────────
//
// O link do e-mail não vale nada sem a linha em `indicacao_codigos`:
// `conviteDaCompra` procura o código e devolve `null` sem ela. Um e-mail
// desses seria pior que não mandar — o amigo clica, paga preço cheio, e quem
// indicou fica sem comissão e sem entender por quê.
//
// Por isso a ordem é: cria o código, manda, marca. Nunca o contrário.
//
// ── SEM LINK DE DESCADASTRO, NÃO SAI ─────────────────────────────
//
// `cabecalhosDescadastro` devolve vazio quando falta `RECUPERACAO_SECRET`, e
// os outros e-mails aceitam isso (vão sem o botão). Aqui NÃO: é marketing pra
// base inteira, e sem saída a única que sobra pra quem não quer é "marcar
// como spam" — o sinal que mais derruba reputação, no mesmo domínio de onde
// sai a entrega de quem pagou. Faltando o segredo, o job recusa e grita.

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

// O tamanho do lote NÃO é constante: sobe sozinho conforme a base vai sendo
// coberta (`loteDaVez`, em `fila-convite.ts`), e pode ser travado a qualquer
// momento pela chave `convite_indicacao_lote` em `config_operacao` — `0` pausa.

// ── SÓ EM HORÁRIO DE GENTE ACORDADA ──────────────────────────────
//
// Sem janela, o cron mandaria a madrugada inteira: 48 rodadas por dia, e uma
// boa parte delas entre 1h e 7h. Isso custa duas vezes — o e-mail chega no
// fundo da caixa de manhã, atrás de tudo que chegou depois, e disparo de
// marketing de madrugada é exatamente o padrão que filtro de spam aprende a
// reconhecer.
//
// Com a janela: 20 por rodada x 2 rodadas por hora x 11 horas = até 440/dia.
// É "aos poucos" de verdade, e ainda é o mesmo remetente da régua de
// recuperação, que já ocupa o domínio.
const HORA_INICIO = 9;
const HORA_FIM = 20;

/** A hora no fuso do Brasil (UTC-3), igual ao resto da operação. */
function horaBr(agora = Date.now()): number {
  return new Date(agora - 3 * 3600000).getUTCHours();
}

export function dentroDaJanela(agora = Date.now()): boolean {
  const h = horaBr(agora);
  return h >= HORA_INICIO && h < HORA_FIM;
}

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function paginado<T>(
  sb: ReturnType<typeof db>,
  tabela: string,
  colunas: string,
  montar?: (q: any) => any,
  chave = "id",
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb
      .from(tabela)
      .select(colunas)
      .order(chave, { ascending: true })
      .range(de, de + 999);
    if (montar) q = montar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export const conviteIndicacao = inngest.createFunction(
  { id: "convite-indicacao", retries: 1, triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    if (!dentroDaJanela()) return { enviados: 0, motivo: "fora-da-janela" };

    if (!linkDescadastroUmClique("teste@exemplo.com")) {
      console.error("[convite] RECUPERACAO_SECRET ausente — disparo de marketing recusado");
      return { enviados: 0, motivo: "sem-descadastro" };
    }

    const fila = await step.run("montar-fila", async () => {
      const sb = db();

      const [pagos, fora, excl, mortos, codigos, naoPt] = await Promise.all([
        // Mesma régua de `jaComprou`: compra de verdade, não crédito nem manual.
        paginado<{
          email: string | null;
          nome_pagador: string | null;
          quiz_response_id: string | null;
          created_at: string;
        }>(sb, "pedidos", "id, email, nome_pagador, quiz_response_id, created_at", (q) =>
          q
            .eq("status", "pago")
            .gt("valor_centavos", 0)
            .not("gateway", "in", "(credito,manual)")
            .or("dinheiro_entrou.is.null,dinheiro_entrou.eq.true"),
        ),
        paginado<{ email: string }>(sb, "descadastros", "email", undefined, "email"),
        paginado<{ email: string }>(sb, "excluidos_email", "email", undefined, "email"),
        paginado<{ email: string }>(
          sb,
          "emails_mortos",
          "email",
          (q) => q.is("liberado_em", null),
          "email",
        ),
        paginado<{ email: string; codigo: string; convite_enviado_em: string | null }>(
          sb,
          "indicacao_codigos",
          "email, codigo, convite_enviado_em",
          undefined,
          "email",
        ),
        // OS QUIZZES QUE NÃO SÃO PT, só o `id`.
        //
        // Custa uma leitura a mais por rodada e conserta o bloqueio de cabeça
        // de fila: antes o espanhol era descartado DEPOIS do corte e voltava a
        // ocupar a vaga na rodada seguinte, pra sempre. Medido em produção, a
        // vazão caía 4, 4, 4, 3, 3, 2, 2… rumo a zero.
        //
        // Só `id`, e a `sequenciaRecuperacao` já pagina esta mesma tabela a
        // cada 30 minutos com bem mais colunas — não é leitura nova pro banco.
        paginado<{ id: string }>(sb, "quiz_responses", "id", (q) => q.neq("locale", "pt")),
      ]);

      // A DECISÃO mora em `src/lib/fila-convite.ts`, pura e testada. Aqui
      // fica só o que precisa de banco: ler as listas e conferir o idioma.
      // O DIAL SEM DEPLOY. Numa alta de reclamação, `0` aqui para o disparo na
      // rodada seguinte — trocar env var na Vercel exigiria redeploy, e isso é
      // lento demais pra servir de freio no meio de um incidente.
      const { data: cfg } = await sb
        .from("config_operacao")
        .select("valor")
        .eq("chave", "convite_indicacao_lote")
        .maybeSingle();
      const override = cfg?.valor === undefined ? null : Number(cfg.valor);

      const jaEnviados = codigos.filter((c) => c.convite_enviado_em).length;
      const lote = loteDaVez(jaEnviados, override);
      if (lote <= 0) return [];

      return montarFila({
        pagos,
        bloqueados: [...fora, ...excl, ...mortos].map((x) => x.email),
        codigos,
        quizNaoPt: new Set(naoPt.map((q) => q.id)),
        lote,
      });

    });

    if (!fila.length) return { enviados: 0, motivo: "fila-vazia" };

    const enviados = await step.run("mandar", async () => {
      const sb = db();
      const resend = new Resend(process.env.RESEND_API_KEY);
      let n = 0;

      for (const p of fila) {
        try {
          // 1. O CÓDIGO PRIMEIRO. Sem a linha, o link do e-mail não dá
          //    desconto nenhum e a comissão nunca nasce.
          let codigo = p.codigo;
          if (!codigo) {
            const novo = gerarCodigo();
            const { error } = await sb
              .from("indicacao_codigos")
              .insert({ email: p.email, codigo: novo });
            if (error) {
              // Corrida (duas rodadas na mesma pessoa) ou colisão de código:
              // relê, e é a leitura que vale.
              const { data } = await sb
                .from("indicacao_codigos")
                .select("codigo")
                .eq("email", p.email)
                .maybeSingle();
              codigo = (data?.codigo as string) ?? null;
            } else {
              codigo = novo;
            }
          }
          if (!codigo) {
            console.error(`[convite] sem código pra ${p.email}, pulando`);
            continue;
          }

          const link = linkDoConvite(codigo, SITE);
          const linkDescadastro = linkDescadastroUmClique(p.email)!;

          const { data: env, error: erroEnvio } = await resend.emails.send({
            from: REMETENTE_RECUPERACAO,
            replyTo: RESPONDER_PARA,
            to: [p.email],
            subject: assuntoIndicacao(),
            html: emailIndicacao({
              nome: p.nome,
              link,
              linkPainel: `${SITE}/indique`,
              linkDescadastro,
            }),
            text: textoIndicacao({ nome: p.nome, link }),
            headers: cabecalhosDescadastro(p.email),
          });
          if (erroEnvio) throw new Error(erroEnvio.message);

          // 2. MARCA SÓ DEPOIS DE SAIR. Marcar antes trocaria "mandou duas
          //    vezes" por "nunca mandou", que é pior: o segundo é invisível.
          await sb
            .from("indicacao_codigos")
            .update({ convite_enviado_em: new Date().toISOString() })
            .eq("email", p.email);

          await registrarEnvio(sb, {
            emailId: env?.id,
            template: "indicacao_convite",
            para: p.email,
            quizResponseId: p.quizId,
          });
          n++;
        } catch (err) {
          // Um endereço ruim não pode parar a fila: ele fica sem marca e
          // volta na próxima rodada.
          console.error(`[convite] falhou pra ${p.email}:`, (err as Error).message);
        }
      }
      return n;
    });

    return { enviados, naFila: fila.length };
  },
);
