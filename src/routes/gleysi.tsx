import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// LINK DE INFLUENCER: serenatagift.com/gleysi -> quiz com UTM, contando o clique.
//
// Por que uma rota nossa, e não um link com `?utm_...` cru direto na bio dela:
//   1. Conta TODO clique no servidor (`funnel_events`), inclusive quem desiste
//      antes de o site carregar. O `?utm` cru só marca quem entra e o JS roda.
//   2. Link limpo pra bio e story, que faz mais gente clicar.
//
// O destino é `/criar?utm_...`: joga direto no quiz, sem passar pela home. É
// tráfego de influencer, já vem quente do conteúdo dela, então menos atrito
// converte melhor. A captura first-touch do `__root` roda em TODA rota
// (inclusive `/criar`), então pega o UTM igual a um clique de anúncio, do mesmo
// jeito que pega gclid e ttclid. Medir a Gleysi depois é cruzar
// `utm_campaign=gleysi` com venda paga, igual a Google e TikTok.
//
// Pra somar outra influencer: copie este arquivo, troque o SLUG. NUNCA fazer
// rota dinâmica no topo (`$slug`), que engoliria 404 e digitação errada de
// qualquer URL e sujaria a atribuição com campanha inventada.

const SLUG = "gleysi";
const DESTINO = `/criar?utm_source=instagram&utm_medium=influencer&utm_campaign=${SLUG}`;

// supabaseAdmin usa service role: NUNCA pode rodar no cliente. O loader pode
// rodar nos dois lados, então o insert vive dentro de um server function.
const contarClique = createServerFn({ method: "POST" }).handler(async () => {
  // Clique perdido não trava o redirect: falha vira log, nunca erro. Perder a
  // contagem de um clique é barato; travar a pessoa na porta é caro.
  try {
    await supabaseAdmin()
      .from("funnel_events")
      .insert({ event_name: "influencer_clique", event_data: { slug: SLUG, canal: "instagram" } });
  } catch (err) {
    console.error("[influencer] clique não contado:", (err as Error).message);
  }
});

export const Route = createFileRoute("/gleysi")({
  loader: async () => {
    await contarClique();
    throw redirect({ href: DESTINO });
  },
  component: () => null,
});
