import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

// O PAÍS DO ACESSO NA TELA (Ballad, 21/10/2026).
//
// O caixa do Stripe cobra em peso quem está no México (`preco-mxn.ts`), e a
// decisão é do SERVIDOR, pelo cabeçalho `x-vercel-ip-country`. A tela tem que
// mostrar o mesmo número, então pergunta ao servidor pela MESMA fonte: nada de
// fuso horário ou idioma do navegador, que dariam "$349" na tela e US$ 19 no
// caixa (ou o contrário) pra quem mora em Tijuana com o celular em inglês.
//
// O país vira `data-pais` no `<html>`, e o CSS (`styles.css`) troca o preço
// sem renderizar nada: as duas moedas já estão no HTML (`NaMoeda`). O script
// do `<head>` carimba o país guardado ANTES da primeira pintura; a pergunta ao
// servidor roda uma vez por página carregada e corrige se a pessoa mudou de
// país. Na primeira visita o carimbo chega uns 100 ms depois da pintura, ainda
// na home ou na abertura do quiz: o preço só aparece minutos depois.

const CHAVE = "mp_pais";

export const paisDoAcesso = createServerFn({ method: "POST" }).handler(async () => {
  const pais = String(getRequestHeader("x-vercel-ip-country") ?? "").trim().toUpperCase();
  return { pais: /^[A-Z]{2}$/.test(pais) ? pais : null };
});

/** Inline no `<head>`: carimba o país guardado antes de pintar. Sem storage, não faz nada. */
export function scriptCarimbarPais(): string {
  return `try{var p=localStorage.getItem(${JSON.stringify(CHAVE)});if(p&&/^[A-Z]{2}$/.test(p))document.documentElement.setAttribute("data-pais",p)}catch(e){}`;
}

/** Pergunta o país ao servidor, guarda e carimba. Falhou: fica o que estava (dólar, na dúvida). */
export async function descobrirPais(): Promise<void> {
  try {
    const { pais } = await paisDoAcesso();
    if (!pais) return;
    document.documentElement.setAttribute("data-pais", pais);
    try {
      localStorage.setItem(CHAVE, pais);
    } catch {
      // aba privada: vale só pra esta página
    }
  } catch (e) {
    console.warn("[pais] não deu pra saber o país", e);
  }
}
