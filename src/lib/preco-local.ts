// TESTE DE PREÇO POR PAÍS (Ballad, 12/11/2026). Primeiro país: Colômbia,
// `preco_co`. Desenho em
// `docs/superpowers/specs/2026-11-12-preco-por-pais-colombia-design.md`.
//
// O teste `preco` é em dólar e vale pro mundo inteiro. Este é o do PAÍS: o
// sorteio roda em todo visitante (o motor não filtra país), mas o braço só
// muda alguma coisa onde o mercado tem `teste` (`mercados.ts`), e só no preço
// da MÚSICA e da âncora dela. Vídeo e extra ficam fixos.
//
// ONDE MORA CADA COISA
//   - o NÚMERO de cada braço: `Mercado.teste.bracos`, no código. A tela e o
//     caixa leem a mesma tabela, e o teste trava os valores;
//   - LIGA/DESLIGA e PESO: a linha da tabela `experimentos` (só no banco da
//     Ballad), pelo painel.
//
// A REGRA DO BRAÇO COBRÁVEL é a do `preco` (`braco-cobravel.ts`), mais duas:
// sem linha no banco ou com o teste desligado, controle; e braço vivo no banco
// que a tabela do país não conhece, controle. Vale igual na tela e no caixa:
// é o que impede a tela de mostrar um número e o caixa cobrar outro.
//
// Puro, sem banco e sem `document`: o servidor (`stripe-checkout.ts`) e a tela
// (`preco-local-tela.ts`) entram cada um com a sua config.

import { bracoCobravel, type VariantePreco } from "./braco-cobravel";
import { bracoTemPreco, textoNaMoeda, usdDe, valorNaMoeda, type Mercado } from "./mercados";

/** O braço que cobra a tabela de sempre do país. */
export const CONTROLE_LOCAL = "A";

/** O que a regra precisa saber da linha do experimento (banco ou config viva). */
export type ConfigTesteLocal = { ativo: boolean; variantes: VariantePreco[] };

/** O teste de preço deste mercado está RODANDO? (Mercado com teste, linha no banco, ligada.) */
export function testeLocalLigado(mercado: Mercado, config: ConfigTesteLocal | null | undefined): boolean {
  return Boolean(mercado.teste && config && config.ativo && Array.isArray(config.variantes) && config.variantes.length);
}

/**
 * O braço que VALE pra este mercado: o que a tela mostra e o que o caixa
 * cobra. Devolve sempre um nome que `valorNaMoeda` entende.
 *
 * O CONTROLE É O BRAÇO CHAMADO "A" (`bracoCobravel`), e o motor do sorteio
 * trata como controle o PRIMEIRO da lista. A linha do banco tem que manter o
 * "A" em primeiro, como a migration cria: com outra ordem, quem ficou `fora`
 * veria o preço do primeiro e pagaria o do "A".
 */
export function bracoLocalCobravel(
  mercado: Mercado,
  config: ConfigTesteLocal | null | undefined,
  braco: string | null | undefined,
): string {
  if (!testeLocalLigado(mercado, config) || !config) return CONTROLE_LOCAL;
  const nome = bracoCobravel(config.variantes, braco)?.nome;
  if (!nome || !bracoTemPreco(mercado, nome)) return CONTROLE_LOCAL;
  return nome;
}

/** Nome de braço como o painel aceita gravar (`NOME_OK` em `admin-experimentos.ts`). O resto é `null`. */
export function limparBraco(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim();
  return /^[A-Za-z0-9_-]{1,24}$/.test(v) ? v : null;
}

/**
 * De onde o SERVIDOR tira o braço da pessoa, antes da regra do cobrável.
 *
 * Primeiro o que a FOLHA mandou, que é o que a tela está mostrando; sem ele
 * (aba aberta com o código de antes do teste), o do lead. O motivo de não ler
 * só o lead, como o `preco` faz: quem deixou o e-mail ANTES de o teste ligar
 * tem o braço no navegador e não no banco, e veria um preço pagando outro.
 *
 * Não afrouxa o "preço nunca vem do cliente": o `attribution` também é escrito
 * pelo navegador. O cliente escolhe entre braços VIVOS; o número sai da tabela.
 */
export function bracoPedido(id: string, enviado: unknown, attribution: unknown): string | null {
  const daFolha = limparBraco(enviado);
  if (daFolha) return daFolha;
  const exp = (attribution as { exp?: unknown } | null | undefined)?.exp;
  if (!exp || typeof exp !== "object") return null;
  return limparBraco((exp as Record<string, unknown>)[id]);
}

/** O que o caixa cobra (unidade menor da moeda) e o que o pedido grava (centavos de dólar). */
export function valorLocalDoBraco(
  mercado: Mercado,
  centavosUsd: number,
  braco: string | null | undefined,
): { valorLocal: number; valorDoPedido: number } {
  const valorLocal = valorNaMoeda(mercado, centavosUsd, braco);
  return { valorLocal, valorDoPedido: usdDe(mercado, valorLocal) };
}

// ── A TELA ───────────────────────────────────────────────────────
//
// Os preços de TODOS os braços vão no HTML e o CSS dos experimentos esconde os
// que não foram sorteados (`cssExperimentos`), como no `preco`: nada pisca e a
// hidratação bate. Estas duas funções recebem a config de fora (a viva, de
// `configAtual()`), pra o teste rodar sem navegador.

/** A forma da config viva que interessa aqui (`ExperimentoConfigPublica`). */
export type ConfigPublicaLocal = { id: string; ativo: boolean; variantes: VariantePreco[] };

/** A linha do teste DESTE mercado na config. Sem teste no mercado ou sem linha: `null`. */
export function configDoTesteLocal(mercado: Mercado, config: readonly ConfigPublicaLocal[]): ConfigPublicaLocal | null {
  if (!mercado.teste) return null;
  return config.find((e) => e.id === mercado.teste?.id) ?? null;
}

/**
 * O texto de um preço em dólar em cada braço do teste do mercado.
 *
 * `null` = desenhar um preço só, o de sempre. Acontece em quatro casos, e os
 * dois primeiros são guarda, não atalho:
 *   - a linha NÃO existe na config (deploy antes da migration, Serenata): o
 *     CSS só tem regra pra experimento que existe, e sem ela os três preços
 *     apareceriam lado a lado;
 *   - o teste está desligado: todo braço mostraria o controle;
 *   - o preço não muda com o braço (vídeo, extra);
 *   - o mercado não tem teste, ou o texto não tem número.
 */
export function textosPorBraco(
  mercado: Mercado,
  textoUsd: string,
  config: readonly ConfigPublicaLocal[],
): { id: string; bracos: Array<{ nome: string; texto: string }> } | null {
  const cfg = configDoTesteLocal(mercado, config);
  if (!cfg || !mercado.teste) return null;
  const bracos: Array<{ nome: string; texto: string }> = [];
  for (const v of cfg.variantes ?? []) {
    // O nome vira atributo `data-v`: só o charset que o painel aceita gravar.
    const nome = limparBraco(v?.nome);
    if (!nome) continue;
    const texto = textoNaMoeda(mercado, textoUsd, bracoLocalCobravel(mercado, cfg, nome));
    if (texto == null) return null;
    bracos.push({ nome, texto });
  }
  if (bracos.length < 2 || bracos.every((b) => b.texto === bracos[0].texto)) return null;
  return { id: mercado.teste.id, bracos };
}
