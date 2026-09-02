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
import { repescarFalhadas } from "../inngest/functions/repescarFalhadas.js";
import { vigiaExperimento } from "../inngest/functions/vigiaExperimento.js";
import { puxarMetricasAds } from "../inngest/functions/puxarMetricasAds.js";
import { taxasFaltando } from "../inngest/functions/taxasFaltando.js";
import { vigiaEntrega } from "../inngest/functions/vigiaEntrega.js";
import { ofertaQuadro } from "../inngest/functions/ofertaQuadro.js";
import { vigiaGeracao } from "../inngest/functions/vigiaGeracao.js";
import { quaseComprou } from "../inngest/functions/quaseComprou.js";
import { quadroParado } from "../inngest/functions/quadroParado.js";
import { creditoParado } from "../inngest/functions/creditoParado.js";

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
    repescarFalhadas,
    vigiaEntrega,
    vigiaExperimento,
    taxasFaltando,
    puxarMetricasAds,
    ofertaQuadro,
    vigiaGeracao,
    quaseComprou,
    quadroParado,
    creditoParado,
  ],
});
