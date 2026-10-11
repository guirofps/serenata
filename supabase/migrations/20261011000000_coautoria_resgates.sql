-- Teste `resgate_coautoria` (11/10/2026): quem largou a coautoria no meio.
-- Uma linha por quiz que entrou no teste, nos DOIS braços (A não recebe nada,
-- C ganha letra + música). A chave primária é a trava de "já resgatado": o job
-- insere ANTES de gastar, e o conflito de chave é o "já passei por aqui".
-- `musica_id` também é lido pelo `finalizarLetra`: se a pessoa voltar e
-- finalizar a letra DELA, a música do resgate é trocada pela dela.
create table if not exists public.coautoria_resgates (
  quiz_response_id uuid primary key references public.quiz_responses(id) on delete cascade,
  braco text not null check (braco in ('A', 'C')),
  musica_id uuid references public.musicas(id) on delete set null,
  erro text,
  created_at timestamptz not null default now()
);
create index if not exists coautoria_resgates_musica_idx on public.coautoria_resgates (musica_id);
create index if not exists coautoria_resgates_created_idx on public.coautoria_resgates (created_at, quiz_response_id);
alter table public.coautoria_resgates enable row level security;
-- Sem política: só o service role (job e servidor) lê e escreve.
