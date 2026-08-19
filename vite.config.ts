import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      // Prerender SÓ a landing "/" para HTML estático no build, servida pelo
      // CDN em vez da função /api/ssr (mata o cold start de ~1.3s no TTFB).
      // A landing não tem loader/beforeLoad nem fetch bloqueante, então o HTML
      // é idêntico para todo visitante. Três guardas mantêm o escopo em "/":
      //   - crawlLinks: false            -> não segue <a> para /quiz etc.
      //   - autoStaticPathsDiscovery: false -> não mescla rotas auto-descobertas
      //   - filter: só "/" passa         -> allow-list de segurança
      //
      // ATENÇÃO, TESTE A/B: o <script> de sorteio da home fica CONGELADO
      // neste HTML, com a config que existia no build. Funciona porque o
      // array de fallback tem tudo desligado, então o script pré-renderizado
      // nasce inerte e quem chega é sorteado em /criar (que é SSR). No dia em
      // que a home ganhar conteúdo de variante, tire "/" daqui — senão o
      // teste falha em silêncio. Ver docs/painel-testes-ab.md.
      prerender: {
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        filter: (page) => page.path === "/",
      },
      pages: [{ path: "/", prerender: { enabled: true } }],
    }),
    react(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Forma de função (não objeto): vira no-op no build SSR, onde o
        // @supabase/supabase-js é externalizado pelo TanStack Start e a forma
        // de objeto erra com "cannot be included in manualChunks". No build de
        // cliente o supabase-js é bundlado e ganha chunk próprio, fora do
        // chunk de entrada que carrega na landing pré-renderizada.
        manualChunks(id) {
          if (id.includes("node_modules/@supabase/supabase-js")) {
            return "supabase";
          }
        },
      },
    },
  },
});
