// Glue Vercel -> TanStack Start: converte a req Node em Request web, delega ao
// server buildado e devolve a Response. Importa de dist/, então fica fora do
// type-check (é o único .js do backend, de propósito).
import server from "../dist/server/server.js";

export default async function handler(req, res) {
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val == null) continue;
    for (const v of Array.isArray(val) ? val : [val]) headers.append(key, v);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let body;
  if (hasBody) {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(Buffer.from(c)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  const webReq = new Request(url, {
    method: req.method ?? "GET",
    headers,
    body: body?.length ? body : undefined,
  });

  const webRes = await server.fetch(webReq);

  res.statusCode = webRes.status;
  webRes.headers.forEach((val, key) => res.setHeader(key, val));
  res.end(Buffer.from(await webRes.arrayBuffer()));
}
