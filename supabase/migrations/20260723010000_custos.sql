-- ────────────────────────────────────────────────────────────────
-- Registro de CUSTO por geração.
--
-- Por que existe: a economia unitária do projeto (CLAUDE.md) foi medida à
-- mão. Numa plataforma isso precisa ser contínuo — saber o custo real por
-- lead, por música e por venda, sem depender de alguém rodar script.
--
-- Guardamos as UNIDADES CRUAS (tokens, créditos) E o custo em BRL calculado
-- no momento: se o preço do provedor mudar depois, o histórico não se
-- reescreve sozinho.
-- ────────────────────────────────────────────────────────────────

create table if not exists public.custos (
  id uuid primary key default gen_random_uuid(),
  quiz_response_id uuid references public.quiz_responses (id) on delete set null,
  musica_id uuid references public.musicas (id) on delete set null,

  -- 'letra' | 'musica' | 'timestamps' | 'transcricao'
  tipo text not null,
  provider text not null,           -- 'anthropic' | 'kie.ai'
  modelo text,                      -- claude-sonnet-5, V4_5PLUS...

  -- Unidades cruas (o que o provedor cobrou)
  tokens_in integer,
  tokens_out integer,
  tokens_cache_read integer,
  tokens_cache_write integer,
  creditos numeric,

  -- Custo já convertido, congelado no momento da geração
  custo_usd numeric not null default 0,
  custo_brl numeric not null default 0,
  cambio numeric,                   -- USD/BRL usado no cálculo

  created_at timestamptz not null default now()
);

create index if not exists custos_criado_idx on public.custos (created_at desc);
create index if not exists custos_tipo_idx on public.custos (tipo);
create index if not exists custos_quiz_idx on public.custos (quiz_response_id);

-- Sem policy: só service role escreve e lê (o painel passa por server function
-- autenticada). Cliente anônimo nunca toca em custo.
alter table public.custos enable row level security;
