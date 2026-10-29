import { getRequestHeader } from "@tanstack/react-start/server";
import { definirFontePais } from "@/lib/mercado-es";
import { normalizarPais } from "@/lib/mercados";

// O PAÍS DA REQUISIÇÃO, no servidor (Ballad, 29/10/2026).
//
// Uma fonte só pra tudo o que roda no servidor: o HTML (`<html data-pais>` e o
// espanhol da página), o caixa (moeda e preço) e a letra. Se cada um lesse o
// cabeçalho do seu jeito, um esqueceria o `toUpperCase` e a página diria euro
// com o caixa cobrando dólar.
//
// `x-vercel-ip-country` é o país do IP, posto pela Vercel em TODA requisição.
// Não redireciona nada (CLAUDE.md: nunca redirecionar por IP); só escolhe o
// preço e o espanhol da MESMA URL.
//
// TESTE LOCAL: fora da Vercel o cabeçalho não existe. Com `MP_PAIS_DEV=ES` no
// ambiente do servidor local (só fora de produção), tudo se comporta como um
// acesso da Espanha. `curl -H "x-vercel-ip-country: CO"` também funciona.

/** O país do acesso desta requisição, ou `null` (fora de requisição, cabeçalho ausente ou lixo). */
export function paisDaRequisicao(): string | null {
  let cabecalho: string | undefined;
  try {
    cabecalho = getRequestHeader("x-vercel-ip-country");
  } catch {
    // Fora de uma requisição (job, teste): ninguém sabe o país.
    return null;
  }
  const pais = normalizarPais(cabecalho);
  if (pais) return pais;
  if (process.env.NODE_ENV !== "production") return normalizarPais(process.env.MP_PAIS_DEV);
  return null;
}

let ligado = false;

/** Faz o `mercadoEs()` do servidor ler o país do cabeçalho. Chamado pelo middleware de `start.ts`. */
export function ligarPaisDaRequisicao(): void {
  if (ligado) return;
  ligado = true;
  definirFontePais(paisDaRequisicao);
}
