import type { SupabaseClient } from "@supabase/supabase-js";

// QUEM É O DONO DE UM `token_edicao`.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// O pós-compra deste projeto tem DUAS credenciais e elas não são
// intercambiáveis por acidente, são complementares:
//
//   sessão (Supabase Auth)  prova QUEM a pessoa é. Exige magic link.
//   `token_edicao`          prova que ela tem o link do presente.
//
// Toda a plataforma nasceu só com a primeira, e isso produziu o mesmo defeito
// duas vezes: 84% dos compradores nunca clicam no magic link, então qualquer
// função que começa com `emailDaSessao` está fechada pra 8 em cada 10 pessoas
// que pagaram.
//
// O caso que custou dinheiro de verdade (medido em 02/09): 34 quadros
// vendidos, 7 montados. Quem abria a folha pelo link do e-mail caía sem
// sessão e a tela oferecia COMPRAR o quadro que já era dela.
//
// ── O QUE ELE NÃO AUTORIZA ───────────────────────────────────────
//
// O token prova posse de UMA música. Ele identifica o DONO, e o dono é quem
// PAGOU aquela música — não quem digitou um e-mail. Por isso o e-mail sai de
// `pedidos`, que é a linha que só existe depois de dinheiro confirmado.
//
// Quem chama continua responsável por limitar o ALVO da operação: no quadro,
// só a música do próprio token; aqui, só o saldo do próprio dono.

export type DonoDoToken = { email: string; musicaId: string };

export async function donoPorTokenEdicao(
  db: SupabaseClient,
  tokenEdicao: string | null | undefined,
): Promise<DonoDoToken | null> {
  const tk = (tokenEdicao ?? "").trim();
  // Comprimento de token de verdade. Sem isto, uma string vazia que escapou de
  // um `?? ""` viraria uma consulta com igualdade a "" — que não casa nada
  // hoje, mas é o tipo de linha que um dia casa.
  if (tk.length < 16 || tk.length > 128) return null;

  const { data: m } = await db
    .from("musicas")
    .select("id")
    .eq("token_edicao", tk)
    .maybeSingle();
  if (!m?.id) return null;

  const { data: p } = await db
    .from("pedidos")
    .select("email")
    .eq("musica_id", m.id)
    .eq("status", "pago")
    .not("email", "is", null)
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!p?.email) return null;

  return { email: p.email, musicaId: m.id };
}
