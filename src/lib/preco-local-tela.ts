// O teste de preço do país (`preco-local.ts`), do lado da TELA: lê a config
// viva e o carimbo do sorteio no `<html>`. Separado do módulo puro pra o
// servidor do caixa não carregar o motor de experimentos junto.

import { configAtual, varianteDe } from "@/lib/experimentos";
import { paisAtual } from "@/lib/mercado-es";
import { mercadoDoPais, type Mercado } from "@/lib/mercados";
import { bracoLocalCobravel, configDoTesteLocal, textosPorBraco } from "@/lib/preco-local";

/** Os textos por braço de um preço, com a config viva. Ver `textosPorBraco`. */
export function textosPorBracoNaTela(mercado: Mercado, textoUsd: string) {
  // Antes de ler a config: o `NaMoeda` chama isto pra cada moeda de cada preço.
  if (!mercado.teste) return null;
  return textosPorBraco(mercado, textoUsd, configAtual());
}

/** O mercado do país desta página (o `data-pais`), quando ele tem teste de preço LIGADO. */
function mercadoEmTeste(): Mercado | null {
  const mercado = mercadoDoPais(paisAtual());
  const cfg = configDoTesteLocal(mercado, configAtual());
  return cfg?.ativo ? mercado : null;
}

/** O país desta página está com teste de preço ligado? (`preco_co_exposto`.) */
export function paisEmTesteDePreco(): boolean {
  return mercadoEmTeste() != null;
}

/** O id do teste de preço do país desta página, ligado ou não. Sem teste no país: `null`. */
export function idDoTesteLocal(): string | null {
  return mercadoDoPais(paisAtual()).teste?.id ?? null;
}

/**
 * O braço que a tela MOSTRA e o caixa COBRA nesta página, já pela regra do
 * cobrável. `null` fora de país em teste: quem recebe trata como "sem braço".
 * No servidor o carimbo não existe e `varianteDe` devolve o controle.
 */
export function bracoLocalDaTela(): string | null {
  const mercado = mercadoEmTeste();
  if (!mercado?.teste) return null;
  return bracoLocalCobravel(mercado, configDoTesteLocal(mercado, configAtual()), varianteDe(mercado.teste.id));
}

/**
 * O que a folha manda pro caixa: o braço CRU do carimbo. O servidor aplica a
 * regra dele com a linha do banco. `undefined` em país sem teste.
 */
export function bracoLocalParaEnviar(): string | undefined {
  const id = idDoTesteLocal();
  return id ? varianteDe(id) : undefined;
}
