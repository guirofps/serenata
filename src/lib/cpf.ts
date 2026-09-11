// CPF: normalizar e conferir os dígitos verificadores.
//
// ── POR QUE CONFERIR AQUI, E NÃO DEIXAR PRO ASAAS ────────────────
//
// O Asaas exige `cpfCnpj` pra criar cliente, e recusa CPF inválido com 400.
// Se a gente só repassasse, a pessoa veria "não consegui gerar o PIX agora"
// — a tela de erro genérica — no lugar de "esse CPF não confere". Erro que
// não diz o que fazer é abandono.
//
// E tem o custo: cada tentativa inválida é uma ida e volta ao gateway na
// tela onde a pessoa está esperando o QR.
//
// ── NÃO USA `@/` ─────────────────────────────────────────────────
//
// Mesma regra do `woovi.ts` e do `asaas.ts`: isto é importado pelo caminho
// do pagamento, que roda no runtime Node da Vercel, onde o alias não
// resolve. Só import relativo com `.js`.

/** Só os dígitos. Aceita "123.456.789-09" e "12345678909" igual. */
export function soDigitosCpf(cru: unknown): string {
  return String(cru ?? "").replace(/\D/g, "");
}

/**
 * O CPF é válido?
 *
 * Os dois últimos dígitos são verificadores calculados a partir dos nove
 * primeiros. Isso pega erro de digitação (que é o caso comum) sem consultar
 * nada — não prova que o CPF EXISTE nem que é de quem está pagando, e não é
 * pra isso que serve.
 */
export function cpfValido(cru: unknown): boolean {
  const d = soDigitosCpf(cru);
  if (d.length !== 11) return false;

  // Todos iguais passam na conta dos verificadores ("111.111.111-11" fecha)
  // e são exatamente o que alguém digita pra burlar o campo. Fora.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digito = (ateOnde: number): number => {
    let soma = 0;
    for (let i = 0; i < ateOnde; i++) soma += Number(d[i]) * (ateOnde + 1 - i);
    const resto = (soma * 10) % 11;
    // 10 e 11 viram 0: é a regra da Receita, não um arredondamento.
    return resto >= 10 ? 0 : resto;
  };

  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/** "12345678909" -> "123.456.789-09". Só pra mostrar de volta na tela. */
export function formatarCpf(cru: unknown): string {
  const d = soDigitosCpf(cru).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
