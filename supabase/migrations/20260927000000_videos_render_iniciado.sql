-- 27/09/2026: a fila de renders do vídeo-presente.
--
-- O `concurrency: 1` do Inngest limita PASSOS executando, não renders no ar:
-- enquanto um render espera a Lambda (step.sleep), o próximo dispara. Três
-- renders juntos pedem ~21 Lambdas numa conta com cota de 10, e a AWS
-- recusa ("Rate Exceeded"). O job passa a olhar esta coluna antes de
-- disparar: se há outro render começado há menos de 25 minutos, espera a vez.
alter table public.videos add column if not exists render_iniciado_em timestamptz;
