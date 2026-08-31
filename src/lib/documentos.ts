// CPF E CEP: máscara e validação.
//
// ── POR QUE VALIDAR CPF AQUI, E NÃO DEIXAR O GATEWAY RECUSAR ─────
//
// O Asaas recusa CPF inválido com "Informe o CPF ou CNPJ do titular do
// cartão", que é a mesma mensagem de campo vazio. A pessoa lê aquilo com o
// campo preenchido e não entende o que fazer.
//
// Pior: cada tentativa recusada é uma tentativa que o antifraude deles conta
// contra a gente. Um dígito trocado — que é o erro mais comum de quem digita
// onze números no celular — vira recusa, e recusa em série vira desconfiança
// no nosso lote inteiro.
//
// O dígito verificador pega isso ANTES de sair da tela, de graça e offline.

const so = (v: string) => (v ?? "").replace(/\D/g, "");

/** `123.456.789-01`, formatado enquanto digita. */
export function mascaraCpf(valor: string): string {
  const d = so(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * O CPF fecha nos dois dígitos verificadores?
 *
 * Rejeita também os onze dígitos repetidos (`111.111.111-11` e irmãos): eles
 * PASSAM na conta do verificador por acidente matemático, e são exatamente o
 * que alguém digita pra "pular" o campo.
 */
export function cpfValido(valor: string): boolean {
  const d = so(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  for (const [ate, pos] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (pos - i);
    const resto = (soma * 10) % 11 % 10;
    if (resto !== Number(d[ate])) return false;
  }
  return true;
}

/** `89223-005`, formatado enquanto digita. */
export function mascaraCep(valor: string): string {
  const d = so(valor).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function cepValido(valor: string): boolean {
  return so(valor).length === 8;
}

/** `1234 5678 9012 3456`, em grupos de quatro. */
export function mascaraCartao(valor: string): string {
  return so(valor)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

/**
 * Os cartões de teste do Asaas, que NÃO passam no Luhn.
 *
 * São números fabricados pra homologação e a documentação deles lista assim
 * mesmo. Sem esta exceção, a validação de Luhn tornaria impossível testar o
 * próprio checkout — e um checkout de cartão que ninguém consegue testar antes
 * de subir é o pior jeito de lançar cobrança.
 *
 * Não é risco em produção: são números que nenhum emissor emite, então quem
 * digitasse um levaria recusa do gateway de qualquer forma.
 */
const CARTOES_DE_TESTE = new Set([
  "4444444444444444", // aprova
  "5184019740373151", // recusa (Mastercard)
  "4916561358240741", // recusa (Visa)
]);

/**
 * O número do cartão passa no Luhn?
 *
 * Mesmo motivo do CPF: um dígito trocado vira recusa, e recusa conta contra a
 * gente no antifraude. O Luhn pega a maioria dos erros de digitação sem
 * chamar ninguém.
 */
export function cartaoValido(valor: string): boolean {
  const d = so(valor);
  if (d.length < 13 || d.length > 19) return false;
  if (CARTOES_DE_TESTE.has(d)) return true;
  let soma = 0;
  let dobra = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (dobra) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
    dobra = !dobra;
  }
  return soma % 10 === 0;
}

/** `12/30`, do jeito que está impresso no cartão. */
export function mascaraValidade(valor: string): string {
  const d = so(valor).slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

/**
 * A validade existe e ainda não passou?
 *
 * Aceita ano de dois dígitos (`30`) e de quatro (`2030`), porque o cartão
 * imprime dois e alguns preenchimentos automáticos entregam quatro.
 */
export function validadeValida(valor: string): boolean {
  const d = so(valor);
  if (d.length !== 4 && d.length !== 6) return false;
  const mes = Number(d.slice(0, 2));
  if (mes < 1 || mes > 12) return false;
  const ano = d.length === 4 ? 2000 + Number(d.slice(2)) : Number(d.slice(2));
  const agora = new Date();
  // O cartão vale até o ÚLTIMO dia do mês impresso.
  const fim = new Date(ano, mes, 1);
  return fim > agora;
}

/** Separa `12/30` no que a API pede: mês e ano de quatro dígitos. */
export function partesValidade(valor: string): { mes: string; ano: string } {
  const d = so(valor);
  const mes = d.slice(0, 2);
  const resto = d.slice(2);
  const ano = resto.length === 2 ? `20${resto}` : resto;
  return { mes, ano };
}
