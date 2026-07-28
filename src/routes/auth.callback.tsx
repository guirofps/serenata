import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, MARCA } from "@/lib/marca";
import { Loader2 } from "lucide-react";

// Aterrissagem do magic link. O Supabase manda de volta pra cá com um `?code=`
// (fluxo PKCE) ou, em alguns casos, um `#access_token` no hash (implicit).
// Troca isso por uma sessão e joga no painel.

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: `Entrando · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;

    async function entrar() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      // Fluxo PKCE: troca o code por sessão.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!vivo) return;
        if (error) {
          setErro(true);
          return;
        }
        navigate({ to: "/dashboard" });
        return;
      }

      // Fluxo implicit (#access_token): o detectSessionInUrl do client já
      // parseia o hash sozinho, mas leva alguns ms. Espera a sessão aparecer.
      for (let i = 0; i < 50 && vivo; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: "/dashboard" });
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (vivo) setErro(true);
    }

    entrar();
    return () => {
      vivo = false;
    };
  }, [navigate]);

  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--papel)] px-6 text-center text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      {erro ? (
        <div>
          <p style={{ fontSize: "var(--t-lg)" }}>Esse link expirou ou já foi usado.</p>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="mt-4 text-[var(--acento)] underline underline-offset-4"
            style={{ fontSize: "var(--t-sm)" }}
          >
            pedir um novo link
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[var(--tinta-suave)]">
          <Loader2 className="h-5 w-5 animate-spin" /> entrando…
        </div>
      )}
    </div>
  );
}
