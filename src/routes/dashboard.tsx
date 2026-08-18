import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { tp } from "@/lib/textos-presente";
import { Logo } from "@/components/marca/Logo";
import { cn } from "@/lib/utils";
import { novaSessao } from "@/lib/session-context";
import { useQuizStore } from "@/lib/quiz-store";
import { ConviteOutraMusica } from "@/components/conta/ConviteOutraMusica";
import { nomeDoComprador } from "@/lib/nome-comprador";
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
  locale: string | null;
  created_at: string;
};

// Duas músicas da mesma pessoa costumam ter o MESMO título (é o título da
// canção, não do arquivo): quando ela pede um ajuste na letra, a nova nasce
// com o nome da antiga. Sem a data no card não dá pra saber qual é qual.
const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

// A COR do status é do idioma nenhum; o texto vem do dicionário.
const COR_STATUS: Record<string, string> = {
  pronta: "text-[var(--acento)]",
  gerando: "text-[var(--tinta-suave)]",
  aguardando: "text-[var(--tinta-suave)]",
  falhou: "text-[var(--acento)]",
};

function Dashboard() {
  const navigate = useNavigate();
  const reset = useQuizStore((s) => s.reset);
  const [carregando, setCarregando] = useState(true);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  // O idioma da CONTA é o da música mais recente. É a única pista disponível
  // aqui: `/dashboard` não tem prefixo de rota, e quem compra nos dois funis
  // vê o painel na língua da última compra.
  const locale = musicas[0]?.locale === "es" ? ("es" as const) : ("pt" as const);
  const T = tp(locale);
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
      // NOME DE VERDADE, não o pedaço do e-mail.
      //
      // Isto mostrava "Olá, fenix bebidas" pra quem comprou com e-mail de
      // empresa. A Perfect Pay já manda o nome no webhook (99% dos pedidos
      // pagos têm), então é só buscar. O e-mail fica como reserva pra conta
      // que ainda não tem compra nenhuma.
      const email = sess.session.user.email ?? "";
      setNome(email.split("@")[0]);
      nomeDoComprador({ data: { email } })
        .then((r) => { if (vivo && r.nome) setNome(r.nome); })
        .catch(() => {});

      // RLS garante que só vêm as músicas DESTE usuário (auth.uid() = user_id).
      const { data } = await supabase
        .from("musicas")
        .select("id, titulo, status, token, token_edicao, genero, personalizada_em, locale, created_at")
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
          {nome ? T.ola(nome) : T.suasMusicas}
        </h1>
        <p
          className="mt-2 text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
        >
          {T.painelSub}
        </p>

        {carregando ? (
          <div className="mt-10 flex items-center gap-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> {T.carregando}
          </div>
        ) : musicas.length === 0 ? (
          <div className="mt-10 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]">
              <Music className="h-5 w-5" />
            </div>
            <p style={{ fontSize: "var(--t-base)" }}>{T.semMusicas}</p>
            {/* Mesmas duas regras do convite de recompra, pelos mesmos dois
                motivos: a rota SEGUE O IDIOMA da conta (este link mandava
                mexicano pro funil em português) e o store é limpo antes de
                sair (uma `letraFinal` velha de funil abandonado apareceria na
                revelação do quiz novo). */}
            <Link
              to={locale === "es" ? "/es/criar" : "/criar"}
              onClick={() => {
                novaSessao();
                reset();
              }}
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-full cta px-6 font-medium"
              style={{ fontSize: "var(--t-sm)" }}
            >
              <Plus className="h-4 w-4" /> {T.criarPrimeira}
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-3">
              {musicas.map((m) => {
                const st = {
                  texto: T.status[m.status] ?? m.status,
                  cor: COR_STATUS[m.status] ?? "text-[var(--tinta-suave)]",
                };
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
                          {m.titulo ?? T.suaMusica}
                        </p>
                        <p className={cn("mt-0.5", st.cor)} style={{ fontSize: "var(--t-xs)" }}>
                          {st.texto}
                          {m.genero ? ` · ${m.genero}` : ""}
                          {m.personalizada_em ? T.presenteMontado : ""}
                        </p>
                        <p
                          className="mt-0.5 text-[var(--tinta-suave)]"
                          style={{ fontSize: "var(--t-xs)" }}
                        >
                          {T.criadaEm} {QUANDO.format(new Date(m.created_at))}
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
                          <Pencil className="h-4 w-4" /> {T.montarBotao}
                        </Link>
                        <a
                          href={`/p/${m.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-5 transition-colors hover:border-[var(--tinta-suave)]"
                          style={{ fontSize: "var(--t-sm)" }}
                        >
                          <ExternalLink className="h-4 w-4" /> {T.verPagina}
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Este botão virou componente (ConviteOutraMusica) quando passou
                a existir também no editor e na tela de obrigado. As regras de
                sair pro funil (rotacionar sessão, limpar o store, respeitar o
                idioma) custaram três incidentes e não podem viver em três
                cópias, que divergem na primeira mudança. */}
            <ConviteOutraMusica locale={locale === "es" ? "es" : "pt"} origem="dashboard" />
          </>
        )}
      </main>
    </div>
  );
}
