// Imports relativos COM extensão .js: este arquivo vira ESM em runtime na
// Vercel, e o resolver ESM do Node não aceita specifier sem extensão. O tsc
// resolve ".js" para o .ts correspondente na checagem de tipos.
import { serve } from "inngest/node";
import { inngest } from "../inngest/client.js";
import { healthcheck } from "../inngest/functions/healthcheck.js";
import { gerarMusica } from "../inngest/functions/gerarMusica.js";
import { lembrarPresente } from "../inngest/functions/lembrarPresente.js";
import { volteCriar } from "../inngest/functions/volteCriar.js";
import { vigiaWebhook } from "../inngest/functions/vigiaWebhook.js";
import { vigiarSaldo } from "../inngest/functions/vigiarSaldo.js";
import { mandarLetra } from "../inngest/functions/mandarLetra.js";
import { sequenciaRecuperacao } from "../inngest/functions/sequenciaRecuperacao.js";
import { triarSuporte } from "../inngest/functions/triarSuporte.js";
import { pixNaoPago } from "../inngest/functions/pixNaoPago.js";
import { guardeOLink } from "../inngest/functions/guardeOLink.js";

// Adapter "inngest/node" (req/res nativo), não "inngest/next": no Inngest v4 o
// adapter next virou web-style (Request -> Response) e nunca escreve no res de
// uma function Vercel Node — o request pendura para sempre. Foi exatamente o
// modo de falha silenciosa dos repos anteriores.
export default serve({
  client: inngest,
  functions: [
    healthcheck,
    gerarMusica,
    lembrarPresente,
    volteCriar,
    vigiaWebhook,
    vigiarSaldo,
    mandarLetra,
    sequenciaRecuperacao,
    triarSuporte,
    pixNaoPago,
    guardeOLink,
  ],
});
