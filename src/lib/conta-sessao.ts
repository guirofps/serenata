import { createClient } from "@supabase/supabase-js";

// QUEM ESTÁ PEDINDO, provado pelo token e não pelo que o cliente digitou.
//
// O erro que isto conserta é meu, e é do tipo que passa despercebido porque a
// tela funciona: as primeiras versões de `nomeDoComprador` e `meusCreditos`
// recebiam o E-MAIL como parâmetro e devolviam nome, saldo e histórico de
// compra. Como server function é uma rota HTTP, qualquer pessoa podia mandar
// o e-mail de outro e ler os dados dele.
//
// É a mesma família do `admin_session=true` forjável que o CLAUDE.md manda não
// repetir: confiar num valor que o cliente controla.
//
// O token de acesso do Supabase é assinado por eles. Verificá-lo devolve o
// usuário de verdade, e é esse e-mail que vale.

export async function emailDaSessao(token: string): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return null;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return data.user.email.trim().toLowerCase();
  } catch {
    return null;
  }
}
