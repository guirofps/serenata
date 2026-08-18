-- CRÉDITO DE MÚSICA: o razão de quem tem quanto, e por quê.
--
-- Um crédito = uma música NOVA completa (outro quiz, outra letra, outra
-- música, duas gravações, página presente, link, QR e MP3). É o mesmo produto
-- de R$ 38, mais barato porque a pessoa já é cliente e a segunda venda não
-- custa anúncio nenhum.
--
-- ── POR QUE UM RAZÃO E NÃO UMA COLUNA "saldo" ────────────────────
--
-- A tentação é guardar um número por conta e somar/subtrair. Não: quando
-- alguém disser "paguei três e só usei uma, cadê", uma coluna só responde
-- "você tem 2" e não prova nada. Aqui cada linha é um FATO com origem — este
-- pedido creditou 3, esta música gastou 1 — e o saldo é a soma. Auditável,
-- e o suporte consegue explicar sem abrir o gateway.
--
-- É a mesma lição do `dinheiro_entrou` em `pedidos`: número agregado sem
-- procedência vira discussão sem prova.

create table if not exists public.creditos (
  id uuid primary key default gen_random_uuid(),

  -- O DONO É O E-MAIL, não o user_id, e isso é deliberado.
  --
  -- O crédito nasce no webhook, que roda antes de a pessoa entrar na
  -- plataforma: nesse instante a conta do Supabase Auth pode nem existir.
  -- Prender ao user_id exigiria criar a conta no webhook ou segurar o crédito
  -- num limbo. O e-mail é o que o gateway manda e o que a pessoa usa pra
  -- entrar, então é a chave que existe nos dois lados.
  email text not null,

  -- POSITIVO credita, NEGATIVO gasta. Zero não entra.
  quantidade int not null check (quantidade <> 0),

  -- De onde veio, em uma palavra: 'compra', 'uso', 'cortesia', 'estorno'.
  origem text not null,

  -- A procedência. Um dos dois preenchido, conforme a origem.
  pedido_id uuid references public.pedidos (id),
  musica_id uuid references public.musicas (id),

  -- Espaço pra explicar o que não cabe nas colunas (qual produto da Perfect
  -- Pay creditou, quem liberou a cortesia, o motivo do estorno).
  nota jsonb default '{}',

  created_at timestamptz not null default now()
);

create index if not exists creditos_email_idx on public.creditos (lower(email));

-- UM CRÉDITO POR PEDIDO, NO MÁXIMO.
--
-- O webhook da Perfect Pay REPETE evento: é assim que ele garante entrega
-- quando a nossa resposta demora. Sem esta trava, um reenvio creditaria de
-- novo e a pessoa ganharia músicas de graça em silêncio.
--
-- A mesma ideia que já protege `pedidos` por `payment_id`, agora no razão.
create unique index if not exists creditos_um_por_pedido
  on public.creditos (pedido_id) where pedido_id is not null and quantidade > 0;

-- E UM DÉBITO POR MÚSICA: se o gasto for reenviado, não cobra duas vezes.
create unique index if not exists creditos_um_por_musica
  on public.creditos (musica_id) where musica_id is not null and quantidade < 0;

alter table public.creditos enable row level security;

-- NINGUÉM LÊ PELO CLIENTE. O saldo sai por server function com service role,
-- como o resto do pós-compra. Deixar o anon ler expõe quem comprou o quê, e a
-- lição do CLAUDE.md sobre rota admin no bundle vale aqui igual.
revoke all on public.creditos from anon, authenticated;

/**
 * Saldo de uma conta. Uma soma, não um cache.
 */
create or replace function public.saldo_creditos(p_email text)
returns int
language sql
stable
as $$
  select coalesce(sum(quantidade), 0)::int
  from public.creditos
  where lower(email) = lower(p_email);
$$;

revoke all on function public.saldo_creditos(text) from public, anon, authenticated;
grant execute on function public.saldo_creditos(text) to service_role;

/**
 * Gasta um crédito, e SÓ se houver saldo.
 *
 * A checagem e a gravação ficam na mesma transação de propósito: ler o saldo
 * no Node e depois gravar abriria a janela pra duas abas gastarem o mesmo
 * crédito. Aqui o banco decide.
 *
 * Devolve o saldo restante, ou -1 quando não havia crédito.
 */
create or replace function public.gastar_credito(p_email text, p_musica uuid)
returns int
language plpgsql
as $$
declare
  atual int;
begin
  select coalesce(sum(quantidade), 0)::int into atual
  from public.creditos
  where lower(email) = lower(p_email)
  for update;

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
