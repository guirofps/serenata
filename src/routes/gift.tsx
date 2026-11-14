import { createFileRoute, notFound } from "@tanstack/react-router";
import { LpRegaloBallad } from "@/components/landing/LpRegaloBallad";
import { FONTES } from "@/lib/marca";
import { chaveDaMarca } from "@/lib/marca-identidade";
import { TEXTOS_GIFT as T } from "@/lib/lp-ballad";

// A landing curta da Ballad em inglês (a irmã da `/presente`). Só existe na
// Ballad: na Serenata é 404. Desenho e regras em `lp-ballad.ts`.
const URL = "https://www.balladgift.com/gift";

export const Route = createFileRoute("/gift")({
  loader: () => {
    if (chaveDaMarca() !== "ballad") throw notFound();
  },
  head: () => ({
    meta: [
      { title: T.titulo },
      { name: "description", content: T.descricao },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: T.titulo },
      { property: "og:description", content: T.descricao },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTES.googleFonts },
    ],
  }),
  component: () => <LpRegaloBallad idioma="en" />,
});
