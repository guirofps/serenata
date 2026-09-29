-- INGLÊS, pra Ballad Gift (EUA).
--
-- A Ballad é outro deploy com outro banco, mas o MESMO repositório e as mesmas
-- migrations: a estrutura dos dois bancos é a mesma, conferida tabela por
-- tabela em 29/09. Por isso esta migration roda nos dois, e na Serenata ela só
-- alarga a trava, sem mudar nenhuma linha.
--
-- NOT VALID + VALIDATE em separado: o ADD comum varre a tabela segurando
-- trava exclusiva, e quiz_responses recebe escrita o tempo todo. O VALIDATE
-- varre com uma trava que não bloqueia INSERT/UPDATE.
--
-- O padrão da coluna continua 'pt' aqui. No banco da Ballad o padrão é 'en',
-- ajustado direto nele (ver CLAUDE.md, "Expansão EUA"): o quiz sempre manda o
-- idioma, e o padrão só existe pra quem esquece.

alter table public.quiz_responses drop constraint if exists quiz_responses_locale_check;
alter table public.quiz_responses
  add constraint quiz_responses_locale_check check (locale in ('pt', 'es', 'en')) not valid;
alter table public.quiz_responses validate constraint quiz_responses_locale_check;

alter table public.musicas drop constraint if exists musicas_locale_check;
alter table public.musicas
  add constraint musicas_locale_check check (locale in ('pt', 'es', 'en')) not valid;
alter table public.musicas validate constraint musicas_locale_check;
