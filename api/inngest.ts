import { serve } from "inngest/node";
import { inngest } from "../inngest/client";
import { healthcheck } from "../inngest/functions/healthcheck";

// Adapter "inngest/node" (req/res nativo), não "inngest/next": no Inngest v4 o
// adapter next virou web-style (Request -> Response) e nunca escreve no res de
// uma function Vercel Node — o request pendura para sempre. Foi exatamente o
// modo de falha silenciosa dos repos anteriores.
export default serve({ client: inngest, functions: [healthcheck] });
