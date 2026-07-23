// Reagrupa as palavras alinhadas do provedor em LINHAS de letra.
//
// Cuidado principal: o provedor às vezes manda a palavra COM espaço no fim
// ("essa ") e às vezes SEM ("Foi"). Concatenar direto colava palavras —
// saía "Foina Disney", "Macarrãoà bolonhesa", "Doisanos casados" (visto em
// produção). A junção precisa decidir o espaço olhando os dois lados.

export type PalavraAlinhada = { word: string; start: number; end: number };
export type LinhaKaraoke = {
  texto: string;
  inicio: number;
  fim: number;
  marcador: boolean;
};

/** Junta preservando espaços: só insere um quando nenhum dos lados já tem. */
export function juntarPalavras(palavras: string[]): string {
  let texto = "";
  for (const p of palavras) {
    if (texto && !/\s$/.test(texto) && !/^\s/.test(p)) texto += " ";
    texto += p;
  }
  return texto.replace(/\s+/g, " ").trim();
}

export function montarLinhas(words: PalavraAlinhada[]): LinhaKaraoke[] {
  const linhas: LinhaKaraoke[] = [];
  let buf: PalavraAlinhada[] = [];

  const fechar = () => {
    if (!buf.length) return;
    const texto = juntarPalavras(buf.map((w) => w.word));
    if (texto) {
      linhas.push({
        texto,
        inicio: buf[0].start,
        fim: buf[buf.length - 1].end,
        marcador: /^\[.*\]$/.test(texto),
      });
    }
    buf = [];
  };

  for (const w of words) {
    // O provedor embute a quebra de linha DENTRO da palavra.
    if (/\n/.test(w.word)) {
      const partes = w.word.split("\n");
      if (partes[0]) buf.push({ ...w, word: partes[0] });
      fechar();
      const resto = partes.slice(1).join("\n").trim();
      if (resto) buf.push({ ...w, word: resto });
    } else {
      buf.push(w);
    }
  }
  fechar();
  return linhas;
}
