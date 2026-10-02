import { describe, expect, it } from "vitest";
import { scriptGuardaGa4 } from "./ga4";
import { PREFIXOS, rotaSensivel } from "./rotas-sensiveis";

// A TRAVA DO GA4 EM ROTA SENSÍVEL.
//
// Com o destino GA4, a medição aprimorada registra `page_view` em troca de
// rota do SPA. Um `<Link>` de página medida para `/p/$token` mandaria o token
// pro Google. A trava é `window['ga-disable-<id>']`, e o que importa é QUANDO
// ela liga: antes de a URL mudar. Estes testes rodam o script de verdade,
// com um `history` falso que anota o valor da trava no instante da troca.

const ID = "G-TESTE";
const CHAVE = `ga-disable-${ID}`;

function montar(inicial: string) {
  const ouvintes: Array<() => void> = [];
  const loc = { href: `https://serenatagift.com${inicial}` };
  const win: Record<string, unknown> = {
    addEventListener: (_tipo: string, fn: () => void) => void ouvintes.push(fn),
  };
  const travaNaTroca: unknown[] = [];
  const nativo = (_estado: unknown, _titulo: string, url?: string | null) => {
    travaNaTroca.push(win[CHAVE]);
    if (url != null) loc.href = new URL(url, loc.href).href;
  };
  const hist = { pushState: nativo, replaceState: nativo };
  new Function("window", "history", "location", scriptGuardaGa4(ID, PREFIXOS))(win, hist, loc);
  return {
    trava: () => win[CHAVE],
    hist,
    voltar: (url: string) => {
      loc.href = new URL(url, loc.href).href;
      for (const fn of ouvintes) fn();
    },
    travaNaTroca,
  };
}

describe("trava do GA4 em rota sensível", () => {
  it("nasce com a trava certa pra rota de entrada", () => {
    expect(montar("/").trava()).toBe(false);
    expect(montar("/editar/abc").trava()).toBe(true);
  });

  it("liga ANTES de a URL mudar, não depois", () => {
    const g = montar("/obrigado");
    g.hist.pushState(null, "", "/p/token123");
    expect(g.travaNaTroca).toEqual([true]);
    expect(g.trava()).toBe(true);
  });

  it("desliga ao sair da rota sensível", () => {
    const g = montar("/editar/abc");
    g.hist.pushState(null, "", "/");
    expect(g.travaNaTroca).toEqual([false]);
  });

  it("replaceState também passa pela trava", () => {
    const g = montar("/criar");
    g.hist.replaceState(null, "", "/pix/ref1");
    expect(g.travaNaTroca).toEqual([true]);
  });

  it("voltar pelo navegador (popstate) liga a trava", () => {
    const g = montar("/");
    g.voltar("/dashboard");
    expect(g.trava()).toBe(true);
  });

  it("pushState só com estado, sem URL, não mexe na trava", () => {
    const g = montar("/editar/abc");
    g.hist.pushState({ rolagem: 10 }, "");
    expect(g.trava()).toBe(true);
  });

  it("/oferta/ é sensível: o token carrega o session_id em texto puro", () => {
    // `<sessao>.<degrau>.<assinatura>` (oferta-assinada.ts): a sessão é a
    // mesma credencial do `/retomar?s=`.
    expect(rotaSensivel("/oferta/sess-1.2.assinatura")).toBe(true);
    expect(montar("/oferta/sess-1.2.assinatura").trava()).toBe(true);
  });

  it("concorda com rotaSensivel em toda forma de caminho", () => {
    const casos = [
      "/",
      "/criar",
      "/obrigado",
      "/p",
      "/p/abc",
      "/presente",
      "/editar/x",
      "/es/editar/x",
      "/pt/p/y",
      "/ES/EDITAR/X",
      "/es",
      "/admin",
      "/dashboard",
      "/indique",
      "/pix",
      "/pix/ref",
      "/auth/callback",
      "/quadro/exemplo",
      "/credito/t",
      "/oferta/s.1.x",
    ];
    for (const caminho of casos) {
      expect(montar(caminho).trava(), caminho).toBe(rotaSensivel(caminho));
    }
  });
});
