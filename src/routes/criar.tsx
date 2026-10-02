import { createFileRoute } from "@tanstack/react-router";
import { linksDeIdioma } from "@/lib/seo";
import { z } from "zod";
import { Quiz } from "@/components/quiz/Quiz";
import { LOCALE_PADRAO } from "@/lib/i18n";
import { MARCA } from "@/lib/marca";
import { temaDoParametro } from "@/lib/tema";

// O quiz em PORTUGUÊS. O corpo vive em `components/quiz/Quiz.tsx`, que recebe
// o idioma: a rota espanhola (`es.criar.tsx`) renderiza o mesmo componente com
// `locale="es"`. Um site, dois idiomas — nunca dois sites.
//
// Passo na URL (?step=<id>): reload não zera, back do navegador funciona.
// `?t=gospel` abre o quiz gospel (`quiz-flow-gospel.ts`).
const searchSchema = z.object({ step: z.string().optional(), t: z.string().optional() });

export const Route = createFileRoute("/criar")({
  validateSearch: searchSchema,
  // O quiz É uma página de entrada de busca ("fazer música personalizada"),
  // então precisa do canonical e do par de idiomas igual à home. Sem isso o
  // `?step=` do quiz vira dezenas de URLs diferentes pro Google, todas com o
  // mesmo conteúdo.
  // Na Ballad Gift (EUA) esta mesma rota é o quiz em INGLÊS: `LOCALE_PADRAO`
  // é o idioma do deploy. Na Serenata continua sendo "pt", como sempre foi.
  head: () =>
    LOCALE_PADRAO === "en"
      ? { meta: [{ title: `Create your personalized song | ${MARCA.nome}` }], links: linksDeIdioma("en", "criar") }
      : { links: linksDeIdioma("pt", "criar") },
  component: function CriarPt() {
    const { step, t } = Route.useSearch();
    return <Quiz locale={LOCALE_PADRAO} stepId={step} temaUrl={temaDoParametro(t)} />;
  },
});
