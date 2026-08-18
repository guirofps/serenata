-- CONSERTO de `gastar_credito`.
--
-- A primeira versão fazia `select sum(...) ... for update` pra travar a conta
-- enquanto decidia. Isso é inválido no Postgres ("FOR UPDATE is not allowed
-- with aggregate functions"), e o efeito era pior que um erro visível: a
-- função devolvia NULL, não gastava nada, e não recusava nada. Ou seja, todo
-- mundo teria crédito infinito.
--
-- Pego pelo teste em `scratch/testa-creditos.mjs`, antes de ir pro ar.
--
-- O que trava agora é um LOCK POR CONTA (advisory), não por linha. Ele
-- serializa duas abas da mesma pessoa tentando gastar ao mesmo tempo, que é
-- exatamente o caso que importa, e não precisa travar linha nenhuma pra isso.
-- O lock morre no fim da transação sozinho.

create or replace function public.gastar_credito(p_email text, p_musica uuid)
returns int
language plpgsql
as $$
declare
  atual int;
begin
  -- Uma conta por vez. Duas abas da mesma pessoa apertando "usar crédito"
  -- juntas viram fila, e a segunda enxerga o saldo já debitado pela primeira.
  perform pg_advisory_xact_lock(hashtext(lower(p_email)));

  select coalesce(sum(quantidade), 0)::int into atual
  from public.creditos
  where lower(email) = lower(p_email);

  if atual < 1 then
    return -1;
  end if;

  insert into public.creditos (email, quantidade, origem, musica_id)
  values (lower(p_email), -1, 'uso', p_musica)
  on conflict do nothing;

  return atual - 1;
end;
$$;

revoke all on function public.gastar_credito(text, uuid) from public, anon, authenticated;
grant execute on function public.gastar_credito(text, uuid) to service_role;
