-- CUSTO E MÉTRICAS POR CAMPANHA E POR DIA.
--
-- ── O QUE ISTO DESTRAVA ────────────────────────────────────────
--
-- A receita por campanha o painel já mostra em tempo real, lida do nosso
-- banco no instante em que o webhook grava o pedido. Falta o CUSTO — e sem
-- custo não existe ROAS, só faturamento. Saber que "Remkt Concorrentes |
-- CAMPEÃO 1#" fez R$ 437 não decide nada até se saber se ela custou R$ 200 ou
-- R$ 900.
--
-- ── POR QUE NÃO USAR `gastos_ads` ──────────────────────────────
--
-- Aquela tabela é UM VALOR POR DIA E POR ORIGEM ("google", "meta"), digitado
-- à mão. Ela responde "a operação deu lucro hoje?", que é outra pergunta e
-- continua útil. O que ela não responde é QUAL campanha deu — e é essa que
-- decide o que matar.
--
-- As duas convivem: `gastos_ads` é o total do dia, esta é a quebra. Quando
-- houver divergência, o total manda: ele vem do extrato, esta vem de um
-- relatório que pode ter sido exportado com filtro.
--
-- ── POR QUE VEM DE CSV, E NÃO DA API ───────────────────────────
--
-- A API do Google Ads resolveria isso sozinha e é pra onde vai. Ela exige
-- developer token com Basic access, que passa por revisão do Google e leva
-- dias. Este caminho funciona hoje e continua servindo depois como histórico:
-- campanha excluída some da API, e o gasto dela fica aqui.

create table if not exists public.metricas_campanha (
  -- O ID que chega em `utm_campaign`. TEXT pelo mesmo motivo de `campanhas`:
  -- é o que a atribuição guarda, e converter dos dois lados só criaria chance
  -- de não casar.
  campanha_id text not null,
  dia date not null,

  custo_brl numeric(10, 2) not null default 0 check (custo_brl >= 0),
  cliques int not null default 0 check (cliques >= 0),
  impressoes int not null default 0 check (impressoes >= 0),

  -- CONVERSÕES QUE O GOOGLE CONTOU, e não as nossas vendas.
  --
  -- Guardado de propósito, e de propósito NUNCA usado como número de vendas:
  -- o Google conta pelo modelo de atribuição dele, com janela de 30 dias e
  -- frações (0,5 de conversão existe). Nossa venda é linha em `pedidos`.
  --
  -- Serve pra uma coisa só, e é valiosa: comparar os dois. Quando o Google
  -- disser 12 e a gente tiver 6, ou o rastreamento está duplicando ou a
  -- atribuição dele está pegando venda que não é dele.
  conversoes_google numeric(10, 2) not null default 0,

  atualizado_em timestamptz not null default now(),

  -- A CHAVE É (campanha, dia): reimportar o mesmo período reescreve em vez de
  -- somar. O Google ajusta custo retroativamente por dias, então a mesma linha
  -- vai ser carregada várias vezes — e cada carga tem que ser a verdade final
  -- daquele dia, não mais uma parcela.
  primary key (campanha_id, dia)
);

create index if not exists metricas_campanha_dia_idx on public.metricas_campanha (dia desc);

-- Só o service role toca, pelas server functions com `exigirAdmin()`. Custo de
-- mídia é informação de negócio, e o funil anônimo não tem nada que ver com
-- isso. RLS ligada sem policy nenhuma nega tudo por padrão.
alter table public.metricas_campanha enable row level security;
revoke all on public.metricas_campanha from anon, authenticated;

comment on table public.metricas_campanha is
  'Custo, cliques e impressões por campanha e por dia, do relatório do Google Ads. Cruza com a receita de `pedidos` pra dar ROAS por campanha. Reimportar reescreve o dia, porque o Google ajusta custo retroativamente.';
