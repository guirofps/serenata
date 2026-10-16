-- ANIVERSÁRIO DE CASAMENTO COMO TIPO PRÓPRIO, 16/10/2026.
--
-- Até aqui o editor juntava "namoro ou casamento" num tipo só, e o lembrete
-- dizia "o aniversário de namoro com Marcos" pra quem é casada há 20 anos. O
-- dono pediu as datas mais fortes separadas: aniversário, aniversário de
-- casamento e aniversário de namoro.
alter table public.datas_especiais drop constraint if exists datas_especiais_tipo_check;
alter table public.datas_especiais
  add constraint datas_especiais_tipo_check
  check (tipo in ('aniversario', 'namoro', 'casamento', 'outra'));
