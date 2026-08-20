import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// O TETO DIÁRIO DE GERAÇÃO, lido e escrito pelo painel.
//
// O número mora em `config_operacao` (migration 20260820100000) e é lido pelo
// disjuntor (`inngest/lib/disjuntor.ts`) na ordem banco > env > padrão.
//
// Por que o painel precisa disso: o disjuntor desliga a geração pra quem ainda
// não pagou e manda um e-mail. Quem recebe esse e-mail está no celular, e a
// pergunta seguinte é sempre "foi pico de verdade ou foi robô?". Sem o número
// e o consumo do dia na mesma tela, a resposta exige abrir o painel da Vercel
// e um deploy.

/** Duas leituras que só fazem sentido juntas: o teto e quanto já foi gasto. */
export type EstadoDoTeto = {
  teto: number;
  /** Quantas gerações não pagas o dia já consumiu. */
  usadoHoje: number;
  /**
   * De onde veio o número que está valendo. A tela usa pra explicar por que
   * o campo mostra 300 quando ninguém digitou 300.
   */
  origem: "banco" | "env" | "padrao";
  /** Quando alguém mexeu pela última vez. `null` se nunca. */
  atualizadoEm: string | null;
};

const CHAVE = "teto_musicas_dia";
const PADRAO = 300;
// Teto do teto. Não é burocracia: um dígito a mais digitado sem querer
// (3000 em vez de 300) transforma a proteção em enfeite, e é o tipo de erro
// que ninguém percebe até a fatura chegar.
const MAX = 5_000;

/** O dia no fuso do Brasil, igual ao `diaBr` do disjuntor. */
function diaBr(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

export const carregarTeto = createServerFn({ method: "POST" }).handler(
  async (): Promise<EstadoDoTeto> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const db = supabaseAdmin();

    const [{ data: cfg }, { data: contador }] = await Promise.all([
      db.from("config_operacao").select("valor, atualizado_em").eq("chave", CHAVE).maybeSingle(),
      db.from("limites_uso").select("contagem").eq("chave", `musica-dia:${diaBr()}`).maybeSingle(),
    ]);

    const doBanco = Number(cfg?.valor);
    if (Number.isFinite(doBanco) && doBanco > 0) {
      return {
        teto: Math.floor(doBanco),
        usadoHoje: Number(contador?.contagem ?? 0),
        origem: "banco",
        atualizadoEm: (cfg?.atualizado_em as string | undefined) ?? null,
      };
    }

    const daEnv = Number(process.env.TETO_MUSICAS_DIA);
    const valeEnv = Number.isFinite(daEnv) && daEnv > 0;
    return {
      teto: valeEnv ? Math.floor(daEnv) : PADRAO,
      usadoHoje: Number(contador?.contagem ?? 0),
      origem: valeEnv ? "env" : "padrao",
      atualizadoEm: null,
    };
  },
);

export const salvarTeto = createServerFn({ method: "POST" })
  .validator((data: { teto: number }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string; estado?: EstadoDoTeto }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();

    // `.validator()` acima é só um cast — não checa nada em runtime. Quem
    // valida é isto aqui, como em `admin-experimentos.ts`.
    const n = Math.floor(Number(data?.teto));
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, erro: "o teto precisa ser um número inteiro maior que zero" };
    }
    if (n > MAX) {
      return { ok: false, erro: `${MAX} é o máximo — acima disso o teto não protege mais nada` };
    }

    const db = supabaseAdmin();
    const { error } = await db
      .from("config_operacao")
      .upsert(
        { chave: CHAVE, valor: String(n), atualizado_em: new Date().toISOString() },
        { onConflict: "chave" },
      );
    if (error) {
      console.error("[teto] gravação falhou:", error);
      return { ok: false, erro: "não deu pra salvar agora" };
    }

    // Devolve o estado RELIDO, não o que foi digitado: é o mesmo cuidado de
    // `salvarExperimento`. O que a tela mostra tem que ser o que o banco tem.
    return { ok: true, estado: await carregarTeto() };
  });
