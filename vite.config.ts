import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      // A landing "/" JÁ FOI pré-renderizada em HTML estático (ganho real:
      // mata o cold start de ~1.3s no TTFB da função /api/ssr). Tirado de
      // propósito quando a config dos experimentos virou MUTÁVEL (Task 4):
      // HTML estático é uma foto — ele congela no build a config que existia
      // naquele instante, e não existe jeito de uma foto refletir uma decisão
      // de runtime tomada minutos ou dias depois no painel.
      //
      // As duas falhas que isso abria eram silenciosas, não gritadas:
      //   - SEM env de Supabase no build (o caso comum): a home sai com o
      //     script de sorteio inerte, e como o link pra /criar é <Link> do
      //     TanStack (navegação SPA, o <head> nunca reexecuta), quem entra
      //     pela home simplesmente SOME do teste — sem erro, sem log.
      //   - COM env de Supabase no build: a home congela a config LIGADA que
      //     existia no momento do deploy, e desligar o experimento pelo
      //     painel não desliga a home — só o próximo deploy desliga.
      // CONSEQUÊNCIA NO `vercel.json`, e ela quase derrubou a home: sem
      // pré-render não existe mais `dist/client/index.html`, e o catch-all
      // era `/(.+)` — que exige ao menos um caractere depois da barra e
      // portanto NÃO casa `/`. Sem arquivo estático e sem rewrite, a raiz
      // dava 404. Hoje o catch-all é `/(.*)`. O `vercel.json` é JSON
      // estrito e não aceita comentário; a explicação mora aqui, na spec e
      // no teste `src/lib/vercel-rotas.test.ts`.
      //
      // Um HTML estático que às vezes mente sobre o estado do teste é pior
      // que perder 1.3s de TTFB. Se a home algum dia deixar de depender de
      // config mutável (ou o time decidir que a defasagem é aceitável e
      // documentar isso explicitamente), revisitar. Ver docs/painel-testes-ab.md.
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
        // chunk de entrada que carrega em toda página (a landing não é mais
        // pré-renderizada — ver o comentário de `tanstackStart` acima).
        manualChunks(id) {
          if (id.includes("node_modules/@supabase/supabase-js")) {
            return "supabase";
          }
        },
      },
    },
  },
});
