// QUEM NÃO RECEBE MAIS.
//
// O bounce já era registrado e já alertava, mas nada consultava esse registro
// antes do próximo envio. Em 14 dias isso produziu 13 e-mails disparados pra
// endereço que já tinha voltado: o Edeilson levou três no mesmo endereço morto,
// o Rodrigo dois, e outros dez levaram dois cada.
//
// Não é desperdício de e-mail, é dano. A reputação do domínio é o que decide
// se a ENTREGA da música (o único e-mail que carrega produto pago) cai na
// caixa de entrada ou no spam, e 84% dos compradores estão no Gmail, que é
// justamente quem está devolvendo 4,3% do que a gente manda.
//
// Fica aqui e não em `src/lib` porque quem consulta é job e webhook, e a
// tabela só é legível pelo service role.
//
// ── FALHA FECHADA (08/10) ────────────────────────────────────────
//
// Esta checagem FALHAVA ABERTA: qualquer exceção virava "ninguém bloqueado", e
// o erro da consulta a `descadastros` nem era lido (só o de `emails_mortos`).
// Com o banco lento, quem apertou "cancelar inscrição" voltava a receber
// marketing, e endereço morto voltava a bater: exatamente o padrão do
// incidente de 04/10, onde uma consulta que estourou o tempo virou "pode
// mandar" e a letra saiu até 32 vezes pra mesma pessoa.
//
// A justificativa antiga ("não segurar a entrega de quem pagou") não vale:
// nenhuma entrega passa por aqui. Quem chama é régua de recuperação, oferta e
// lembrete, e o custo de não mandar UMA rodada é a rodada seguinte mandar.
// Então, na dúvida, bloqueado:
//   - `bloqueados()` LANÇA, e o passo do Inngest não manda o lote (e tenta de
//     novo). Lançar, e não devolver "todos bloqueados", porque o
//     `campanhaMusica10` grava `pulado = 'bloqueado'` pra quem volta daqui, e
//     um soluço do banco marcaria 100 pessoas pra sempre.
//   - `estaBloqueado()` devolve `true`, e o chamador pula a pessoa.
import type { SupabaseClient } from "@supabase/supabase-js";

export type OpcoesBloqueio = {
  /**
   * Conta também `excluidos_email`: cortesias, contas internas e quem foi
   * LIBERADO na recuperação (tem a música inteira sem pedido pago). Vale pra
   * toda régua que oferece compra ou cobra quem "não comprou". Fica de fora
   * nos lembretes de quem já pagou (vídeo, link), que essas pessoas também
   * precisam receber.
   */
  incluirExcluidos?: boolean;
};

/** Quantos endereços por `.in()`: centenas numa URL só voltam "Bad Request". */
const LOTE = 100;

/**
 * Endereços bloqueados dentro de uma lista, em minúsculas.
 *
 * Recebe a lista inteira e devolve um Set, em vez de responder um por vez:
 * os crons mandam em lote, e uma consulta por destinatário seria N chamadas
 * por rodada.
 *
 * LANÇA se qualquer consulta falhar (ver o cabeçalho).
 */
export async function bloqueados(
  db: SupabaseClient,
  emails: string[],
  opcoes: OpcoesBloqueio = {},
): Promise<Set<string>> {
  const limpos = emails.filter(Boolean).map((e) => e.trim()).filter(Boolean);
  // A grafia original E a minúscula: `excluidos_email` recebe o e-mail como o
  // pedido trouxe (`recuperacao.ts`), e `.in()` compara byte a byte.
  const alvos = [...new Set([...limpos, ...limpos.map((e) => e.toLowerCase())])];
  const fora = new Set<string>();
  for (let i = 0; i < alvos.length; i += LOTE) {
    const lote = alvos.slice(i, i + LOTE);
    // Mortos (bounce) E descadastrados: desde 25/09 o "Cancelar inscrição"
    // do Outlook/Gmail grava em `descadastros`, e ele tem que valer em toda
    // régua que usa esta checagem, não só na escada. (Os transacionais, como
    // a entrega, não passam por aqui.)
    const consultas = [
      db.from("emails_mortos").select("email").in("email", lote).is("liberado_em", null),
      db.from("descadastros").select("email").in("email", lote),
      ...(opcoes.incluirExcluidos ? [db.from("excluidos_email").select("email").in("email", lote)] : []),
    ];
    const respostas = await Promise.all(consultas);
    for (const r of respostas) {
      if (r.error) throw new Error(`[emails-mortos] lista de bloqueio ilegível: ${r.error.message}`);
      for (const linha of r.data ?? []) fora.add(String(linha.email).trim().toLowerCase());
    }
  }
  return fora;
}

/**
 * Versão de um endereço só, pros caminhos que não mandam em lote.
 *
 * Erro de banco devolve `true` (bloqueado): o chamador pula esta pessoa nesta
 * rodada e ela volta na próxima.
 */
export async function estaBloqueado(
  db: SupabaseClient,
  email: string,
  opcoes: OpcoesBloqueio = {},
): Promise<boolean> {
  try {
    return (await bloqueados(db, [email], opcoes)).has(email.trim().toLowerCase());
  } catch (err) {
    console.error("[emails-mortos] consulta falhou, pulando por segurança:", email, err);
    return true;
  }
}
