// O MARKDOWN RESTRITO DO BLOG (spec §3.2).
//
// O corpo de cada artigo é texto, nunca HTML. Este parser entende um
// subconjunto pequeno e RECUSA o resto com erro: como o teste de conteúdo
// roda o parser em todos os artigos, um erro de digitação quebra o teste, não
// a página no ar. A saída são blocos tipados, renderizados em componentes —
// por isso não existe `dangerouslySetInnerHTML` em lugar nenhum do blog.

import type { Bloco, Inline } from "./tipos";

// Itálico exige um caractere não-espaço logo depois do `*`: "5* hoje" é texto.
const INLINE = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function idDoTitulo(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function parsearInline(texto: string): Inline[] {
  const saida: Inline[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > ultimo) saida.push({ tipo: "texto", texto: texto.slice(ultimo, i) });
    if (m[1] !== undefined) saida.push({ tipo: "negrito", texto: m[1] });
    else if (m[2] !== undefined) saida.push({ tipo: "italico", texto: m[2] });
    else {
      const href = m[4];
      if (href.startsWith("/")) saida.push({ tipo: "link", texto: m[3], href, interno: true });
      else if (href.startsWith("https://")) saida.push({ tipo: "link", texto: m[3], href, interno: false });
      else throw new Error(`link recusado (só /caminho ou https://): ${href}`);
    }
    ultimo = i + m[0].length;
  }
  if (ultimo < texto.length) saida.push({ tipo: "texto", texto: texto.slice(ultimo) });
  return saida;
}

export function textoDoInline(itens: Inline[]): string {
  return itens.map((t) => t.texto).join("");
}

export function parsearCorpo(corpo: string): Bloco[] {
  const blocos: Bloco[] = [];
  const pedacos = corpo
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const pedaco of pedacos) {
    if (/<[a-zA-Z/!]/.test(pedaco)) throw new Error(`HTML cru não entra no corpo: ${pedaco.slice(0, 40)}`);
    const linhas = pedaco.split("\n").map((l) => l.trim());
    const primeira = linhas[0];

    if (/^#\s/.test(primeira)) throw new Error("H1 é o título do artigo, não o corpo");
    const titulo = /^(#{2,3})\s+(.+)$/.exec(primeira);
    if (titulo) {
      if (linhas.length > 1) throw new Error(`título precisa de linha em branco depois: ${primeira}`);
      const texto = titulo[2].trim();
      blocos.push(titulo[1] === "##" ? { tipo: "h2", texto, id: idDoTitulo(texto) } : { tipo: "h3", texto });
      continue;
    }
    if (primeira.startsWith("#")) throw new Error(`título não suportado: ${primeira}`);

    if (primeira.startsWith("[[")) {
      const b = /^\[\[([a-z]+)(?::([^\]]+))?\]\]$/.exec(primeira);
      if (!b || linhas.length > 1) throw new Error(`bloco mal formado: ${primeira}`);
      if (b[1] === "musica" && b[2]) {
        blocos.push({ tipo: "musica", slug: b[2].trim() });
        continue;
      }
      if (b[1] === "cta") {
        blocos.push(b[2] ? { tipo: "cta", texto: b[2].trim() } : { tipo: "cta" });
        continue;
      }
      throw new Error(`bloco desconhecido: ${primeira}`);
    }

    const marcadas = (re: RegExp) => linhas.filter((l) => re.test(l)).length;
    const lista = marcadas(/^- /);
    const numerada = marcadas(/^\d+\.\s/);
    const citacao = marcadas(/^>/);
    if (lista === linhas.length) {
      blocos.push({ tipo: "lista", ordenada: false, itens: linhas.map((l) => parsearInline(l.slice(2).trim())) });
      continue;
    }
    if (numerada === linhas.length) {
      blocos.push({
        tipo: "lista",
        ordenada: true,
        itens: linhas.map((l) => parsearInline(l.replace(/^\d+\.\s+/, ""))),
      });
      continue;
    }
    if (citacao === linhas.length) {
      blocos.push({ tipo: "citacao", linhas: linhas.map((l) => l.replace(/^>\s?/, "")) });
      continue;
    }
    if (lista || numerada || citacao) throw new Error(`lista ou citação misturada com texto: ${primeira}`);

    blocos.push({ tipo: "p", inline: parsearInline(linhas.join(" ")) });
  }
  return blocos;
}

export function contarPalavras(blocos: Bloco[]): number {
  const textos = blocos.flatMap((b): string[] => {
    switch (b.tipo) {
      case "p":
        return [textoDoInline(b.inline)];
      case "h2":
      case "h3":
        return [b.texto];
      case "lista":
        return b.itens.map(textoDoInline);
      case "citacao":
        return b.linhas;
      default:
        return [];
    }
  });
  return textos.join(" ").split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}
