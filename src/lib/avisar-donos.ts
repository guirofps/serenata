// TODO AVISO DE OPERAÇÃO PASSA POR AQUI: e-mail pros donos + WhatsApp.
//
// ── POR QUE UM LUGAR SÓ ───────────────────────────────────────────
//
// Em 27/09 o endereço dos donos estava cravado a mão em 18 arquivos, e o
// efeito apareceu no dia em que a letra parou: o alerta existia, disparou, e
// foi pra uma caixa só. `donos.ts` resolveu QUEM recebe; este módulo resolve
// COMO, e pela mesma razão — o pedido foi "me avisa SEMPRE que tiver
// problema", e "sempre" não sobrevive a doze cópias do código de envio. A
// décima terceira vai esquecer o WhatsApp.
//
// ── O WHATSAPP SOMA, NÃO SUBSTITUI ────────────────────────────────
//
// O CallMeBot é grátis e "personal use" pelo próprio site deles: pode
// atrasar, limitar ou parar, sem contrato. Ele acorda alguém rápido; o
// e-mail é o registro que fica. Por isso os dois saem SEMPRE, e a falha de um
// nunca impede o outro — são dois `try` separados, de propósito.
//
// ── NUNCA LANÇA ───────────────────────────────────────────────────
//
// Mesma disciplina do `enviar()` que este módulo substitui: se o aviso
// estourasse, ele derrubaria o caminho que estava só tentando reportar um
// problema, e o usuário trocaria um erro por outro, pior de diagnosticar.

import { Resend } from "resend";
import { DONOS } from "./donos.js";
import { lerDestinos, urlDoAviso } from "./callmebot.js";
import { MARCA_ATIVA } from "./marca-identidade.js";

// ── O REMETENTE VEM DA MARCA DO DEPLOY ───────────────────────────
//
// Desde 29/09 existe a Ballad Gift, a marca irmã nos EUA, rodando no MESMO
// código. Um endereço cravado aqui faria o alerta da Ballad sair assinado
// "Serenata" — e, pior, do domínio errado, que é o tipo de coisa que derruba
// reputação do remetente que nada tem a ver com a falha.
//
// O e-mail de alerta é TRANSACIONAL (domínio raiz), não recuperação: quem
// recebe é o dono, e a reputação que importa aqui é a do canal que precisa
// chegar mesmo quando tudo está pegando fogo.
const REMETENTE = MARCA_ATIVA.remetenteTransacional;

/** Tira as etiquetas pra virar texto de WhatsApp legível. */
export function htmlParaTexto(html: string): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

async function mandarEmail(assunto: string, html: string, extras: string[]): Promise<void> {
  try {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) return;
    const para = [...new Set([...DONOS, ...extras.filter(Boolean)])];
    await new Resend(chave).emails.send({ from: REMETENTE, to: para, subject: assunto, html });
  } catch (err) {
    console.error("[aviso] e-mail não saiu:", err);
  }
}

/**
 * Só o WhatsApp, sem e-mail.
 *
 * Existe pro aviso de vendas das 12h e das 22h: ele não é um problema, é um
 * pulso. Mandá-lo por e-mail também empilharia dois e-mails por dia em cima
 * do resumo diário que já existe, e caixa cheia de rotina é como o aviso que
 * IMPORTA passa despercebido.
 */
export async function avisarWhats(texto: string): Promise<void> {
  await mandarWhats(texto).catch((err) => console.error("[aviso] whats:", err));
}

async function mandarWhats(texto: string): Promise<void> {
  const destinos = lerDestinos(process.env.CALLMEBOT_DONOS);
  if (!destinos.length) return;
  await Promise.all(
    destinos.map(async (d) => {
      try {
        // Timeout curto: o CallMeBot é de graça e às vezes pendura. Um alerta
        // que trava por 30s dentro de um webhook de pagamento custa mais do
        // que o aviso vale — e o e-mail já saiu de qualquer jeito.
        const r = await fetch(urlDoAviso(d, texto), {
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) {
          console.error(`[aviso] whats ${d.telefone}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
        }
      } catch (err) {
        // Nome do erro, não o objeto: a URL carrega a apikey e ela não pode
        // acabar num log que outra pessoa lê.
        console.error(`[aviso] whats ${d.telefone} falhou:`, (err as Error).message);
      }
    }),
  );
}

/**
 * Manda o aviso pelos dois canais. Não lança nunca.
 *
 * `whats` é o texto curto do celular. Quando não vem, ele é derivado do HTML —
 * e derivar é melhor que repetir: um segundo texto escrito à mão é um texto
 * que vai ficar desatualizado em relação ao e-mail.
 */
export async function avisarDonos(args: {
  assunto: string;
  html: string;
  /** Texto do WhatsApp. Sem isto, sai do `assunto` + o corpo sem etiquetas. */
  whats?: string;
  /** Quem mais recebe o E-MAIL (a agência, um sócio). O WhatsApp é só dos donos. */
  extras?: string[];
}): Promise<void> {
  const texto = args.whats ?? `*${args.assunto}*\n\n${htmlParaTexto(args.html)}`;
  // Os dois em paralelo e com `allSettled`: a falha de um canal não pode
  // impedir o outro, que é a razão de existirem dois.
  await Promise.allSettled([
    mandarEmail(args.assunto, args.html, args.extras ?? []),
    mandarWhats(texto),
  ]);
}
