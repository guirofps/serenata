-- GASTO DE ANÚNCIO, digitado à mão.
--
-- Sem isto o painel mostra receita e margem BRUTA, e some com a única conta
-- que decide se a operação vive: o CPA. R$ 209 de margem bruta pode ser lucro
-- ou prejuízo dependendo do que se gastou pra trazer aquelas 6 vendas.
--
-- Por que digitado e não puxado da API: o Google Ads exige OAuth com developer
-- token aprovado, o que leva dias e depende de review deles. Um campo de
-- digitar resolve hoje, e o dia em que a API entrar troca a fonte sem mexer em
-- nada do resto.
--
-- Uma linha por DIA e ORIGEM. A chave única deixa reescrever o valor do dia
-- quando o gasto fecha diferente do parcial (o Google ajusta retroativamente).

create table if not exists public.gastos_ads (
  id uuid primary key default gen_random_uuid(),
  dia date not null,
  -- 'google' | 'meta' | qualquer outra. Casa com a `origem` da atribuição
  -- first-touch, pra dar CPA por canal.
  origem text not null,
  valor_brl numeric(10, 2) not null check (valor_brl >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dia, origem)
);

create index if not exists gastos_ads_dia_idx on public.gastos_ads (dia desc);

-- Só o service role toca. Não há caso de uso anônimo, e gasto de anúncio é
-- informação de negócio: RLS ligada sem policy nenhuma nega tudo por padrão.
alter table public.gastos_ads enable row level security;

comment on table public.gastos_ads is
  'Gasto de midia por dia e canal, digitado no painel. Base do CPA e do ROAS.';
