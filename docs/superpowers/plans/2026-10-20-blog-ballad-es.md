# Blog da Ballad em espanhol — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 20 artigos de SEO em espanhol em `balladgift.com/es/blog/<slug>`, servidos pelo mesmo motor do blog da Serenata, que passa a ter uma configuração por site.

**Architecture:** `src/lib/blog` ganha `SiteBlog` (`site.ts`), uma configuração por blog (`BLOG_SERENATA`, `BLOG_BALLAD_ES`) que o validador, o `<head>`, os componentes e as rotas recebem. O conteúdo em espanhol mora em `src/conteudo/blog-es/`, as rotas novas em `src/routes/es.blog.*.tsx` (só na Ballad). O blog da Serenata não muda por fora.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router (rotas por arquivo), Vitest (`environment: node`, só `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-20-blog-ballad-es-design.md` (e o do motor original, `docs/superpowers/specs/2026-10-02-blog-seo-design.md`).

## Global Constraints

- Só Ballad e só espanhol: `/es/blog*` dá `notFound()` quando `chaveDaMarca() !== "ballad"` (a Serenata tem `/es`, o funil argentino); `/blog*` continua `notFound()` fora da Serenata.
- Espanhol neutro dos EUA com `tú` (nunca `vos`/`vosotros`); redação nova, não tradução.
- Proibido no texto da Ballad: preço (`$`, `US$`, `USD` seguido de número), `60 segundos`, `en un minuto`, `entrega exprés`, `reembolso`, `devolución`.
- 900 a 2.000 palavras; palavra-chave no `titulo`, no `tituloSeo` e no 1º parágrafo; `tituloSeo + " | Ballad Gift"` ≤ 60; descrição 120-160; FAQ 3-5; relacionados 2-3 da `PAUTA_ES`; `[[musica:…]]` e `[[cta]]` no corpo.
- Fé é canção com fé PARA ALGUÉM; nenhum artigo promete canção "para Dios". Nenhum artigo tem `tema` (o CTA é sempre `/es/criar`).
- Música da abuela (`es-us-abuela`) só nos artigos da spec §3; trecho citado nunca com "rezar" nem "cruz"; trecho de letra só da letra real lida em `https://www.balladgift.com/p/<token>`.
- O quiz é guiado só com opções que existem: quinceañera → "Cumpleaños"; Natal antes de 15/11 → "Otro momento" (a opção "Navidad" aparece de 15/11 a 31/12); pastor → "Otro".
- Imagens: os arquivos da Serenata em `public/img/blog/<arquivo>.webp` e `<arquivo>-og.jpg`, pelo `imagem.arquivo` da spec §3; nunca `louvor-de-gratidao` nem `louvor-para-momento-dificil`.
- Registro só por `await import()` dentro do loader (nada de import estático do conteúdo nas rotas).
- Nada de `dangerouslySetInnerHTML` no blog.

## Review Focus

1. Uma página da Serenata (artigo e índice) muda de HTML ou de `<head>` depois do motor — esperado: idêntica. Teste na Task 1.
2. `/es/blog` aberto no domínio da Serenata (funil argentino) — esperado: 404. Teste na Task 3.
3. O player de um artigo da Ballad toca o áudio do bucket da Serenata (outro projeto) — esperado: `audioDoExemploEsUs(slug)`, o do deploy. Teste na Task 2.
4. Palavra-chave com acento e ñ ("canción de cumpleaños") contra título sem acento — esperado: o validador normaliza e aceita. Teste na Task 2.
5. Artigo de fé com o CTA indo pro `?t=gospel` (que o espanhol não tem) — esperado: sempre `/es/criar`. Teste na Task 4.

---

### Task 1: O motor com `SiteBlog`, Serenata idêntica

**Files:**
- Create: `src/lib/blog/site.ts`, `src/lib/blog/site.test.ts`
- Modify: `src/lib/blog/tipos.ts`, `src/lib/blog/seo.ts`, `src/lib/blog/validar.ts`, `src/components/blog/*.tsx`, `src/routes/blog.index.tsx`, `src/routes/blog.$slug.tsx`, `src/lib/blog/{seo,validar,conteudo,blog-contrato}.test.ts`

**Interfaces:**
- Produces:
  - `type ExemploBlog = { slug: string; titulo: string; para: string; genero: string; capa: string; audio: string }`
  - `type SiteBlog = { chave: "serenata" | "ballad-es"; origem: string; prefixo: "/blog" | "/es/blog"; marca: string; sufixo: string; ogLocale: string; inLanguage: string; logo: string; rotas: Set<string>; preco: RegExp; proibidas: RegExp; destinoCriar: "/criar" | "/es/criar"; data: (iso: string) => string; exemplo: (slug: string) => ExemploBlog | undefined; textos: TextosBlog }`
  - `TextosBlog`: todo texto fixo de `LayoutBlog`, `CtaCriar`, `CartaoMusica`, `blog.$slug.tsx` (caminho, "Atualizado em", "min de leitura", "Perguntas frequentes", "Leia também") e do índice (título, descrição, h1, subtítulo, nomes dos grupos e a ordem deles).
  - `BLOG_SERENATA` com os valores de hoje (copiados das constantes que existem em `seo.ts`, `validar.ts` e dos componentes).
  - `GrupoArtigo` += `"regalo" | "fe"`; `Artigo.imagem.arquivo?: string`.
  - `seo.ts`: `urlDoArtigo(site, slug)`, `imagemDoArtigo(site, a)` (= `/img/blog/${a.imagem.arquivo ?? a.slug}.webp`), `imagemOgDoArtigo(site, a)`, `tituloCompleto(site, a)`, `headDoArtigo(site, a)`, `headDoIndice(site)`, `jsonLdDoArtigo(site, a)`.
  - `validar.ts`: `ContextoValidacao = { site: SiteBlog; slugsPauta: Set<string>; slugsExemplos: Set<string> }`; links internos válidos = `site.rotas` ou `${site.prefixo}/<slug da pauta>`.
  - Componentes recebem `site: SiteBlog` (prop) no lugar de constantes.

- [ ] **Step 1: Congelar a Serenata antes de mexer.** Em `src/lib/blog/site.test.ts`, `it("a Serenata sai igual depois do motor")`: para TODO artigo de `ARTIGOS`, `JSON.stringify(headDoArtigo(...))` igual a um arquivo de referência gerado AGORA com o código atual (`src/lib/blog/__snapshots__` via `toMatchSnapshot()`), e o mesmo para `headDoIndice`. Rodar e gravar o snapshot com o código de hoje.

Run: `npx vitest run src/lib/blog/site.test.ts`
Expected: PASS (snapshot criado)

- [ ] **Step 2: Escrever os testes do motor** em `site.test.ts`: `BLOG_SERENATA.prefixo === "/blog"`; `tituloCompleto(BLOG_SERENATA, a)` termina em `" | Serenata"`; `imagemDoArtigo(BLOG_SERENATA, {slug:"x", imagem:{alt:"a",prompt:"p"}})` = `"/img/blog/x.webp"` e com `arquivo:"y"` = `"/img/blog/y.webp"`.

Run: `npx vitest run src/lib/blog/site.test.ts`
Expected: FAIL (`site.ts` não existe)

- [ ] **Step 3: Implementar `site.ts` com `BLOG_SERENATA` e trocar `seo.ts`, `validar.ts`, os componentes e as duas rotas `blog.*` pra receber o site.** As rotas da Serenata passam `BLOG_SERENATA`. Ajustar os testes existentes que chamam as funções antigas (`seo.test.ts`, `validar.test.ts`, `conteudo.test.ts`) pra passar o site; nenhuma asserção muda de valor.

- [ ] **Step 4: Rodar tudo do blog**

Run: `npx vitest run src/lib/blog`
Expected: PASS, com o snapshot do Step 1 intacto (`toMatchSnapshot` sem `-u`)

- [ ] **Step 5: Commit** — `refactor(blog): motor com SiteBlog, Serenata idêntica`

### Task 2: `BLOG_BALLAD_ES` e o validador em espanhol

**Files:**
- Modify: `src/lib/blog/site.ts`, `src/lib/blog/site.test.ts`, `src/lib/blog/validar.test.ts`

**Interfaces:**
- Consumes: `SiteBlog`, `problemasDoArtigo(a, ctx)` da Task 1; `exemploEsUs(slug)`, `audioDoExemploEsUs(slug)` de `src/lib/exemplos-es-us.ts`.
- Produces: `BLOG_BALLAD_ES` com: origem `https://www.balladgift.com`, prefixo `/es/blog`, marca `Ballad Gift`, sufixo ` | Ballad Gift`, `es_US`/`es-US`, logo `/ballad/logo.webp`, rotas `{"/es","/es/criar","/es/blog"}`, `preco = /(US\$|USD|\$)\s*\d/`, `proibidas = /60 segundos|en un minuto|entrega expr[eé]s|reembolso|devoluci[oó]n/i`, `destinoCriar "/es/criar"`, `data("2026-10-20") === "20 de octubre de 2026"`, `exemplo(slug)` montado de `exemploEsUs` com `audio: audioDoExemploEsUs(slug)`, textos de interface em espanhol com `tú` (índice: h1 "Blog de Ballad Gift", grupos na ordem `regalo` "Regalos", `guia` "Cómo hacerlo", `fe` "Con fe").

- [ ] **Step 1: Testes que falham** (em `validar.test.ts`, com um artigo válido de base e o `BLOG_BALLAD_ES`):
  - `"recusa preço em dólar"`: corpo com `$19`, com `US$ 19` e com `USD 19` → problemas contêm `"preço no texto"`.
  - `"recusa promessa proibida"`: `"reembolso"`, `"en un minuto"` → contêm `"promessa proibida"`.
  - `"aceita palavra-chave com acento e ñ"`: `palavraChave "canción de cumpleaños personalizada"`, título `"Cancion de cumpleanos personalizada: …"` → sem problema de palavra-chave.
  - `"link interno da Ballad"`: `[x](/es/criar)` e `[y](/es/blog/<slug da pauta>)` válidos; `[z](/criar)` → `"link interno pra rota que não existe"`.
  - Em `site.test.ts`: `BLOG_BALLAD_ES.exemplo("es-us-abuela")?.audio === audioDoExemploEsUs("es-us-abuela")` e `exemplo("eva")` é `undefined`.

Run: `npx vitest run src/lib/blog`
Expected: FAIL (`BLOG_BALLAD_ES` não existe; mensagens de problema em português continuam as mesmas)

- [ ] **Step 2: Implementar `BLOG_BALLAD_ES`** com os valores do Interfaces. As mensagens de problema do validador continuam em português (são pra quem escreve).

- [ ] **Step 3: Rodar** — `npx vitest run src/lib/blog` → PASS

- [ ] **Step 4: Commit** — `feat(blog): configuração do blog da Ballad em espanhol`

### Task 3: Rotas `/es/blog`, sitemap, robots e rodapé

**Files:**
- Create: `src/routes/es.blog.index.tsx`, `src/routes/es.blog.$slug.tsx`, `src/conteudo/blog-es/index.ts`, `src/conteudo/blog-es/pauta.ts`, `src/lib/blog/blog-es-contrato.test.ts`
- Modify: `public/ballad/sitemap.xml`, `public/ballad/robots.txt`, `src/routes/es.index.tsx`, `src/routeTree.gen.ts` (regenerado pelo plugin no build/dev)

**Interfaces:**
- Consumes: `BLOG_BALLAD_ES`, componentes com `site`.
- Produces: `PAUTA_ES` (os 20 slugs da spec §3, na ordem, `as const`); `ARTIGOS_ES: Artigo[]` (vazio nesta task, cresce nas Tasks 4-7); `artigoEsPorSlug(slug)`.

- [ ] **Step 1: Testes que falham** em `blog-es-contrato.test.ts` (leitura de arquivo, como `blog-contrato.test.ts`):
  - as duas rotas `es.blog.*` contêm `chaveDaMarca() !== "ballad") throw notFound()`; o `$slug` contém `if (!artigo) throw notFound()`;
  - nenhuma das duas importa `@/conteudo/blog-es` estaticamente e ambas têm `await import("@/conteudo/blog-es")`;
  - nenhuma tem `dangerouslySetInnerHTML`;
  - `public/ballad/robots.txt` tem `^Allow: /es/blog$`;
  - `public/ballad/sitemap.xml` tem `<loc>https://www.balladgift.com/es/blog</loc>`;
  - `src/routes/es.index.tsx` tem `<Link to="/es/blog"` só dentro do rodapé da Ballad (`BALLAD &&`).

Run: `npx vitest run src/lib/blog/blog-es-contrato.test.ts`
Expected: FAIL

- [ ] **Step 2: Criar as rotas** espelhando `blog.index.tsx`/`blog.$slug.tsx`, com `BLOG_BALLAD_ES`, portão de marca `"ballad"`, e `pauta.ts`/`index.ts` do registro em espanhol. Sitemap: `<url>` do `/es/blog` (changefreq weekly, priority 0.6); robots: `Allow: /es/blog`. Rodapé da home `/es`: link "Blog" pro `/es/blog` só quando `BALLAD`.

- [ ] **Step 3: Rodar** — `npx vitest run src/lib/blog` → PASS; `npx tsc --noEmit -p .` sem erro novo em arquivo tocado.

- [ ] **Step 4: Ver no navegador** (dev server da Ballad, config `ballad` do `.claude/launch.json`): `/es/blog` abre (índice vazio com o CTA), `/es/blog/qualquer` dá 404. No dev da Serenata, `/es/blog` dá 404.

- [ ] **Step 5: Commit** — `feat(blog): rotas /es/blog da Ballad`

### Task 4: Letras e artigos 1-5

**Files:**
- Create: `scratch/blog-es-letras.md` (não versionado: `scratch/` é ignorado), `src/conteudo/blog-es/{cancion-personalizada-para-mi-esposa,cancion-para-mi-mama,cancion-para-mi-papa,cancion-para-mi-novia,cancion-de-aniversario-de-bodas}.ts`, `src/lib/blog/conteudo-es.test.ts`
- Modify: `src/conteudo/blog-es/index.ts`, `public/ballad/sitemap.xml`

**Interfaces:**
- Consumes: `PAUTA_ES`, `BLOG_BALLAD_ES`, `problemasDoArtigo`.

- [ ] **Step 1: Ler as 6 letras inteiras** nas páginas públicas `https://www.balladgift.com/p/<token>` (tokens em `src/lib/exemplos-es-us.ts`), no navegador (a letra não vem no HTML do servidor), e guardar em `scratch/blog-es-letras.md`, uma seção por exemplo, verso por verso. Nenhum trecho citado sai de outro lugar.

- [ ] **Step 2: Teste de conteúdo que falha** em `conteudo-es.test.ts`, espelhando `conteudo.test.ts` com `BLOG_BALLAD_ES`, `PAUTA_ES` e os slugs de `exemplosEsUsProntos()`: cada artigo passa em `problemasDoArtigo`; `public/img/blog/${a.imagem.arquivo}.webp` (≤ 200 KB) e `-og.jpg` existem; `a.imagem.arquivo` não é `louvor-de-gratidao` nem `louvor-para-momento-dificil`; `a.tema` é `undefined`; nenhum `[[musica:es-us-abuela]]` fora dos slugs 9, 11, 12, 13, 14, 20 da spec; nenhuma citação (`> `) com "rezar" ou "cruz"; o corpo não tem "para Dios"/"a Dios" como destinatário da canção; todo artigo tem `<url>` com `<lastmod>` em `public/ballad/sitemap.xml`; registro na ordem da pauta.

Run: `npx vitest run src/lib/blog/conteudo-es.test.ts`
Expected: FAIL (artigos ausentes)

- [ ] **Step 3: Escrever os artigos 1-5** com os campos da spec §3 (slug, `palavraChave`, `grupo: "regalo"`, `imagem.arquivo`, `musicas`), `imagem.prompt` = `"reaproveitada do blog da Serenata: <arquivo>"`, `publicadoEm`/`atualizadoEm` = data do dia. Redação conforme a spec §5 e as Global Constraints. Registrar em `index.ts` e pôr os `<url>` no sitemap da Ballad.

- [ ] **Step 4: Rodar** — `npx vitest run src/lib/blog` → PASS (o teste de "pauta inteira publicada" só entra na Task 7)

- [ ] **Step 5: Commit** — `feat(blog-es): artigos 1-5`

### Task 5: Artigos 6-10

Mesmos arquivos, passos e checagens da Task 4, com os slugs 6-10 da spec §3 (`grupo` `"regalo"`, e `"guia"` no 10). O 7 (quinceañera) guia o quiz por "Cumpleaños"; o 8 (Navidad) diz "Otro momento" e que a opção "Navidad" aparece de 15/11 a 31/12. Commit: `feat(blog-es): artigos 6-10`.

### Task 6: Artigos 11-15

Mesmos passos da Task 4, slugs 11-15, `grupo: "fe"`. Canção com fé PARA ALGUÉM (Global Constraints). Commit: `feat(blog-es): artigos 11-15`.

### Task 7: Artigos 16-20 e a pauta fechada

Mesmos passos da Task 4, slugs 16-20, `grupo: "fe"` (o 16 guia o quiz por "Otro"). Mais, em `conteudo-es.test.ts`: `it("a pauta inteira está publicada")` → `ARTIGOS_ES.map(a => a.slug)` igual a `[...PAUTA_ES]`.

- [ ] **Run final:** `npx vitest run` (suíte inteira) → só as falhas de ambiente já conhecidas desta máquina (`jsdom`, `lucide-react`, `@tanstack/react-store`), nenhuma nova; `npx tsc --noEmit -p .` sem erro novo.
- [ ] **Ver no navegador** (dev da Ballad): `/es/blog` com os 3 grupos, 2 artigos abertos (um de presente, um de fé) com imagem, player tocando o trecho e o botão levando a `/es/criar`.
- [ ] **Commit** — `feat(blog-es): artigos 16-20, pauta completa`
- [ ] **CLAUDE.md**: seção "Blog da Ballad em espanhol (20/10/2026)" com o caminho do motor (`site.ts`), as regras que o validador da Ballad cobra e "artigo novo: arquivo + `index.ts` + `pauta.ts` + `<url>` no sitemap da Ballad".
