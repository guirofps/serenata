// AS REGRAS DE SEO E DE COPY DO BLOG, num lugar só (spec §4 e §5).
//
// Devolve a lista de problemas em vez de lançar: o teste de conteúdo mostra
// TODOS os problemas de um artigo de uma vez, e não só o primeiro.

import { contarPalavras, normalizar, parsearCorpo, textoDoInline } from "./markdown";
import type { Artigo, Bloco } from "./tipos";

export type ContextoValidacao = { slugsPauta: Set<string>; slugsExemplos: Set<string> };

const SUFIXO = " | Serenata";
const ROTAS = new Set(["/", "/criar", "/blog", "/musica-personalizada-para-esposa"]);
const PRECO = /R\$\s*\d/;
const PROIBIDAS = /60 segundos|entrega expressa/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function linksDoCorpo(blocos: Bloco[]) {
  return blocos.flatMap((b) =>
    b.tipo === "p" ? b.inline : b.tipo === "lista" ? b.itens.flat() : [],
  ).filter((i) => i.tipo === "link");
}

export function problemasDoArtigo(a: Artigo, ctx: ContextoValidacao): string[] {
  const p: string[] = [];
  const chave = normalizar(a.palavraChave);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) p.push(`slug fora de kebab-case: ${a.slug}`);
  if ((a.tituloSeo + SUFIXO).length > 60) p.push(`tituloSeo + "${SUFIXO}" passa de 60 caracteres`);
  if (a.descricao.length < 120 || a.descricao.length > 160)
    p.push(`descricao com ${a.descricao.length} caracteres (120 a 160)`);
  if (!normalizar(a.titulo).includes(chave)) p.push("palavraChave ausente do titulo");
  if (!normalizar(a.tituloSeo).includes(chave)) p.push("palavraChave ausente do tituloSeo");
  if (!DATA.test(a.publicadoEm) || !DATA.test(a.atualizadoEm)) p.push("data fora do formato AAAA-MM-DD");
  else if (a.atualizadoEm < a.publicadoEm) p.push("data de atualização antes da publicação");
  if (!a.imagem.alt.trim() || !a.imagem.prompt.trim()) p.push("imagem sem alt ou sem prompt");

  if (a.relacionados.length < 2 || a.relacionados.length > 3) p.push("relacionados precisa de 2 ou 3");
  if (new Set(a.relacionados).size !== a.relacionados.length) p.push("relacionados repetidos");
  for (const r of a.relacionados) {
    if (r === a.slug) p.push("relacionados aponta pro próprio artigo");
    else if (!ctx.slugsPauta.has(r)) p.push(`relacionados fora da pauta: ${r}`);
  }

  if (a.faq.length < 3 || a.faq.length > 5) p.push(`faq com ${a.faq.length} perguntas (3 a 5)`);

  for (const m of a.musicas) if (!ctx.slugsExemplos.has(m)) p.push(`musica não é exemplo público: ${m}`);

  const textos = [a.titulo, a.tituloSeo, a.descricao, a.corpo, ...a.faq.flatMap((f) => [f.q, f.a])];
  if (textos.some((t) => PRECO.test(t))) p.push("preço no texto (R$ seguido de número)");
  if (textos.some((t) => PROIBIDAS.test(t))) p.push("promessa proibida (60 segundos / entrega expressa)");

  let blocos: Bloco[];
  try {
    blocos = parsearCorpo(a.corpo);
  } catch (e) {
    p.push(`corpo não parseia: ${(e as Error).message}`);
    return p;
  }

  const palavras = contarPalavras(blocos);
  if (palavras < 900 || palavras > 2000) p.push(`corpo com ${palavras} palavras (900 a 2.000)`);

  const primeiro = blocos.find((b) => b.tipo === "p");
  if (!primeiro || primeiro.tipo !== "p" || !normalizar(textoDoInline(primeiro.inline)).includes(chave))
    p.push("palavraChave ausente do primeiro parágrafo");

  if (!blocos.some((b) => b.tipo === "h2")) p.push("corpo sem nenhum ##");
  if (!blocos.some((b) => b.tipo === "cta")) p.push("corpo sem [[cta]]");

  const tocadas = blocos.flatMap((b) => (b.tipo === "musica" ? [b.slug] : []));
  if (tocadas.length === 0) p.push("corpo sem [[musica:…]]");
  for (const s of tocadas) if (!ctx.slugsExemplos.has(s)) p.push(`[[musica:${s}]] não é exemplo público`);
  if ([...new Set(tocadas)].sort().join() !== [...new Set(a.musicas)].sort().join())
    p.push("musicas diferente das [[musica:…]] do corpo");

  for (const l of linksDoCorpo(blocos)) {
    if (l.tipo !== "link" || !l.interno) continue;
    const caminho = l.href.split(/[?#]/)[0];
    const doBlog = caminho.startsWith("/blog/") && ctx.slugsPauta.has(caminho.slice("/blog/".length));
    if (!ROTAS.has(caminho) && !doBlog) p.push(`link interno pra rota que não existe: ${l.href}`);
  }

  return p;
}
