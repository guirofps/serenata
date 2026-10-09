# Aba "Criativos" no painel (08/10/2026)

## O que o dono quer

Uma aba nova no `/admin` com o ranking dos criativos do Google Ads que mais
venderam: vídeos, imagens, títulos e descrições. Hoje o painel enxerga a venda
até a CAMPANHA (`utm_campaign`), e criativo só se compara abrindo uma campanha
de teste por vídeo. A pergunta que a aba responde: **qual criativo traz
cliente, e a que custo.**

Decidido pelo dono (08/10, AskUserQuestion):

| | |
|---|---|
| Métrica | Os dois lado a lado: vídeo e anúncio pela **venda real** (banco, ligada pelo `gclid`); título, descrição e imagem pela **conversão do Google** por recurso |
| Contas | Cada painel a sua: Serenata mostra a conta da Serenata, Ballad a da Ballad |
| Colunas | Vendas e CPA; receita e ROAS; impressões, cliques e CTR; views e % assistido |
| Visual | Miniatura + tabela, um ranking por tipo |

## Por que dois números

O `gclid` diz qual ANÚNCIO foi clicado, não qual título ou imagem apareceu
naquele clique: anúncio responsivo monta a peça na hora. Então:

- **Anúncio e vídeo**: venda real do nosso banco. É o número que decide.
- **Título, descrição, imagem**: só o Google sabe, e só como conversão
  atribuída pelo modelo dele. A tela diz isso no cabeçalho da seção
  ("conversão do Google, não venda real"), porque o CPA do Google já se
  mostrou diferente do real (CLAUDE.md, cortes de 30/09 e 05/10).

## Arquitetura

Mesmo molde do `metricas_campanha`: **um job coleta e grava; a aba só lê o
banco.** A aba nunca chama o Google: abrir o painel não gasta cota, não fica
lento e o histórico sobrevive aos 90 dias do `click_view`.

```
Inngest puxarCriativosAds (de hora em hora, nas duas marcas)
  ├─ anúncios + métricas por anúncio/dia (7 dias, reescreve)   → anuncios_ads, metricas_anuncio
  ├─ recursos + métricas por recurso/dia (7 dias, reescreve)    → criativos_ads, metricas_criativo
  └─ gclid das vendas sem anúncio → click_view → anúncio        → cliques_anuncio
/admin?aba=criativos → carregarCriativos({de, ate}) → só banco
```

### O job `puxarCriativosAds`

Arquivo `inngest/functions/puxarCriativosAds.ts`, registrado nas DUAS listas
de `api/inngest.ts` (cada deploy usa as próprias `GOOGLE_ADS_*`, igual ao
`puxarMetricasAds`). Cron `50 * * * *`, `retries: 2`, `concurrency: 1`. Sem
`GOOGLE_ADS_CUSTOMER_ID`, sai com `pulado`. O OAuth e o cabeçalho são os do
`puxarMetricasAds` (extrair pra `inngest/lib/google-ads.ts`, que os dois usam).

**Passo 1, anúncios e métricas (7 dias, mesmo `DIAS` e mesmo reescrever).**
GAQL em `ad_group_ad`: id, nome e tipo do anúncio, status, campanha, grupo,
os vídeos do anúncio (id do YouTube de cada um) e, por `segments.date`:
`cost_micros`, `impressions`, `clicks`, views do vídeo, as quatro taxas de
quartil (25/50/75/100), `conversions` e `conversions_value`. Os nomes exatos
dos campos de vídeo (views e quartis mudaram de nome entre versões) são
conferidos na referência da **v25** no plano, e a leitura vira uma função pura
testada contra uma resposta real gravada.

**Passo 2, recursos e métricas.** GAQL em `ad_group_ad_asset_view`: o
`field_type` (HEADLINE, LONG_HEADLINE, DESCRIPTION, MARKETING_IMAGE,
SQUARE_MARKETING_IMAGE, PORTRAIT_MARKETING_IMAGE, YOUTUBE_VIDEO, e o que mais
vier), o asset (id, tipo, texto, id do YouTube e título, URL da imagem) e as
mesmas métricas por dia, somadas por (dia, asset, tipo de campo) entre os
anúncios. Métrica que o Google não devolver pra aquele tipo fica `null`, e a
tela mostra "—", nunca zero.

**Passo 3, venda → anúncio.** Lê as vendas pagas (`ehVenda`) dos últimos 89
dias cujo quiz tem `attribution.gclid` e cujo `gclid` ainda não está em
`cliques_anuncio`. Agrupa pelo DIA do clique, que é `attribution.captured_at`
no fuso da conta (`customer.time_zone`, lido uma vez por execução). Pra cada
dia, `click_view` com `segments.date = '<dia>'` e `click_view.gclid IN (...)`
em lotes de 100; o que não achar, tenta o dia anterior (captura logo depois
da meia-noite). Grava `gclid → anúncio, grupo, campanha, dia`. O que não
achar em nenhum dos dois grava com `anuncio_id = null` e `tentado_em`, pra não
reconsultar a cada hora; nova tentativa só depois de 24h, até o clique fazer
89 dias.

**Teto por execução:** no máximo 30 dias consultados no passo 3 (as vendas
antigas entram aos poucos na primeira semana). Erro de um dia não derruba os
outros: registra e segue.

### A sonda vem PRIMEIRO

Não se sabe se o `click_view` devolve clique de campanha de **vídeo e
Demand Gen**, que são as campeãs. Antes de construir o resto, um evento
`criativos/sonda` roda o passo 3 com os `gclid` das vendas dos últimos 7 dias
SEM gravar e devolve: quantos achou por tipo de campanha
(`campaign.advertising_channel_type`) e quantos ficaram sem. Lido pelo dono
no painel do Inngest.

- Se o vídeo/Demand Gen aparecer: segue o desenho.
- Se NÃO aparecer: **plano B**, decidido com o dono antes de construir. O
  plano B é pôr `{creative}` no sufixo de URL final da conta
  (`utm_content={creative}`), que liga a venda ao anúncio sem `click_view`,
  só daqui pra frente. Mexe na configuração da conta, então não entra sem
  aprovação.

### Tabelas (migration `20261008100000_criativos_ads.sql`)

Só DDL simples, sem função (o SQL Editor parte nos `;`). Roda nos DOIS
Supabase. RLS ligado e sem política em todas: só o service role lê.

| tabela | chave | colunas |
|---|---|---|
| `anuncios_ads` | `id` (ad id, texto) | `campanha_id`, `grupo_id`, `nome`, `tipo`, `status`, `videos text[]` (ids do YouTube), `atualizado_em` |
| `criativos_ads` | `id` (asset id, texto) | `tipo` (video/imagem/texto), `texto`, `youtube_id`, `imagem_url`, `nome`, `atualizado_em` |
| `metricas_anuncio` | (`dia`, `anuncio_id`) | `custo_brl`, `impressoes`, `cliques`, `views`, `p25`, `p50`, `p75`, `p100` (taxas 0–1), `conversoes_google`, `valor_conv_google` |
| `metricas_criativo` | (`dia`, `criativo_id`, `campo`) | `custo_brl`, `impressoes`, `cliques`, `conversoes_google`, `valor_conv_google` (todas anuláveis) |
| `cliques_anuncio` | `gclid` | `anuncio_id` (nulo = não achado), `grupo_id`, `campanha_id`, `dia`, `tentado_em` |

Ids como TEXTO, igual a `metricas_campanha` (o id do Google passa de 2^53).

### A aba

`/admin?aba=criativos`, rótulo "Criativos", depois de "De onde vem". Como a
Financeira, **não usa `dados`**: componente `AbaCriativos.tsx` com a própria
consulta, `carregarCriativos({ de, ate })` em `src/lib/admin-criativos.ts`
(server fn com `exigirAdmin()`). Segue o seletor de período do painel.

A conta é uma função pura, `montarCriativos` (`src/lib/criativos.ts`), que
recebe as linhas já lidas e devolve os rankings. É ela que o teste cobre.

**Seção 1, Vídeos (venda real).** Uma linha por vídeo do YouTube. Juntam-se
os anúncios que têm aquele vídeo como ÚNICO vídeo; anúncio com vários vídeos
fica só na seção 2, porque dividir a venda entre os vídeos seria inventar.
Colunas: miniatura (`i.ytimg.com/vi/<id>/mqdefault.jpg`, link pro YouTube),
título do vídeo, vendas, receita, gasto, CPA, ROAS, impressões, cliques, CTR,
views, % assistido (25/50/75/100).

**Seção 2, Anúncios (venda real).** Uma linha por anúncio: nome, campanha,
tipo, as miniaturas dos vídeos dele, e as mesmas colunas.

**Seções 3 a 5, Títulos, Descrições, Imagens (conversão do Google).**
Texto ou miniatura, conversões do Google, valor de conversão, gasto, custo
por conversão (quando houver gasto), impressões, cliques, CTR. Cabeçalho:
"Conversão do Google, não venda real." Título longo entra em Títulos com a
etiqueta "longo".

Cada seção ordena por vendas (ou conversões), desempate por gasto, mostra
as 20 primeiras e um "ver todos". Linha sem impressão E sem venda no
período não aparece (venda de clique anterior ao período aparece, com gasto
zero).

**Regras da conta:**

- **Venda** = a mesma do painel (`ehVenda`, `paid_at` no período), com
  upsell, ligada pelo `attribution.gclid` do quiz → `cliques_anuncio`.
  Quiz fora da janela é lido à parte, como no cartão de canais.
- **Venda com cupom ou que voltou por e-mail CONTA pro anúncio**: aqui a
  pergunta é qual criativo trouxe a pessoa, não por onde ela voltou. (É a
  diferença em relação ao cartão "Vendas Google", e a tela não precisa
  bater com ele.)
- **Receita** em real (`valorEmBrl`, dólar da Ballad pela cotação do dia).
- **Gasto e venda no mesmo período**: CPA = gasto do criativo no período ÷
  vendas pagas no período. Sem venda, CPA "—".
- **% assistido** = média das taxas diárias ponderada pelas impressões do dia.
- **CTR** = cliques ÷ impressões.
- Venda com `gclid` que o `click_view` não achou entra numa linha só, ao pé
  da seção 2: "N vendas do Google sem anúncio identificado (clique com mais
  de 90 dias ou não encontrado)". Assim o total não some em silêncio.

**PMAX fica fora**: não tem `ad_group_ad`, e já é medida por grupo pelo
`utm_content=ag_<nome>`.

**Rota sensível:** a miniatura carrega com `referrerPolicy="no-referrer"`;
o `/admin` já é rota sensível, e nada da aba leva token na URL.

## Erros e limites

- Google fora ou credencial inválida: o job falha com retry; a aba mostra o
  que já está gravado e o horário da última coleta (`max(atualizado_em)`).
- Vendas com clique de mais de 90 dias antes da primeira coleta nunca são
  ligadas: o `click_view` não alcança. Consequência aceita, dita na tela.
- Anúncio removido continua nas tabelas (a coleta só faz upsert): o histórico
  dele não some do ranking.

## Testes

- `criativos.test.ts`: `montarCriativos` — venda ligada ao anúncio certo,
  vídeo único × vários vídeos, CPA/ROAS/CTR, % assistido ponderado, venda
  sem anúncio na linha de rodapé, métrica nula vira "—", ordem e desempate.
- `ler-criativos-google.test.ts`: leitura das respostas da API (anúncio,
  recurso, click_view) contra respostas gravadas da v25, sem dado pessoal.
- `dia-do-clique.test.ts`: `captured_at` → dia no fuso da conta, e a
  tentativa do dia anterior.

## Fora do escopo

- Leads por criativo (só vendas).
- PMAX por recurso.
- Ação sobre a campanha a partir da aba (pausar, subir orçamento).
- Meta/TikTok.
