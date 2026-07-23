import { createClient } from "@supabase/supabase-js";

// Cliente com service role — SÓ pode ser importado de código que roda no
// servidor (createServerFn / api/). Ignora RLS, então nunca no bundle do
// cliente. As tabelas musicas e pedidos não têm policy anon justamente
// porque só este cliente as toca.
export function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server env ausente (URL / SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}
