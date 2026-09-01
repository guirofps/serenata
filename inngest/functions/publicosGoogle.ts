import { inngest } from "../client.js";
import { sincronizarPublicos } from "../lib/publicos-google.js";

// AS LISTAS DE PÚBLICO, MANTIDAS SOZINHAS.
//
// A lógica inteira mora em `../lib/publicos-google.ts`, junto com o porquê de
// cada definição. Aqui é só o relógio.
//
// ── DE SEIS EM SEIS HORAS, E NÃO DE HORA EM HORA ─────────────────
//
// Cada rodada reenvia a lista inteira (milhares de hashes). O Google
// deduplica, então repetir é seguro, mas de hora em hora seria pagar
// processamento pra mudar umas dez pessoas. Público de remarketing não decide
// nada em minutos: quem gerou PIX às 14h continua sendo o mesmo alvo às 20h.
//
// ── ELE PODE FALHAR SEM DRAMA ────────────────────────────────────
//
// Lista velha por seis horas não quebra campanha nenhuma; ela só fica um
// pouco desatualizada. Por isso duas retentativas e nada de alarme: o job que
// precisa gritar quando falha é o da entrega, não este.

export const publicosGoogle = inngest.createFunction(
  {
    id: "publicos-google",
    retries: 2,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    // Minuto 55 pra não empilhar com os outros (25, 35, 45).
    triggers: [{ cron: "55 */6 * * *" }],
  },
  async ({ step }) => {
    return await step.run("sincronizar", async () => await sincronizarPublicos());
  },
);
