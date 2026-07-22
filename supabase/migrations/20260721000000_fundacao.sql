-- ────────────────────────────────────────────────────────────────
-- Fundação (Fase 0): tabelas do funil + RLS + RPC de upsert.
--
-- Princípios herdados (aprendidos a caro nos repos anteriores):
--   1. Cliente anônimo NUNCA lê tabela com PII. quiz_responses não tem
--      nenhuma policy de SELECT para anon.
--   2. quiz_responses só é escrita via RPC SECURITY DEFINER (abaixo).
--      Sem policy de INSERT/UPDATE aberta: uma policy "update using(true)"
--      deixaria qualquer um sobrescrever a linha de qualquer sessão.
--   3. funnel_events: anon INSERE (trackEvent grava direto), nunca lê.
--   4. pedidos e musicas: zero acesso anon. Só service role (server-side),
--      que ignora RLS. A página presente lê a música por token no servidor.
-- ────────────────────────────────────────────────────────────────

-- Lead + respostas do quiz. Uma linha por sessão, gravada a cada passo
-- (captura parcial: quem abandona no meio ainda vira lead).
create table public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  current_step integer,
  furthest_step integer,
  respostas jsonb,
  email text,
  whatsapp text,
  attribution jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Eventos crus do funil (page_view, quiz_step, fake_door_click...).
create table public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  event_name text not null,
  event_data jsonb default '{}',
  created_at timestamptz not null default now()
);
create index funnel_events_session_idx on public.funnel_events (session_id);
create index funnel_events_name_time_idx on public.funnel_events (event_name, created_at);

-- Música gerada (dispara na conclusão do quiz, ANTES do pagamento).
create table public.musicas (
  id uuid primary key default gen_random_uuid(),
  quiz_response_id uuid not null references public.quiz_responses (id),
  -- Token da página presente (/p/$token). Gerado no servidor, imprevisível.
  token text not null unique,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'gerando', 'pronta', 'falhou')),
  titulo text,
  letra text,
  estilo_suno text,
  verso_destaque text,
  genero text,
  audio_url text,
  provider text,
  provider_job_id text,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index musicas_quiz_response_idx on public.musicas (quiz_response_id);

-- Pedidos. payment_id único é a chave da idempotência do webhook:
-- o mesmo evento de pagamento processado duas vezes não libera duas vezes.
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  quiz_response_id uuid references public.quiz_responses (id),
  musica_id uuid references public.musicas (id),
  gateway text,
  payment_id text unique,
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'reembolsado', 'cancelado')),
  valor_centavos integer,
  email text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index pedidos_quiz_response_idx on public.pedidos (quiz_response_id);

-- updated_at automático.
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger quiz_responses_updated_at before update on public.quiz_responses
  for each row execute function public.set_updated_at();
create trigger musicas_updated_at before update on public.musicas
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.quiz_responses enable row level security;
alter table public.funnel_events enable row level security;
alter table public.musicas enable row level security;
alter table public.pedidos enable row level security;

-- funnel_events: anon só insere. Leitura fica para o service role (ignora RLS).
create policy "anon insert funnel_events" on public.funnel_events
  for insert to anon, authenticated with check (true);

-- quiz_responses, musicas, pedidos: nenhuma policy. Escrita de quiz_responses
-- passa pela RPC abaixo; todo o resto é service role no servidor.

-- ── RPC de upsert (SECURITY DEFINER) ────────────────────────────
-- O PostgREST traduz upsert do cliente para INSERT ... ON CONFLICT DO UPDATE,
-- que sob RLS exige policy de SELECT — e SELECT anon é exatamente o que não
-- pode existir aqui. A RPC roda com privilégio do owner (bypassa RLS),
-- retorna void e não reexpõe leitura nenhuma.
--
-- Semântica de merge:
--   - furthest_step: GREATEST(atual, novo) — nunca regride (back-nav seguro).
--   - demais campos: COALESCE(novo, atual) — upsert parcial (progresso) não
--     apaga o que o upsert final grava, e vice-versa.
create or replace function public.upsert_quiz_response(
  p_session_id text,
  p_current_step integer default null,
  p_furthest_step integer default null,
  p_respostas jsonb default null,
  p_email text default null,
  p_whatsapp text default null,
  p_attribution jsonb default null
) returns void as $$
begin
  insert into public.quiz_responses as qr (
    session_id, current_step, furthest_step, respostas, email, whatsapp, attribution
  ) values (
    p_session_id, p_current_step, p_furthest_step, p_respostas, p_email, p_whatsapp, p_attribution
  )
  on conflict (session_id) do update set
    current_step  = coalesce(excluded.current_step, qr.current_step),
    furthest_step = greatest(coalesce(qr.furthest_step, 0), coalesce(excluded.furthest_step, 0)),
    respostas     = coalesce(excluded.respostas, qr.respostas),
    email         = coalesce(excluded.email, qr.email),
    whatsapp      = coalesce(excluded.whatsapp, qr.whatsapp),
    attribution   = coalesce(excluded.attribution, qr.attribution);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb
) to anon, authenticated;
