// Imports relativos COM extensão .js: este arquivo vira ESM em runtime na
// Vercel, e o resolver ESM do Node não aceita specifier sem extensão. O tsc
// resolve ".js" para o .ts correspondente na checagem de tipos.
import { serve } from "inngest/node";
import { inngest } from "../inngest/client.js";
import { healthcheck } from "../inngest/functions/healthcheck.js";
import { gerarMusica } from "../inngest/functions/gerarMusica.js";

// Adapter "inngest/node" (req/res nativo), não "inngest/next": no Inngest v4 o
// adapter next virou web-style (Request -> Response) e nunca escreve no res de
// uma function Vercel Node — o request pendura para sempre. Foi exatamente o
// modo de falha silenciosa dos repos anteriores.
export default serve({ client: inngest, functions: [healthcheck, gerarMusica] });
