-- ────────────────────────────────────────────────────────────────
-- Contas do comprador (Fase plataforma): Supabase Auth nativo.
--
-- A virada do CLAUDE.md: o funil deixa de ser 100% anônimo. O comprador
-- passa a ter uma CONTA (magic link), e o presente vira o documento dele,
-- editável, listado num painel.
--
-- Princípios mantidos dos repos antigos (aprendidos a caro):
--   - Segurança é RLS no Supabase, não rota escondida no front.
--   - O comprador autenticado só enxerga o que é DELE (auth.uid() = user_id).
--   - Tudo que é anônimo (quiz_responses) continua write-only pro anon.
--   - O backend (webhook, server fns) usa service role e ignora RLS.
-- ────────────────────────────────────────────────────────────────

-- Espelho de auth.users no schema público. auth.users não é acessível por
-- RLS de tabelas do app; o espelho dá uma tabela nossa pra referenciar e
-- pra buscar "existe conta com este e-mail?" sem paginar a API de admin.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nome text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- O dono lê a própria linha. Ninguém mais.
create policy "owner select users" on public.users
  for select to authenticated using (auth.uid() = id);

-- Trigger: toda conta criada em auth.users nasce espelhada aqui. SECURITY
-- DEFINER porque o insert roda no contexto do Auth, não do app.
-- (O bug histórico do numaya foi escrever `raw_user_metadata`; o campo certo
-- é `raw_user_meta_data`.)
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.users (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: contas que já existirem em auth.users (nenhuma hoje, mas mantém
-- o espelho consistente se rodar depois de já ter usuário).
insert into public.users (id, email, nome)
select id, email, coalesce(raw_user_meta_data ->> 'nome', raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

-- ── Ligação música → dono ───────────────────────────────────────
-- Nullable: as músicas nascem no fim do quiz, ANTES de existir conta. O
-- vínculo é feito quando o comprador entra pela primeira vez (o endpoint de
-- magic link casa por e-mail e preenche isto). ON DELETE SET NULL pra não
-- perder a música se a conta for apagada.
alter table public.musicas
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists musicas_user_id_idx on public.musicas (user_id);

-- RLS: o comprador autenticado LÊ as próprias músicas (o painel monta a lista
-- por aqui). Continua sem INSERT/UPDATE/DELETE pro cliente — edição de
-- conteúdo passa pelo token_edicao no servidor, e a geração é service role.
create policy "owner select musicas" on public.musicas
  for select to authenticated using (auth.uid() = user_id);
