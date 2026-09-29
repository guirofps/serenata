import { createFileRoute } from "@tanstack/react-router";
import { MARCA } from "@/lib/marca";
import { Login } from "@/components/conta/Login";
import { LOCALE_PADRAO } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Entrar · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <Login locale={LOCALE_PADRAO} />,
});
