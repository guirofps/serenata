import { createFileRoute } from "@tanstack/react-router";
import { linksDeIdioma } from "@/lib/seo";
import { z } from "zod";
import { Quiz } from "@/components/quiz/Quiz";
import { MARCA } from "@/lib/marca";

// `/es/crear`: a MESMA abertura do quiz em espanhol que `/es/criar`, numa URL
// em espanhol de verdade ("criar", em espanhol, é criar animal).
//
// Existe por causa do Google Ads (10/10/2026): na Ballad, todo anúncio com
// texto em espanhol apontando pra `/es/criar` caiu em
// CONSUMER_FINANCE:FULLY_LIMITED (zero impressão), enquanto o mesmo texto
// apontando pra home `/es` passou. A página não tem palavra financeira
// nenhuma: é o classificador deles. Esta rota é o destino dos anúncios em
// espanhol; o quiz segue pelos passos de `/es/criar` (`caminho("/criar")`)
// assim que a pessoa avança, então nada no funil muda.
//
// O canonical continua apontando pra `/es/criar`: é a mesma página.
const searchSchema = z.object({ step: z.string().optional() });

export const Route = createFileRoute("/es/crear")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: `Crea tu canción personalizada | ${MARCA.nome}` }],
    links: linksDeIdioma("es", "criar"),
  }),
  component: function CrearEs() {
    const { step } = Route.useSearch();
    return <Quiz locale="es" stepId={step} />;
  },
});
