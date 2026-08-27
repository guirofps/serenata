import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// A CORRIDA QUE DEIXAVA GENTE SEM MÚSICA.
//
// `captureLeadProgress` é fire-and-forget e é ele quem cria a linha de
// `quiz_responses`. Quando `finalizarLetra` corria na frente dela, ele
// desistia em silêncio e a pessoa ficava com a letra na tela e NADA no banco:
// 12 casos em 7 dias, 8 deles com a linha do quiz nascendo 16 a 74 segundos
// DEPOIS da letra ser finalizada.
//
// O desfecho era sempre o mesmo: barrada no botão de comprar.
//
// Estes testes são de ESTRUTURA, não de comportamento: `finalizarLetra` é
// server fn com Supabase por dentro e não roda em unidade. O que eles travam é
// que as três camadas do conserto continuem existindo, porque cada uma sozinha
// deixa um buraco aberto.
describe("as três camadas contra letra sem música", () => {
  const servidor = readFileSync("src/lib/coautoria.ts", "utf8");
  const reveal = readFileSync("src/components/quiz/RevealStep.tsx", "utf8");
  const oferta = readFileSync("src/components/quiz/TelaOferta.tsx", "utf8");

  it("1 · o servidor CRIA o lead que falta em vez de desistir", () => {
    const trecho = servidor.slice(
      servidor.indexOf("export const finalizarLetra"),
      servidor.indexOf("dispararGeracaoMusica(inserida.id)"),
    );
    expect(trecho).toContain("upsert_quiz_response");
    // E tenta de novo depois de criar: sem a segunda leitura, o `quizId`
    // continua nulo e o conserto não serve pra nada.
    expect(trecho.match(/quizIdDaSessao\(data\.sessionId\)/g)?.length).toBe(2);
  });

  it("2 · o cliente não trata `musicaId` nulo como sucesso", () => {
    expect(reveal).toContain("finalizar_sem_musica");
    expect(reveal).toContain("!r?.musicaId");
  });

  it("3 · a oferta repara a partir da letra guardada no navegador", () => {
    expect(oferta).toContain("tentarRecriarMusica");
    expect(oferta).toContain("finalizarLetra");
    // Precisa rodar ao entrar na espera, senão o relógio gira 4 minutos
    // esperando algo que ninguém pediu.
    expect(oferta).toMatch(/void tentarRecriarMusica\(\);/);
  });

  it("o lead criado no servidor não chuta passo do funil", () => {
    // Chutar um número alto aqui estragaria o funil do painel: quem sabe em
    // que passo a pessoa está é o cliente.
    const trecho = servidor.slice(
      servidor.indexOf("upsert_quiz_response"),
      servidor.indexOf("upsert_quiz_response") + 400,
    );
    expect(trecho).not.toContain("p_current_step");
    expect(trecho).not.toContain("p_furthest_step");
  });
});
