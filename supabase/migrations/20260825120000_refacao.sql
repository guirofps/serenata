-- A REFAÇÃO: a pessoa pede um ajuste na música depois de comprar.
--
-- ── POR QUE DEPOIS DE PAGAR, E NÃO ANTES ─────────────────────────
--
-- A vontade de mexer aparece na hora que ela OUVE, e é onde mais se perde
-- venda ("gostei, mas aquele trecho..."). Só que oferecer isso antes do
-- pagamento é gastar R$ 0,32 por pedido de quem ainda não pagou nada. Então a
-- promessa fica na paywall e o botão fica no pós-compra.
--
-- ── AS VERSÕES SOMAM, NÃO SUBSTITUEM ─────────────────────────────
--
-- Decisão do dono, e o argumento é melhor que o meu: o custo da primeira
-- gravação já foi pago e não volta. Apagar não devolve nada; guardar
-- transforma o mesmo gasto em mais produto, e resolve o arrependimento de
-- quem pede o ajuste, ouve, e prefere a original.
--
-- Por isso uma TABELA e não colunas `_anterior` na `musicas`: com colunas, a
-- segunda refação exigiria outra migration e um terceiro par de campos.
--
-- ── O DIREITO É DA MÚSICA, NÃO DA CONTA ──────────────────────────
--
-- Diferente de `creditos` (que é saldo de pessoa, fungível), a refação é uma
-- promessa feita sobre UMA música: "esta aqui, a gente refaz se não ficar
-- boa". Contar por música é o que a paywall promete e o que evita alguém
-- comprar uma música e gastar as refações em outra.

create table if not exists public.versoes_musica (
  id uuid primary key default gen_random_uuid(),
  musica_id uuid not null references public.musicas(id) on delete cascade,
  -- 1 é a gravação original, 2 a primeira refação, e assim por diante.
  ordem smallint not null,
  -- Um retrato do que a música ERA. Guardado inteiro de propósito: o áudio
  -- sem a letra que o gerou é um arquivo órfão, e é a letra que explica por
  -- que a pessoa pediu o ajuste.
  letra text,
  titulo text,
  estilo_suno text,
  audio_path text,
  audio_path_v2 text,
  timestamps jsonb,
  timestamps_v2 jsonb,
  -- O que ela pediu. Fica pra suporte e pra a gente aprender o que mais
  -- incomoda: é a única pesquisa de insatisfação que o produto tem.
  pedido text,
  arquivada_em timestamptz not null default now()
);

create unique index if not exists versoes_musica_ordem
  on public.versoes_musica (musica_id, ordem);
create index if not exists versoes_musica_musica_idx
  on public.versoes_musica (musica_id);

alter table public.versoes_musica enable row level security;
revoke all on public.versoes_musica from anon, authenticated;

-- ── O DIREITO, na própria música ─────────────────────────────────
--
-- `incluidas` é quantas ela pode pedir (1 vem com a compra; vender mais é
-- somar aqui). `usadas` é quantas já pediu. O direito é a diferença, e a
-- conta é a mesma que qualquer pessoa faria de cabeça.
alter table public.musicas
  add column if not exists refacoes_incluidas smallint not null default 1,
  add column if not exists refacoes_usadas smallint not null default 0;

comment on column public.musicas.refacoes_incluidas is
  'Quantos ajustes esta música dá direito. 1 vem com a compra; upsell soma.';
comment on column public.musicas.refacoes_usadas is
  'Quantos já foram pedidos. O direito é incluidas - usadas.';
