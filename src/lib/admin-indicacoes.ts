import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A INDICAÇÃO NO PAINEL: a fila de saques e o que sustenta cada um.
//
// O saque é pago À MÃO (ver a migração `20260926000000_indicacao.sql`), então
// esta aba é também o antifraude: ao lado de cada pedido de saque aparecem as
// compras que geraram aquele saldo, com o nome de quem PAGOU. Alguém que
// indica a si mesmo com outro e-mail passa pela trigger, mas não passa por
// um olho que vê o mesmo titular de PIX dos dois lados.

export type ComissaoAdmin = {
  quando: string;
  indicador: string;
  indicado: string;
  pagador: string | null;
  valorCentavos: number;
  pagoCentavos: number;
  liberaEm: string;
  statusPedido: string;
};

export type SaqueAdmin = {
  id: string;
  email: string;
  valorCentavos: number;
  chavePix: string;
  status: "solicitado" | "pago" | "recusado";
  quando: string;
  resolvidoEm: string | null;
  nota: string | null;
  /** Quem pede o saque, quando comprou: o nome no PIX dele, pra comparar. */
  pagadorDoIndicador: string | null;
  comissoes: ComissaoAdmin[];
};

export type PainelIndicacoes = {
  codigos: number;
  comprasComConvite: number;
  descontoDadoCentavos: number;
  aLiberarCentavos: number;
  liberadoCentavos: number;
  pagoEmSaquesCentavos: number;
  saques: SaqueAdmin[];
  recentes: ComissaoAdmin[];
};

type LinhaComissao = {
  created_at: string;
  indicador_email: string;
  indicado_email: string;
  valor_centavos: number;
  base_centavos: number;
  libera_em: string;
  pedidos: { status?: string; titular_pix?: string | null; nome_pagador?: string | null } | null;
};

function paraComissao(c: LinhaComissao): ComissaoAdmin {
  return {
    quando: c.created_at,
    indicador: c.indicador_email,
    indicado: c.indicado_email,
    pagador: c.pedidos?.titular_pix ?? c.pedidos?.nome_pagador ?? null,
    valorCentavos: c.valor_centavos,
    pagoCentavos: c.base_centavos,
    liberaEm: c.libera_em,
    statusPedido: c.pedidos?.status ?? "?",
  };
}

const COLUNAS_COMISSAO =
  "created_at, indicador_email, indicado_email, valor_centavos, base_centavos, libera_em, pedidos(status, titular_pix, nome_pagador)";

export const carregarIndicacoes = createServerFn({ method: "POST" }).handler(
  async (): Promise<PainelIndicacoes> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const db = supabaseAdmin();

    const [codigos, comissoes, saques, descontos] = await Promise.all([
      db.from("indicacao_codigos").select("email", { count: "exact", head: true }),
      db
        .from("indicacao_comissoes")
        .select(COLUNAS_COMISSAO)
        .order("created_at", { ascending: false })
        .limit(1000),
      db.from("indicacao_saques").select("*").order("created_at", { ascending: false }).limit(100),
      db
        .from("pedidos")
        .select("desconto_indicacao_centavos")
        .eq("status", "pago")
        .gt("desconto_indicacao_centavos", 0)
        .limit(5000),
    ]);
    for (const r of [codigos, comissoes, saques, descontos]) {
      if (r.error) throw new Error(r.error.message);
    }

    const todas = (comissoes.data ?? []) as unknown as LinhaComissao[];
    const agora = Date.now();
    let aLiberar = 0;
    let liberado = 0;
    for (const c of todas) {
      if (c.pedidos?.status !== "pago") continue;
      if (new Date(c.libera_em).getTime() > agora) aLiberar += c.valor_centavos;
      else liberado += c.valor_centavos;
    }

    const linhasSaque = (saques.data ?? []) as Array<{
      id: string;
      email: string;
      valor_centavos: number;
      chave_pix: string;
      status: SaqueAdmin["status"];
      created_at: string;
      resolvido_em: string | null;
      nota: string | null;
    }>;

    // O nome no PIX de quem indica, pra pôr ao lado do nome de quem comprou.
    const emails = [...new Set(linhasSaque.map((s) => s.email))];
    const pagadorPorEmail = new Map<string, string>();
    if (emails.length) {
      const { data } = await db
        .from("pedidos")
        .select("email, titular_pix, nome_pagador")
        .in("email", emails)
        .eq("status", "pago")
        .limit(500);
      for (const p of data ?? []) {
        const nome = (p.titular_pix as string | null) ?? (p.nome_pagador as string | null);
        const e = String(p.email ?? "").toLowerCase();
        if (nome && !pagadorPorEmail.has(e)) pagadorPorEmail.set(e, nome);
      }
    }

    return {
      codigos: codigos.count ?? 0,
      comprasComConvite: todas.length,
      descontoDadoCentavos: (descontos.data ?? []).reduce(
        (s, p) => s + (Number(p.desconto_indicacao_centavos) || 0),
        0,
      ),
      aLiberarCentavos: aLiberar,
      liberadoCentavos: liberado,
      pagoEmSaquesCentavos: linhasSaque
        .filter((s) => s.status === "pago")
        .reduce((s, q) => s + q.valor_centavos, 0),
      saques: linhasSaque.map((s) => ({
        id: s.id,
        email: s.email,
        valorCentavos: s.valor_centavos,
        chavePix: s.chave_pix,
        status: s.status,
        quando: s.created_at,
        resolvidoEm: s.resolvido_em,
        nota: s.nota,
        pagadorDoIndicador: pagadorPorEmail.get(s.email) ?? null,
        comissoes: todas.filter((c) => c.indicador_email === s.email).map(paraComissao),
      })),
      recentes: todas.slice(0, 50).map(paraComissao),
    };
  },
);

/**
 * Marca o saque como pago (depois de o dono fazer o PIX) ou recusado.
 *
 * Só sai de `solicitado`: um saque pago não volta a ser recusado por um
 * clique errado, o que devolveria ao saldo um dinheiro que já saiu.
 */
export const resolverSaque = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: "pago" | "recusado"; nota?: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    if (data.status !== "pago" && data.status !== "recusado")
      return { ok: false, erro: "status inválido" };
    const { data: linhas, error } = await supabaseAdmin()
      .from("indicacao_saques")
      .update({
        status: data.status,
        resolvido_em: new Date().toISOString(),
        nota: data.nota?.trim().slice(0, 300) || null,
      })
      .eq("id", data.id)
      .eq("status", "solicitado")
      .select("id");
    if (error) return { ok: false, erro: error.message };
    if (!linhas?.length) return { ok: false, erro: "esse saque já foi resolvido" };
    return { ok: true };
  });
