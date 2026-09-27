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
 * O idioma NÃO é filtrado aqui: ele é conferido depois, só sobre o lote que
 * vai sair, porque puxar o `locale` da base inteira de `quiz_responses` pra
 * decidir sobre 40 pessoas custaria dezenas de milhares de linhas por rodada.
 * Ver `somenteBrasileiros`.
 */
export function montarFila(args: {
  pagos: PedidoPago[];
  /** descadastros + excluídos + endereços que voltaram, tudo junto. */
  bloqueados: Iterable<string>;
  codigos: CodigoExistente[];
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

/**
 * Tira quem comprou fora do funil português.
 *
 * O programa é pt: o funil espanhol cobra em DÓLAR, e a trigger da comissão
 * recusa `locale <> 'pt'`. Um convite pra essas pessoas prometeria uma
 * comissão que o banco nunca vai creditar.
 *
 * Sem `quizId` a pessoa FICA: o pedido antigo sem quiz vinculado é do funil
 * brasileiro (o espanhol nasceu depois), e o custo dos dois erros não é o
 * mesmo — deixar de convidar um comprador legítimo é receita perdida em
 * silêncio, e é o erro que ninguém vai investigar.
 */
export function somenteBrasileiros(
  fila: Convidado[],
  locais: Map<string, string | null>,
): Convidado[] {
  return fila.filter((c) => !c.quizId || (locais.get(c.quizId) ?? "pt") === "pt");
}
