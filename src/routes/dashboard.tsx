import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, ExternalLink, Plus, LogOut, Music } from "lucide-react";

// A ÁREA DO COMPRADOR — a "casa" dele na plataforma. Lista as músicas que ele
// criou; cada uma leva ao editor do presente (montar foto/galeria/cor) e à
// página pública.
//
// Guard CLIENT-SIDE (não em beforeLoad): a sessão vive no localStorage, que
// não existe no SSR. Um beforeLoad no servidor redirecionaria todo mundo pro
// login. Então renderiza "carregando" até confirmar a sessão no navegador.

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: `Sua conta · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

type Musica = {
  id: string;
  titulo: string | null;
  status: string;
  token: string;
  token_edicao: string;
  genero: string | null;
  personalizada_em: string | null;
};

const ROTULO_STATUS: Record<string, { texto: string; cor: string }> = {
  pronta: { texto: "pronta", cor: "text-[var(--acento)]" },
  gerando: { texto: "gerando…", cor: "text-[var(--tinta-suave)]" },
  aguardando: { texto: "na fila", cor: "text-[var(--tinta-suave)]" },
  falhou: { texto: "falhou", cor: "text-[var(--acento)]" },
};

function Dashboard() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [nome, setNome] = useState<string>("");

  useEffect(() => {
    let vivo = true;

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!sess.session) {
        navigate({ to: "/login" });
        return;
      }
      setNome(sess.session.user.email?.split("@")[0] ?? "");

      // RLS garante que só vêm as músicas DESTE usuário (auth.uid() = user_id).
      const { data } = await supabase
        .from("musicas")
        .select("id, titulo, status, token, token_edicao, genero, personalizada_em")
        .order("created_at", { ascending: false });
      if (!vivo) return;
      setMusicas((data ?? []) as Musica[]);
      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [navigate]);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div
      className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      <header className="border-b border-[var(--tinta-fraca)]/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Logo tamanho="sm" />
          <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 text-[var(--tinta-suave)] transition-colors hover:text-[var(--tinta)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <LogOut className="h-4 w-4" /> sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1
          className="text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}
        >
          {nome ? `Olá, ${nome}` : "Suas músicas"}
        </h1>
        <p
          className="mt-2 text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
        >
          Aqui ficam as músicas que você criou. Toque em uma pra montar o
          presente ou ver a página.
        </p>

        {carregando ? (
          <div className="mt-10 flex items-center gap-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> carregando…
          </div>
        ) : musicas.length === 0 ? (
          <div className="mt-10 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]">
              <Music className="h-5 w-5" />
            </div>
            <p style={{ fontSize: "var(--t-base)" }}>Você ainda não tem nenhuma música.</p>
            <Link
              to="/criar"
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-full cta px-6 font-medium"
              style={{ fontSize: "var(--t-sm)" }}
            >
              <Plus className="h-4 w-4" /> Criar minha primeira música
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-3">
              {musicas.map((m) => {
                const st = ROTULO_STATUS[m.status] ?? { texto: m.status, cor: "text-[var(--tinta-suave)]" };
                const pronta = m.status === "pronta";
                return (
                  <li
                    key={m.id}
                    className="rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate font-medium"
                          style={{ fontFamily: FONTES.display, fontSize: "var(--t-lg)" }}
                        >
                          {m.titulo ?? "Sua música"}
                        </p>
                        <p className={cn("mt-0.5", st.cor)} style={{ fontSize: "var(--t-xs)" }}>
                          {st.texto}
                          {m.genero ? ` · ${m.genero}` : ""}
                          {m.personalizada_em ? " · presente montado" : ""}
                        </p>
                      </div>
                    </div>

                    {pronta && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          to="/editar/$tokenEdicao"
                          params={{ tokenEdicao: m.token_edicao }}
                          className="inline-flex h-11 items-center gap-2 rounded-full cta px-5 font-medium"
                          style={{ fontSize: "var(--t-sm)" }}
                        >
                          <Pencil className="h-4 w-4" /> Montar o presente
                        </Link>
                        <a
                          href={`/p/${m.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-5 transition-colors hover:border-[var(--tinta-suave)]"
                          style={{ fontSize: "var(--t-sm)" }}
                        >
                          <ExternalLink className="h-4 w-4" /> Ver página
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Recompra: por ora leva de volta ao funil. O desconto de
                recompra depende do pagamento estar ligado (fake door hoje). */}
            <Link
              to="/criar"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-6 transition-colors hover:border-[var(--acento)] hover:text-[var(--acento)]"
              style={{ fontSize: "var(--t-sm)" }}
            >
              <Plus className="h-4 w-4" /> Criar outra música
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
