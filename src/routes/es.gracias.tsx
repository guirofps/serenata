import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MARCA } from "@/lib/marca";
import { Obrigado } from "@/components/conta/Obrigado";

// A página de obrigado em espanhol. `/es/gracias`, não `/es/obrigado`: a URL
// de conversão é vista pelo comprador e vai colada no painel da Perfect Pay.
const busca = z.object({ email: z.string().optional(), code: z.string().optional() });

export const Route = createFileRoute("/es/gracias")({
  validateSearch: busca,
  head: () => ({
    meta: [
      { title: `Compra confirmada · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: function GraciasEs() {
    const { email, code } = Route.useSearch();
    return <Obrigado locale="es" email={email} code={code} />;
  },
});
