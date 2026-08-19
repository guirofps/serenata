import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// SÓ a lógica pura. Nada de jsdom, nada de render de componente: o que este
// projeto precisa cobrir é o sorteio, e o resto continua verificado à mão no
// navegador (que é como a tela foi conferida em 18 e 19/08).
export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
