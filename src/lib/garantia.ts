import type { Locale } from "@/lib/i18n";

// GARANTIA INCONDICIONAL — a promessa que faltava no funil inteiro.
//
// Até 10/08 não existia a palavra "reembolso" em lugar nenhum. O mais perto
// era uma pergunta dentro do acordeão do FAQ da oferta ("E se eu não gostar da
// gravação?"), respondida com "a gente resolve" — vago, e escondido atrás de
// um clique que quase ninguém dá.
//
// O concorrente NossaCanção carrega um selo de garantia de 7 dias pelo funil
// inteiro e cobra R$ 97. Nós cobramos R$ 37 sem nenhuma rede de segurança
// declarada, que é a pior combinação possível: barato e sem garantia soa
// arriscado, não soa oportunidade.
//
// ── POR QUE 7 DIAS ──
//
// Não é número escolhido no olho. Compra online no Brasil já tem 7 dias de
// arrependimento por lei (Art. 49 do CDC). O prazo já é obrigação, com ou sem
// selo. Dizer em voz alta não cria risco novo nenhum: transforma uma obrigação
// invisível em argumento de venda, e é o mesmo prazo do concorrente.
//
// Esticar pra 14 ou 30 é decisão comercial de quem paga a conta — muda só o
// número aqui, e o texto se ajusta sozinho nos dois idiomas.

export const DIAS_GARANTIA = 7;

export const GARANTIA: Record<
  Locale,
  { titulo: string; texto: string; curto: string }
> = {
  pt: {
    titulo: `Garantia de ${DIAS_GARANTIA} dias`,
    texto: "Não ficou satisfeito? Reembolso total, sem perguntas.",
    // Versão de uma linha, pro rodapé da faixa do quiz, onde cada pixel
    // vertical é disputado.
    curto: `garantia de ${DIAS_GARANTIA} dias · reembolso sem perguntas`,
  },
  es: {
    titulo: `Garantía de ${DIAS_GARANTIA} días`,
    texto: "¿No quedaste satisfecho? Reembolso total, sin preguntas.",
    curto: `garantía de ${DIAS_GARANTIA} días · reembolso sin preguntas`,
  },
};
