import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, MARCA } from "@/lib/marca";
import { Loader2 } from "lucide-react";
import { normalizarLocale, caminho } from "@/lib/i18n";

// Aterrissagem do magic link. O Supabase manda de volta pra cá com um `?code=`
// (fluxo PKCE) ou, em alguns casos, um `#access_token` no hash (implicit).
// Troca isso por uma sessão e joga no painel.

export const Route = createFileRoute("/auth/callback")({
  // `lang` vem colado no link do e-mail. É a única pista de idioma que existe
  // aqui: não há sessão (é justamente o que se está criando) nem prefixo de
  // rota. Sem ele, um comprador mexicano com link expirado veria a tela de
  // erro em português e seria mandado pro login brasileiro.
  validateSearch: (busca: Record<string, unknown>) => ({
    lang: typeof busca.lang === "string" ? busca.lang : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Entrando · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Callback,
});


const COPY = {
  pt: {
    naoVale: "Esse link não vale mais.",
    porque:
      "Cada link é de uso único, e pedir um novo desliga o anterior. Se você recebeu mais de um e-mail, abra o mais recente antes de pedir outro.",
    maisRecente: "abra o mais recente",
    pedirNovo: "pedir um novo link",
    entrando: "entrando…",
  },
  es: {
    naoVale: "Este link ya no sirve.",
    porque:
      "Cada link es de un solo uso, y pedir uno nuevo desactiva el anterior. Si recibiste más de un correo, abre el más reciente antes de pedir otro.",
    maisRecente: "abre el más reciente",
    pedirNovo: "pedir un link nuevo",
    entrando: "entrando…",
  },
} as const;

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

  const locale = normalizarLocale(Route.useSearch().lang);
  const C = COPY[locale] ?? COPY.pt;

  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--papel)] px-6 text-center text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      {/* A mensagem de erro antiga era só "expirou ou já foi usado", e mandava
          pedir outro link. Quem tinha pedido dois clicava no e-mail antigo,
          caía aqui, pedia outro, e repetia — 11 vezes no caso medido em
          02/08. Agora a tela diz a CAUSA provável antes de oferecer o botão
          que reinicia o ciclo. */}
      {erro ? (
        <div className="mx-auto max-w-xs">
          <p style={{ fontSize: "var(--t-lg)" }}>{C.naoVale}</p>
          <p
            className="mt-3 text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
          >
            {C.porque.split(C.maisRecente).map((pedaco, i) => (
              <span key={i}>
                {i > 0 && <strong className="text-[var(--tinta)]">{C.maisRecente}</strong>}
                {pedaco}
              </span>
            ))}
          </p>
          <button
            onClick={() => navigate({ to: caminho("/login", locale) } as never)}
            className="mt-5 text-[var(--acento)] underline underline-offset-4"
            style={{ fontSize: "var(--t-sm)" }}
          >
            {C.pedirNovo}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[var(--tinta-suave)]">
          <Loader2 className="h-5 w-5 animate-spin" /> {C.entrando}
        </div>
      )}
    </div>
  );
}
