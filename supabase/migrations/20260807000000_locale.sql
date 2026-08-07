-- IDIOMA DA VENDA.
--
-- Por que uma COLUNA e não a URL: em três lugares o idioma não pode ser
-- deduzido de onde a pessoa está.
--
--   1. `/p/$token` é aberto pelo PRESENTEADO, que nunca passou pelo funil.
--      Não existe `/es` no link que ele recebeu no WhatsApp.
--   2. `/editar/$tokenEdicao` chega por e-mail, sem prefixo nenhum.
--   3. Os 4 e-mails (magic link, entrega, lembrete) saem de webhook e cron,
--      onde não existe navegador, cabeçalho nem rota.
--
-- Nos três, a única fonte de verdade possível é o registro. Gravado uma vez,
-- no primeiro passo do quiz, e carregado dali em diante.
--
-- Default 'pt': toda linha que já existe é brasileira, e uma venda futura sem
-- idioma explícito é muito mais provavelmente brasileira do que espanhola.
-- Falhar pro lado do português é falhar pro lado certo.

alter table public.quiz_responses
  add column if not exists locale text not null default 'pt'
  check (locale in ('pt', 'es'));

comment on column public.quiz_responses.locale is
  'Idioma do funil em que esta pessoa entrou. Decide a lingua da pagina presente, do editor e dos 4 e-mails.';

-- A RPC ganha o parâmetro. É preciso DERRUBAR a antiga em vez de sobrecarregar:
-- com todos os argumentos tendo default, duas versões coexistindo deixam o
-- PostgREST sem saber qual chamar e a chamada falha com "function is not
-- unique" — em produção, calada, no passo 1 do quiz.
drop function if exists public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb
);

create or replace function public.upsert_quiz_response(
  p_session_id text,
  p_current_step integer default null,
  p_furthest_step integer default null,
  p_respostas jsonb default null,
  p_email text default null,
  p_whatsapp text default null,
  p_attribution jsonb default null,
  p_locale text default null
) returns void as $$
begin
  insert into public.quiz_responses as qr (
    session_id, current_step, furthest_step, respostas, email, whatsapp,
    attribution, locale
  ) values (
    p_session_id, p_current_step, p_furthest_step, p_respostas, p_email,
    p_whatsapp, p_attribution, coalesce(p_locale, 'pt')
  )
  on conflict (session_id) do update set
    current_step  = coalesce(excluded.current_step, qr.current_step),
    furthest_step = greatest(coalesce(qr.furthest_step, 0), coalesce(excluded.furthest_step, 0)),
    respostas     = coalesce(excluded.respostas, qr.respostas),
    email         = coalesce(excluded.email, qr.email),
    whatsapp      = coalesce(excluded.whatsapp, qr.whatsapp),
    attribution   = coalesce(excluded.attribution, qr.attribution),
    -- O idioma NÃO se atualiza depois de gravado. Quem começou em espanhol
    -- termina em espanhol, mesmo que um upsert posterior venha sem o campo
    -- (é o que acontece em toda chamada que não passa `p_locale`).
    locale        = qr.locale;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb, text
) to anon, authenticated;
