// QUANDO UM BOUNCE BLOQUEIA O ENDEREÇO.
//
// Até 08/10 todo bounce bloqueava pra sempre em `emails_mortos`, inclusive o
// temporário (caixa cheia, servidor ocupado, Gmail adiando). A decisão de
// 15/08 tinha número: 48 dos 55 bounces medidos eram Transient e nenhum
// daqueles endereços voltou a receber. Só que um Transient isolado também é
// o comprador com a caixa cheia num dia ruim, e bloqueado ele perde a letra,
// a recuperação e o magic link de acesso pra sempre (auditoria de 08/10).
//
// O meio-termo: Permanent bloqueia na hora, como sempre. Temporário fica
// REGISTRADO na primeira vez (com `liberado_em` preenchido, que é o que as
// leituras de bloqueio já ignoram) e bloqueia na SEGUNDA. Os 13 repetidos de
// 15/08 foram dois, três envios pro mesmo endereço morto; aqui o endereço
// temporário leva no máximo um a mais antes de travar.
//
// Puro: o webhook do Resend lê a linha anterior e grava o que isto decidir.

/** Quantos bounces temporários até o endereço ser tratado como morto. */
export const TEMPORARIOS_ATE_BLOQUEAR = 2;

/** O Resend manda `bounce.type` = "Permanent" | "Transient" | "Undetermined". */
export function bounceEPermanente(tipo: string | null | undefined): boolean {
  const t = String(tipo ?? "").trim().toLowerCase();
  return t === "permanent" || t === "hard";
}

/**
 * Bloqueia agora?
 *
 * `anterior` é a linha de `emails_mortos` desse endereço (ou `null`), e
 * `leituraFalhou` diz se não deu pra ler. Na dúvida bloqueia: era o
 * comportamento de antes, e um bounce a mais custa reputação do domínio,
 * que é o que decide se a ENTREGA de quem pagou cai na caixa de entrada.
 */
export function decidirBloqueio(args: {
  tipo: string | null | undefined;
  anterior: { vezes?: number | null; liberado_em?: string | null } | null;
  leituraFalhou?: boolean;
}): { bloquear: boolean; vezes: number } {
  const vezes = (args.anterior?.vezes ?? 0) + 1;
  if (args.leituraFalhou) return { bloquear: true, vezes };
  if (bounceEPermanente(args.tipo)) return { bloquear: true, vezes };
  // Já bloqueado continua bloqueado: um temporário não desfaz um Permanent.
  if (args.anterior && !args.anterior.liberado_em) return { bloquear: true, vezes };
  return { bloquear: vezes >= TEMPORARIOS_ATE_BLOQUEAR, vezes };
}
