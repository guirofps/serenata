import { inngest } from "../client.js";

// Função mínima para provar que o app Inngest registra e executa.
// Nos repos anteriores o /api/inngest ficou meses quebrado por import de
// arquivo inexistente sem ninguém notar — esta função existe para o smoke
// test da Fase 0 e morre quando o primeiro job real (gerarMusica) entrar.
export const healthcheck = inngest.createFunction(
  { id: "healthcheck", triggers: [{ event: "app/healthcheck" }] },
  async ({ event, step }) => {
    const echo = await step.run("echo", async () => ({
      ok: true,
      recebido_em: new Date().toISOString(),
      payload: event.data ?? null,
    }));
    return echo;
  },
);
