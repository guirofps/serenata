// O DOCUMENTO DO MÉXICO NO OXXO (Ballad, 29/10/2026).
//
// A página da dLocal Go pedia o documento e a pessoa digitava o que achava que
// era: "ife" (o NOME do documento, sem o número) e "mamv660422" (o RFC sem os 3
// últimos caracteres, a homoclave, que muita gente não sabe de cor). A dLocal
// recusava com "Documento inválido" DEPOIS que a pessoa já tinha escolhido
// pagar. Agora o documento é pedido na NOSSA folha, conferido aqui, e vai pronto
// no `payer` do pagamento: a página deles só pede o que a gente não manda.
//
// O que a dLocal aceita no México: CURP, RFC, IFE (e passaporte). A CURP é a
// que todo mundo tem (vem impressa na INE) e é a única com dígito verificador,
// então é a que a tela pede; RFC com homoclave e a clave de elector da INE
// também passam, reconhecidos pelo formato.
//
// Puro, sem imports: a folha (navegador) e o servidor usam a mesma regra.

export type TipoDocumentoMx = "CURP" | "RFC" | "IFE";

export type DocumentoMx =
  { ok: true; tipo: TipoDocumentoMx; documento: string } | { ok: false; motivo: MotivoDocumentoMx };

export type MotivoDocumentoMx =
  "vazio" | "nome_do_documento" | "rfc_sem_homoclave" | "curp_digito" | "formato";

const ESTADOS =
  "AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE";
const DATA = "\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])";
const CURP = new RegExp(
  `^[A-Z][AEIOUX][A-Z]{2}${DATA}[HMX](?:${ESTADOS})[B-DF-HJ-NP-TV-Z]{3}[A-Z\\d]\\d$`,
);
const RFC_PESSOA = new RegExp(`^[A-ZÑ&]{4}${DATA}[A-Z\\d]{3}$`);
const RFC_SEM_HOMOCLAVE = new RegExp(`^[A-ZÑ&]{4}${DATA}$`);
const CLAVE_ELECTOR = new RegExp(`^[A-Z]{6}${DATA}\\d{2}[HM]\\d{3}$`);

/** Maiúsculo, sem espaço, hífen nem ponto: como a pessoa copia da INE. */
export function normalizarDocumentoMx(texto: string): string {
  return String(texto ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-̂̄-ͯ]/g, "") // tira acento, mas mantém o til do Ñ (U+0303)
    .normalize("NFC")
    .replace(/[\s.\-_/]/g, "");
}

/** O dígito verificador da CURP (18º caractere), pela regra do RENAPO. */
export function digitoCurp(primeiros17: string): number {
  const tabela = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  let soma = 0;
  for (let i = 0; i < 17; i++) soma += tabela.indexOf(primeiros17[i]) * (18 - i);
  return (10 - (soma % 10)) % 10;
}

export function validarDocumentoMx(texto: string): DocumentoMx {
  const d = normalizarDocumentoMx(texto);
  if (!d) return { ok: false, motivo: "vazio" };
  if (/^(IFE|INE|CURP|RFC|PASAPORTE|PASS|CREDENCIAL)$/.test(d))
    return { ok: false, motivo: "nome_do_documento" };
  if (d.length === 18 && CURP.test(d)) {
    if (digitoCurp(d.slice(0, 17)) !== Number(d[17])) return { ok: false, motivo: "curp_digito" };
    return { ok: true, tipo: "CURP", documento: d };
  }
  if (d.length === 18 && CLAVE_ELECTOR.test(d)) return { ok: true, tipo: "IFE", documento: d };
  if (d.length === 13 && RFC_PESSOA.test(d)) return { ok: true, tipo: "RFC", documento: d };
  if (d.length === 10 && RFC_SEM_HOMOCLAVE.test(d))
    return { ok: false, motivo: "rfc_sem_homoclave" };
  return { ok: false, motivo: "formato" };
}

/** O que a folha diz pra cada erro, em espanhol, apontando o conserto. */
export const MENSAGEM_DOCUMENTO_MX: Record<MotivoDocumentoMx, string> = {
  vazio: "Escribe tu CURP para generar la ficha.",
  nome_do_documento:
    "Escribe el número del documento, no su nombre. Tu CURP tiene 18 caracteres y viene en tu INE.",
  rfc_sem_homoclave:
    "A tu RFC le faltan los 3 últimos caracteres (la homoclave). Mejor escribe tu CURP: tiene 18 caracteres y viene en tu INE.",
  curp_digito: "Esa CURP tiene un carácter equivocado. Revísala en tu INE: son 18 caracteres.",
  formato:
    "No reconocemos ese documento. Escribe tu CURP: 18 caracteres (4 letras, 6 números, 6 letras y 2 al final), viene en tu INE.",
};

/** Nome completo pra ficha: pelo menos nome e sobrenome, sem número. */
export function nomeCompletoValido(nome: string): boolean {
  const n = String(nome ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return n.length >= 5 && n.length <= 100 && n.split(" ").length >= 2 && !/\d/.test(n);
}
