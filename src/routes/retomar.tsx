import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { useQuizStore } from "@/lib/quiz-store";
import { TEMA_CLARO, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { normalizarLocale, caminho } from "@/lib/i18n";
import { trackEvent } from "@/lib/track";
import { novaSessao } from "@/lib/session-context";
import { Loader2 } from "lucide-react";

// RETOMAR A SESSÃO a partir de um link de e-mail.
//
// O e-mail da letra manda a pessoa "ouvir um trecho", e o destino natural
// seria `/criar?step=reveal`. Só que aquela tela lê a letra do localStorage:
// quem abre o e-mail no computador, ou num celular diferente, cairia em
// "Faltou a parte mais importante" — o pior desfecho possível pra um e-mail
// que existe justamente para trazer a pessoa de volta.
//
// Esta rota resolve pelo lado certo: busca no servidor pelo `session_id` que
// veio no link, reidrata o navegador (sessão + respostas + letra) e manda pro
// reveal. Dali pra frente tudo funciona igual a quem nunca saiu — inclusive o
// polling da música, que é por sessão.

// DEVOLVE O MOTIVO, não `null`.
//
// Em 14 dias, 152 sessões chegaram aqui e tiveram UM evento só: o page_view
// desta tela. Nada depois. Não dá pra saber se foram robôs de e-mail
// prefetchando o link, se a sessão não foi achada, ou se foi achada sem letra,
// porque o caminho de falha não registrava nada e as três causas devolviam o
// mesmo `null`.
//
// Três causas opostas com o mesmo silêncio é o que transforma um vazamento de
// 68% em palpite. Agora cada uma tem nome.
type Falha = "sessao_nao_achada" | "sem_letra";
const buscarSessao = createServerFn({ method: "POST" })
  .validator((data: { sessao: string }) => data)
  .handler(async ({ data }) => {
    const db = supabaseAdmin();
    const { data: lead } = await db
      .from("quiz_responses")
      .select("id, respostas, locale")
      .eq("session_id", data.sessao)
      .maybeSingle();
    if (!lead) return { erro: "sessao_nao_achada" as Falha };

    const { data: m } = await db
      .from("musicas")
      .select("titulo, letra, estilo_suno, verso_destaque")
      .eq("quiz_response_id", lead.id)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const locale = lead.locale === "es" ? ("es" as const) : ("pt" as const);
    if (!m?.letra) return { erro: "sem_letra" as Falha, locale };

    return {
      respostas: (lead.respostas ?? {}) as Record<string, string>,
      locale,
      letra: {
        titulo: m.titulo ?? "",
        letra: m.letra,
        estiloSuno: m.estilo_suno ?? "",
        versoDestaque: m.verso_destaque ?? "",
      },
    };
  });

const COPY = {
  pt: {
    indo: "abrindo a sua letra…",
    erro: "Não achei essa letra.",
    erroSub: "O link pode ter vindo cortado no e-mail. Você pode fazer uma nova em menos de dois minutos, de graça.",
    botao: "Criar minha música",
  },
  es: {
    indo: "abriendo tu letra…",
    erro: "No encontré esa letra.",
    erroSub: "El link pudo venir cortado en el correo. Puedes hacer una nueva en menos de dos minutos, gratis.",
    botao: "Crear mi canción",
  },
} as const;

export const Route = createFileRoute("/retomar")({
  validateSearch: (b: Record<string, unknown>) => ({
    s: typeof b.s === "string" ? b.s : undefined,
    // O cupom do e-mail de recuperação viaja daqui até o checkout.
    cupom: typeof b.cupom === "string" ? b.cupom : undefined,
  }),
  head: () => ({
    meta: [{ title: MARCA.nome }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Retomar,
});

function Retomar() {
  const { s, cupom } = Route.useSearch();
  const navigate = useNavigate();
  const [erro, setErro] = useState(false);
  const [locale, setLocale] = useState<"pt" | "es">("pt");

  useEffect(() => {
    if (!s) {
      trackEvent("retomar_falhou", { motivo: "link_sem_sessao" });
      setErro(true);
      return;
    }
    buscarSessao({ data: { sessao: s } })
      .then((r) => {
        if ("erro" in r) {
          trackEvent("retomar_falhou", { motivo: r.erro });
          if (r.locale) setLocale(r.locale);
          setErro(true);
          return;
        }
        trackEvent("retomar_ok", { locale: r.locale });
        setLocale(r.locale);

        // ADOTA a sessão do link. É o que faz o polling da música achar a
        // gravação certa, e o que amarra uma compra futura ao mesmo quiz.
        try {
          localStorage.setItem("mp_session_id", s);
        } catch {
          // Modo anônimo: o reveal ainda mostra a letra, só não acha o áudio.
        }

        const store = useQuizStore.getState();
        store.reset();
        for (const [k, v] of Object.entries(r.respostas)) store.setResposta(k, v);
        store.setLetraFinal(r.letra);
        // Guarda ANTES de navegar: a partir daqui a pessoa anda pelo funil e
        // o código precisa sobreviver até o botão de pagar.
        if (cupom) store.setCupom(cupom);

        navigate({ to: caminho("/criar", r.locale), search: { step: "reveal" } } as never);
      })
      .catch(() => {
        trackEvent("retomar_falhou", { motivo: "erro_de_rede" });
        setErro(true);
      });
  }, [s, navigate]);

  const C = COPY[normalizarLocale(locale)] ?? COPY.pt;

  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--papel)] px-6 text-center text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      <main className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo tamanho="md" />
        </div>
        {erro ? (
          <>
            <p style={{ fontSize: "var(--t-xl)" }}>{C.erro}</p>
            <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
              {C.erroSub}
            </p>
            {/* A tela era um beco sem saída: dizia "responda o e-mail" e acabava
                ali. Quem chega aqui clicou num e-mail nosso, ou seja, é a
                pessoa mais interessada que existe, e estava sendo devolvida
                pra lugar nenhum. O caminho de volta ao funil custa um botão. */}
            <button
              onClick={() => {
                trackEvent("retomar_recomecou", { locale });
                novaSessao();
                useQuizStore.getState().reset();
                navigate({ to: caminho("/criar", locale) } as never);
              }}
              className="cta mt-6 inline-flex h-12 items-center justify-center rounded-full px-8 font-medium"
              style={{ fontSize: "var(--t-base)" }}
            >
              {C.botao}
            </button>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> {C.indo}
          </p>
        )}
      </main>
    </div>
  );
}
