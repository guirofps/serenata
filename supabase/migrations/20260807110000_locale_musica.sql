-- O IDIOMA TAMBÉM NA MÚSICA.
--
-- A página-presente, o editor e os e-mails leem `quiz_responses.locale` com a
-- chave de serviço, e isso resolve. O painel do comprador (`/dashboard`) não:
-- ele consulta com a chave do PRÓPRIO usuário, e a RLS do funil é "anônimo
-- escreve, nunca lê" — ele não enxerga `quiz_responses`.
--
-- Duplicar o campo aqui é mais honesto que afrouxar a RLS pra uma tela de
-- listagem. A fonte da verdade continua sendo o lead; esta coluna é cópia,
-- gravada junto com a música e nunca editada depois.

alter table public.musicas
  add column if not exists locale text not null default 'pt'
  check (locale in ('pt', 'es'));

comment on column public.musicas.locale is
  'Cópia de quiz_responses.locale, pro painel do comprador (que não lê o lead por RLS).';

-- Backfill do histórico: tudo que existe é brasileiro, mas puxa do lead pra
-- não assumir — se algum dia houver linha divergente, ela aparece.
update public.musicas m
set locale = q.locale
from public.quiz_responses q
where m.quiz_response_id = q.id and m.locale is distinct from q.locale;
