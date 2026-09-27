// O PRIMEIRO NOME, tratado pra saudação.
//
// Vive sozinho e SEM IMPORTS porque é usado dos dois lados da cerca: pelo
// painel (via `nome-comprador.ts`, uma server function) e por job do Inngest,
// que na Vercel roda no ESM do Node — onde o alias `@/` não existe e derruba
// o endpoint inteiro (commit `ccbdeb7`). Mesma razão de `donos.ts`.

/** "RONDINELE APARECIDO DOS SANTOS" -> "Rondinele". */
export function primeiroNome(completo: string | null | undefined): string {
  const limpo = String(completo ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!limpo) return "";
  const p = limpo.split(" ")[0];
  // Nomes vêm em CAIXA ALTA do gateway na maioria das vezes. "RONDINELE" numa
  // saudação parece grito.
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}
