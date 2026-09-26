-- MEMBER GET MEMBER: o link de quem já comprou, a comissão e o saque.
--
-- Quem chega pelo link paga 10% a menos na primeira música. Quem indicou
-- ganha 20% do que o convidado pagou, "a liberar" por 30 dias, e saca por PIX
-- a partir de R$ 100. As regras e os números moram em `src/lib/indicacao.ts`;
-- os que a trigger precisa (20%, 30 dias, R$ 100, o formato do código) estão
-- repetidos aqui, e o teste de lá avisa quando alguém muda um lado só.
--
-- ── A CHAVE É O E-MAIL, NÃO O user_id ────────────────────────────
--
-- Mesma decisão do razão de `creditos`: `pedidos` não tem user_id, e 84% dos
-- compradores nunca fazem login. O e-mail é o que liga o pedido à pessoa em
-- todo o resto do sistema. Sempre gravado minúsculo.

create table if not exists public.indicacao_codigos (
  email text primary key check (email = lower(email)),
  -- Sem 0/O e 1/I/L: o código é lido de um print e digitado.
  codigo text not null unique check (codigo ~ '^[A-HJKMNP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

-- O CONVITE QUE A COBRANÇA APLICOU, gravado no pedido pendente.
--
-- O `?ref=` mora na `attribution`, que o cliente escreve. Resolver e validar
-- na hora de gerar a cobrança, e gravar aqui o que foi validado, é o que faz
-- a trigger abaixo não depender de um JSON que pode ter mudado depois.
alter table public.pedidos
  add column if not exists indicacao_codigo text,
  add column if not exists desconto_indicacao_centavos integer not null default 0;

comment on column public.pedidos.indicacao_codigo is
  'Código de indicação validado quando a cobrança nasceu (desconto aplicado). Nulo = sem convite, ou pedido de um caminho que não gera pendente (Perfect Pay), que cai na attribution.ref.';
comment on column public.pedidos.desconto_indicacao_centavos is
  'Quanto o convite tirou do preço base. Já está descontado do valor_centavos.';

-- ── A COMISSÃO ───────────────────────────────────────────────────
--
-- Uma linha por pedido que gerou comissão, e NUNCA atualizada. O estado
-- (a liberar, liberada, estornada) não é coluna: sai de `libera_em` e do
-- status do pedido na hora de ler. Reembolso que vira `reembolsado` apaga a
-- comissão do saldo sem ninguém precisar lembrar de estornar.
create table if not exists public.indicacao_comissoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos (id) on delete cascade,
  codigo text not null,
  indicador_email text not null,
  indicado_email text not null,
  base_centavos integer not null check (base_centavos > 0),
  valor_centavos integer not null check (valor_centavos > 0),
  libera_em timestamptz not null,
  created_at timestamptz not null default now()
);

-- SÓ A PRIMEIRA COMPRA: uma comissão por convidado, pra sempre. É também a
-- trava de concorrência — dois pagamentos do mesmo convidado chegando juntos
-- não passam os dois pelo "é a primeira?" da trigger.
create unique index if not exists indicacao_um_por_indicado
  on public.indicacao_comissoes (indicado_email);
create index if not exists indicacao_comissoes_indicador_idx
  on public.indicacao_comissoes (indicador_email);

-- ── O SAQUE ──────────────────────────────────────────────────────
--
-- Pago À MÃO pelo dono. O `asaas-saque.ts` recusa toda transferência nascida
-- da API, de propósito (é a proteção contra chave vazada), e comissão não é
-- motivo pra abrir essa porta.
create table if not exists public.indicacao_saques (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  valor_centavos integer not null check (valor_centavos > 0),
  chave_pix text not null,
  status text not null default 'solicitado'
    check (status in ('solicitado', 'pago', 'recusado')),
  nota text,
  created_at timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists indicacao_saques_email_idx on public.indicacao_saques (email);

alter table public.indicacao_codigos enable row level security;
alter table public.indicacao_comissoes enable row level security;
alter table public.indicacao_saques enable row level security;
revoke all on public.indicacao_codigos from anon, authenticated;
revoke all on public.indicacao_comissoes from anon, authenticated;
revoke all on public.indicacao_saques from anon, authenticated;

-- ── A TRIGGER: O ÚNICO PONTO POR ONDE TODO PAGAMENTO PASSA ───────
--
-- São seis caminhos que marcam pedido como pago (webhook da Woovi, do Asaas,
-- da Perfect Pay, o cartão síncrono, o vigia de pagamento, a liberação
-- manual). Chamar uma função em cada um é pedir pra esquecer o sétimo.
--
-- ── ELA NUNCA DERRUBA UMA VENDA ──────────────────────────────────
--
-- Trigger que estoura desfaz o UPDATE que a disparou, e o UPDATE aqui é o
-- pagamento sendo gravado. Um erro de comissão não pode fazer o webhook
-- devolver 500 com o dinheiro já na conta. Então tudo roda dentro de um
-- bloco com EXCEPTION: falhou, vira WARNING no log e o pedido segue pago.
create or replace function public.indicacao_comissionar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_locale text;
  v_attr jsonb;
  v_codigo text;
  v_indicador text;
begin
  -- Só na TRANSIÇÃO pra pago. Reprocessar um pedido já pago não é evento.
  if new.status is distinct from 'pago' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'pago' then
    return new;
  end if;

  begin
    -- Dinheiro de verdade, e só da compra principal: crédito gasto, liberação
    -- manual e upsell (`:up:`) não são "a primeira compra" de ninguém.
    if coalesce(new.valor_centavos, 0) <= 0
       or new.dinheiro_entrou is false
       or coalesce(new.gateway, '') in ('credito', 'manual')
       or coalesce(new.payment_id, '') like '%:up:%' then
      return new;
    end if;

    v_email := lower(trim(new.email));
    if v_email is null or v_email = '' then
      return new;
    end if;

    if new.quiz_response_id is not null then
      select q.locale, q.attribution into v_locale, v_attr
      from quiz_responses q
      where q.id = new.quiz_response_id;
    end if;
    -- Só o funil em português: o espanhol cobra em DÓLAR, e `valor_centavos`
    -- ali são centavos de dólar. 20% deles creditados como real seria erro
    -- de câmbio silencioso.
    if coalesce(v_locale, 'pt') <> 'pt' then
      return new;
    end if;

    -- O validado na cobrança vence; a attribution só cobre o caminho que não
    -- gera pendente do nosso lado (Perfect Pay), onde não houve desconto mas
    -- a indicação existiu.
    v_codigo := upper(coalesce(new.indicacao_codigo, v_attr ->> 'ref'));
    if v_codigo is null or v_codigo !~ '^[A-HJKMNP-Z2-9]{6}$' then
      return new;
    end if;

    select c.email into v_indicador from indicacao_codigos c where c.codigo = v_codigo;
    -- Indicar a si mesmo não conta.
    if v_indicador is null or v_indicador = v_email then
      return new;
    end if;

    -- A PRIMEIRA COMPRA. Um pedido anterior reembolsado também conta como
    -- compra: senão, comprar, pedir reembolso e comprar de novo pelo link
    -- viraria o jeito de fabricar comissão.
    if exists (
      select 1 from pedidos p
      where lower(p.email) = v_email
        and p.id <> new.id
        and p.status in ('pago', 'reembolsado')
        and coalesce(p.valor_centavos, 0) > 0
        and p.dinheiro_entrou is not false
        and coalesce(p.gateway, '') not in ('credito', 'manual')
    ) then
      return new;
    end if;

    insert into indicacao_comissoes
      (pedido_id, codigo, indicador_email, indicado_email, base_centavos, valor_centavos, libera_em)
    values (
      new.id,
      v_codigo,
      v_indicador,
      v_email,
      new.valor_centavos,
      -- 20%, o mesmo `comissaoDe` do TS. valor/5 nunca termina em ,5, então
      -- o arredondamento dos dois lados não diverge.
      round(new.valor_centavos * 20 / 100.0)::int,
      coalesce(new.paid_at, now()) + interval '30 days'
    )
    on conflict do nothing;
  exception when others then
    raise warning 'indicacao_comissionar falhou no pedido %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists pedidos_indicacao_comissao on public.pedidos;
create trigger pedidos_indicacao_comissao
  after insert or update of status on public.pedidos
  for each row execute function public.indicacao_comissionar();

-- ── O SALDO: UMA SOMA, NÃO UM CACHE ──────────────────────────────
--
-- Comissão de pedido que deixou de estar pago (reembolso, contestação) some
-- da conta sozinha. Consequência aceita: se a contestação chegar DEPOIS do
-- saque, o disponível fica negativo, e é assim que o dono vê que tem um
-- acerto a fazer.
create or replace function public.saldo_indicacao(p_email text)
returns table (
  pendente_centavos bigint,
  liberado_centavos bigint,
  sacado_centavos bigint,
  disponivel_centavos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select ic.valor_centavos, ic.libera_em
    from indicacao_comissoes ic
    join pedidos p on p.id = ic.pedido_id
    where ic.indicador_email = lower(trim(p_email))
      and p.status = 'pago'
  ),
  s as (
    select coalesce(sum(valor_centavos), 0)::bigint as total
    from indicacao_saques
    where email = lower(trim(p_email)) and status <> 'recusado'
  )
  select
    coalesce(sum(c.valor_centavos) filter (where c.libera_em > now()), 0)::bigint,
    coalesce(sum(c.valor_centavos) filter (where c.libera_em <= now()), 0)::bigint,
    (select total from s),
    coalesce(sum(c.valor_centavos) filter (where c.libera_em <= now()), 0)::bigint - (select total from s)
  from c;
$$;

-- ── O PEDIDO DE SAQUE, ATÔMICO ───────────────────────────────────
--
-- Lê o disponível e grava o saque sob a mesma trava: dois toques em "Sacar"
-- (ou duas abas) não pedem o mesmo dinheiro duas vezes. Saca TUDO o que está
-- disponível; um saque em aberto por vez, pra fila do dono ser legível.
create or replace function public.pedir_saque_indicacao(p_email text, p_chave text)
returns public.indicacao_saques
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_disp bigint;
  v_linha public.indicacao_saques;
begin
  perform pg_advisory_xact_lock(hashtext('saque_indicacao:' || v_email));

  if exists (select 1 from indicacao_saques where email = v_email and status = 'solicitado') then
    raise exception 'saque-em-aberto';
  end if;

  select disponivel_centavos into v_disp from saldo_indicacao(v_email);
  if coalesce(v_disp, 0) < 10000 then
    raise exception 'saldo-insuficiente';
  end if;

  insert into indicacao_saques (email, valor_centavos, chave_pix)
  values (v_email, v_disp, p_chave)
  returning * into v_linha;
  return v_linha;
end;
$$;

revoke all on function public.indicacao_comissionar() from public, anon, authenticated;
revoke all on function public.saldo_indicacao(text) from public, anon, authenticated;
revoke all on function public.pedir_saque_indicacao(text, text) from public, anon, authenticated;
grant execute on function public.saldo_indicacao(text) to service_role;
grant execute on function public.pedir_saque_indicacao(text, text) to service_role;
