import { createFileRoute } from "@tanstack/react-router";
import { linksDeIdioma } from "@/lib/seo";
import { z } from "zod";
import { Quiz } from "@/components/quiz/Quiz";

// El quiz en ESPAÑOL. Mismo componente, mismo banco, misma sesión — solo
// cambia el idioma. Ver `components/quiz/Quiz.tsx`.
const searchSchema = z.object({ step: z.string().optional() });

export const Route = createFileRoute("/es/criar")({
  validateSearch: searchSchema,
  // EL TÍTULO, que faltaba.
  //
  // Sin esto la ruta hereda el del `__root` — "Uma música feita da sua
  // história" —, o sea: la pestaña del navegador del mexicano decía portugués.
  // La home ES (`es.index.tsx`) sí define el suyo; el quiz se quedó fuera y
  // nadie lo vio porque en portugués el heredado es el correcto.
  //
  // Importa más de lo que parece: es lo que aparece en la pestaña, en el
  // historial y al compartir el link, justo en la pantalla donde la persona
  // decide si el sitio es de fiar.
  head: () => ({
    meta: [{ title: "Crea tu canción personalizada | Serenata" }],
    links: linksDeIdioma("es", "criar"),
  }),
  component: function CriarEs() {
    const { step } = Route.useSearch();
    return <Quiz locale="es" stepId={step} />;
  },
});
