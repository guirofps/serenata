import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { cn } from "@/lib/utils";
import { Loader2, Mail, Check } from "lucide-react";

// Entrada na conta do comprador. Sem senha: só o e-mail que ele usou no
// funil. O link mágico chega por e-mail e entra logado.
//
// Anti-enumeração: o backend responde igual com ou sem música, então a tela
// de sucesso é sempre a mesma ("se este e-mail tem música, o link foi").

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Entrar · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Login,
});

// Sugestão de domínio enquanto digita (copiado dos concorrentes: reduz erro
// de digitação no campo que decide se o link chega).
const DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "icloud.com", "yahoo.com.br"];

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado");
  const [erro, setErro] = useState<string | null>(null);

  // Já logado? Vai direto pro painel.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const sugestao = (() => {
    const at = email.indexOf("@");
    if (at < 0) return null;
    const antes = email.slice(0, at);
    const depois = email.slice(at + 1);
    if (!depois) return null;
    const match = DOMINIOS.find((d) => d.startsWith(depois) && d !== depois);
    return match ? `${antes}@${match}` : null;
  })();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");
    try {
      const r = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!r.ok && r.status !== 200) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Não consegui enviar agora.");
      }
      setEstado("enviado");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui enviar agora.");
      setEstado("parado");
    }
  }

  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--papel)] px-6 text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      <main className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo tamanho="md" />
        </div>

        {estado === "enviado" ? (
          <div className="text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]">
              <Check className="h-6 w-6" />
            </div>
            <h1
              className="text-balance"
              style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}
            >
              Confira seu e-mail
            </h1>
            <p
              className="mx-auto mt-3 max-w-xs text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
            >
              Se este e-mail tem uma música sua, o link de acesso está a caminho.
              Ele entra direto, sem senha.
            </p>
            <button
              onClick={() => {
                setEstado("parado");
                setErro(null);
              }}
              className="mt-6 text-[var(--acento)] underline underline-offset-4"
              style={{ fontSize: "var(--t-sm)" }}
            >
              usar outro e-mail
            </button>
          </div>
        ) : (
          <>
            <h1
              className="text-center text-balance"
              style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}
            >
              Entrar na sua conta
            </h1>
            <p
              className="mx-auto mt-3 max-w-xs text-center text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
            >
              Use o e-mail que você deu ao criar a música. Mandamos um link que
              entra sem senha.
            </p>

            <form onSubmit={enviar} className="mt-8 space-y-3">
              <div>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-full border border-[var(--tinta-fraca)] bg-[var(--papel-fundo)] px-5 outline-none transition-colors focus:border-[var(--acento)]"
                  style={{ fontSize: "var(--t-base)", height: "3.25rem" }}
                />
                {sugestao && (
                  <button
                    type="button"
                    onClick={() => setEmail(sugestao)}
                    className="mt-2 pl-5 text-[var(--tinta-suave)]"
                    style={{ fontSize: "var(--t-sm)" }}
                  >
                    Você quis dizer <span className="text-[var(--acento)]">{sugestao}</span>?
                  </button>
                )}
              </div>

              {erro && (
                <p
                  className="rounded-xl bg-[var(--acento)]/10 px-4 py-3 text-[var(--acento)]"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={estado === "enviando"}
                className={cn(
                  "cta flex w-full items-center justify-center gap-2 rounded-full font-medium",
                  "disabled:opacity-60",
                )}
                style={{ fontSize: "var(--t-base)", height: "3.25rem" }}
              >
                {estado === "enviando" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> enviando…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" /> Enviar link de acesso
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
