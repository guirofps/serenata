// UTM EM TODO LINK DE E-MAIL (08/10). Sem imports: roda no site, na api e no
// Inngest.
//
// Aplicado no HTML pronto, na hora do envio, e não em cada template: são 28
// lugares que mandam e-mail, e link novo num template esquecido ficaria sem
// utm sem ninguém ver.
//
// A utm sozinha NÃO decide o canal da venda: a atribuição da casa é a do
// primeiro toque, gravada no quiz. Quem chega com `utm_source=email` ganha o
// cookie de `toque-email.ts`, e o checkout grava `pedidos.veio_de = 'email'`.
// É isso que o painel lê (`canal-venda.ts`).
//
// Fica de fora: link de outro domínio (WhatsApp, Instagram), `mailto:` e o
// descadastro. Link que já tem `utm_source` (a campanha MUSICA10) fica como
// está.

const NOSSO = /^https?:\/\/(?:www\.)?(?:serenatagift|balladgift)\.com(?:[/?#]|$)/i;

export function comUtmEmail(html: string, campanha: string): string {
  const utm =
    `utm_source=email&amp;utm_medium=email&amp;utm_campaign=${encodeURIComponent(campanha)}`;
  return html.replace(/href="([^"]*)"/g, (inteiro, url: string) => {
    if (!NOSSO.test(url)) return inteiro;
    if (/descadastr/i.test(url) || /[?&](?:amp;)?utm_source=/i.test(url)) return inteiro;
    const i = url.indexOf("#");
    const base = i < 0 ? url : url.slice(0, i);
    const hash = i < 0 ? "" : url.slice(i);
    const sep = base.includes("?") ? (base.endsWith("?") ? "" : "&amp;") : "?";
    return `href="${base}${sep}${utm}${hash}"`;
  });
}

type Envio = { html?: unknown; tags?: { name: string; value: string }[] } & Record<string, unknown>;

function comUtmNoEnvio<T>(p: T): T {
  const e = p as Envio;
  if (typeof e?.html !== "string") return p;
  const campanha = e.tags?.find((t) => t.name === "template")?.value || "email";
  return { ...e, html: comUtmEmail(e.html, campanha) } as T;
}

/**
 * O cliente do Resend com a utm em todo envio: `comUtm(new Resend(chave))`.
 * A campanha é a tag `template` que cada envio já manda. Tipagem estrutural
 * pra este arquivo não importar o Resend.
 */
export function comUtm<
  R extends {
    emails: { send: (p: never, ...resto: never[]) => unknown };
    batch?: { send: (ps: never, ...resto: never[]) => unknown };
  },
>(r: R): R {
  const emails = r.emails as unknown as { send: (...a: unknown[]) => unknown };
  const send = emails.send.bind(emails);
  emails.send = (p: unknown, ...resto: unknown[]) => send(comUtmNoEnvio(p), ...resto);
  if (r.batch) {
    const batch = r.batch as unknown as { send: (...a: unknown[]) => unknown };
    const sendLote = batch.send.bind(batch);
    batch.send = (ps: unknown, ...resto: unknown[]) =>
      sendLote(Array.isArray(ps) ? ps.map(comUtmNoEnvio) : ps, ...resto);
  }
  return r;
}
