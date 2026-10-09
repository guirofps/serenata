import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MARCA } from "@/lib/marca";
import { Obrigado } from "@/components/conta/Obrigado";

// A página de obrigado em espanhol. `/es/gracias`, não `/es/obrigado`: a URL
// de conversão é vista pelo comprador e vai colada no painel da Perfect Pay.
//
// `session_id` é o que o Stripe devolve no `return_url` do espanhol da Ballad
// (hispanos dos EUA, `stripe-checkout.ts`): com ele a confirmação adiantada da
// `/obrigado` roda aqui também. Na Serenata ele nunca vem, e nada muda.
const busca = z.object({
  email: z.string().optional(),
  code: z.string().optional(),
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/es/gracias")({
  validateSearch: busca,
  head: () => ({
    meta: [
      { title: `Compra confirmada · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: function GraciasEs() {
    const { email, code, session_id } = Route.useSearch();
    return <Obrigado locale="es" email={email} code={code} sessaoStripe={session_id} />;
  },
});
