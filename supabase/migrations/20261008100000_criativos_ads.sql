-- ABA CRIATIVOS (08/10/2026). Spec: docs/superpowers/specs/2026-10-08-aba-criativos-design.md
-- Gravadas pelo job `puxarCriativosAds`, lidas só pelo painel (service role).
-- Ids do Google como texto: passam de 2^53.

create table if not exists public.anuncios_ads (
  id text primary key,
  campanha_id text,
  grupo_id text,
  nome text,
  tipo text,
  status text,
  -- ids de ASSET dos vídeos do anúncio; o YouTube de cada um está em criativos_ads
  videos text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

create table if not exists public.criativos_ads (
  id text primary key,
  tipo text not null check (tipo in ('video', 'imagem', 'texto', 'outro')),
  texto text,
  youtube_id text,
  imagem_url text,
  nome text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.metricas_anuncio (
  dia date not null,
  anuncio_id text not null,
  custo_brl numeric not null default 0,
  impressoes bigint not null default 0,
  cliques bigint not null default 0,
  views bigint,
  p25 numeric,
  p50 numeric,
  p75 numeric,
  p100 numeric,
  conversoes_google numeric not null default 0,
  valor_conv_google numeric not null default 0,
  primary key (dia, anuncio_id)
);

create table if not exists public.metricas_criativo (
  dia date not null,
  criativo_id text not null,
  campo text not null,
  custo_brl numeric,
  impressoes bigint,
  cliques bigint,
  conversoes_google numeric,
  valor_conv_google numeric,
  primary key (dia, criativo_id, campo)
);

create table if not exists public.cliques_anuncio (
  gclid text primary key,
  anuncio_id text,
  grupo_id text,
  campanha_id text,
  dia date,
  tentado_em timestamptz not null default now()
);

create index if not exists pedidos_paid_at_id on public.pedidos (paid_at, id);

alter table public.anuncios_ads enable row level security;
alter table public.criativos_ads enable row level security;
alter table public.metricas_anuncio enable row level security;
alter table public.metricas_criativo enable row level security;
alter table public.cliques_anuncio enable row level security;
