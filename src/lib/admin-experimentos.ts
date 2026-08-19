import { createServerFn } from "@tanstack/react-start";
import { FORA, type ExperimentoConfig, type Variante } from "@/lib/experimentos";
import { supabaseAdmin } from "@/lib/supabase-admin";

// AS DUAS FUNÇÕES QUE O PAINEL USA.
//
// Separadas de `admin-dados.ts` de propósito: aquilo é leitura pesada de
// funil, isto é escrita de configuração. Misturar faria a tela de config
// carregar 180 mil eventos pra salvar um checkbox.

/** Lê SEM cache: quem está editando não pode ver estado velho. */
export const carregarExperimentos = createServerFn({ method: "POST" }).handler(
  async (): Promise<ExperimentoConfig[]> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const { lerConfigFresca } = await import("@/lib/experimentos-config.server");
    return lerConfigFresca();
  },
);

type EntradaSalvar = {
  id: string;
  ativo: boolean;
  exposicaoPct: number;
  nota: string;
  variantes: Variante[];
};

/** O que a linha `experimentos` diz AGORA, lido do banco — nunca do payload. */
type EstadoNoBanco = { ativo: boolean; variantes: Variante[] } | null;

type Decisao = { ok: true } | { ok: false; erro: string };

/**
 * TODAS as travas de `salvarExperimento`, sem tocar em banco nem em rede.
 *
 * Extraída à parte de propósito: são elas que protegem dinheiro de verdade
 * (o teste de preço em produção), e são o único jeito de testar essas travas
 * sem inventar mock de Supabase — a função recebe o estado atual já lido, e
 * devolve só a decisão.
 *
 * `banco` PRECISA vir de uma leitura fresca da tabela, feita pelo chamador,
 * nunca do que o navegador mandou. A Trava 1 abaixo compara contra
 * `banco.ativo`, não contra `entrada.ativo` — é isso que fecha o furo de
 * mandar `ativo:false` junto com um preço novo pra passar pela trava
 * enquanto o teste está ligado de verdade.
 */
export function decidirSalvamento(banco: EstadoNoBanco, entrada: EntradaSalvar): Decisao {
  if (!banco) return { ok: false, erro: "experimento não existe" };

  const novas = entrada.variantes;
  if (!novas.length) return { ok: false, erro: "precisa de pelo menos uma versão" };
  if (novas.some((v) => v.nome === FORA)) {
    return { ok: false, erro: `\`${FORA}\` é reservado pra quem não entra no teste` };
  }
  if (new Set(novas.map((v) => v.nome)).size !== novas.length) {
    return { ok: false, erro: "duas versões com o mesmo nome" };
  }

  // TRAVA 1 — preço e link são só-leitura enquanto o teste está no ar.
  //
  // Quem já foi sorteada pro B tem o preço antigo gravado no navegador. Ela
  // volta, lê outro, e os dois preços ficam embaixo do mesmo rótulo. A
  // comparação é contra `banco.ativo` (o que a linha diz AGORA), não contra
  // `entrada.ativo` (o que o clique mandou) — senão bastaria mandar
  // `ativo:false` junto pra furar a trava, e ela não valeria nada.
  if (banco.ativo) {
    const antes = JSON.stringify(
      (banco.variantes ?? []).map((v) => [v.nome, v.plano ?? null]),
    );
    const depois = JSON.stringify(novas.map((v) => [v.nome, v.plano ?? null]));
    if (antes !== depois) {
      return {
        ok: false,
        erro: "desligue o teste pra mexer em preço, link ou nome de versão",
      };
    }
  }

  // TRAVA 2 — não liga com duas versões dividindo o mesmo checkout.
  //
  // É o defeito que o teste de preço inteiro existe pra impedir: a tela diz
  // um número e o caixa cobra outro.
  if (entrada.ativo) {
    const links = novas.map((v) => v.plano?.checkout).filter(Boolean);
    if (links.length !== new Set(links).size) {
      return { ok: false, erro: "duas versões apontam pro mesmo link de checkout" };
    }

    // TRAVA 3 — versão sem plano completo não entra no ar.
    const incompleta = novas.find(
      (v) => !v.plano?.checkout || !v.plano?.texto || !Number.isFinite(v.plano?.valor),
    );
    if (incompleta) {
      return { ok: false, erro: `a versão ${incompleta.nome} está sem preço ou link` };
    }
  }

  return { ok: true };
}

/**
 * Salva um experimento, com as travas que impedem estrago de um clique.
 *
 * A decisão em si mora em `decidirSalvamento` (testável sem banco). Aqui só
 * lê o estado atual, chama a decisão, e — se ela deixar — grava. Falha de
 * decisão volta pro chamador como `{ ok:false, erro }`, nunca como exceção:
 * é a tela do painel que decide como mostrar isso, não um 500 genérico.
 */
export const salvarExperimento = createServerFn({ method: "POST" })
  .validator((data: EntradaSalvar) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const { invalidarConfig } = await import("@/lib/experimentos-config.server");
    const db = supabaseAdmin();

    const { data: linha } = await db
      .from("experimentos")
      .select("ativo, variantes")
      .eq("id", data.id)
      .maybeSingle();

    const banco: EstadoNoBanco = linha
      ? { ativo: Boolean(linha.ativo), variantes: (linha.variantes ?? []) as Variante[] }
      : null;

    const decisao = decidirSalvamento(banco, data);
    if (!decisao.ok) return decisao;

    const exposicao = Math.max(0, Math.min(100, Math.round(data.exposicaoPct)));
    const { error } = await db
      .from("experimentos")
      .update({
        ativo: data.ativo,
        exposicao_pct: exposicao,
        nota: data.nota,
        variantes: data.variantes.map((v) => ({ ...v, peso: Math.max(0, Number(v.peso) || 0) })),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) return { ok: false, erro: error.message };

    // Só invalida DEPOIS do `update` confirmado — invalidar antes reabriria
    // a janela de até 60s de config velha que a invalidação existe pra
    // fechar, se o `update` acima falhasse por qualquer motivo.
    invalidarConfig();
    return { ok: true };
  });
