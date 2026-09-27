// QUEM RECEBE ALERTA DE OPERAÇÃO.
//
// ── POR QUE ISTO É UM MÓDULO, E NÃO UMA STRING EM CADA ARQUIVO ──
//
// Até 27/09 o endereço estava escrito à mão em NOVE lugares
// (`alerta-operacao`, `disjuntor`, `vigiaEntrega`, `vigiarSaldo`,
// `vigiaGeracao`, `vigiaExperimento`, `vigiaWebhook`, `renderizarVideo`,
// `triarSuporte`, `vigia-externo`), e cada um tinha uma lista ligeiramente
// diferente. O efeito prático apareceu no dia em que a geração de letra parou:
// o alerta EXISTIA, disparou, e foi pra uma caixa só — o dono do funil
// descobriu a parada olhando a própria tela, não pelo aviso que ele mesmo
// mandou escrever.
//
// Alerta que vai pra uma pessoa só é alerta que depende dela estar acordada.
// A partir daqui, quem escrever um vigia novo importa daqui e acerta por
// padrão; esquecer de somar alguém deixou de ser possível sem querer.
//
// ── DUAS ARMADILHAS DE RUNTIME, E AS DUAS JÁ EXPLODIRAM AQUI ──
//
// 1. ESTE ARQUIVO NÃO IMPORTA NADA, de propósito. Ele é lido por funções do
//    Inngest, que na Vercel rodam no ESM do Node — onde o alias `@/` NÃO
//    EXISTE. Em 27/08 um `@/lib` dentro de um arquivo carregado por esse
//    caminho derrubou `/api/inngest` inteiro com 500, e junto foi a geração de
//    música de todo mundo (commit `ccbdeb7`). Sem import, não há o que quebrar.
//
// 2. QUEM IMPORTA DAQUI DE FORA DE `src/` USA CAMINHO RELATIVO COM `.js`
//    (`../../src/lib/donos.js`), nunca o alias. Mesma razão.

/**
 * Os donos do negócio. Todo alerta de operação vai pros dois.
 *
 * `nosfer@gmail.com` entrou em 27/09 a pedido dele, depois da parada da letra.
 */
export const DONOS: readonly string[] = ["guilhermerojasiqueira@gmail.com", "nosfer@gmail.com"];

/**
 * Os donos MAIS quem aquele alerta específico também avisa (a agência, um
 * sócio), sem repetir ninguém.
 *
 * Existe porque alguns vigias avisam terceiro além dos donos, e a resposta
 * certa ali é SOMAR, não substituir: trocar a lista inteira por `DONOS`
 * silenciaria quem estava sendo avisado e ninguém notaria — o alerta continua
 * chegando, só que pra menos gente, que é o defeito mais difícil de ver.
 *
 * Vazio e repetido são descartados: `undefined` de env var não vira
 * destinatário em branco.
 */
export function donosMais(...extras: (string | undefined | null)[]): string[] {
  return [...new Set([...DONOS, ...extras.filter((e): e is string => Boolean(e && e.trim()))])];
}
