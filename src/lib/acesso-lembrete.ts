// "VOCÊ AINDA NÃO OUVIU A SUA MÚSICA" (teste `acesso_lembrete`, Serenata, 10/11/2026).
//
// ── POR QUÊ ──────────────────────────────────────────────────────
//
// Medido em 10/11 (1.446 compradores de 15/10 a 08/11): 16% não abrem o editor
// nas 24h depois de pagar; a maioria chega pela página do presente, mas 3% (uns
// 1 a 2 por dia) não dão NENHUM sinal: nem editor, nem página, nem e-mail aberto.
// É de onde sai o "paguei e não recebi" e o medo de parecer golpe. O e-mail de
// entrega no Gmail caiu de ~47% de abertura (25/10-05/11) pra 27% (09/11): ele
// chega, mas cai fora da caixa de entrada.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = como hoje (entrega + o lembrete de montar o presente de sempre).
//   B = 24h depois de pagar, SÓ pra quem não deu sinal de acesso, um e-mail curto
//       em texto puro pela caixa de verdade (contato@, Hostinger), que é como uma
//       pessoa escreve e entra melhor que o envio em massa.
//
// Braço pelo 8º caractere do fim do id do quiz (os testes de e-mail usam o 2º ao
// 5º; o 6º e o 7º são da Ballad): sorteios independentes, recalculável na leitura.
// Os dois braços gravam a trava `acesso_lembrete` (com o braço), pra a leitura
// saber quem ENTRARIA no teste no A também.
//
// ── LEITURA ──────────────────────────────────────────────────────
//
// Entre os que entraram (trava gravada), % que abre o editor ou a página em 72h,
// por braço; pedidos de suporte "não recebi" e contestação por braço.
//
// Regra pura aqui; quem envia é `inngest/functions/lembrarAcesso.ts`.

export type BracoAcesso = "A" | "B";

/** Desliga o envio do B sem deploy de código: `ACESSO_LEMBRETE_OFF=1` na Vercel (e redeploy). */
export const LIGADO = true;

/** Só depois de 24h: antes disso a /obrigado e o e-mail de entrega ainda estão fazendo o trabalho deles. */
export const MIN_H = 24;
/** Compra mais velha que 72h não entra: lembrete tardio demais vira cobrança. */
export const MAX_H = 72;
/** Teto por rodada (de hora em hora). A demanda medida é ~1 a 2 por dia no B. */
export const MAX_POR_RODADA = 20;

export function bracoAcesso(quizId: string | null | undefined): BracoAcesso {
  const limpo = String(quizId ?? "").replace(/-/g, "");
  const c = limpo[limpo.length - 8];
  if (!c || !/^[0-9a-f]$/i.test(c)) return "A";
  return parseInt(c, 16) % 2 === 1 ? "B" : "A";
}

/** Sinais de que a pessoa chegou no que comprou, a partir do pagamento. */
export type SinaisAcesso = {
  abriuEditor: boolean;
  abriuPagina: boolean;
  clicouEmail: boolean;
  montou: boolean;
};

export function semSinalDeAcesso(s: SinaisAcesso): boolean {
  return !s.abriuEditor && !s.abriuPagina && !s.clicouEmail && !s.montou;
}

export function assuntoAcesso(nome: string): string {
  return `A música de ${nome} está te esperando`;
}

/** Texto puro, curto, sem cara de disparo. Sem travessão (regra do funil). */
export function textoAcesso(args: { nome: string; titulo: string | null; linkEditor: string }): string {
  const musica = args.titulo ? `"${args.titulo}"` : `a música de ${args.nome}`;
  return `Olá!

Seu pagamento entrou e ${musica} já está pronta, mas vimos que você ainda não conseguiu abrir.

É só tocar neste link pra ouvir a música completa, baixar o MP3 e pegar o link do presente:
${args.linkEditor}

Se o link não abrir, entre em serenatagift.com/login com este mesmo e-mail que a sua música aparece lá.

Qualquer dúvida, é só responder este e-mail que a gente te ajuda.

Um abraço,
Equipe Serenata`;
}
