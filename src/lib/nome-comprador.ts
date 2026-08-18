import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";

// O PRIMEIRO NOME DE QUEM COMPROU, pra saudação do painel.
//
// Antes o painel fazia `email.split("@")[0]`, e o resultado era "Olá,
// fenix bebidas" pra quem comprou com um e-mail de empresa. Numa plataforma
// que vende presente emocional, chamar a pessoa pelo pedaço do e-mail é o
// oposto do produto.
//
// Não precisa PERGUNTAR o nome: a Perfect Pay já manda no webhook e a gente
// guarda em `pedidos.nome_pagador`. Medido em 17/08: 298 de 302 pedidos pagos
// (99%) têm o nome preenchido. Perguntar seria pedir de novo um dado que já
// está no banco, e todo campo a mais é gente a menos terminando.

/** "RONDINELE APARECIDO DOS SANTOS" -> "Rondinele". */
function primeiroNome(completo: string): string {
  const limpo = completo.trim().replace(/\s+/g, " ");
  if (!limpo) return "";
  const p = limpo.split(" ")[0];
  // Nomes vêm em CAIXA ALTA do gateway na maioria das vezes. "RONDINELE" numa
  // saudação parece grito.
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/**
 * Descobre o nome pelo e-mail da conta logada.
 *
 * Server function porque `pedidos` não é legível pelo cliente (e não deve
 * ser: tem valor, telefone e status de pagamento de todo mundo).
 */
export const nomeDoComprador = createServerFn({ method: "POST" })
  // O TOKEN, não o e-mail: com o e-mail solto, qualquer um descobriria o nome
  // completo de qualquer comprador mandando o endereço dele.
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<{ nome: string | null }> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { nome: null };

    const { data: p } = await supabaseAdmin()
      .from("pedidos")
      .select("nome_pagador")
      .ilike("email", email)
      .not("nome_pagador", "is", null)
      // O mais recente: se ela comprou duas vezes com nomes diferentes
      // (acontece quando alguém compra pra terceiro), vale o último.
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nome = p?.nome_pagador ? primeiroNome(p.nome_pagador) : null;
    return { nome: nome || null };
  });
