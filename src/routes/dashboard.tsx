import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { tp } from "@/lib/textos-presente";
import { Logo } from "@/components/marca/Logo";
import { cn } from "@/lib/utils";
import { novaSessao } from "@/lib/session-context";
import { ConviteOutraMusica } from "@/components/conta/ConviteOutraMusica";
import { useQuizStore } from "@/lib/quiz-store";
import { nomeDoComprador } from "@/lib/nome-comprador";
import { meusCreditos } from "@/lib/meus-creditos";
import { meusQuadros } from "@/lib/meus-quadros";
import { BlocoCreditos } from "@/components/conta/BlocoCreditos";
import { BlocoQuadro } from "@/components/conta/BlocoQuadro";
import {
  Loader2, Pencil, ExternalLink, Plus, LogOut, Music, Sparkles, Frame, Lock, ChevronRight,
} from "lucide-react";

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
  const [email, setEmail] = useState<string>("");
  const [saldo, setSaldo] = useState<number | null>(null);
  const [quadros, setQuadros] = useState(0);
  // ── AS DUAS ABAS ────────────────────────────────────────────────
  //
  // O painel estava ordenado pela NOSSA prioridade (vender) e não pela dela
  // (ver o que é dela): a oferta ocupava a primeira tela inteira e as músicas
  // ficavam abaixo de tudo, atrás de muita rolagem. Num painel, o conteúdo da
  // pessoa vem primeiro; a oferta tem lugar, não tem precedência.
  //
  // Abre em "músicas" de propósito. E as abas não substituem a faixa do quadro
  // comprado, que fica ACIMA delas: produto pago que espera não pode ficar
  // escondido dentro de aba nenhuma.
  const [aba, setAba] = useState<"musicas" | "criar" | "quadro">("musicas");
  // ── A ESPERA DO PIX ─────────────────────────────────────────────
  //
  // Medido no teste de 18/08: 64 segundos entre gerar o Pix e o webhook
  // aprovar. Quem aperta o botão da Perfect Pay na hora chega aqui ANTES do
  // crédito existir, e a tela dizia "você não tem créditos" pra quem tinha
  // acabado de pagar. É o pior momento possível pra ela duvidar da gente.
  //
  // Então quando ela vem da compra a página fica PROCURANDO por 90 segundos,
  // dizendo que está confirmando, e para no instante em que o crédito chega.
  const [confirmandoPix, setConfirmandoPix] = useState(false);
  // ── AS OFERTAS SAO BR-ONLY, POR ENQUANTO ──────────────────────────
  //
  // Os tres upsells existem so na Perfect Pay BR, cobrados em real. Mostrar
  // "R$ 67" pra quem comprou em dolar oferece um produto que ela nao consegue
  // comprar direito, e o preco nem faz sentido na cabeca dela.
  //
  // Espera `carregando` de proposito: o idioma sai da musica mais recente, e
  // enquanto a lista nao chega `locale` cai no "pt" por padrao. Sem essa
  // trava, o mexicano veria o bloco em real piscar antes de sumir.
  //
  // Quando o LATAM ganhar os produtos, isto vira `true` pros dois e o
  // BlocoCreditos ja tem o texto em espanhol pronto.
  //
  // E exige ter PELO MENOS UMA musica: sem nenhuma, o idioma cai no "pt" por
  // falta de pista, e "Quem mais merece uma?" sairia pra quem nao fez nem a
  // primeira. Essa conta ve o convite de criar a primeira, que ja existe.
  const temOfertas = !carregando && musicas.length > 0 && locale === "pt";

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
      const token = sess.session.access_token;
      setNome(email.split("@")[0]);
      setEmail(email);
      nomeDoComprador({ data: { token } })
        .then((r) => { if (vivo && r.nome) setNome(r.nome); })
        .catch(() => {});
      // O saldo NÃO bloqueia a lista de músicas: se o razão falhar, ela ainda
      // vê o que comprou. Bloco de venda quebrado não pode esconder produto
      // entregue.
      meusCreditos({ data: { token } })
        .then((c) => { if (vivo) setSaldo(c.saldo); })
        .catch(() => { if (vivo) setSaldo(0); });
      // O QUADRO COMPRADO E NÃO MONTADO. Também não bloqueia a lista: produto
      // parado é urgente de mostrar, mas não a ponto de esconder o que ela já
      // recebeu se a consulta cair.
      meusQuadros({ data: { token } })
        .then((q) => { if (vivo) setQuadros(q.paraMontar); })
        .catch(() => {});

      // VEIO DA COMPRA? Duas pistas, porque nenhuma sozinha é confiável: o
      // `?novo=1` que a gente põe na URL de obrigado da Perfect Pay, e o
      // referrer, que cobre o caso de alguém mexer nessa configuração e
      // esquecer o parâmetro.
      const veioDaCompra =
        new URLSearchParams(window.location.search).get("novo") === "1" ||
        /perfectpay/i.test(document.referrer || "");
      if (veioDaCompra) {
        setConfirmandoPix(true);
        const ate = Date.now() + 90_000;
        const bater = async () => {
          if (!vivo) return;
          const [c, q] = await Promise.all([
            meusCreditos({ data: { token } }).catch(() => null),
            meusQuadros({ data: { token } }).catch(() => null),
          ]);
          if (!vivo) return;
          if (c) setSaldo(c.saldo);
          if (q) setQuadros(q.paraMontar);
          // Chegou alguma coisa, ou o tempo acabou: para de procurar.
          if ((c?.saldo ?? 0) > 0 || (q?.paraMontar ?? 0) > 0 || Date.now() > ate) {
            setConfirmandoPix(false);
            return;
          }
          setTimeout(bater, 5000);
        };
        setTimeout(bater, 4000);
      }

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
          <div className="flex items-center gap-4">
            {/* O CONTADOR, no cabeçalho. Fica aqui porque é o único lugar que
                continua na tela enquanto ela rola a lista de músicas, e
                porque saldo que ela não vê é saldo que ela não usa. */}
            {temOfertas && saldo !== null && saldo > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--acento)]/12 px-3 py-1 font-medium text-[var(--acento)]"
                style={{ fontSize: "var(--t-xs)" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {saldo} {saldo === 1 ? T.credito : T.creditos}
              </span>
            )}
            <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 text-[var(--tinta-suave)] transition-colors hover:text-[var(--tinta)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <LogOut className="h-4 w-4" /> sair
            </button>
          </div>
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

        {/* CONFIRMANDO O PAGAMENTO. Fica acima de tudo enquanto procura, pra
            ninguém que acabou de pagar ler "você não tem créditos". */}
        {confirmandoPix && (
          <div className="mt-5 flex items-center gap-3 rounded-[var(--raio)] border border-[var(--acento)]/40 bg-[var(--acento)]/[0.06] p-4">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--acento)]" />
            <span style={{ fontSize: "var(--t-sm)", lineHeight: 1.45 }}>{T.confirmandoPix}</span>
          </div>
        )}

        {/* A FAIXA DO QUADRO COMPRADO, acima das abas.
            Fina de propósito: é um lembrete, não uma oferta. */}
        {temOfertas && quadros > 0 && (
          <a
            href="/meu-quadro"
            className="mt-5 flex items-center gap-3 rounded-[var(--raio)] border border-[var(--acento)]/45 bg-[var(--acento)]/[0.07] p-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)]/15 text-[var(--acento)]">
              <Frame className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 font-medium" style={{ fontSize: "var(--t-sm)" }}>
              {quadros === 1 ? T.quadroPronto1 : T.quadroPronto(quadros)}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[var(--acento)]" />
          </a>
        )}

        {/* ── AS ABAS ────────────────────────────────────────────
            Grudadas no topo ao rolar: é o que separa um painel de uma página
            que se desce. Só no BR, porque no ES não existe o que ofertar e uma
            aba com uma opção só é um enfeite que confunde. */}
        {temOfertas && (
          <div className="sticky top-0 z-20 -mx-6 mt-6 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/97 px-6 backdrop-blur-md">
            <div className="flex gap-1">
              {([
                ["musicas", T.abaMusicas, musicas.length, ""],
                ["criar", T.abaCriar, 0, T.seloDesconto],
                ["quadro", T.abaQuadro, quadros, ""],
              ] as const).map(([chave, rotulo, quantos, selo]) => (
                <button
                  key={chave}
                  onClick={() => setAba(chave)}
                  className={
                    "relative flex h-12 flex-1 items-center justify-center gap-1.5 font-medium transition-colors " +
                    (aba === chave ? "text-[var(--acento)]" : "text-[var(--tinta-suave)]")
                  }
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  {rotulo}
                  {/* O SELO NA ABA. Ela precisa de um motivo pra tocar numa
                      aba que vende, e "com desconto" é esse motivo, dito no
                      lugar onde a decisão de tocar acontece. */}
                  {selo && (
                    <span
                      className="rounded-full bg-[var(--acento)] px-1.5 py-0.5 font-semibold text-white"
                      style={{ fontSize: "10px" }}
                    >
                      {selo}
                    </span>
                  )}
                  {quantos > 0 && (
                    <span
                      className="rounded-full bg-[var(--tinta-fraca)]/25 px-1.5 py-0.5"
                      style={{ fontSize: "var(--t-xs)" }}
                    >
                      {quantos}
                    </span>
                  )}
                  {aba === chave && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--acento)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {temOfertas && aba === "criar" && saldo !== null && email && (
          <BlocoCreditos saldo={saldo} locale={locale} email={email} />
        )}

        {temOfertas && aba === "quadro" && email && (
          <BlocoQuadro paraMontar={quadros} locale={locale} email={email} />
        )}

        {temOfertas && aba !== "musicas" ? null : carregando ? (
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
            {/* O BOTÃO DE CRIAR, SEMPRE VISÍVEL, no topo da lista.
                Com crédito ele cria. Sem crédito ele ganha cadeado e leva pra
                aba de comprar, em vez de morrer no toque: botão morto não
                ensina nada, e mandar pro preço cheio era exatamente o que a
                gente tirou daqui. */}
            {temOfertas && saldo !== null && (
              saldo > 0 ? (
                <Link
                  to="/criar"
                  search={{ credito: 1 } as never}
                  onClick={() => {
                    // Sessão nova e store limpo: as duas regras que custaram
                    // três incidentes. Ver ConviteOutraMusica.
                    novaSessao();
                    reset();
                  }}
                  className="cta mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  <Plus className="h-4 w-4" /> {T.criarComCredito(saldo)}
                </Link>
              ) : (
                <button
                  onClick={() => setAba("criar")}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-[var(--tinta-fraca)] text-[var(--tinta-suave)] transition-colors hover:border-[var(--tinta-suave)]"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  <Lock className="h-4 w-4" /> {T.criarSemCredito}
                </button>
              )
            )}

            <ul className="mt-5 space-y-3">
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
          </>
        )}

        {/* O CONVITE ANTIGO, agora SO no ES. No BR ele sumiu porque mandava
            pro funil no preco cheio mesmo com credito na conta. No ES nao
            existe credito nenhum pra atropelar, e sem ele o painel de la
            ficaria sem nenhum caminho pra criar outra musica. */}
        {!carregando && !temOfertas && musicas.length > 0 && (
          <ConviteOutraMusica locale="es" origem="dashboard" />
        )}
      </main>
    </div>
  );
}
