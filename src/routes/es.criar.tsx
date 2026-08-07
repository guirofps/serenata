import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Quiz } from "@/components/quiz/Quiz";

// El quiz en ESPAÑOL. Mismo componente, mismo banco, misma sesión — solo
// cambia el idioma. Ver `components/quiz/Quiz.tsx`.
const searchSchema = z.object({ step: z.string().optional() });

export const Route = createFileRoute("/es/criar")({
  validateSearch: searchSchema,
  component: function CriarEs() {
    const { step } = Route.useSearch();
    return <Quiz locale="es" stepId={step} />;
  },
});
