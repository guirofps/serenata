-- ────────────────────────────────────────────────────────────────
-- Fase 2: armazenamento das músicas + campos do pipeline.
--
-- Por que o bucket: as URLs que o kie.ai devolve são TEMPORÁRIAS
-- (tempfile.aiquickdraw.com). Se a gente apontar direto pra elas, a música do
-- cliente some sozinha depois de um tempo. Baixar e guardar é obrigatório.
--
-- Bucket PRIVADO: o acesso à música é o produto pago. A página presente
-- serve por signed URL gerada no servidor.
-- ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('musicas', 'musicas', false)
on conflict (id) do nothing;

-- Sem policy para anon/authenticated: só service role toca no bucket.
-- (Storage nega por padrão quando não há policy.)

-- Campos que o pipeline precisa e ainda não existiam.
alter table public.musicas
  add column if not exists audio_path text,        -- caminho no bucket
  add column if not exists audio_path_v2 text,     -- 2ª versão (pague 1 leve 2)
  add column if not exists timestamps jsonb,       -- palavras alinhadas (karaokê)
  add column if not exists duracao_s numeric,
  add column if not exists gerada_em timestamptz;

-- Status ganha os estados do pipeline de música.
alter table public.musicas drop constraint if exists musicas_status_check;
alter table public.musicas add constraint musicas_status_check
  check (status in ('aguardando', 'gerando', 'pronta', 'falhou'));

-- Busca por token (página presente) e por status (retry/monitoramento).
create index if not exists musicas_status_idx on public.musicas (status);
