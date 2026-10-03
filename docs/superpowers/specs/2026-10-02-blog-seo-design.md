# Blog da Serenata (SEO) — desenho

Data: 02/10/2026. Só Serenata, só português.

## 1. O que é e por quê

Dez artigos em `/blog/<slug>`, cada um mirando UMA busca com intenção de
presente, com imagem de topo gerada no Higgsfield, uma música real tocável e
link pro `/criar`. É a segunda leva de busca orgânica depois da
`/musica-personalizada-para-esposa`, que fica onde está.

A regra herdada daquela página continua valendo: **texto genérico pra "ter
conteúdo" não entra.** Cada artigo se segura em duas coisas que concorrente
não copia: as músicas REAIS de exemplo (as mesmas já públicas na home) e o
conhecimento de como o nosso funil funciona (o que contar pra letra sair boa).

Decisões do dono (AskUserQuestion, 02/10):

- Pauta com os quatro grupos: pessoa, ocasião, gospel, guia.
- Músicas tocáveis nos artigos: sim, só os exemplos já públicos.
- Imagem de topo: foto realista de momento (pessoas que não existem, luz quente).
- O blog aparece no rodapé da home (português), nada no topo.
- Montagem: artigos como arquivos `.ts` no repositório, com renderizador nosso
  (abordagem 1).

## 2. A pauta

| # | slug | busca-alvo (`palavraChave`) | grupo | músicas | CTA |
|---|---|---|---|---|---|
| 1 | `musica-personalizada-para-mae` | música personalizada para mãe | pessoa | eva | `/criar` |
| 2 | `musica-personalizada-para-pai` | música personalizada para pai | pessoa | antonio | `/criar` |
| 3 | `musica-personalizada-para-namorada` | música personalizada para namorada | pessoa | bianca | `/criar` |
| 4 | `homenagem-para-avo` | homenagem para avó | pessoa | rose, joaquim | `/criar` |
| 5 | `presente-aniversario-de-namoro` | presente de aniversário de namoro | ocasião | isabela | `/criar` |
| 6 | `presente-bodas-aniversario-de-casamento` | presente de aniversário de casamento | ocasião | camburi, garga | `/criar` |
| 7 | `presente-de-natal-emocionante` | presente de natal emocionante | ocasião | eva, antonio | `/criar` |
| 8 | `louvor-personalizado` | louvor personalizado | gospel | denise | `/criar?t=gospel` |
| 9 | `como-fazer-uma-musica-para-alguem` | como fazer uma música para alguém | guia | li | `/criar` |
| 10 | `presente-criativo-de-ultima-hora` | presente criativo de última hora | guia | isabela | `/criar` |

A pauta foi escolhida por intenção, não por volume medido (sem Ahrefs nesta
sessão). Quem confirma é o Search Console, umas 3 semanas depois de indexar.
O Natal entra agora de propósito: indexação leva semanas e a busca sobe em
novembro.

Nenhum artigo mira "esposa": isso é da página que já existe, e dois
resultados nossos disputando a mesma busca se canibalizam. Os artigos 5, 6 e
10 linkam pra ela.

## 3. Arquitetura

```
src/lib/blog/tipos.ts        Artigo, Bloco, GrupoArtigo
src/lib/blog/markdown.ts     parsearCorpo(texto) → Bloco[]  (puro, sem React)
src/lib/blog/seo.ts          headDoArtigo(a), headDoIndice(), urlDoArtigo(slug)  (puro)
src/lib/blog/blog.test.ts    (e irmãos) — ver §8
src/conteudo/blog/<slug>.ts  um arquivo por artigo, exporta `artigo: Artigo`
src/conteudo/blog/index.ts   ARTIGOS (ordem de publicação), artigoPorSlug(slug)
src/components/blog/         CorpoArtigo, CartaoMusica, CtaCriar, CartaoArtigo
src/routes/blog.index.tsx    /blog
src/routes/blog.$slug.tsx    /blog/$slug
public/img/blog/<slug>.webp  topo, 1600×900
public/img/blog/<slug>-og.jpg  compartilhamento, 1200×630
```

### 3.1 O tipo `Artigo`

```ts
type GrupoArtigo = "pessoa" | "ocasiao" | "gospel" | "guia";

type Artigo = {
  slug: string;              // kebab-case, sem acento
  palavraChave: string;      // a busca-alvo, minúscula
  grupo: GrupoArtigo;
  titulo: string;            // o H1
  tituloSeo: string;         // <title> sem o " | Serenata"; até 60 caracteres no total
  descricao: string;         // meta description, 120 a 160 caracteres
  publicadoEm: string;       // "2026-10-02"
  atualizadoEm: string;
  imagem: { alt: string; prompt: string };  // arquivo e tamanho saem do slug
  musicas: string[];         // slugs dos exemplos públicos
  tema?: "gospel";           // CTA vai pra /criar?t=gospel
  relacionados: string[];    // 2 ou 3 slugs de outros artigos
  faq: { q: string; a: string }[];  // 3 a 5
  corpo: string;             // markdown restrito, §3.2
};
```

`imagem.prompt` guarda o prompt do Higgsfield que gerou a foto, pra refazer
igual se precisar.

### 3.2 O markdown restrito

O corpo é texto, não HTML. `parsearCorpo` entende só isto:

- `## ` e `### ` (o H1 é o `titulo`, nunca o corpo)
- parágrafo (linhas seguidas; linha em branco separa)
- `- ` lista e `1. ` lista numerada
- `> ` citação (trecho de letra)
- inline: `**negrito**`, `*itálico*`, `[texto](/caminho)` e
  `[texto](https://…)`
- bloco `[[musica:<slug>]]`: o cartão tocável da música
- bloco `[[cta]]` ou `[[cta:Texto do botão]]`: o botão pro `/criar`

Saída é uma lista tipada de blocos, renderizada em componentes React. **Nunca
`dangerouslySetInnerHTML`.** Qualquer outra coisa (HTML cru, `# `, bloco
`[[…]]` desconhecido, link `http://`) é erro do parser — e o teste de
conteúdo roda o parser em todos os artigos, então erro de digitação quebra o
teste, não a página.

Link interno vira `<Link>` do TanStack; externo sai com `rel="noopener"` e
`target="_blank"`.

### 3.3 As músicas

A lista de exemplos públicos hoje mora em `ExemplosReais.tsx`. Ela passa a ser
exportada (só o `export` na constante, sem mexer no que a home renderiza) e o
`CartaoMusica` do blog lê dela: capa, título, "para a mãe", gênero, botão de
tocar. Mesma regra do resto do site: UM `<audio>` por página, `preload="none"`,
áudio do bucket público `exemplos`.

Trecho de letra no artigo (`> `) é copiado da página-presente pública daquele
exemplo. **Nunca inventado.**

### 3.4 A página do artigo

De cima pra baixo:

1. Cabeçalho: logo (link pra home) e botão "Criar música" (o mesmo da página
   de esposa).
2. Breadcrumb visível: Início › Blog › título.
3. H1, a `descricao` como linha de apoio, "Atualizado em 02/10/2026 · 7 min
   de leitura" (tempo calculado a 200 palavras/min).
4. Imagem de topo: `<img>` com `width`/`height`, `fetchpriority="high"`, sem
   lazy.
5. Corpo. Os blocos `[[musica]]` e `[[cta]]` caem onde o texto mandar.
6. "Perguntas frequentes": `<details>`/`<summary>`, o mesmo conteúdo do
   JSON-LD.
7. CTA final fixo do layout (sempre presente, além dos do corpo).
8. "Leia também": cartões dos `relacionados` (imagem lazy + título).
9. Rodapé: Blog, Termos, Privacidade, CNPJ — como o da home.

O CTA de artigo `tema: "gospel"` vai pra `/criar?t=gospel`; os outros pra
`/criar` puro. Nenhum parâmetro extra na URL: o painel já agrupa venda pela
página de ENTRADA da sessão, então o artigo aparece lá sozinho.

### 3.5 A página `/blog`

H1 "Blog da Serenata", uma linha de apoio, e os dez cartões agrupados por
grupo ("Para quem", "Datas e ocasiões", "Gospel", "Como fazer"). CTA pro
`/criar` no fim.

### 3.6 Só Serenata

Os dois `loader`s fazem `notFound()` quando `chaveDaMarca() !== "serenata"`.
A Ballad tem robots e sitemap próprios e nunca lista `/blog`; a trava é pra o
mesmo deploy não servir conteúdo em português no domínio americano.

## 4. SEO técnico

Por artigo, saindo de `headDoArtigo(artigo)`:

- `<title>`: `${tituloSeo} | Serenata` (até 60 caracteres no total)
- `description`, `canonical` absoluto `https://www.serenatagift.com/blog/<slug>`
- Open Graph: `og:type=article`, `og:title`, `og:description`, `og:image`
  (o `-og.jpg`, 1200×630, absoluto), `og:site_name`,
  `article:published_time`, `article:modified_time`, `twitter:card`
- JSON-LD, num `@graph`:
  - `Article` (headline, description, image, datePublished, dateModified,
    author e publisher = Organization Serenata com logo, mainEntityOfPage)
  - `BreadcrumbList` (Início › Blog › artigo)
  - `FAQPage` com o `faq` — o mesmo texto visível na página (o Google pune
    FAQ escondido)
- Fontes com o mesmo `preconnect` da página de esposa.

Regras de redação (o teste cobra as marcadas com *):

- `palavraChave` no `titulo`*, no `tituloSeo`*, no primeiro parágrafo* e no
  slug (por desenho da pauta).
- O primeiro parágrafo RESPONDE a busca, sem rodeio (é o trecho que o Google
  e as respostas de IA pegam).
- 900 a 2.000 palavras de corpo*.
- Pelo menos um `##`*, um `[[musica:…]]`* e um `[[cta]]`* no corpo.
- 2 ou 3 `relacionados`*, todos existentes e diferentes do próprio*.
- Link interno só pra rota que existe*: `/criar`, `/blog/<slug existente>`,
  `/musica-personalizada-para-esposa`, `/`.

Indexação:

- `sitemap.xml`: `/blog` e os dez, com `<lastmod>`*. O comentário de "quatro
  URLs" é atualizado.
- `robots.txt`: `Allow: /blog`*.
- Rodapé da home portuguesa (`Home`, não `HomeEn`) e da página de esposa
  ganham o link "Blog"*.
- Mandar o sitemap no Search Console é do dono (sem acesso daqui).

## 5. Regras de copy

Valem pra corpo, FAQ e descrição (o teste cobra as marcadas com *):

- **Nenhum preço***: nada de `R$` seguido de número. O preço é experimento e
  muda; artigo indexado com preço velho é promessa pública errada.
- **Nenhum número inventado** (clientes, músicas feitas, nota) e nenhum
  depoimento. Os únicos casos citáveis são os exemplos públicos.
- **Prazo**: letra "na hora, de graça"; música "em poucos minutos". Nunca
  "60 segundos", nunca "entrega expressa"*.
- Nenhuma marca de concorrente.
- Gospel (artigo 8): fala de fé sem pregar, e descreve o que o `/criar?t=gospel`
  faz de verdade: louvor pra Deus ou presente com fé, cinco estilos.
- Tom da marca: segunda pessoa, frase curta, concreto ("o café ruim que ele
  faz todo domingo"), sem clichê de IA ("no mundo de hoje", "mergulhe").

## 6. As imagens (Higgsfield)

- Uma por artigo, gerada no Higgsfield com modelo fotorrealista, 16:9.
- Pessoas que NÃO existem, cenário brasileiro, luz quente, o momento de
  ouvir/receber o presente (fone, celular na mão, abraço, olhos marejados).
- Sem texto, logo ou tela de app legível na imagem (IA escreve errado e tela
  falsa parece golpe).
- Conferida a olho antes de entrar (mãos, dedos, rosto); com defeito, gera de
  novo.
- Convertida com `ffmpeg` em `<slug>.webp` (1600×900, alvo ≤ 200 KB) e
  `<slug>-og.jpg` (1200×630). Metadados limpos (`-map_metadata -1`), pela
  mesma higiene do áudio.
- `alt` descreve a cena, com a busca-alvo quando cabe naturalmente.

## 7. Medição

Não é teste A/B (é canal novo, não mudança de fluxo). Mede-se:

- No painel: a tabela de páginas de entrada já mostra visitas, leads e vendas
  de cada `/blog/<slug>`, sem código novo. Ressalva já escrita no cartão: venda
  por página de entrada só conta compra no MESMO dia da visita, então quem lê
  hoje e compra semana que vem não aparece ali.
- No Search Console: impressões e cliques por URL.

Entra na tabela "Testes em andamento" do `CLAUDE.md` com 1ª leitura em
23/10 (3 semanas).

## 8. Testes

Contrato e conteúdo, no padrão do projeto (sem render de componente):

- `blog-markdown.test.ts`: o parser entende cada construção de §3.2 e
  recusa HTML cru, `# `, bloco desconhecido e `http://`.
- `blog-conteudo.test.ts`, rodando em TODOS os artigos de `ARTIGOS`:
  - os dez slugs da pauta, únicos e em kebab-case
  - o corpo parseia
  - as regras marcadas com * em §4 e §5
  - `musicas` e `[[musica:x]]` existem na lista exportada de exemplos
  - imagem `.webp` e `-og.jpg` existem em `public/img/blog/`
  - FAQ com 3 a 5 perguntas
  - o artigo 8 tem `tema: "gospel"`; nenhum outro tem
- `blog-seo.test.ts`: `headDoArtigo` dá canonical absoluto, `og:image`
  absoluto, JSON-LD com `Article` + `BreadcrumbList` + `FAQPage`, título até 60.
- `blog-contrato.test.ts` (fonte lida com `readFileSync`): sitemap com os 11
  endereços, robots com `Allow: /blog`, rodapé da home e da página de esposa
  com link pro blog, as duas rotas com a trava de marca, e nenhum
  `dangerouslySetInnerHTML` em `src/components/blog/`.

Verificação no navegador antes do merge (servidor local): `/blog` e um artigo
de cada grupo, o player tocando, o CTA gospel levando à abertura gospel, sem
erro no console. Depois do deploy: HTML de produção com title, canonical e
JSON-LD (`curl`), e o validador de rich results pro `Article` e o `FAQPage`.

## 9. Fora do escopo

Comentários, página de autor, página por categoria, RSS, paginação, busca,
CMS, blog em espanhol ou na Ballad, newsletter. Página nova vira artigo novo
no mesmo molde, escolhido com o dado do Search Console.

## 10. Riscos

- **Conteúdo raso aos olhos do Google.** Mitigação: músicas reais, conselho
  prático que sai do funil, primeiro parágrafo que responde, nada de enchimento.
- **Rosto estranho de IA** na foto de topo. Mitigação: conferência a olho e
  refação.
- **Canibalização** com a página de esposa. Mitigação: nenhum artigo mira
  "esposa"; os próximos são escolhidos pelo Search Console.
