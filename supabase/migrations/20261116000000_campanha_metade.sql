-- CAMPANHA METADE (16/11/2026, Ralph): 50% em música, vídeo e quadro, por e-mail,
-- SÓ pra quem já comprou, com 10% de grupo de controle que não recebe.
--
-- A fila é a mesma tabela da MUSICA10 (`campanha_envios`). O CONTROLE entra na
-- fila com `pulado = 'controle'`: o job nunca pega linha com `pulado`, e a
-- leitura compara quem recebeu (`enviado_em`) com quem ficou de fora.
--
-- O sorteio é o hash do e-mail (md5, primeiros 8 dígitos, resto de 100): o mesmo
-- e-mail cai sempre no mesmo grupo, rodando a função uma vez ou em pedaços.
--
-- Um envio por E-MAIL (o quiz mais recente dele), só `pt`, fora descadastrados,
-- mortos, excluídos e memorial: as mesmas regras de `montar_campanha`.
-- `language sql` e SEM ponto e vírgula dentro do corpo (o SQL Editor do Supabase
-- parte o texto nos `;`). Devolve quantas linhas entraram, controle incluído.
create or replace function public.montar_campanha_compradores(
  p_campanha text,
  p_controle_pct integer default 10,
  p_desde timestamptz default '-infinity',
  p_ate timestamptz default 'infinity'
)
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
    join compradores b on b.email = lower(trim(q.email))
    where q.email is not null
      and q.created_at >= p_desde
      and q.created_at < p_ate
      and coalesce(q.locale, 'pt') = 'pt'
      and length(q.email) <= 254
      and lower(trim(q.email)) ~ '^[^[:space:]@]+@[^[:space:]@.]+([.][^[:space:]@.]+)*[.]([a-z]{2,24}|xn--[a-z0-9-]{2,59})$'
    order by lower(trim(q.email)), q.created_at desc
  ),
  inseridos as (
    insert into campanha_envios (campanha, email, versao, quiz_response_id, nome, pulado)
    select
      p_campanha,
      c.email,
      'comprador',
      c.quiz_id,
      c.nome,
      case
        when (('x' || substr(md5(c.email), 1, 8))::bit(32)::bigint % 100) < p_controle_pct then 'controle'
      end
    from candidatos c
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
revoke all on function public.montar_campanha_compradores(text, integer, timestamptz, timestamptz) from public, anon, authenticated;
