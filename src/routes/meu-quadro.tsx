import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { meusQuadros, confirmarQuadro, type MeusQuadros } from "@/lib/meus-quadros";
import { OFERTAS, TEXTO_OFERTA } from "@/lib/creditos";
import { trackEvent } from "@/lib/track";
import {
  Loader2, Check, Printer, Frame, Eye, ArrowLeft, ArrowRight, AlertCircle,
} from "lucide-react";

// MONTAR O QUADRO: escolher de qual música ele é, antes de gastar.
//
// ── O PROBLEMA QUE ESTA TELA RESOLVE ─────────────────────────────
//
// Quem compra o pacote de três músicas tem três. O quadro é UM. Sem uma tela
// de escolha, a única saída era o link do editor de alguma delas, e a pessoa
// teria que adivinhar qual link corresponde a qual música (os títulos se
// repetem: o título é da canção, não do arquivo). Escolher errado gastaria o
// quadro na música errada.
//
// ── A REGRA DO GASTO, DITA NA TELA ANTES DE ACONTECER ────────────
//
// Ela troca de música quantas vezes quiser e vê a prévia de cada uma. Nada é
// gasto até apertar confirmar, e o que confirmar faz está escrito ao lado do
// botão, não num rodapé. Depois de confirmado ela ainda edita título,
// dedicatória, cor e fundo: o que trava é a MÚSICA.
//
// ── DESENHO ──────────────────────────────────────────────────────
//
// Uma coluna, alvos de toque grandes, um passo por vez e uma frase por ideia.
// Quem compra aqui não navega bem em site: se a tela pedir interpretação, ela
// escreve pro suporte em vez de concluir. Por isso cada bloco responde uma
// pergunta só, na ordem em que ela faz: o que é isso, de qual música, e agora.

export const Route = createFileRoute("/meu-quadro")({
  head: () => ({
    meta: [
      { title: `Montar o quadro · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MeuQuadro,
});

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const QUANDO_ES = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "America/Mexico_City",
});

// O IDIOMA sai da conta (a música mais recente), não da rota: `/meu-quadro`
// não tem prefixo de onde deduzir, e quem comprou no funil mexicano chega
// aqui pelo mesmo caminho.
const TXT = {
  pt: {
    voltar: "minhas músicas",
    carregando: "carregando...",
    tituloMontar: "Monte o seu quadro",
    tituloSem: "O quadro da música",
    oQueE:
      "A letra da música e a foto de vocês numa folha A4, com o QR Code que toca a música. Você salva em PDF aqui, manda imprimir numa gráfica ou na sua impressora, compra uma moldura de A4 e pendura na parede.",
    verPronto: "Ver um quadro pronto",
    meusUm: "Seu quadro",
    meusVarios: "Seus quadros",
    abrir: "Abrir e imprimir",
    escolhaVarias: "De qual música é o seu quadro?",
    escolhaUma: "A música do seu quadro",
    escolhaSubVarias:
      "Toque na música que você quer no papel. Dá pra ver como fica antes de decidir, e trocar quantas vezes quiser.",
    escolhaSubUma: "Veja como fica e confirme quando estiver bom.",
    todasTem:
      "Todas as suas músicas já têm quadro. Crie uma música nova pra usar este quadro nela.",
    verComoFica: "Ver como fica esta",
    para: (n: string) => `para ${n} · `,
    semFoto: " · sem foto ainda",
    avisoSemFoto:
      "Esta música ainda não tem foto. O quadro fica bonito sem foto, mas se você quiser a foto de vocês nele, coloque antes na página presente: ela é a mesma foto.",
    semDireito: "Você não tem nenhum quadro pra montar agora.",
    erroGeral: "Não deu pra confirmar agora. Tente de novo daqui a pouco.",
    naoTem: "Você ainda não tem um quadro",
    indisponivel: "",
    naoTemSub:
      "Cada quadro vale por uma música. Depois de comprar, você volta aqui e escolhe qual delas vai pro papel.",
    trava:
      "Depois de confirmar, este quadro fica sendo o desta música. A cor, o fundo e os textos você ainda muda quando quiser.",
    confirmar: "Confirmar e montar meu quadro",
    confirmando: "confirmando...",
  },
  es: {
    voltar: "mis canciones",
    carregando: "cargando...",
    tituloMontar: "Arma tu cuadro",
    tituloSem: "El cuadro de la canción",
    oQueE:
      "La letra de la canción y su foto en una hoja A4, con el código QR que reproduce la canción. La guardas en PDF aquí, la mandas a imprimir en una imprenta o en tu impresora, compras un marco A4 y la cuelgas en la pared.",
    verPronto: "Ver un cuadro terminado",
    meusUm: "Tu cuadro",
    meusVarios: "Tus cuadros",
    abrir: "Abrir e imprimir",
    escolhaVarias: "¿De cuál canción es tu cuadro?",
    escolhaUma: "La canción de tu cuadro",
    escolhaSubVarias:
      "Toca la canción que quieres en el papel. Puedes ver cómo queda antes de decidir, y cambiar todas las veces que quieras.",
    escolhaSubUma: "Mira cómo queda y confirma cuando esté bien.",
    todasTem:
      "Todas tus canciones ya tienen cuadro. Crea una canción nueva para usar este cuadro en ella.",
    verComoFica: "Ver cómo queda esta",
    para: (n: string) => `para ${n} · `,
    semFoto: " · todavía sin foto",
    avisoSemFoto:
      "Esta canción todavía no tiene foto. El cuadro queda bonito sin foto, pero si quieres la foto de ustedes en él, ponla antes en la página regalo: es la misma foto.",
    semDireito: "No tienes ningún cuadro para armar ahora.",
    erroGeral: "No pudimos confirmar ahora. Inténtalo de nuevo en un momento.",
    naoTem: "Todavía no tienes un cuadro",
    // NÃO EXISTE PRODUTO DE QUADRO NO MÉXICO. Não é tradução pendente: é
    // produto que não foi criado. Enquanto não existir, esta tela não oferece
    // nada e não mostra preço nenhum.
    indisponivel: "El cuadro todavía no está disponible en tu país. Te avisamos por correo cuando lo esté.",
    naoTemSub:
      "Cada cuadro vale por una canción. Después de comprar, vuelves aquí y eliges cuál de ellas va al papel.",
    trava:
      "Después de confirmar, este cuadro queda siendo el de esta canción. El color, el fondo y los textos todavía los cambias cuando quieras.",
    confirmar: "Confirmar y armar mi cuadro",
    confirmando: "confirmando...",
  },
};

function MeuQuadro() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<MeusQuadros | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const oferta = OFERTAS.find((o) => o.id === "quadro");
  const locale = dados?.locale === "es" ? ("es" as const) : ("pt" as const);
  const t = TXT[locale];
  const txt = TEXTO_OFERTA[locale].quadro;
  // A data em pt-BR e es-MX: dd/mm nos dois, mas a ordem e o separador do
  // Intl mudam, e data com cara de estrangeira é ruído numa tela de escolha.
  const quando = locale === "es" ? QUANDO_ES : QUANDO;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!sess.session) {
        navigate({ to: "/login" });
        return;
      }
      const r = await meusQuadros({ data: { token: sess.session.access_token } });
      if (!vivo) return;
      setDados(r);
      // Uma música só: já vem escolhida. Pedir pra escolher entre uma coisa é
      // um passo que só existe pra ser cumprido.
      const livres = r.musicas.filter((m) => !m.jaTemQuadro);
      if (livres.length === 1) setEscolhida(livres[0].id);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [navigate]);

  async function confirmar() {
    if (!escolhida) return;
    setConfirmando(true);
    setErro(null);
    const { data: sess } = await supabase.auth.getSession();
    const tk = sess.session?.access_token;
    if (!tk) {
      navigate({ to: "/login" });
      return;
    }
    const r = await confirmarQuadro({ data: { token: tk, musicaId: escolhida } });
    if (r.ok) {
      trackEvent("quadro_confirmado", { musica: escolhida });
      window.location.href = `/quadro/${r.tokenEdicao}?de=montar`;
      return;
    }
    setErro(
      r.erro === "sem-direito" ? t.semDireito : t.erroGeral,
    );
    setConfirmando(false);
  }

  const musicas = dados?.musicas ?? [];
  const disponiveis = musicas.filter((m) => !m.jaTemQuadro);

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <header className="border-b border-[var(--tinta-fraca)]/30">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Logo tamanho="sm" />
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-[var(--tinta-suave)] transition-colors hover:text-[var(--tinta)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <ArrowLeft className="h-4 w-4" /> {t.voltar}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 pb-32">
        {carregando ? (
          <div className="flex items-center gap-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> {t.carregando}
          </div>
        ) : (
          <>
            <h1
              className="text-balance"
              style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
            >
              {dados && dados.paraMontar > 0 ? t.tituloMontar : t.tituloSem}
            </h1>

            {/* ── O QUE É, EM UMA FRASE E UMA IMAGEM MENTAL ──────
                "Folha A4 com a letra" não desenha nada na cabeça de ninguém.
                O que desenha é o que ela vai FAZER com aquilo: imprimir,
                comprar uma moldura, pendurar. */}
            <div className="mt-4 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--acento)]/12 text-[var(--acento)]">
                  <Frame className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                    {txt.titulo}
                  </p>
                  <p className="mt-1.5 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
                    {t.oQueE}
                  </p>
                </div>
              </div>
              <a
                href="/quadro/exemplo?de=montar"
                onClick={() => trackEvent("quadro_exemplo_click", { origem: "meu-quadro" })}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--tinta-fraca)] font-medium transition-colors hover:border-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)" }}
              >
                <Eye className="h-4 w-4" /> {t.verPronto}
              </a>
            </div>

            {/* ── OS QUADROS QUE ELA JÁ MONTOU ──────────────────── */}
            {dados && dados.prontos.length > 0 && (
              <section className="mt-8">
                <h2 className="font-medium" style={{ fontFamily: FONTES.display, fontSize: "var(--t-lg)" }}>
                  {dados.prontos.length === 1 ? t.meusUm : t.meusVarios}
                </h2>
                <ul className="mt-3 space-y-3">
                  {dados.prontos.map((q) => (
                    <li
                      key={q.id}
                      className="rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4"
                    >
                      <p className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                        {q.titulo}
                      </p>
                      <a
                        href={`/quadro/${q.tokenEdicao}?de=montar`}
                        className="cta mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium"
                        style={{ fontSize: "var(--t-sm)" }}
                      >
                        <Printer className="h-4 w-4" /> {t.abrir}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── A ESCOLHA ─────────────────────────────────────── */}
            {dados && dados.paraMontar > 0 && (
              <section className="mt-8">
                <h2 className="font-medium" style={{ fontFamily: FONTES.display, fontSize: "var(--t-lg)" }}>
                  {disponiveis.length > 1 ? t.escolhaVarias : t.escolhaUma}
                </h2>
                <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
                  {disponiveis.length > 1 ? t.escolhaSubVarias : t.escolhaSubUma}
                </p>

                {disponiveis.length === 0 ? (
                  <p className="mt-4 rounded-[var(--raio)] border border-[var(--tinta-fraca)]/40 p-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
                    {t.todasTem}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {disponiveis.map((m) => {
                      const ativa = escolhida === m.id;
                      return (
                        <li key={m.id}>
                          {/* O CARD INTEIRO É O BOTÃO. Alvo de toque de 72px
                              pra cima: no celular, um rádio de 20px ao lado do
                              texto é onde a pessoa erra e desiste. */}
                          <button
                            onClick={() => {
                              setEscolhida(m.id);
                              trackEvent("quadro_musica_escolhida");
                            }}
                            className={
                              "flex w-full items-center gap-3 rounded-[var(--raio)] border p-4 text-left transition-colors " +
                              (ativa
                                ? "border-[var(--acento)] bg-[var(--acento)]/[0.07]"
                                : "border-[var(--tinta-fraca)]/40")
                            }
                          >
                            <span
                              className={
                                "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 " +
                                (ativa
                                  ? "border-[var(--acento)] bg-[var(--acento)] text-white"
                                  : "border-[var(--tinta-fraca)]")
                              }
                            >
                              {ativa && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium" style={{ fontSize: "var(--t-base)" }}>
                                {m.titulo}
                              </span>
                              <span
                                className="block text-[var(--tinta-suave)]"
                                style={{ fontSize: "var(--t-xs)" }}
                              >
                                {m.para ? t.para(m.para) : ""}
                                {quando.format(new Date(m.criadaEm))}
                                {m.temFoto ? "" : t.semFoto}
                              </span>
                            </span>
                          </button>

                          {/* A PRÉVIA da escolhida, logo abaixo dela: é a
                              resposta à pergunta que ela acabou de fazer, e
                              não um link perdido no fim da página. */}
                          {ativa && (
                            <a
                              // MESMA ABA, de propósito. Aba nova é beco sem
                              // saída pra quem não sabe alternar entre abas
                              // no celular, e o `?de=montar` é o que faz a
                              // prévia saber pra onde ela volta.
                              href={`/quadro/${m.tokenEdicao}?de=montar`}
                              onClick={() => trackEvent("quadro_previa_click")}
                              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--tinta-fraca)] font-medium transition-colors hover:border-[var(--tinta-suave)]"
                              style={{ fontSize: "var(--t-sm)" }}
                            >
                              <Eye className="h-4 w-4" /> {t.verComoFica}
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!m_temFoto(disponiveis, escolhida) && escolhida && (
                  <p className="mt-4 flex items-start gap-2 rounded-[var(--raio)] border border-amber-500/30 bg-amber-50 p-3 text-amber-900" style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}>
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t.avisoSemFoto}
                    </span>
                  </p>
                )}

                {erro && (
                  <p className="mt-4 rounded-[var(--raio)] border border-amber-500/30 bg-amber-50 p-3 text-amber-900" style={{ fontSize: "var(--t-sm)" }}>
                    {erro}
                  </p>
                )}
              </section>
            )}

            {/* ── NÃO COMPROU ──────────────────────────────────── */}
            {/* NO ES A TELA NÃO VENDE. O produto do quadro só existe na
                Perfect Pay BR, cobrado em real: oferecer aqui mostraria um
                preço em R$ pra quem comprou em dólar e levaria a um checkout
                que não é dela. Enquanto o produto não for criado lá, a tela
                diz isso e para. */}
            {dados && dados.paraMontar === 0 && dados.prontos.length === 0 && locale === "es" && (
              <section className="mt-8 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-5 text-center">
                <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
                  {t.indisponivel}
                </p>
                <Link
                  to="/dashboard"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--tinta-fraca)] font-medium"
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  <ArrowLeft className="h-4 w-4" /> {t.voltar}
                </Link>
              </section>
            )}

            {dados && dados.paraMontar === 0 && dados.prontos.length === 0 && locale === "pt" && oferta && (
              <section className="mt-8 rounded-[var(--raio-lg)] border border-[var(--acento)]/40 bg-[var(--acento)]/5 p-5 text-center">
                <p className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                  {t.naoTem}
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}>
                  {t.naoTemSub}
                </p>
                <p className="mt-4 font-semibold text-[var(--acento)]" style={{ fontSize: "var(--t-2xl)" }}>
                  R$ {oferta.precoBrl.toFixed(2).replace(".", ",")}
                </p>
                <a
                  href={oferta.checkout}
                  onClick={() => trackEvent("credito_oferta_click", { oferta: "quadro", origem: "meu-quadro" })}
                  className="cta mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 font-medium"
                >
                  {txt.cta} <ArrowRight className="h-4 w-4" />
                </a>
              </section>
            )}
          </>
        )}
      </main>

      {/* ── A BARRA DE CONFIRMAR ───────────────────────────────
          Fixa embaixo porque no celular a lista de músicas empurra o botão
          pra fora da tela, e botão que exige rolar é botão que não é apertado.
          A frase do que vai acontecer fica GRUDADA nele: "confirmar" sozinho
          não diz que a escolha trava. */}
      {dados && dados.paraMontar > 0 && disponiveis.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/97 backdrop-blur-md">
          <div className="mx-auto max-w-2xl px-5 py-3">
            <p className="text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)", lineHeight: 1.4 }}>
              {t.trava}
            </p>
            <button
              onClick={confirmar}
              disabled={!escolhida || confirmando}
              className="cta mt-2 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border-0 font-medium disabled:opacity-45"
              style={{ height: "3.25rem" }}
            >
              {confirmando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.confirmando}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> {t.confirmar}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A escolhida tem foto? Fora do componente pra a condição do aviso ler bem. */
function m_temFoto(lista: MeusQuadros["musicas"], id: string | null): boolean {
  if (!id) return true;
  return lista.find((m) => m.id === id)?.temFoto ?? true;
}
