import { createServerFn } from "@tanstack/react-start";

// Server functions do login do painel. A lógica (HMAC, cookie, timing-safe)
// vive em `admin-auth.server.ts` e é importada DENTRO dos handlers: assim o
// `node:crypto` nunca entra no grafo do bundle do cliente.

export const entrarAdmin = createServerFn({ method: "POST" })
  .validator((data: { senha: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; papel: string | null }> => {
    const { autenticar } = await import("@/lib/admin-auth.server");
    const papel = await autenticar(data.senha);
    return { ok: papel !== null, papel };
  });

export const sairAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { encerrarSessao } = await import("@/lib/admin-auth.server");
  encerrarSessao();
  return { ok: true };
});
