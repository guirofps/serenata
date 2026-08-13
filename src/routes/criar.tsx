import { createFileRoute } from "@tanstack/react-router";
import { linksDeIdioma } from "@/lib/seo";
import { z } from "zod";
import { Quiz } from "@/components/quiz/Quiz";

// O quiz em PORTUGUÊS. O corpo vive em `components/quiz/Quiz.tsx`, que recebe
// o idioma: a rota espanhola (`es.criar.tsx`) renderiza o mesmo componente com
// `locale="es"`. Um site, dois idiomas — nunca dois sites.
//
// Passo na URL (?step=<id>): reload não zera, back do navegador funciona.
const searchSchema = z.object({ step: z.string().optional() });

export const Route = createFileRoute("/criar")({
  validateSearch: searchSchema,
  // O quiz É uma página de entrada de busca ("fazer música personalizada"),
  // então precisa do canonical e do par de idiomas igual à home. Sem isso o
  // `?step=` do quiz vira dezenas de URLs diferentes pro Google, todas com o
  // mesmo conteúdo.
  head: () => ({ links: linksDeIdioma("pt", "criar") }),
  component: function CriarPt() {
    const { step } = Route.useSearch();
    return <Quiz locale="pt" stepId={step} />;
  },
});
