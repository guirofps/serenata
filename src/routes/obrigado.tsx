import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MARCA } from "@/lib/marca";
import { Obrigado } from "@/components/conta/Obrigado";
import { LOCALE_PADRAO } from "@/lib/i18n";

// Página de conversão. O corpo vive em `components/conta/Obrigado.tsx`, que
// recebe o idioma — a rota espanhola (`es.gracias.tsx`) usa o mesmo.
// `session_id`: o Stripe (Ballad Gift) volta pra cá com o id da sessão paga.
const busca = z.object({
  email: z.string().optional(),
  code: z.string().optional(),
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/obrigado")({
  // `code`: a Perfect Pay costuma devolver o id da venda no redirect. Serve de
  // transaction_id da conversão, o que impede um F5 aqui contar a venda 2x.
  validateSearch: busca,
  head: () => ({
    meta: [
      { title: LOCALE_PADRAO === "en" ? `Order confirmed · ${MARCA.nome}` : `Compra confirmada · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: function ObrigadoPt() {
    const { email, code, session_id } = Route.useSearch();
    return <Obrigado locale={LOCALE_PADRAO} email={email} code={code} sessaoStripe={session_id} />;
  },
});
