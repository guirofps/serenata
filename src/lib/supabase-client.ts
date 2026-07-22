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
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-anon-key",
  {
    auth: {
      // Funil anônimo: não há login no cliente. Persistência de auth desligada
      // até existir área autenticada (se algum dia existir).
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
