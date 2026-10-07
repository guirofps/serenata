import { scriptPularAbertura } from "@/lib/abertura-en";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import {
  scriptExperimentos,
  cssExperimentos,
  scriptConfigGlobal,
  configAtual,
} from "@/lib/experimentos";

import appCss from "../styles.css?url";
import {
  getOrCreateSessionId,
  captureFirstTouchAttribution,
  getDevice,
  getOrAssignVariant,
  stampVariantIntoAttribution,
  carimbarIndicacao,
} from "@/lib/session-context";
import { trackEvent } from "@/lib/track";
import { PREFIXOS, rotaSensivel } from "@/lib/rotas-sensiveis";
import { GA4_ID, scriptGuardaGa4 } from "@/lib/ga4";
import { TIKTOK_PIXEL_ID, scriptTiktok } from "@/lib/tiktok-pixel";
import { GOOGLE_ADS_ID } from "@/lib/google-ads";
import { LOCALE_PADRAO, TAG_IDIOMA } from "@/lib/i18n";
import { FONTES, MARCA } from "@/lib/marca";
import { rotaDeConversao, scriptCarregaGtag, scriptDepoisDaPagina, scriptFontes } from "@/lib/carregar-depois";
import { guardarCupomDaUrl } from "@/lib/cupom-url";
import { useQuizStore } from "@/lib/quiz-store";

// ── O QUE NÃO EXISTE NA BALLAD GIFT ───────────────────────────────
//
// O mesmo código serve os dois sites, então as rotas da Serenata também
// existem no domínio da Ballad: a home espanhola, a landing de SEO em
// português, o link de influencer, o quadro e o PIX. Abertas lá, mostrariam
// português (ou espanhol) com a marca americana. Na Ballad elas voltam pra
// home; na Serenata esta lista não faz nada.
const SO_DA_SERENATA =
  /^\/(es(\/|$)|gleysi|musica-personalizada-para-esposa|indique|meu-quadro|quadro\/|pix\/|oferta\/|credito\/|demo-musica|marca)/;

const NAO_ACHEI_EN = {
  titulo: "Page not found",
  texto: "The page you're looking for doesn't exist or has moved.",
  voltar: "Back to home",
  erroTitulo: "This page didn't load",
  erroTexto: "Something went wrong on our end. Try again or go back home.",
  tentar: "Try again",
};

function NotFoundComponent() {
  const en = LOCALE_PADRAO === "en";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {en ? NAO_ACHEI_EN.titulo : "Página não encontrada"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {en ? NAO_ACHEI_EN.texto : "A página que você procura não existe ou foi movida."}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {en ? NAO_ACHEI_EN.voltar : "Voltar ao início"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const en = LOCALE_PADRAO === "en";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {en ? NAO_ACHEI_EN.erroTitulo : "Essa página não carregou"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {en ? NAO_ACHEI_EN.erroTexto : "Algo deu errado do nosso lado. Tente de novo ou volte para o início."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {en ? NAO_ACHEI_EN.tentar : "Tentar de novo"}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {en ? NAO_ACHEI_EN.voltar : "Voltar ao início"}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (LOCALE_PADRAO === "en" && SO_DA_SERENATA.test(location.pathname)) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // `interactive-widget=resizes-content` EXISTE POR CAUSA DO BOTÃO CONTINUAR.
      //
      // O rodapé do quiz é `sticky bottom-0`, e sticky se ancora no viewport de
      // LAYOUT. O teclado do celular, por padrão (`resizes-visual`), encolhe só
      // o viewport VISUAL — o de layout continua com a altura inteira. Resultado
      // nos passos de digitar (nome, historia1, historia2, recado, contato): a
      // barra fica grudada num rodapé que está ATRÁS do teclado.
      //
      // O sintoma que isso produz é o relatado: "às vezes clico e vai, às vezes
      // preciso clicar 2 ou 3 vezes". O primeiro toque fecha o teclado, o layout
      // se refaz, e só o segundo alcança o botão. É aleatório porque depende de
      // o teclado estar aberto, ou seja, do passo e de onde a pessoa tocou.
      //
      // O que descartou as outras hipóteses: `continuar_bloqueado` (disparado
      // quando o toque CHEGA num botão sem resposta) marcou ZERO numa hora com
      // 18 pessoas finalizando. Toque que chega registra; o que não registra é
      // toque que não chega. E localmente, com clique sintético, os passos
      // avançaram sempre de primeira, inclusive sem espera nenhuma — o que
      // elimina estado atrasado e elimina o `disabled`.
      //
      // Com `resizes-content` o viewport de layout encolhe junto com o teclado
      // e a barra passa a parar em cima dele. Vale no Chrome Android (a maior
      // parte do tráfego BR); o iOS ignora e é medido pelo evento
      // `botao_atras_do_teclado`, no Quiz.
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
      },
      // O título e a descrição de quem não define os seus. Por marca: na Ballad
      // Gift (EUA) a aba do navegador dizia português em toda página sem head.
      ...(LOCALE_PADRAO === "en"
        ? [
            { title: `${MARCA.nome} · A song made from your story` },
            {
              name: "description",
              content:
                "Tell the story of someone you love and get the lyrics to a personalized song in seconds, free.",
            },
          ]
        : [
            { title: "Uma música feita da sua história" },
            {
              name: "description",
              content:
                "Conte a história de alguém querido e receba a letra de uma música personalizada na hora, de graça.",
            },
          ]),
      { property: "og:type", content: "website" },
    ],
    links: [
      // Favicon da marca (coração-ouro na noite, onda sonora vinho). SVG pros
      // navegadores modernos; PNG 32 e apple-touch pro resto e pra tela inicial.
      // A Ballad Gift (EUA) tem os dela em `public/ballad/`.
      ...(MARCA.chave === "ballad"
        ? [
            { rel: "icon", href: "/ballad/favicon-32.png", type: "image/png", sizes: "32x32" },
            { rel: "apple-touch-icon", href: "/ballad/apple-touch-icon.png" },
          ]
        : [
            { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
            { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
            { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
          ]),
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      // A folha da Google Fonts NÃO entra aqui: `<link rel=stylesheet>` no HTML
      // trava a pintura (~0,8s no celular). Ela vem por script no <head>
      // (`scriptFontes`, logo abaixo), que não trava.
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // ONDE ESTAMOS, pra decidir se o script do Google entra. Ver
  // `rotas-sensiveis.ts`: a URL de `/editar/<token_edicao>` É a autorização, e
  // o gtag manda a URL inteira pro Google em `page_location`.
  //
  // Lido aqui, no servidor, e não num efeito do cliente: quem abre o editor
  // chega DIRETO pelo link do e-mail, então é o primeiro HTML que importa —
  // gating só no cliente chegaria tarde.
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const podeMedir = !rotaSensivel(caminho);
  // Na página da venda, os pixels carregam na hora (ver `carregar-depois.ts`).
  const imediato = rotaDeConversao(caminho);
  // A config isomórfica: no servidor vem do snapshot em memória (mantido
  // fresco pelo middleware, ver `src/start.ts`); no cliente, do
  // `window.__SRN_CFG__` que o <script> logo abaixo planta — ver o comentário
  // grande em cima de `configAtual()` em `experimentos.ts` pra entender por
  // que os dois lados TÊM que enxergar o mesmo valor aqui. Uma leitura só,
  // reaproveitada nos três lugares abaixo: ler duas vezes arriscaria pegar um
  // `configAtual()` diferente no meio (o snapshot pode trocar entre chamadas,
  // já que o middleware recarrega por trás) e aí o <script> de sorteio e o
  // <style> descreveriam experimentos diferentes.
  const cfgExperimentos = configAtual();
  return (
    // `suppressHydrationWarning` é a declaração de que o `<html>` é do
    // CLIENTE, não do servidor.
    //
    // O script de experimentos roda bloqueando, antes da pintura, e carimba
    // `data-exp-preco` e `data-exp-fluxo` na raiz. O servidor não pode
    // carimbá-los (a variante é sorteio por visitante mais localStorage), então
    // toda visita gerava um "tree hydrated but some attributes... didn't
    // match" — seis vezes na mesma página.
    //
    // O aviso sempre foi inofensivo AQUI (o atributo é intencionalmente do
    // cliente, e o CSS tem o `:not([data-exp-...])` como rede). O que não é
    // inofensivo é o console cheio: erro de verdade some no meio do barulho, e
    // foi assim que a queda de 4 horas do `/api/inngest` passou despercebida.
    <html lang={TAG_IDIOMA[LOCALE_PADRAO]} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* TESTE A/B — os três <script>/<style> abaixo precisam ser a
            PRIMEIRA coisa do <head>, NESTA ordem. Síncronos e antes de tudo
            porque, se rodassem depois do primeiro pixel, a pessoa veria a
            tela trocar na frente dela. É por isso que estão escritos à mão e
            não importados: um <script src> seria uma ida à rede antes de
            qualquer pintura.
              1. planta `window.__SRN_CFG__` — sem isto, o script de sorteio
                 no cliente não sabe a config viva (e no servidor nem faz
                 falta, mas escrever sempre os três mantém HTML e hidratação
                 no mesmo formato).
              2. sorteia a variante e carimba no <html>.
              3. o CSS que esconde a variante que não saiu. */}
        <script dangerouslySetInnerHTML={{ __html: scriptConfigGlobal(cfgExperimentos) }} />
        <script dangerouslySetInnerHTML={{ __html: scriptExperimentos(cfgExperimentos) }} />
        <style dangerouslySetInnerHTML={{ __html: cssExperimentos(cfgExperimentos) }} />
        {/* O braço B do `abertura_en` (Ballad) pula a abertura ANTES de pintar.
            Precisa vir depois do sorteio, que é quem carimba o <html>. Na
            Serenata o carimbo não existe e ele não faz nada. Ver `abertura-en.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: scriptPularAbertura() }} />
        {/* Depois dos três do teste A/B: a porta dos scripts que esperam a
            página carregar (gtag e TikTok, mais abaixo) e a fonte sem travar a
            pintura. Ver `carregar-depois.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: scriptDepoisDaPagina() }} />
        <script dangerouslySetInnerHTML={{ __html: scriptFontes(FONTES.googleFonts) }} />
        {/* Em rota sensível o referrer sai SÓ com a origem. Sem isto, a
            navegação de `/p/<token>` ou `/pix/<ref>` pra uma página medida
            entregaria o token ao gtag em `page_referrer` — o vazamento que já
            foi medido em produção no `/credito`. Política padrão do site:
            `strict-origin-when-cross-origin` (vercel.json). */}
        {!podeMedir && <meta name="referrer" content="strict-origin" />}
      </head>
      <body className="bg-background text-foreground">
        {children}
        {/* Google Ads: sem esta tag o algoritmo não sabe quais cliques viraram
            venda e não consegue otimizar a campanha. A conversão em si dispara
            na /obrigado (src/lib/google-ads.ts).

            FORA das rotas sensíveis (`rotas-sensiveis.ts`). A /obrigado, que é
            onde a conversão acontece, não está na lista — o funil de medição
            continua inteiro. */}
        {/* O id é da MARCA (`google-ads.ts`): a Ballad Gift nunca carrega a
            conta da Serenata, e sem o id dela não carrega tag nenhuma. */}
        {podeMedir && GOOGLE_ADS_ID && (
          <>
            {/* A trava do GA4 em rota sensível. O script inline executa
                durante o parse do HTML, ANTES da hidratação: quando o SPA faz a
                primeira navegação, a trava já envolve o pushState e liga
                `ga-disable-<id>` antes de a URL mudar. A ordem em relação ao
                gtag não importa e nem é controlável (o React 19 iça o
                `<script async>` pro <head>). Ver `scriptGuardaGa4` em `ga4.ts`. */}
            {GA4_ID && (
              <script dangerouslySetInnerHTML={{ __html: scriptGuardaGa4(GA4_ID, PREFIXOS) }} />
            )}
            {/* O arquivo de googletagmanager.com/gtag/js espera a página
                (exceto na /obrigado); a fila `gtag()` logo abaixo nasce na hora. */}
            <script dangerouslySetInnerHTML={{ __html: scriptCarregaGtag(GOOGLE_ADS_ID, imediato) }} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GOOGLE_ADS_ID}');`,
              }}
            />
          </>
        )}
        {/* TikTok Ads, mesma régua do gtag: fora das rotas sensíveis, e a
            /obrigado de fora da lista pra a conversão poder disparar lá.

            Só entra quando `VITE_TIKTOK_PIXEL_ID` existe. A conta foi comprada
            pra testar, e sem o id o módulo inteiro é no-op: nada carrega, nada
            quebra, e no dia em que o id for configurado começa a medir sem
            precisar de deploy de código. Ver `tiktok-pixel.ts`. */}
        {podeMedir && TIKTOK_PIXEL_ID && (
          <script dangerouslySetInnerHTML={{ __html: scriptTiktok(TIKTOK_PIXEL_ID, imediato) }} />
        )}
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
  // Mesma régua do gtag: a UTMify também vê a URL da página, e o que ela
  // precisa medir (a origem do clique) acontece no funil, nunca no editor nem
  // nos painéis. Ver `rotas-sensiveis.ts`.
  if (rotaSensivel(window.location.pathname)) return;
  // A UTMify é a conta brasileira de atribuição. Na Ballad Gift (EUA) ela
  // mediria venda americana no painel da Serenata.
  if (MARCA.chave !== "serenata") return;
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
    // Depois da atribuição (que lê as UTMs da mesma URL), antes do page_view.
    guardarCupomDaUrl((c) => useQuizStore.getState().setCupom(c));
    getDevice();
    // A/B: resolve a variante sticky e carimba em mp_attribution ANTES do
    // primeiro page_view, para todo funnel_event carregar attribution.variant.
    const variant = getOrAssignVariant();
    stampVariantIntoAttribution(variant);
    // O `?ref=` do link de indicação. Antes do page_view, pelo mesmo motivo
    // da variante: todo evento já sai sabendo que ela veio por convite.
    const convite = carimbarIndicacao();
    trackEvent("page_view", { is_landing: true });
    // O CLIQUE NO CONVITE, contado uma vez por chegada com `?ref=` na URL.
    //
    // Sem dedupe de propósito: `trackEventOnce` guardaria a marca no mesmo
    // navegador que já ignora o segundo clique, e o painel voltaria a medir
    // "pessoas" achando que mede cliques. Quem deduplica é a consulta.
    //
    // Nome novo, fora dos doze que `admin_eventos_resumo` filtra: não entra em
    // nenhuma conta do painel de funil, só na aba de indicações.
    if (convite) trackEvent("convite_clique", { ref: convite });
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
