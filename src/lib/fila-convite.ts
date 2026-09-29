// QUEM RECEBE O CONVITE DE INDICAÇÃO — a decisão, sem banco e sem rede.
//
// Separada do job (`inngest/functions/conviteIndicacao.ts`) pelo mesmo motivo
// de `sinais-geracao.ts`: é aqui que mora o erro que ninguém vê. Mandar pra
// quem se descadastrou, mandar duas vezes pra mesma pessoa, ou prometer
// comissão a quem comprou no funil espanhol (onde a trigger nunca vai
// comissionar) são três defeitos que SAEM, chegam na caixa de alguém, e não
// acendem nada em lugar nenhum.
//
// Dentro do job, nada disso é testável sem inventar um Supabase de mentira.
// Aqui é uma função pura: entra lista, sai lista.
//
// SEM IMPORTS além do `primeiroNome`, que também não tem: o job roda no ESM
// do Node na Vercel, onde o alias `@/` derruba o endpoint inteiro.

import { primeiroNome } from "./primeiro-nome.js";

export type PedidoPago = {
  email: string | null;
  nome_pagador: string | null;
  quiz_response_id: string | null;
  /** Usado só pra ordenar: o nome mais recente é o que vale. */
  created_at: string;
};

export type CodigoExistente = {
  email: string;
  codigo: string;
  convite_enviado_em: string | null;
};

export type Convidado = {
  email: string;
  nome: string;
  quizId: string | null;
  /** `null` quando o código ainda não existe — o job cria antes de mandar. */
  codigo: string | null;
};

/**
 * Os candidatos, já sem quem não pode receber, um por e-mail e no máximo
 * `lote`.
 *
 * ── O IDIOMA ENTRA ANTES DO CORTE, E ISSO É UM CONSERTO ─────────
 *
 * A primeira versão cortava em `lote` e SÓ DEPOIS tirava o funil espanhol.
 * Parecia economia (resolver o `locale` de 5 pessoas em vez da base inteira) e
 * era bloqueio de cabeça de fila: o espanhol ocupava a vaga, era descartado, e
 * como nunca era marcado como enviado VOLTAVA a ocupar a mesma vaga na rodada
 * seguinte. Pra sempre.
 *
 * Medido em produção, rodada a rodada: 4, 4, 4, 3, 3, 2, 2, 2, 2, 2. Não era
 * um número fixo — eles se ACUMULAVAM na cabeça, e a curva ia pra zero, onde
 * o disparo pararia sozinho sem nada falhar e sem nada no log.
 *
 * Por isso `quizNaoPt` chega pronto e a exclusão acontece ANTES do `slice`.
 */
export function montarFila(args: {
  pagos: PedidoPago[];
  /** descadastros + excluídos + endereços que voltaram, tudo junto. */
  bloqueados: Iterable<string>;
  codigos: CodigoExistente[];
  /**
   * Os `quiz_response_id` que NÃO são do funil português.
   *
   * ENTRA AQUI, ANTES DO CORTE, e a posição é o conserto inteiro — ver o
   * comentário acima.
   */
  quizNaoPt: Set<string>;
  lote: number;
}): Convidado[] {
  const bloqueado = new Set([...args.bloqueados].map((e) => e.trim().toLowerCase()));
  const jaRecebeu = new Set(
    args.codigos.filter((c) => c.convite_enviado_em).map((c) => c.email.trim().toLowerCase()),
  );
  const codigoDe = new Map(
    args.codigos.map((c) => [c.email.trim().toLowerCase(), c.codigo] as const),
  );

  // Do mais antigo pro mais novo: o `set` sobrescreve, então o último pedido
  // da pessoa é o que decide o nome. Quem comprou duas vezes aparece UMA vez.
  const porEmail = new Map<string, { nome: string; quizId: string | null }>();
  for (const p of [...args.pagos].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const email = (p.email ?? "").trim().toLowerCase();
    if (!email || bloqueado.has(email) || jaRecebeu.has(email)) continue;
    // Sem `quizId` a pessoa FICA: pedido antigo sem quiz vinculado é do funil
    // brasileiro (o espanhol nasceu depois), e os dois erros não custam o
    // mesmo — deixar de convidar um comprador legítimo é receita perdida em
    // silêncio, que é o erro que ninguém vai investigar.
    if (p.quiz_response_id && args.quizNaoPt.has(p.quiz_response_id)) continue;
    const antes = porEmail.get(email);
    porEmail.set(email, {
      // Pedido novo sem nome não apaga o nome que o anterior tinha.
      nome: primeiroNome(p.nome_pagador) || antes?.nome || "",
      quizId: p.quiz_response_id ?? antes?.quizId ?? null,
    });
  }

  return [...porEmail.entries()].slice(0, Math.max(0, args.lote)).map(([email, v]) => ({
    email,
    nome: v.nome,
    quizId: v.quizId,
    codigo: codigoDe.get(email) ?? null,
  }));
}

// ── A RAMPA, porque 4.660 de uma vez dobra o domínio ─────────────
//
// O remetente `ola@envio.serenatagift.com` manda hoje ~380/dia (régua de
// recuperação ~240, oferta do vídeo ~140). Entrar com 440/dia no primeiro dia
// MAIS QUE DOBRA o volume de marketing do domínio de uma hora pra outra, e
// salto assim é o que faz Gmail e Microsoft começarem a segurar entrega — pelo
// mesmo domínio que entrega a música de quem pagou.
//
// A rampa sobe sozinha, medida pelo que JÁ SAIU, não por data: ela não depende
// de ninguém lembrar de mexer, não quebra se o deploy atrasar um dia, e se o
// job ficar parado ela retoma de onde estava em vez de pular pro fim.
//
//   primeiros 200   ->  5 por rodada  (~110/dia, +29% no domínio)
//   até 700         -> 10 por rodada  (~220/dia)
//   daí em diante   -> 20 por rodada  (~440/dia)
//
// Com 4.660 na fila isso dá umas duas semanas, contra os 11 dias do ritmo
// cheio. Os três dias a mais compram a chance de ver a taxa de reclamação nos
// primeiros 200 — e reputação queimada não se desfaz, enquanto e-mail atrasado
// se manda depois.
const DEGRAUS_RAMPA: readonly [number, number][] = [
  [200, 5],
  [700, 10],
];
const LOTE_CHEIO = 20;

/**
 * Quantos mandar nesta rodada.
 *
 * `override` vem de `config_operacao` (a mesma tabela do teto do Suno), pra
 * dar um dial sem deploy: numa alta de reclamação, `0` PAUSA o disparo na
 * hora. Trocar env var na Vercel exige redeploy, e redeploy no meio de um
 * incidente de reputação é lento demais pra servir de freio.
 */
export function loteDaVez(jaEnviados: number, override?: number | null): number {
  if (override !== undefined && override !== null && Number.isFinite(override)) {
    return Math.max(0, Math.floor(override));
  }
  const n = Number.isFinite(jaEnviados) ? Math.max(0, jaEnviados) : 0;
  for (const [ate, lote] of DEGRAUS_RAMPA) {
    if (n < ate) return lote;
  }
  return LOTE_CHEIO;
}
