-- DATAS QUE ELA NÃO PODE ESQUECER, 25/09/2026.
--
-- A compra hoje é uma só: ela faz a música, entrega e some. As datas são o
-- motivo pra voltar. Ela cadastra no editor (aniversário da mãe, do namoro)
-- e o `lembrarDatas` avisa 10 dias antes, com o caminho pra criar a próxima.
--
-- Só o servidor lê e escreve (service role). Anon e authenticated não têm
-- acesso nenhum: a lista é pessoal e é aberta pelo token de edição.

create table if not exists public.datas_especiais (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text not null check (char_length(nome) between 1 and 40),
  tipo text not null default 'aniversario'
    check (tipo in ('aniversario', 'namoro', 'outra')),
  dia smallint not null check (dia between 1 and 31),
  mes smallint not null check (mes between 1 and 12),
  locale text not null default 'pt',
  -- Ano do último aviso: um lembrete por data por ano, mesmo com o cron
  -- rodando de novo ou falhando no meio.
  avisado_ano integer,
  origem text,
  created_at timestamptz not null default now()
);

create index if not exists datas_especiais_email on public.datas_especiais (lower(email));
create index if not exists datas_especiais_dia on public.datas_especiais (mes, dia);

alter table public.datas_especiais enable row level security;
revoke all on public.datas_especiais from anon, authenticated;
