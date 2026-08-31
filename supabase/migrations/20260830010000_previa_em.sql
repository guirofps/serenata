-- QUANDO a prévia ficou disponível.
--
-- Sem isto, a mudança que corta a espera de ~97s para ~30s é INMENSURÁVEL:
-- a tabela guarda `gerada_em` (o arquivo final) e mais nada. Dava pra ter
-- opinião sobre a prévia, não número.
--
-- Com as duas colunas, a conta é direta e sai por geração real de cliente,
-- não por teste meu:
--
--   previa_em  − created_at  =  quanto a pessoa esperou pra OUVIR
--   gerada_em  − created_at  =  quanto ela esperaria antes
alter table public.musicas
  add column if not exists previa_em timestamptz;

comment on column public.musicas.previa_em is
  'Instante em que a prévia ficou tocável. Contra `gerada_em`, mede o que a prévia adiantou.';
