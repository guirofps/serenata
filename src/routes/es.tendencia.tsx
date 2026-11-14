import { createFileRoute, notFound } from "@tanstack/react-router";
import { LpMateriaBallad } from "@/components/landing/LpMateriaBallad";
import { FONTES } from "@/lib/marca";
import { chaveDaMarca } from "@/lib/marca-identidade";
import { textosMateriaEs } from "@/lib/lp-ballad";

// A matéria da Ballad em espanhol (a irmã da `/tendencia`). Só existe na
// Ballad: na Serenata é 404. Desenho e regras em `lp-ballad.ts`.
const URL = "https://www.balladgift.com/es/tendencia";
const T = textosMateriaEs("latam");
const INTER = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap";

export const Route = createFileRoute("/es/tendencia")({
  loader: () => {
    if (chaveDaMarca() !== "ballad") throw notFound();
  },
  head: () => ({
    meta: [
      { title: `${T.manchete} | ${T.publicacao}` },
      { name: "description", content: T.linhaFina },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: T.manchete },
      { property: "og:description", content: T.linhaFina },
      { property: "og:type", content: "article" },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTES.googleFonts },
      { rel: "stylesheet", href: INTER },
    ],
  }),
  component: () => <LpMateriaBallad idioma="es" url={URL} />,
});
