import { createServerFn } from "@tanstack/react-start";
import { paisDaRequisicao } from "@/lib/pais-requisicao.server";

// O PAÍS DO ACESSO NA TELA (Ballad, 21/10/2026).
//
// O caixa do Stripe cobra na moeda do país do acesso (`mercados.ts`), e a
// decisão é do SERVIDOR, pelo cabeçalho `x-vercel-ip-country`. A tela tem que
// mostrar o mesmo número, então pergunta ao servidor pela MESMA fonte: nada de
// fuso horário ou idioma do navegador, que dariam "$199 MXN" na tela e US$ 19
// no caixa (ou o contrário) pra quem mora em Tijuana com o celular em inglês.
//
// O país vira `data-pais` no `<html>`, e o CSS (`cssPrecoPorPais`) troca o
// preço sem renderizar nada: todas as moedas já estão no HTML (`NaMoeda`).
//
// ── DESDE 29/10 O SERVIDOR CARIMBA ───────────────────────────────
//
// Com cinco países e o espanhol mudando por país (`mercado-es.ts`), o carimbo
// não pode chegar depois da pintura: o texto da página já sai do servidor no
// espanhol do país, e a hidratação precisa reler o MESMO país pra não trocar a
// página na frente da pessoa. Então o `__root.tsx` escreve `data-pais` (e
// `data-pais-fonte="servidor"`) no `<html>` do HTML que manda.
//
// O que ficou daqui é a REDE: o script do `<head>` só carimba o país guardado
// quando o servidor não carimbou (servidor local sem o cabeçalho), e a
// pergunta ao servidor só roda nesse mesmo caso.

const CHAVE = "mp_pais";

export const paisDoAcesso = createServerFn({ method: "POST" }).handler(async () => {
  return { pais: paisDaRequisicao() };
});

/** Inline no `<head>`: carimba o país guardado antes de pintar, se o servidor não carimbou. */
export function scriptCarimbarPais(): string {
  return `try{var h=document.documentElement;if(!h.getAttribute("data-pais")){var p=localStorage.getItem(${JSON.stringify(CHAVE)});if(p&&/^[A-Z]{2}$/.test(p))h.setAttribute("data-pais",p)}}catch(e){}`;
}

/**
 * Guarda o país que o servidor carimbou; sem carimbo do servidor, pergunta,
 * guarda e carimba. Falhou: fica o que estava (dólar, na dúvida).
 */
export async function descobrirPais(): Promise<void> {
  const html = document.documentElement;
  if (html.getAttribute("data-pais-fonte") === "servidor") {
    const p = html.getAttribute("data-pais");
    try {
      if (p) localStorage.setItem(CHAVE, p);
    } catch {
      // aba privada
    }
    return;
  }
  try {
    const { pais } = await paisDoAcesso();
    if (!pais) return;
    html.setAttribute("data-pais", pais);
    try {
      localStorage.setItem(CHAVE, pais);
    } catch {
      // aba privada: vale só pra esta página
    }
  } catch (e) {
    console.warn("[pais] não deu pra saber o país", e);
  }
}
