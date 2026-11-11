// A LANDING DE ANÚNCIO `/presente` (Serenata, 11/11/2026) e o teste da headline.
//
// Pra quem chega pelo anúncio e ainda não entendeu o produto: uma música é um
// presente personalizado, único, que emociona e dura, ao contrário de flor,
// chocolate e perfume. Pouco texto, o vídeo de reações reais, três músicas de
// exemplo tocáveis e o botão pro `/criar`. Sem preço (decisão do dono): a
// letra é grátis e a pessoa ouve antes de pagar, o preço aparece na oferta.
//
// ── O TESTE `lp_headline` ────────────────────────────────────────
//
// Três ângulos, um por braço (só a frase do topo muda; o resto da página é
// igual pros três):
//
//   A  a comparação com o presente comum (o centro do pedido do dono)
//   B  a exclusividade: o nome e a história, que nenhum outro presente tem
//   C  a emoção: o que a pessoa vai sentir ao ouvir
//
// Mesmo desenho do `abertura_titulo`: as três frases vêm no HTML, a do A
// visível e as outras escondidas, e o carimbo do braço no <html> troca qual
// aparece. Sem a linha no banco, com o teste desligado ou sem JavaScript: A.
//
// ── O QUE MEDIR ──────────────────────────────────────────────────
//
// RECEITA POR SESSÃO, por braço (`attribution.exp.lp_headline`), SÓ entre as
// sessões com `page_view` em `/presente`. O sorteio do <head> roda em todas as
// páginas do site, então ter o braço gravado não prova que a pessoa viu a
// landing. Sinal de saúde: `lp_presente_cta` (clique no botão) por sessão.

export const EXP_LP_HEADLINE = "lp_headline";

export const BRACOS_LP = ["A", "B", "C"] as const;
export type BracoLp = (typeof BRACOS_LP)[number];

/** A frase em três pedaços: o do meio é a palavra dourada (`texto-ouro`). */
export type HeadlineLp = { antes: string; ouro: string; depois: string };

export const HEADLINES_LP: Record<BracoLp, HeadlineLp> = {
  A: { antes: "Flores murcham. Chocolate acaba. Uma ", ouro: "música", depois: " fica pra sempre." },
  B: { antes: "O único presente do mundo com o ", ouro: "nome", depois: " e a história de quem você ama" },
  C: { antes: "O presente que faz quem você ama ", ouro: "chorar", depois: " na primeira nota" },
};

/** A frase inteira, sem os pedaços (alt de acessibilidade, testes, painel). */
export function headlineCompleta(b: BracoLp): string {
  const h = HEADLINES_LP[b];
  return `${h.antes}${h.ouro}${h.depois}`;
}

/**
 * O CSS dos braços. Sem aspas, `<` nem `&` de propósito: entra num `<style>`
 * inline, e o valor do atributo sem aspas é seletor válido.
 */
export function cssLpHeadline(): string {
  const regras = BRACOS_LP.slice(1).map((b) => {
    const sel = `html[data-exp-${EXP_LP_HEADLINE}=${b}]`;
    return `${sel} .lph-A{display:none}${sel} .lph-${b}{display:inline}`;
  });
  return `.lph-v{display:none}${regras.join("")}`;
}

/** As três músicas tocáveis: esposa, mãe e pai (os casos que mais vendem). */
export const SLUGS_EXEMPLO_LP = ["isabela", "eva", "antonio"] as const;
