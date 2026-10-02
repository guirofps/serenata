# Painel rápido: consultas consertadas + resumo diário do funil

**Data:** 02/10/2026 · **Status:** aguardando revisão do dono

## O problema

O `/admin` não abre nem com 7 dias. A tela mostra `canceling statement due to
statement timeout`, e o botão de socorro "Ver só os últimos 7 dias" cai igual.

Quem derruba a tela inteira é o **núcleo** (`carregarPainel` → `montarPainel`),
porque é a única consulta que `decidirEstado` trata como fatal. Lendo o código
e as migrations, há quatro causas somadas:

1. **Sem índice por data.** O painel filtra `quiz_responses`, `musicas` e
   `pedidos` por `created_at`, e nenhuma das três tem índice que comece por
   essa coluna. `pedidos_status_created_idx` começa por `status`, e o painel
   não filtra status no banco. Resultado: cada página lê a tabela inteira.
2. **Paginação por OFFSET, ordenada por uuid, 12 páginas em paralelo**
   (`paginado`, `PAGINA = 1000`, `LOTE = 12`). Para entregar a página N, o
   banco ordena a janela inteira por um id aleatório e descarta N×1000 linhas.
   O custo cresce mais rápido que o volume, e as 12 páginas fazem isso juntas.
3. **O comparativo dobra a carga no mesmo instante.** `carregarComparativo`
   roda um `montarPainel` inteiro para o período anterior, disparado junto
   com o núcleo. Pedir 30 dias faz o banco processar 60, em paralelo.
4. **O funil agrega o `funnel_events` cru** (`admin_eventos_resumo`). A
   medição de 28/08 dava 3,3s para 1 dia e 22s para 7, com estouro em 14. Hoje
   a tabela é maior. Essa falha já é tratada (vira `aviso`), mas é ela que
   impede 30 e 90 dias de mostrar o funil.

**Limite do diagnóstico:** não houve medição no banco de produção, porque esta
sessão não tem acesso de leitura a ele. As causas saem do código e das
migrations. A parte A inclui log de tempos justamente para confirmar no deploy
o que cada etapa custa.

## Objetivo

- O painel abre com 7, 30 e 90 dias, de forma confiável.
- O funil (visitantes, passos, entradas) aparece nos três períodos.
- O tempo do painel deixa de crescer com o tráfego.
- Nenhum número muda de significado sem estar escrito na tela ou aqui.

## Fora do escopo

- Resumir `quiz_responses`, `pedidos`, `musicas` e `custos`. Depois da
  parte A elas leem algumas dezenas de milhares de linhas por um índice, e o
  JS que monta experimentos, origens e listas continua igual. Se 90 dias ainda
  ficar lento nisso, o log da parte A mostra, e o próximo passo é outro spec.
- `carregarEmails` e `carregarAutomacoes`. Ficam como estão.
- Guardar o payload pronto do painel (cache por período). Foi descartado: a
  primeira abertura de cada período continuaria rodando a consulta que estoura.

---

## Parte A: consertar as consultas

### A1. Índices por data (migration)

```sql
create index if not exists quiz_responses_created_at_idx on public.quiz_responses (created_at, id);
create index if not exists musicas_created_at_idx        on public.musicas        (created_at, id);
create index if not exists pedidos_created_at_idx        on public.pedidos        (created_at, id);
create index if not exists custos_created_at_id_idx      on public.custos         (created_at, id);
```

O `(created_at, id)` serve ao filtro e também ao cursor da A2.

**Como aplicar:** a migration fica em `supabase/migrations/`. Na Serenata, o
dono cola o SQL no SQL Editor, como nas outras. Na Ballad, roda
`scratch/ballad-migrar.mjs`. Criar índice trava a escrita na tabela durante
alguns segundos, porque as tabelas são pequenas. O quiz espera, não falha. Mesmo
assim, aplicar de madrugada. Se o editor aceitar comandos fora de transação, usar
`create index concurrently`, um por vez.

### A2. Paginação por fatias de tempo, cada uma por cursor

`paginado` é substituído por `lerJanela(tabela, colunas, inicio, fim)`:

- A janela é cortada em **fatias de 1 dia**, lidas em paralelo, até 12 por
  vez. O paralelismo continua, mas agora cada fatia é um trecho próprio do
  índice, não a janela inteira reordenada.
- Dentro da fatia, a leitura avança **por cursor**:
  `order by created_at, id` com `limit 1000`, e a próxima página pede
  `(created_at, id) > (último lido)`. Nada é descartado e nenhuma página
  reordena a janela.
- A deduplicação por `id` continua. Ela custa nada e protege a junção das
  fatias.
- `TETO = 500_000` continua, com o mesmo erro explícito.

Com cursor, a escrita concorrente não empurra linhas entre páginas: o furo que
a deduplicação de hoje fecha deixa de existir por construção. A deduplicação
fica como cinto.

### A3. O comparativo espera o núcleo

Na tela (`admin.tsx`), `comparativo` passa a ter
`enabled: nucleo.isSuccess`. O núcleo não divide o banco com outra janela
inteira, e as setinhas chegam logo depois. A tela já desenha o painel sem o
comparativo enquanto ele não vem, então nenhum estado novo é necessário.

### A4. Log de tempos no servidor

`montarPainel` registra uma linha por chamada, legível nos logs da Vercel:

```
[admin] painel 30d todos: leituras 1.840ms · eventos 410ms (28 dias do resumo, 2 fatias ao vivo) · total 2.390ms
```

Sem e-mail, sem id, sem valor: só tempos e contagens de dias. É o que
confirma o diagnóstico e mostra se 90 dias pede o próximo passo.

---

## Parte B: resumo diário do funil

### A ideia

O que é caro é agregar `funnel_events`. Um dia que já terminou não muda mais,
ou muda muito pouco. Então ele é agregado **uma vez**, guardado, e o painel
soma linhas prontas.

### Tabela

```sql
create table public.painel_eventos_dia (
  dia           date not null,                       -- dia no fuso de Brasília
  filtro        text not null check (filtro in ('todos', 'pt', 'es')),
  resumo        jsonb not null,                      -- saída de admin_eventos_resumo pro dia
  atualizado_em timestamptz not null default now(),
  primary key (dia, filtro)
);
alter table public.painel_eventos_dia enable row level security;
-- sem policy: só o service_role lê e escreve, como o resto do painel
```

`resumo` tem **exatamente** o formato que `admin_eventos_resumo` já devolve
(`EventosResumo`). Isso é de propósito: **a mesma função alimenta o vivo e o
resumo**. Não existe uma segunda versão em SQL do que é visitante, abertura
ou checkout.

### Quem preenche: cron `api/painel-resumo.ts`

- Vercel Cron **de hora em hora** (`7 * * * *`), autenticado por
  `Authorization: Bearer $CRON_SECRET`, como o `vigia-externo`.
  `maxDuration: 300` no `vercel.json`.
- A cada execução, ele monta a lista de dias a fazer, em ordem:
  1. **Dias faltando**, do mais antigo ao mais novo, entre o primeiro dia
     com evento no banco dele (na Serenata, julho; na Ballad, 29/09) e ontem.
  2. **Dias recentes vencidos**: dia fechado há menos de 72h cuja linha tem
     `atualizado_em` com mais de 6h. Isso absorve evento que chega atrasado e
     PIX pago depois.
- Para cada dia e cada filtro (`todos`, `pt`, `es`), chama
  `admin_eventos_resumo(dia 00:00 BRT, dia+1 00:00 BRT, filtro, sessões)` e faz
  upsert.
- **As sessões que compraram** saem da mesma regra de hoje (pedido `pago`,
  `dinheiro_entrou !== false`, lead do mesmo dia e do mesmo filtro). Ela é
  extraída de `montarPainel` para uma função própria, que o painel e o cron
  chamam. A regra continua morando num lugar só, em JS.
- **Orçamento de tempo:** depois de 200s não começa dia novo. O próximo
  ciclo continua dali. O histórico inteiro (~73 dias × 3 filtros na Serenata) se completa
  sozinho nas primeiras horas depois do deploy, sem script manual nem chave
  na máquina de ninguém.
- Erro num dia é logado e o cron segue para o próximo. Um dia ruim não trava
  a fila.

### Quem lê: o painel

Uma função pura, `fatiarJanela(inicio, fim, agora)`, divide qualquer janela
em:

- **dias fechados inteiros** (de 00:00 a 24:00 BRT, todos antes de hoje), que
  vêm da tabela;
- **até duas fatias vivas**: a ponta inicial (a janela móvel de "7 dias"
  começa no meio de um dia) e a ponta final (hoje, até agora). Cada uma é menor
  que um dia e vai para `admin_eventos_resumo` como hoje.

Outra função pura, `somarResumos(partes)`, junta tudo:

- soma `visitantes`, `sessoes_abertura`, `sessoes_oferta`,
  `sessoes_checkout` e cada chave de `contagens`;
- em `por_entrada`, soma por `caminho` e reordena por visitantes;
- devolve o mesmo `EventosResumo` que o resto de `montarPainel` já consome.

Daí para baixo, nada muda.

**Dia que deveria estar na tabela e não está** (cron atrasado, migration
ainda não aplicada) vira fatia viva, ou seja, fica correto e lento, e o painel
mostra um `aviso`: "N dias ainda sem resumo; o funil foi calculado ao vivo
nesses dias". Se a tabela não existir, o caminho é o de hoje, inteiro ao vivo.

### O que muda de significado, e fica escrito na tela

1. **Sessão que atravessa a meia-noite conta uma vez em cada dia.** Hoje, numa
   janela de 30 dias, ela conta uma vez. Com o resumo, conta uma vez por dia em
   que teve evento. Num funil de compra por impulso deve ser pouco (estimativa
   de 1 a 3%, não medida). O painel ganha uma nota curta no cartão de
   visitantes: "soma dos visitantes de cada dia".
2. **Venda por página de entrada só conta compra no mesmo dia da visita.**
   Quem visitou no dia 1 e pagou no dia 3 (recuperação, PIX tardio) aparece nas
   vendas do topo (que vêm de `pedidos`, intactas), mas não na coluna
   "vendas" da tabela de entradas. É uma coluna de leitura de porta, não de
   faturamento.

Faturamento, vendas, receita, custo, CPA, ROAS e lucro **não mudam**. Eles
vêm de `pedidos`, `custos` e `gastos_ads`, não do resumo.

### Auditoria: `?vivo=1`

Um parâmetro da URL do `/admin` (só admin) força o caminho inteiro ao vivo,
ignorando a tabela. Serve para conferir, num dia fechado, que o resumo bate
com o cálculo direto. É pensado para janelas curtas: em 30 dias, ao vivo
volta a estourar.

### Ballad

Mesmo código e outro banco. Na Ballad, a migration roda pelo
`scratch/ballad-migrar.mjs`. O cron do `vercel.json` vale para os dois
projetos, e cada um escreve no próprio banco. Conferir que `CRON_SECRET`
existe no projeto `balladgift` (o `vigia-externo` já depende dele).

---

## Testes

Puros, no Vitest (ambiente node, como o resto):

- `fatiarJanela`: janela móvel de 7 dias às 22:38 (ponta inicial + 6 dias +
  hoje); `de`/`ate` de um único dia fechado (só tabela, nenhuma fatia viva);
  janela que é só hoje (só fatia viva); virada de mês; janela anterior do
  comparativo (termina no meio de ontem).
- `somarResumos`: soma de contagens com chaves diferentes em cada parte;
  `por_entrada` somado por caminho e reordenado; lista vazia devolve o resumo
  zerado (nunca `undefined`).
- `lerJanela` com um banco falso: fatia vazia; fatia com mais de 1000
  linhas avança pelo cursor sem repetir nem pular; empate de `created_at`
  desempatado por `id`; erro numa fatia lança como antes.
- A regra de sessões compradoras, já extraída: cortesia (`dinheiro_entrou =
false`) fica de fora; filtro `pt`/`es` respeitado.
- O planejador do cron (`diasAFazer(existentes, agora)`): dias faltando em
  ordem; recentes vencidos entram; dia de hoje nunca entra; recente
  atualizado há menos de 6h não entra.

Contrato da tela: `admin-estado.test.ts` continua passando, e um teste de
contrato que lê o código-fonte de `admin.tsx` (o mesmo estilo de
`ga4-contrato.test.ts`) garante que o comparativo tem `enabled` preso ao
sucesso do núcleo.

**No deploy, verificação real:**

- o log da A4 nos logs da Vercel para 7, 30 e 90 dias;
- a tabela `painel_eventos_dia` enchendo nas primeiras horas;
- um dia fechado comparado com `?vivo=1`.

O dono confere a tela, porque a senha do painel é dele.

## Ordem de entrega

1. A1 a A4 num deploy só. Já deve devolver 7 e 30 dias, e o log diz.
2. B: migration da tabela, cron, leitura fatiada. Num segundo deploy, depois de
   ver o log da parte A.
