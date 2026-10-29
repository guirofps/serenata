import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// A CONFIG DOS EXPERIMENTOS, garantida antes de qualquer render.
//
// Roda em toda requisição e quase sempre não faz nada: só quando o snapshot
// está velho é que dispara a releitura, e mesmo aí sem esperar. A única
// espera é na instância fria, uma vez.
//
// Vem DEPOIS do errorMiddleware na lista: se a leitura da config explodir de
// um jeito não previsto, a página de erro ainda aparece.
const configMiddleware = createMiddleware().server(async ({ next }) => {
  const { garantirConfig } = await import("./lib/experimentos-config.server");
  await garantirConfig();
  return next();
});

// O PAÍS DA REQUISIÇÃO, ligado antes de qualquer render (Ballad, 29/10).
//
// O `mercadoEs()` é puro e pergunta o país a uma fonte; no servidor a fonte é
// o cabeçalho da Vercel (`pais-requisicao.server.ts`). Ligar aqui, e não no
// módulo da página, garante que o PRIMEIRO HTML já sai com o espanhol e o
// `data-pais` do país certo: é o que a hidratação vai reler no navegador. Na
// Serenata o mercado é a Argentina pela marca, e isto não muda nada lá.
const paisMiddleware = createMiddleware().server(async ({ next }) => {
  const { ligarPaisDaRequisicao } = await import("./lib/pais-requisicao.server");
  ligarPaisDaRequisicao();
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, configMiddleware, paisMiddleware],
}));
