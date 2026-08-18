import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { scriptExperimentos, cssExperimentos } from "@/lib/experimentos";

import appCss from "../styles.css?url";
import {
  getOrCreateSessionId,
  captureFirstTouchAttribution,
  getDevice,
  getOrAssignVariant,
  stampVariantIntoAttribution,
} from "@/lib/session-context";
import { trackEvent } from "@/lib/track";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Essa página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Tente de novo ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Uma música feita da sua história" },
      {
        name: "description",
        content:
          "Conte a história de alguém querido e receba a letra de uma música personalizada na hora, de graça.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      // Favicon da marca (coração-ouro na noite, onda sonora vinho). SVG pros
      // navegadores modernos; PNG 32 e apple-touch pro resto e pra tela inicial.
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Poppins:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {/* TESTE A/B — precisa ser a PRIMEIRA coisa do <head>.
            O script sorteia a variante e carimba no <html>; o CSS esconde a
            que não saiu. Síncrono e antes de tudo porque, se rodasse depois do
            primeiro pixel, a pessoa veria a tela trocar na frente dela. É por
            isso que ele está escrito à mão e não importado: um <script src>
            seria uma ida à rede antes de qualquer pintura. */}
        <script dangerouslySetInnerHTML={{ __html: scriptExperimentos() }} />
        <style dangerouslySetInnerHTML={{ __html: cssExperimentos() }} />
      </head>
      <body className="bg-background text-foreground">
        {children}
        {/* Google Ads: sem esta tag o algoritmo não sabe quais cliques viraram
            venda e não consegue otimizar a campanha. A conversão em si dispara
            na /obrigado (src/lib/google-ads.ts). */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-16919557808"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-16919557808');`,
          }}
        />
        {/* UTMify NÃO fica aqui. Ver `carregarUtmify` mais abaixo: o script
            reescreve todo <a href> interno, e no HTML do servidor isso quebra
            a hidratação do React. */}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * CARREGA A UTMIFY DEPOIS DA HIDRATAÇÃO, e não no HTML do servidor.
 *
 * ── O BUG QUE ISTO CONSERTA ──────────────────────────────────────
 *
 * O script da UTMify reescreve TODO `<a href>` interno da página, colando
 * `?utm_source=organic&utm_campaign=&utm_medium=&utm_content=&utm_term=` em
 * cada um. Quando ele roda antes da hidratação, o React encontra `/criar` no
 * HTML que o servidor mandou e `/criar?utm_source=...` no DOM, declara
 * "hydration failed" e JOGA FORA a árvore inteira, remontando tudo no cliente.
 *
 * Achado no console em 19/08, na home e na página presente. O custo é maior
 * justamente onde dói: num Android lento, remontar a página inteira é uma
 * piscada e um punhado de segundos sem interatividade, e 99% do nosso tráfego
 * é celular.
 *
 * Efeito colateral que some junto: o link que a pessoa copia da barra de
 * endereço pra mandar no WhatsApp ia com UTMs vazias grudadas, e o
 * presenteado entrava carimbado como "organic".
 *
 * ── POR QUE ISTO NÃO QUEBRA A ATRIBUIÇÃO ─────────────────────────
 *
 * O que a gente usa da UTMify é o `localStorage.utmify_data`, lido lá na ida
 * pro checkout (`src/lib/checkout.ts`), que acontece minutos depois. Carregar
 * o script um tique mais tarde não muda nada nisso: os UTMs da URL continuam
 * lá pra ele ler.
 */
function carregarUtmify() {
  if (typeof document === "undefined") return;
  if (document.getElementById("utmify-utms")) return;
  // NÃO BASTA ESPERAR O ROOT MONTAR. As rotas são carregadas em `lazy`, então
  // elas hidratam DEPOIS do root: um script que já esteja reescrevendo links
  // pega a próxima rota no meio da hidratação e o problema volta, só que mais
  // difícil de enxergar. Esperar o navegador ficar ocioso cobre todas.
  //
  // Atrasar não custa nada aqui: o que a gente lê dele é o
  // `localStorage.utmify_data` na ida pro checkout, que acontece minutos
  // depois, e os UTMs continuam na URL o tempo todo.
  const s = document.createElement("script");
  s.id = "utmify-utms";
  s.src = "https://cdn.utmify.com.br/scripts/utms/latest.js";
  s.async = true;
  s.defer = true;
  s.setAttribute("data-utmify-prevent-xcod-sck", "");
  s.setAttribute("data-utmify-prevent-subids", "");
  const injetar = () => document.body.appendChild(s);
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback(injetar, { timeout: 4000 });
  } else {
    setTimeout(injetar, 2500);
  }
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Inicializa o contexto de sessão: sessionId, atribuição first-touch,
    // bucket de device. Capturado uma vez no primeiro mount, persiste entre rotas.
    getOrCreateSessionId();
    captureFirstTouchAttribution();
    getDevice();
    // A/B: resolve a variante sticky e carimba em mp_attribution ANTES do
    // primeiro page_view, para todo funnel_event carregar attribution.variant.
    const variant = getOrAssignVariant();
    stampVariantIntoAttribution(variant);
    trackEvent("page_view", { is_landing: true });
    // DEPOIS de tudo montado. Ver o comentário de `carregarUtmify`: rodando
    // antes da hidratação ele quebrava a página inteira.
    carregarUtmify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const router = useRouter();
  React.useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", ({ toLocation }) => {
      trackEvent("page_view", { path: toLocation.pathname });
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
