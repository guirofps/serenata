# Blog da Ballad em espanhol (SEO) — desenho

Data: 20/10/2026. Só Ballad Gift, só espanhol (hispanos dos EUA).

## 1. O que é e por quê

Vinte artigos em `balladgift.com/es/blog/<slug>`, cada um mirando UMA busca
em espanhol com intenção de presente, com a imagem de topo reaproveitada do
blog da Serenata, uma música real tocável (os exemplos em espanhol da própria
Ballad) e o botão pro quiz em espanhol (`/es/criar`).

Por que espanhol: é onde a Ballad vende hoje (as vendas pelos anúncios
saíram do funil `/es`), e há bem menos blog de "canción personalizada" em
espanhol do que de "custom song" em inglês.

A regra do blog da Serenata continua: **texto genérico pra "ter conteúdo"
não entra.** Cada artigo se segura nas músicas REAIS de exemplo e no
conhecimento de como o funil funciona (o que contar pra letra sair boa).

## 2. Decisões do dono (20/10)

- Idioma: **só espanhol** (AskUserQuestion).
- Pauta: **10 de presente + 10 de fé**, a lista da §3, aprovada como está
  ("tá certo, pode fazer"), incluindo a quinceañera no lugar de "presente de
  última hora".
- Imagens: **as já geradas do blog da Serenata** (nada novo no Higgsfield).
- Endereço `/es/blog/<slug>`; o `/blog` da Serenata não muda.
- Nos artigos de fé o botão vai pro `/es/criar` normal (o quiz em espanhol não
  tem a porta cristã `?t=gospel`, que só existe em `pt` e `en`).
- **Fé é SEMPRE canção com fé PARA ALGUÉM** (2ª rodada, 20/10): o quiz em
  espanhol não tem "Dios" como destinatário, então nenhum artigo promete uma
  música feita pra Deus. Alabanza, testimonio, gratitud e consuelo são
  vividos e cantados pra uma pessoa (mãe, avó, esposo, pastor…).
- **"La Cruz Que Me Dejaste" (abuela) serve, com cuidado** (2ª rodada): toca
  só onde o tema cabe (avó, consolo, mãe cristã, testemunho, alabanza,
  canción cristiana); boda, pastor, Navidad e pai tocam as músicas de amor do
  tema. Trecho citado nunca é verso com "rezar" ou "cruz" (o público é
  evangélico); o título dela aparece no cartão da música, e isso fica.

## 3. A pauta

Imagens: o slug do arquivo em `public/img/blog/<imagem>.webp` (e
`<imagem>-og.jpg`), os MESMOS arquivos da Serenata, servidos pelos dois
deploys (a pasta `public` é uma só). Ficam de fora `louvor-de-gratidao` e
`louvor-para-momento-dificil`, que mostram paisagem do Rio.

Músicas: slugs de `EXEMPLOS_ES_US` (`src/lib/exemplos-es-us.ts`): `es-us-esposa`
(Mariachi), `es-us-mama` (Bolero), `es-us-esposo` (Norteño), `es-us-hija`
(Pop latino), `es-us-novia` (Bachata), `es-us-abuela` (Música cristiana, a
ÚNICA de fé). Artigo de fé toca a abuela e diz o estilo real; nenhum artigo
finge que uma música é de um estilo que ela não é.

| # | slug | busca-alvo (`palavraChave`) | grupo | imagem (Serenata) | músicas |
|---|---|---|---|---|---|
| 1 | `cancion-personalizada-para-mi-esposa` | canción personalizada para mi esposa | regalo | `presente-aniversario-de-namoro` | es-us-esposa |
| 2 | `cancion-para-mi-mama` | canción para mi mamá | regalo | `musica-personalizada-para-mae` | es-us-mama |
| 3 | `cancion-para-mi-papa` | canción para mi papá | regalo | `musica-personalizada-para-pai` | es-us-esposo |
| 4 | `cancion-para-mi-novia` | canción para mi novia | regalo | `musica-personalizada-para-namorada` | es-us-novia |
| 5 | `cancion-de-aniversario-de-bodas` | canción de aniversario de bodas | regalo | `presente-bodas-aniversario-de-casamento` | es-us-esposo, es-us-esposa |
| 6 | `cancion-de-cumpleanos-personalizada` | canción de cumpleaños personalizada | regalo | `musica-gospel-de-aniversario` | es-us-hija |
| 7 | `cancion-para-quinceanera` | canción para quinceañera | regalo | `presente-de-batismo-evangelico` | es-us-hija |
| 8 | `regalo-de-navidad-emotivo` | regalo de navidad emotivo | regalo | `presente-de-natal-emocionante` | es-us-mama |
| 9 | `homenaje-a-la-abuela` | homenaje a la abuela | regalo | `homenagem-para-avo` | es-us-abuela |
| 10 | `como-hacer-una-cancion-para-alguien` | cómo hacer una canción para alguien | guia | `como-fazer-uma-musica-para-alguem` | es-us-esposa |
| 11 | `cancion-cristiana-personalizada` | canción cristiana personalizada | fe | `louvor-personalizado` | es-us-abuela |
| 12 | `alabanza-personalizada` | alabanza personalizada | fe | `louvor-culto-de-acao-de-gracas` | es-us-abuela |
| 13 | `cancion-de-testimonio` | canción de testimonio | fe | `louvor-de-testemunho` | es-us-abuela |
| 14 | `regalo-para-mama-cristiana` | regalo para mamá cristiana | fe | `presente-para-mae-evangelica` | es-us-mama, es-us-abuela |
| 15 | `regalo-para-papa-cristiano` | regalo para papá cristiano | fe | `presente-para-pai-evangelico` | es-us-esposo |
| 16 | `regalo-para-pastor` | regalo para pastor | fe | `presente-para-pastor` | es-us-esposo |
| 17 | `cancion-cristiana-para-boda` | canción cristiana para boda | fe | `musica-gospel-para-casamento` | es-us-novia, es-us-esposa |
| 18 | `cancion-de-gratitud` | canción de gratitud | fe | `hino-personalizado` | es-us-mama |
| 19 | `regalo-de-navidad-cristiano` | regalo de navidad cristiano | fe | `presente-de-natal-cristao` | es-us-mama |
| 20 | `cancion-de-consuelo` | canción de consuelo | fe | `como-escrever-um-louvor` | es-us-abuela |

Pauta escolhida por intenção, não por volume medido (sem Ahrefs nesta
sessão); quem confirma é o Search Console da balladgift.com, ~3 semanas
depois de indexar. Natal entra agora de propósito: a busca sobe em novembro.
Os artigos 1 e 5 não disputam a mesma busca (esposa como pessoa × data de
casamento) e linkam entre si.

## 4. Arquitetura

O blog da Serenata (spec `2026-10-02-blog-seo-design.md`) vira um motor com
DUAS configurações, em vez de uma cópia irmã (a home espanhola é o exemplo
do que acontece com página irmã: melhoria numa não chega na outra).

```
src/lib/blog/site.ts            SiteBlog: a configuração por blog (nova)
src/lib/blog/tipos.ts           Artigo: `grupo` ganha "regalo" | "fe"; `imagem` ganha `arquivo`
src/lib/blog/validar.ts         problemasDoArtigo(a, ctx) lê preço/proibidas/rotas do SiteBlog
src/lib/blog/seo.ts             head/JSON-LD/URLs a partir do SiteBlog
src/components/blog/*           textos e exemplos vindos do SiteBlog
src/conteudo/blog-es/<slug>.ts  um arquivo por artigo
src/conteudo/blog-es/index.ts   ARTIGOS_ES, artigoEsPorSlug
src/conteudo/blog-es/pauta.ts   PAUTA_ES (a §3, na ordem)
src/routes/es.blog.index.tsx    /es/blog
src/routes/es.blog.$slug.tsx    /es/blog/<slug>
```

`SiteBlog` (um por blog: `BLOG_SERENATA`, `BLOG_BALLAD_ES`):

| campo | Serenata | Ballad ES |
|---|---|---|
| origem | `https://www.serenatagift.com` | `https://www.balladgift.com` |
| prefixo da rota | `/blog` | `/es/blog` |
| sufixo do `<title>` | ` \| Serenata` | ` \| Ballad Gift` |
| `og:locale` / `inLanguage` | `pt_BR` / `pt-BR` | `es_US` / `es-US` |
| destino do CTA | `/criar` (gospel: `/criar?t=gospel`) | `/es/criar` (sempre) |
| rotas internas válidas | `/`, `/criar`, `/blog`, `/musica-personalizada-para-esposa` | `/es`, `/es/criar`, `/es/blog` |
| preço proibido | `R$` + número | `$`, `US$`, `USD` + número |
| promessas proibidas | 60 segundos, entrega expressa | `60 segundos`, `en un minuto`, `entrega exprés`, `reembolso`, `devolución` (garantia de devolução é contra a regra da casa) |
| exemplos tocáveis | `exemplos-pt.ts` (áudio do bucket da Serenata) | `exemplos-es-us.ts` (`audioDoExemploEsUs`, capa própria) |
| textos de interface | português | espanhol neutro, com `tú` |
| data | `dd/mm/aaaa` | `d de mes de aaaa` |
| organização (JSON-LD) | Serenata, `logo-serenata.png` | Ballad Gift, `/ballad/logo.webp` |

A imagem de topo deixa de ser deduzida do slug: o artigo diz qual arquivo usa
(`imagem.arquivo`). Na Serenata é o próprio slug (sem mudar nada do que está
no ar); na Ballad é o slug da Serenata da §3.

**Portões de marca** (o mesmo deploy serve as duas):

- `/es/blog` e `/es/blog/$slug`: `notFound()` quando NÃO é Ballad. A
  Serenata também tem `/es` (o funil argentino) e não pode ganhar esse blog.
- `/blog` da Serenata: continua `notFound()` na Ballad.
- O registro (`@/conteudo/blog-es`) entra por `import()` dentro do loader,
  como na Serenata: nada dos 20 artigos no chunk de entrada.

**Sitemap e robots da Ballad** (`public/ballad/`): `/es/blog` e os 20 `<url>`
no `sitemap.xml`; `Allow: /es/blog` no `robots.txt`. Sem hreflang com a
Serenata (outro site, outra marca).

**Medição:** a tabela de páginas de entrada do painel da Ballad e o Search
Console da balladgift.com (o dono envia o sitemap).

## 5. Redação

- Espanhol neutro dos EUA, com `tú`, nunca `vos` nem `vosotros` (a regra do
  funil `/es` da Ballad). Redação nova, não tradução dos artigos da Serenata:
  o leitor é mexicano, salvadorenho, porto-riquenho… morando nos EUA, e as
  datas e referências são dele (quinceañera, posada, Día de las Madres em
  10 de mayo, iglesia cristiana/evangélica).
- Sem preço, sem prometer tempo de entrega curto, sem prometer devolução
  (o validador cobra). Pode dizer que dá pra ouvir antes de pagar e que a
  letra sai na hora e grátis: é o funil real.
- Trecho de letra só copiado da letra REAL do exemplo, lida na página pública
  `balladgift.com/p/<token>` (a letra inteira, não só os 4 `versos` de
  `exemplos-es-us.ts`), um trecho diferente por artigo. Da abuela, nunca
  verso com "rezar" ou "cruz".
- Como o artigo guia a pessoa no quiz: quinceañera → escolher "Cumpleaños" e
  contar que são os quinze; Natal antes de 15/11 → "Otro momento" (de 15/11 a
  31/12 a opção "Navidad" aparece sozinha); pastor → "Otro". O texto não
  promete opção que o quiz não tem.
- Fé: o público é cristão evangélico hispano; sem santos nem imagem católica
  no texto (as imagens reaproveitadas já seguiram essa regra na Serenata).
- 900 a 2.000 palavras, palavra-chave no título, no `tituloSeo` e no 1º
  parágrafo, `[[musica:…]]` e `[[cta]]` no corpo, 3 a 5 perguntas no FAQ,
  2 ou 3 relacionados da própria pauta em espanhol.

## 6. Não é / não entra

- Blog em inglês da Ballad (fica pra depois de medir este).
- Imagem nova no Higgsfield.
- Porta cristã no quiz em espanhol, e música "para Dios".
- Mudança de conteúdo, URL ou visual do blog da Serenata (o motor muda por
  dentro; o que está no ar continua byte a byte igual no HTML).
- Link do blog no topo da home `/es` (só no rodapé, como na Serenata).

## 7. Testes

- O contrato do blog roda nos DOIS registros: todo slug da pauta tem artigo,
  todo artigo passa no `problemasDoArtigo` com a configuração do seu site, e
  todo artigo tem `<url>` no sitemap do seu site.
- A Serenata não muda: o `headDoArtigo` de um artigo da Serenata sai igual ao
  de hoje (teste de igualdade antes/depois da troca pro `SiteBlog`).
- Portão: as rotas `/es/blog*` respondem 404 com marca Serenata.
- Validador da Ballad: recusa `$19`, `US$`, "reembolso", "en un minuto".
