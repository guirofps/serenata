// O WHATSAPP DO ATENDIMENTO, e onde ele pode aparecer.
//
// Pedido do atendente: em vez de ele ter que mandar a música pra cada pessoa
// que pediu, deixar que a pessoa o procure. Enquanto a entrega automática por
// WhatsApp não existe, isso tira trabalho manual dele e dá um canal de suporte
// que não depende do e-mail chegar.
//
// ── SÓ DEPOIS DO PAGAMENTO. NUNCA ANTES. ─────────────────────────
//
// Número visível antes da compra é uma saída do funil: a pessoa sai da tela de
// pagamento pra "tirar uma dúvida", e a conversa vira negociação, desconto ou
// nada. O funil inteiro é desenhado pra levar do quiz ao checkout sem desvio.
//
// Por isso este módulo é importado só em três lugares, todos pós-pagamento:
// a tela de obrigado, o e-mail de entrega e o editor do presente. Se um dia
// alguém importar isto numa tela do funil, está errado.

/**
 * Número do atendimento, em dígitos, com DDI.
 *
 * VAZIO DESLIGA O BOTÃO: `linkSuporte` devolve null e nada é renderizado.
 */
const NUMERO = "5511950557212";

/**
 * Só dígitos e tamanho plausível de celular com DDI.
 *
 * O piso é 12, não 13: o atendimento já usou um número de 8 dígitos depois do
 * DDD (conta de WhatsApp anterior a 2016, DDD acima de 30), que é válido e dá
 * 55 + DDD de 2 + 8 = 12. Exigir 13 desligaria um número que funciona.
 */
export function numeroValido(n: string = NUMERO): boolean {
  const so = n.replace(/\D/g, "");
  return so.length >= 12 && so.length <= 15;
}

/**
 * Link do WhatsApp com mensagem pronta.
 *
 * A mensagem carrega o TÍTULO da música e o começo do link do presente. Sem
 * isso o atendente recebe "oi" e precisa perguntar quem é, o que é justamente
 * o trabalho que este botão deveria poupar.
 */
export function linkSuporte(args: {
  locale: "pt" | "es";
  titulo?: string | null;
  token?: string | null;
  /** Nome de quem comprou, pra mensagem sair assinada. */
  nome?: string | null;
  /**
   * `ajuda`   — "preciso de ajuda", genérico.
   * `receber` — "quero receber minha música", que é o pedido de verdade de
   *             quem comprou e não achou o e-mail.
   */
  motivo?: "ajuda" | "receber";
}): string | null {
  if (!numeroValido()) return null;
  const musica = args.titulo?.trim();
  const quem = args.nome?.trim();
  const ref = args.token ? ` (${args.token})` : "";

  // A MENSAGEM VAI PRONTA, e isso não é enfeite: o atendente recebe "oi" e
  // gasta três mensagens perguntando quem é, qual música e qual e-mail. Com
  // nome, título e código na primeira linha, ele já procura e responde. É o
  // trabalho manual que este botão existe pra poupar.
  const texto =
    args.motivo === "receber"
      ? args.locale === "es"
        ? `Hola! Soy ${quem || "un cliente"} y acabo de comprar mi canción` +
          `${musica ? ` "${musica}"` : ""}${ref} en Serenata. ` +
          `Me gustaría recibir las dos versiones, por favor.`
        : `Oi! Eu sou ${quem || "cliente"} e acabei de comprar minha música` +
          `${musica ? ` "${musica}"` : ""}${ref} na Serenata. ` +
          `Gostaria de receber as duas versões, por favor.`
      : args.locale === "es"
        ? `Hola! Acabo de comprar mi canción${musica ? ` "${musica}"` : ""} en Serenata` +
          `${ref} y necesito ayuda.`
        : `Oi! Acabei de comprar minha música${musica ? ` "${musica}"` : ""} na Serenata` +
          `${ref} e preciso de ajuda.`;

  return `https://wa.me/${NUMERO.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

export const TEXTO_SUPORTE = {
  pt: {
    titulo: "Precisa de ajuda?",
    sub: "Fale com a gente no WhatsApp. A gente responde de verdade.",
    botao: "Chamar no WhatsApp",
    receberTitulo: "Quer receber sua música pelo WhatsApp?",
    receberSub:
      "Toque no botão abaixo e fale com o nosso atendimento. A mensagem já vai escrita com os seus dados: é só enviar, e a gente manda as duas versões pra você.",
    receberBotao: "Solicitar minha música no WhatsApp",
  },
  es: {
    titulo: "¿Necesitas ayuda?",
    sub: "Habla con nosotros por WhatsApp. Contestamos de verdad.",
    botao: "Escribir por WhatsApp",
    receberTitulo: "¿Quieres recibir tu canción por WhatsApp?",
    receberSub:
      "Toca el botón de abajo y habla con nuestro equipo. El mensaje ya va escrito con tus datos: solo tienes que enviarlo y te mandamos las dos versiones.",
    receberBotao: "Solicitar mi canción por WhatsApp",
  },
} as const;
