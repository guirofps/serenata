// LER O JSON QUE O MODELO DEVOLVE, MESMO COM DEFEITO PEQUENO.
//
// A letra vem do Claude como {"titulo","letra","estilo_suno","verso_destaque"}.
// Em 6 a 7% das letras (medido de 23 a 27/09, todo dia) o JSON vinha com um
// defeito miúdo e o `JSON.parse` estrito quebrava. A pessoa via a letra sendo
// escrita, a tela voltava pro "carregando" e tudo recomeçava por uma segunda
// chamada: uns 13 segundos a mais e o dobro do custo. Os três erros vistos:
//
//   "Expected ':' after property name"  → aspa sem escape DENTRO do texto
//                                          (letra com fala: ela disse "sim")
//   "Bad control character in string"   → quebra de linha crua dentro do texto
//   "Bad escaped character"             → barra seguida de algo que não é escape
//
// O conserto só roda quando o parse estrito falha, e é conservador: uma aspa
// dentro de texto só é tratada como FIM do texto se o que vem depois dela é o
// que viria depois de um valor ou de uma chave (vírgula, dois-pontos, fecha
// chaves/colchetes, ou o fim). Qualquer outra aspa vira \".

const ESCAPES_VALIDOS = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);

/** Conserta os três defeitos acima, sem mexer em JSON que já é válido. */
export function consertarJson(texto: string): string {
  let out = "";
  let dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (!dentro) {
      out += c;
      if (c === '"') dentro = true;
      continue;
    }
    if (c === "\\") {
      const p = texto[i + 1];
      if (p !== undefined && ESCAPES_VALIDOS.has(p)) {
        out += c + p;
        i++;
      } else {
        out += "\\\\"; // barra solta vira barra literal
      }
      continue;
    }
    if (c === "\n") {
      out += "\\n";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\t") {
      out += "\\t";
      continue;
    }
    if (c === '"') {
      // Fim de verdade? Olha o próximo caractere que não é espaço.
      let j = i + 1;
      while (j < texto.length && /\s/.test(texto[j])) j++;
      const prox = texto[j];
      if (prox === undefined || prox === "," || prox === ":" || prox === "}" || prox === "]") {
        out += c;
        dentro = false;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Primeiro objeto JSON do texto: parse estrito, e só se falhar, o consertado.
 * Lança a mensagem ORIGINAL se nem o conserto salvar, pra o log continuar
 * dizendo o que o modelo mandou de errado.
 */
export function extrairJsonTolerante<T>(texto: string): T {
  const s = texto.indexOf("{");
  const e = texto.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Resposta do modelo não continha JSON");
  const bruto = texto.slice(s, e + 1);
  try {
    return JSON.parse(bruto) as T;
  } catch (erro) {
    try {
      return JSON.parse(consertarJson(bruto)) as T;
    } catch {
      throw erro;
    }
  }
}
