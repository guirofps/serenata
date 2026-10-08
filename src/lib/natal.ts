import { isQuestion, type ChipOption, type FlowStep } from "@/lib/flow-engine";

// NATAL COMO OCASIÃO DO QUIZ (08/10/2026). Conteúdo sazonal, não teste A/B.
//
// O chip "Natal" só aparece de 15/11 a 31/12, no fuso de Brasília. Fora da
// janela ele some da tela, mas o VALOR continua aceito em todo lugar que lê
// ocasião (os três mapas do prompt em `letra-prompt*.ts`): quem escolheu Natal
// em 31/12 e gera a letra em 01/01 não pode cair no "momento especial".
//
// Um `value` só pros três idiomas (`natal`), como as outras ocasiões: é o
// contrato com o banco, o prompt e o painel. O rótulo é que muda.
//
// Entra em PRIMEIRO lugar dentro da janela. A ordem do passo é por demanda
// medida no painel (ver `quiz-flow.ts`), e de meados de novembro ao fim do ano
// quem chega pelo anúncio de Natal procura o chip de Natal antes de qualquer
// outro. Fora da janela a ordem de sempre fica intacta.

export const OCASIAO_NATAL = "natal";

/** O passo de ocasião que recebe o chip. O `ocasiao_louvor` do gospel fica de fora. */
const PASSO_OCASIAO = "ocasiao";

const OPCAO: Record<"pt" | "es" | "en", ChipOption> = {
  pt: { value: OCASIAO_NATAL, label: "Natal", emoji: "🎄" },
  es: { value: OCASIAO_NATAL, label: "Navidad", emoji: "🎄" },
  en: { value: OCASIAO_NATAL, label: "Christmas", emoji: "🎄" },
};

/**
 * Dentro de 15/11 a 31/12, contado no dia de BRASÍLIA.
 *
 * UTC-3 fixo, como `ocasioes.ts`: o Brasil não tem horário de verão desde
 * 2019, e o servidor (Vercel) roda em UTC. Sem isto, das 21h às 23h59 de
 * 31/12 em Brasília o servidor já estaria em 01/01 e esconderia o chip, e o
 * HTML do servidor divergiria do que o navegador do Brasil monta.
 */
export function natalNaJanela(agora: Date = new Date()): boolean {
  const brasilia = new Date(agora.getTime() - 3 * 3600_000);
  const mes = brasilia.getUTCMonth() + 1;
  const dia = brasilia.getUTCDate();
  return (mes === 11 && dia >= 15) || mes === 12;
}

/**
 * O mesmo fluxo com o chip de Natal na frente das ocasiões. Pura: devolve um
 * array novo e não mexe no original (os fluxos são constantes de módulo).
 */
export function comNatal(flow: FlowStep[], locale: "pt" | "es" | "en"): FlowStep[] {
  const opcao = OPCAO[locale];
  return flow.map((passo) => {
    if (passo.id !== PASSO_OCASIAO || !isQuestion(passo) || passo.input !== "chips") return passo;
    if (passo.options.some((o) => o.value === OCASIAO_NATAL)) return passo;
    return { ...passo, options: [opcao, ...passo.options] };
  });
}
