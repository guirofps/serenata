import { createClient } from "@supabase/supabase-js";

// Funciona no client (import.meta.env do Vite) e no SSR (fallback process.env).
const url = (import.meta.env?.VITE_SUPABASE_URL ||
  (typeof process !== "undefined"
    ? process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL
    : "")) as string;
const key = (import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== "undefined"
    ? process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY
    : "")) as string;

// Os placeholders evitam que createClient() lance no import quando as envs não
// existem (ex.: prerender de "/" no build). Nunca são usados em runtime, onde
// as VITE_ reais estão presentes; só impedem o build estático de falhar.
//
// Auth LIGADA agora que existe área do comprador (login por magic link,
// /dashboard, /editar). O funil segue anônimo — ele nunca chama signIn, então
// simplesmente não há sessão nas páginas do funil. `detectSessionInUrl` só age
// quando há `?code=`/hash de auth na URL, o que só acontece em /auth/callback.
//
// `storage` só existe no browser: no SSR não há localStorage, e passar
// undefined faz o supabase-js pular a persistência sem quebrar o prerender.
const browser = typeof window !== "undefined";

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-anon-key",
  {
    auth: {
      persistSession: browser,
      autoRefreshToken: browser,
      detectSessionInUrl: browser,
      storage: browser ? window.localStorage : undefined,
    },
  },
);
