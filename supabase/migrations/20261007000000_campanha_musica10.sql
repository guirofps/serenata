-- CAMPANHA MUSICA10 (07/10/2026). Ver docs/superpowers/specs/2026-10-07-campanha-musica10-design.md

-- O cupom que BAIXOU o preço, normalizado. Mede a campanha sem adivinhar pelo
-- valor, e é o que o webhook do upsell confere (`valorEsperadoDoUpsell`).
alter table public.pedidos add column if not exists cupom text;

-- A FILA. Montada UMA vez (`montar_campanha`) e drenada pelo job
-- `campanhaMusica10`. `enviado_em` é a trava: linha enviada nunca volta pra fila.
create table if not exists public.campanha_envios (
  campanha text not null,
  email text not null,
  versao text not null check (versao in ('comprador', 'lead')),
  quiz_response_id uuid,
  nome text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  email_id text,
  pulado text,
  primary key (campanha, email)
);
create index if not exists campanha_envios_fila
  on public.campanha_envios (campanha, versao, email)
  where enviado_em is null and pulado is null;
create index if not exists campanha_envios_enviado
  on public.campanha_envios (campanha, enviado_em);
-- Sem política: só o service role lê e escreve.
alter table public.campanha_envios enable row level security;

-- QUEM RECEBE: um envio por E-MAIL (o quiz mais recente dele), só `pt`, fora
-- descadastrados, mortos (bounce não liberado), excluídos e memorial.
-- `comprador` = tem pedido pago com dinheiro entrando; senão `lead`.
--
-- `language sql` e SEM ponto e vírgula dentro do corpo, de propósito: o SQL
-- Editor do Supabase parte o texto nos `;` e quebrava o corpo de uma versão
-- plpgsql (07/10). Devolve quantas linhas entraram na fila.
create or replace function public.montar_campanha(p_campanha text)
returns integer
language sql
security definer
set search_path = public
as $$
  with compradores as (
    select distinct lower(trim(email)) as email
    from pedidos
    where status = 'pago' and dinheiro_entrou is not false and email is not null
  ),
  candidatos as (
    select distinct on (lower(trim(q.email)))
      lower(trim(q.email)) as email,
      q.id as quiz_id,
      nullif(trim(q.nome_comprador), '') as nome,
      coalesce(q.respostas->>'ocasiao', '') as ocasiao
    from quiz_responses q
    where q.email is not null
      and coalesce(q.locale, 'pt') = 'pt'
      and position('@' in q.email) > 1
    order by lower(trim(q.email)), q.created_at desc
  ),
  inseridos as (
    insert into campanha_envios (campanha, email, versao, quiz_response_id, nome)
    select
      p_campanha,
      c.email,
      case when b.email is not null then 'comprador' else 'lead' end,
      c.quiz_id,
      c.nome
    from candidatos c
    -- JOIN, e não `exists` no select: o `exists` contra a CTE virava um laço
    -- (cada candidato varrendo todos os compradores) e estourou o tempo do
    -- SQL Editor em 07/10. O join vira hash, uma passada só.
    left join compradores b on b.email = c.email
    where c.ocasiao not ilike '%memorial%'
      and not exists (select 1 from descadastros d where lower(d.email) = c.email)
      and not exists (select 1 from excluidos_email x where lower(x.email) = c.email)
      and not exists (
        select 1 from emails_mortos m where lower(m.email) = c.email and m.liberado_em is null
      )
    on conflict (campanha, email) do nothing
    returning 1
  )
  select count(*)::integer from inseridos
$$;
revoke all on function public.montar_campanha(text) from public, anon, authenticated;

-- O FREIO: dos enviados desde `p_desde`, quantos voltaram (bounce depois do
-- envio) e quantos reclamaram (descadastro por 'complaint' depois do envio).
create or replace function public.taxas_campanha(p_campanha text, p_desde timestamptz)
returns table (enviados bigint, bounces bigint, reclamacoes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*),
    count(*) filter (where exists (
      select 1 from emails_mortos m where m.email = e.email and m.ultimo_em >= e.enviado_em
    )),
    count(*) filter (where exists (
      select 1 from descadastros d
      where d.email = e.email and d.motivo = 'complaint' and d.created_at >= e.enviado_em
    ))
  from campanha_envios e
  where e.campanha = p_campanha and e.enviado_em >= p_desde
$$;
revoke all on function public.taxas_campanha(text, timestamptz) from public, anon, authenticated;
