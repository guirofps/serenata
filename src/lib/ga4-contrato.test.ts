import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROMOVIDOS } from "./ga4";

// CONTRATO ENTRE O CÓDIGO-FONTE E O GA4.
//
// O projeto não renderiza componente em teste (`vitest.config.ts`), então o
// que dá pra garantir sobre os componentes é lido do próprio fonte: que nomes
// de evento existem, e onde.

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.ts$/.test(nome) ? [caminho] : [];
  });
}
export const FONTES = arquivos("src").map((f) => [f, readFileSync(f, "utf8")] as const);

const NOMES = [
  ...new Set(
    FONTES.flatMap(([, texto]) =>
      [...texto.matchAll(/trackEvent(?:Once)?\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]),
    ),
  ),
].sort();

// Nomes que o GA4 reserva, coleta sozinho, ou que nós mesmos emitimos pelas
// funções tipadas. Um evento nosso com um desses nomes se misturaria com o
// do GA4 sem aviso.
const DO_GA4 = [
  "ad_activeview",
  "ad_click",
  "ad_exposure",
  "ad_impression",
  "ad_query",
  "ad_reward",
  "adunit_exposure",
  "app_background",
  "app_clear_data",
  "app_exception",
  "app_remove",
  "app_update",
  "app_upgrade",
  "error",
  "first_open",
  "first_visit",
  "in_app_purchase",
  "notification_dismiss",
  "notification_foreground",
  "notification_open",
  "notification_receive",
  "os_update",
  "session_start",
  "session_start_with_rollout",
  "user_engagement",
  "page_view",
  "scroll",
  "click",
  "file_download",
  "video_start",
  "video_progress",
  "video_complete",
  "view_search_results",
  "form_start",
  "form_submit",
  "generate_lead",
  "view_item",
  "begin_checkout",
  "add_payment_info",
  "purchase",
];

describe("nomes de evento contra o GA4", () => {
  it("o fonte tem os ~132 eventos que o spec mediu", () => {
    expect(NOMES.length).toBeGreaterThan(120);
  });

  it("só page_view colide, e é o único que o encaminhamento pula por isso", () => {
    expect(NOMES.filter((n) => DO_GA4.includes(n))).toEqual(["page_view"]);
  });

  it("todo nome cabe no limite de 40 caracteres do GA4", () => {
    expect(NOMES.filter((n) => n.length > 40)).toEqual([]);
  });
});

// Cada nome promovido, e a função tipada que tem que estar no MESMO arquivo
// de todo `trackEvent` dele. É a guarda contra o risco 2 do spec: promover num
// ponto novo e esquecer o outro lado faria o GA4 receber os dois nomes, ou
// nenhum.
const PROMOCAO: Record<string, string> = {
  letra_finalizada: "leadGa4(",
  oferta_vista: "vitrineGa4(",
  checkout_click: "checkoutGa4(",
  pix_transparente_gerado: "pagamentoGa4(",
};

describe("promoção ao GA4 nos pontos de chamada", () => {
  it("a lista de promovidos e este mapa são os mesmos nomes", () => {
    expect([...PROMOVIDOS].sort()).toEqual(Object.keys(PROMOCAO).sort());
  });

  for (const [nome, chamada] of Object.entries(PROMOCAO)) {
    it(`todo trackEvent de ${nome} vem com ${chamada}`, () => {
      const padrao = new RegExp(`trackEvent(?:Once)?\\(\\s*"${nome}"`);
      const onde = FONTES.filter(([, texto]) => padrao.test(texto));
      expect(onde.length, nome).toBeGreaterThan(0);
      for (const [arquivo, texto] of onde) expect(texto, arquivo).toContain(chamada);
    });
  }

  it("o PIX converte centavos pra unidade cheia no ponto de chamada", () => {
    const texto = readFileSync("src/components/quiz/PixTransparente.tsx", "utf8");
    expect(texto).toMatch(/pagamentoGa4\(\{\s*valor: r\.valorCentavos \/ 100/);
  });

  it("a compra do GA4 sai do mesmo arquivo da conversão do Ads", () => {
    const texto = readFileSync("src/components/conta/Obrigado.tsx", "utf8");
    expect(texto).toContain("conversaoCompra(");
    expect(texto).toContain("compraGa4(");
  });

  it("botao_comprar NÃO é promovido: dispara no mesmo clique que checkout_click", () => {
    expect(PROMOVIDOS.has("botao_comprar")).toBe(false);
  });
});

// O que isto garante é que a trava é renderizada no MESMO bloco do gtag
// (sempre que o gtag entra, a trava entra). NÃO garante ordem no DOM: o
// React 19 iça `<script async>` pro <head>. A ordem não precisa ser essa — a
// trava roda no parse, antes da hidratação, e liga antes de toda navegação
// (conferido na página real em 01/10, ver o ledger da Tarefa 6).
describe("a trava no __root", () => {
  it("o __root injeta a trava no mesmo bloco do gtag", () => {
    const texto = readFileSync("src/routes/__root.tsx", "utf8");
    const trava = texto.indexOf("scriptGuardaGa4(");
    const gtag = texto.indexOf("googletagmanager.com/gtag/js");
    expect(trava, "scriptGuardaGa4 ausente do __root").toBeGreaterThan(-1);
    expect(trava).toBeLessThan(gtag);
  });
});

// O REFERRER LEVA O TOKEN JUNTO.
//
// Com a política padrão (`strict-origin-when-cross-origin`, vercel.json), uma
// navegação completa dentro do site manda a URL INTEIRA de origem como
// referrer. Saindo de `/p/<token>` ou `/pix/<ref>` pra uma página medida, o
// gtag recebe o token em `page_referrer`. Já foi medido em produção no
// `/credito` (ver o comentário lá). Em rota sensível a política vira
// `strict-origin`: sai só a origem.
describe("referrer em rota sensível", () => {
  it("o __root corta o referrer pra só a origem quando a rota é sensível", () => {
    const texto = readFileSync("src/routes/__root.tsx", "utf8");
    expect(texto).toMatch(/\{!podeMedir && <meta name="referrer" content="strict-origin" \/>\}/);
  });
});
