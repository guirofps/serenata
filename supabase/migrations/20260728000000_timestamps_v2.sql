-- Timestamps da SEGUNDA gravação (v2), pra ela também acender o karaokê.
--
-- Os timestamps são medidos por gravação: a v1 e a v2 são takes diferentes,
-- com timing diferente. `timestamps` guarda os da v1 (a principal); esta
-- coluna guarda os da v2. A página-presente usa um ou outro conforme a
-- versão que está tocando.

alter table public.musicas
  add column if not exists timestamps_v2 jsonb;
