import { emailPlausivel, semPontoNoFim } from "@/lib/email-limpo";

// O LEAD QUE O SERVIDOR CRIA QUANDO O NAVEGADOR NÃO CONSEGUIU (29/10).
//
// O `finalizarLetra` já criava a linha de `quiz_responses` quando ela não
// existia (a corrida de 16 a 74 segundos com `captureLeadProgress`), mas só com
// sessão e respostas: quem perdeu a rede no passo do e-mail ganhava letra e
// música e NENHUM e-mail (sem "letra pronta", sem recuperação, sem atribuição
// do anúncio). Agora o cliente manda o e-mail e a atribuição junto, e isto
// decide o que dá pra usar. O que vem do navegador é só CONTEÚDO, e só entra
// numa linha que nasce aqui: e-mail que já existe nunca é trocado.

/** Endereço que cabe num e-mail (RFC 5321). */
const MAX_EMAIL = 254;
/** A atribuição real tem ~1 KB (UTMs, gclid, exp). Folga, sem virar depósito. */
const MAX_ATRIBUICAO = 4_000;

export function emailDoCliente(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const email = semPontoNoFim(bruto.trim()).toLowerCase();
  if (!email || email.length > MAX_EMAIL) return null;
  return emailPlausivel(email) ? email : null;
}

export function atribuicaoDoCliente(bruta: unknown): Record<string, unknown> | null {
  if (!bruta || typeof bruta !== "object" || Array.isArray(bruta)) return null;
  let texto: string;
  try {
    texto = JSON.stringify(bruta);
  } catch {
    return null;
  }
  if (texto.length > MAX_ATRIBUICAO || texto === "{}") return null;
  return bruta as Record<string, unknown>;
}
