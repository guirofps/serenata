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
 * ATENÇÃO AO FORMATO: celular brasileiro tem 9 dígitos depois do DDD desde
 * 2016 (o "nono dígito"). Um número com 8 gera um link que abre o WhatsApp
 * dizendo que o contato não existe, e isso apareceria pra TODO comprador.
 *
 * Já aconteceu de um número entrar quebrado na base sem ninguém notar: o
 * comprador de 15/08 ficou inalcançável porque o telefone dele tinha dígitos
 * faltando, e só foi descoberto quando o suporte tentou usá-lo.
 */
// VAZIO = BOTÃO DESLIGADO. `linkSuporte` devolve null e nada é renderizado.
//
// Está assim de propósito. O número informado foi "+55 65 9919-3386", que tem
// 8 dígitos depois do DDD, e celular brasileiro tem 9 desde 2016. Falta o
// nono dígito, e existem duas leituras possíveis:
//
//   5565999193386   (o 9 na frente, mais provável)
//   5565991933386   (o 9 no meio)
//
// Publicar o errado é pior que não ter botão: ele vai pra tela de obrigado, pro
// editor e pro e-mail de entrega, então TODO comprador clicaria e receberia
// "esse número não está no WhatsApp". E a gente só descobriria pelo ticket.
//
// Pra ligar: teste os dois links wa.me no celular, veja qual abre a conversa
// do atendimento, e ponha os dígitos aqui.
const NUMERO = "";

/** Só dígitos e tamanho plausível de celular com DDI. */
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
}): string | null {
  if (!numeroValido()) return null;
  const musica = args.titulo?.trim();
  const texto =
    args.locale === "es"
      ? `Hola! Acabo de comprar mi canción${musica ? ` "${musica}"` : ""} en Serenata` +
        (args.token ? ` (${args.token})` : "") +
        ` y necesito ayuda.`
      : `Oi! Acabei de comprar minha música${musica ? ` "${musica}"` : ""} na Serenata` +
        (args.token ? ` (${args.token})` : "") +
        ` e preciso de ajuda.`;
  return `https://wa.me/${NUMERO.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

export const TEXTO_SUPORTE = {
  pt: {
    titulo: "Precisa de ajuda?",
    sub: "Fale com a gente no WhatsApp. A gente responde de verdade.",
    botao: "Chamar no WhatsApp",
  },
  es: {
    titulo: "¿Necesitas ayuda?",
    sub: "Habla con nosotros por WhatsApp. Contestamos de verdad.",
    botao: "Escribir por WhatsApp",
  },
} as const;
