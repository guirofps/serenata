import { createServerFn } from "@tanstack/react-start";

// O DOMÍNIO DO E-MAIL RECEBE E-MAIL? (teste `email_confirma`, 30/09/2026)
//
// Pergunta ao DNS, sem mandar nada: domínio com registro MX recebe; sem MX
// mas com endereço A também pode receber (a RFC 5321 manda tentar o A); sem
// nenhum dos dois, o domínio não existe e o e-mail nunca chega.
//
// FALHA ABERTA: DNS lento ou fora do ar responde "recebe". Um aviso falso de
// "esse e-mail não existe" em quem digitou certo custa o lead inteiro; deixar
// passar um erro custa um bounce. A tela só AVISA, não bloqueia.

/** Os grandes, que sempre recebem: nem vale a ida ao DNS. */
const CONHECIDOS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "yahoo.com.br",
  "icloud.com", "me.com", "msn.com", "uol.com.br", "bol.com.br", "terra.com.br",
  "outlook.com.br", "hotmail.com.br", "aol.com", "protonmail.com", "proton.me",
]);

export type LeituraDns = { mx: "tem" | "nao-tem" | "erro"; a: "tem" | "nao-tem" | "erro" };

/** Pura: decide pelo que o DNS respondeu. Só "não recebe" com resposta firme dos dois. */
export function recebeEmail(l: LeituraDns): boolean {
  if (l.mx === "tem") return true;
  if (l.mx === "erro") return true;
  // Sem MX: vale o A, e dúvida no A também passa.
  return l.a !== "nao-tem";
}

export function dominioDe(email: string): string | null {
  const e = email.trim().toLowerCase();
  const i = e.lastIndexOf("@");
  if (i < 1 || i === e.length - 1) return null;
  return e.slice(i + 1);
}

/** Códigos do Node que querem dizer "esse nome não tem esse registro". */
const NAO_EXISTE = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN", "ENONAME"]);

async function consultar<T>(fn: () => Promise<T[]>): Promise<"tem" | "nao-tem" | "erro"> {
  try {
    const r = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error("tempo"), { code: "TEMPO" })), 2500)),
    ]);
    return r.length > 0 ? "tem" : "nao-tem";
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    return NAO_EXISTE.has(code) ? "nao-tem" : "erro";
  }
}

export const dominioRecebeEmail = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => ({ email: String(data?.email ?? "").slice(0, 254) }))
  .handler(async ({ data }): Promise<{ recebe: boolean; dominio: string | null }> => {
    const dominio = dominioDe(data.email);
    if (!dominio) return { recebe: false, dominio: null };
    if (CONHECIDOS.has(dominio)) return { recebe: true, dominio };
    const dns = await import("node:dns/promises");
    const mx = await consultar(() => dns.resolveMx(dominio));
    const a = mx === "nao-tem" ? await consultar(() => dns.resolve4(dominio)) : "tem";
    return { recebe: recebeEmail({ mx, a }), dominio };
  });
