import { createFileRoute } from "@tanstack/react-router";
import { MARCA } from "@/lib/marca";
import { Login } from "@/components/conta/Login";

export const Route = createFileRoute("/es/login")({
  head: () => ({
    meta: [
      { title: `Entrar · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <Login locale="es" />,
});
