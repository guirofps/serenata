// A MATÉRIA `/tendencia` (Serenata, 11/11/2026): landing de anúncio em formato
// de notícia, pra Google e YouTube.
//
// Ângulo (donos, 11/11): TENDÊNCIA, sem personagem. A matéria relata um
// comportamento (o presente mudou) e o produto aparece como a explicação dele.
// O que sustenta a "tendência" são números NOSSOS e verdadeiros.
//
// ── O QUE DEIXA ISTO DENTRO DAS REGRAS DO GOOGLE ─────────────────
//
//  - Não imita portal nenhum: nosso domínio, nosso logo, selo "Publicidade"
//    no topo e rodapé dizendo de quem é o conteúdo, com o CNPJ.
//  - Assina "Redação Serenata". Sem repórter inventado.
//  - Só dado nosso. Sem seção de comentários, sem contagem regressiva, sem
//    "últimas vagas". Sem preço e sem falar em pagar (como a `/presente`):
//    a promessa é ouvir a prévia de graça.
//
// O teste `materia-tendencia.test.ts` segura essas regras.
//
// ── O TESTE `materia_titulo` ─────────────────────────────────────
//
// Três manchetes, uma por braço; o resto da matéria é igual. Mesmo desenho do
// `lp_headline`: as três vêm no HTML, a do A visível, e o carimbo do braço no
// <html> troca qual aparece. Sem a linha no banco ou com o teste desligado: A.
//
// Medir RECEITA POR SESSÃO por braço (`attribution.exp.materia_titulo`) SÓ
// entre sessões com `page_view` em `/tendencia`; saúde: `materia_cta`.

export const EXP_MATERIA_TITULO = "materia_titulo";

export const BRACOS_MATERIA = ["A", "B", "C"] as const;
export type BracoMateria = (typeof BRACOS_MATERIA)[number];

export const MANCHETES: Record<BracoMateria, string> = {
  A: "Brasileiros estão trocando flores e perfume por músicas feitas com a história do casal",
  B: "O presente que já fez mais de 6.600 famílias chorarem não se compra em loja",
  C: "Quase metade é para a esposa: o presente que virou febre entre maridos brasileiros",
};

/** Sem aspas, `<` nem `&`: entra num `<style>` inline. */
export function cssMateriaTitulo(): string {
  const regras = BRACOS_MATERIA.slice(1).map((b) => {
    const sel = `html[data-exp-${EXP_MATERIA_TITULO}=${b}]`;
    return `${sel} .mtt-A{display:none}${sel} .mtt-${b}{display:inline}`;
  });
  return `.mtt-v{display:none}${regras.join("")}`;
}

// PARA QUEM AS MÚSICAS SÃO FEITAS. Medido nas vendas de 30 dias até 15/10/2026
// (`scratch/_relacao-vendas-15out.mjs`): esposa 47%, namorada 12%. O resto não
// foi aberto por relação, então fica junto. Atualizar os três números E o
// período quando alguém rodar de novo.
export const PERIODO_PARA_QUEM = "músicas compradas em 30 dias, até 15 de outubro de 2026";
export const PARA_QUEM = [
  { rotulo: "Esposa", pct: 47 },
  { rotulo: "Namorada", pct: 12 },
  { rotulo: "Mãe, pai, filhos, avós e amigos", pct: 41 },
] as const;

/** A data que a matéria mostra (a da publicação). */
export const DATA_MATERIA = "11/11/2026";
/** A hora em que ela foi ao ar. É a da publicação de verdade: nada de relógio que se atualiza sozinho. */
export const HORA_MATERIA = "16h00";

/** O parágrafo de Natal vale até o dia 25/12/2026, no horário de Brasília. */
export function mostraNatal(agora: Date = new Date()): boolean {
  return agora.getTime() < Date.parse("2026-12-26T03:00:00Z");
}

/** As três músicas tocáveis, as mesmas da `/presente`. */
export const SLUGS_EXEMPLO_MATERIA = ["isabela", "eva", "antonio"] as const;
