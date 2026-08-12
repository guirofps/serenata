-- WHATSAPP OPCIONAL, PEDIDO NA ESPERA.
--
-- Medido em 12/08, janela de 14 dias: 515 pessoas deixaram e-mail, 413 ouviram
-- a própria música, e 343 delas NUNCA chegaram ao checkout. Dessas 343 a gente
-- tem e-mail e nada mais. O telefone só existe pra quem preencheu o cadastro
-- da Perfect Pay, ou seja, só pra quem já estava comprando.
--
-- A coluna `whatsapp` existe desde a fundação e nunca foi usada ("decisão: só
-- e-mail no lançamento"). A decisão muda agora porque a condição mudou: existe
-- uma pessoa trabalhando recuperação, e o gargalo dela é falta de telefone.
--
-- O que ENTRA aqui é o registro do consentimento, não o telefone (esse já
-- tinha lugar): quando ela aceitou e de qual tela. É o que separa "ela pediu
-- pra ser avisada" de "a gente pegou o número no cadastro do gateway" — quem
-- for chamar no WhatsApp precisa saber a diferença antes de digitar.

alter table public.quiz_responses
  add column if not exists whatsapp_em timestamptz,
  add column if not exists whatsapp_origem text;

comment on column public.quiz_responses.whatsapp_em is
  'Quando a pessoa deixou o WhatsApp por vontade própria. Null = não deixou.';
comment on column public.quiz_responses.whatsapp_origem is
  'De qual tela veio o consentimento (ex.: "espera"). Serve pro operador saber o que ela aceitou.';

-- A RPC ganha um parâmetro. Como PostgREST chama por nome e o novo parâmetro
-- tem default, a versão antiga do site continua funcionando durante o deploy;
-- por isso a de 8 argumentos é derrubada em vez de conviver (duas funções com
-- o mesmo nome deixariam a chamada ambígua).
drop function if exists public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb, text
);

create or replace function public.upsert_quiz_response(
  p_session_id text,
  p_current_step integer default null,
  p_furthest_step integer default null,
  p_respostas jsonb default null,
  p_email text default null,
  p_whatsapp text default null,
  p_attribution jsonb default null,
  p_locale text default null,
  p_whatsapp_origem text default null
) returns void as $$
begin
  insert into public.quiz_responses as qr (
    session_id, current_step, furthest_step, respostas, email, whatsapp,
    attribution, locale, whatsapp_em, whatsapp_origem
  ) values (
    p_session_id, p_current_step, p_furthest_step, p_respostas, p_email,
    p_whatsapp, p_attribution, coalesce(p_locale, 'pt'),
    case when p_whatsapp is not null then now() end,
    case when p_whatsapp is not null then p_whatsapp_origem end
  )
  on conflict (session_id) do update set
    current_step  = coalesce(excluded.current_step, qr.current_step),
    furthest_step = greatest(coalesce(qr.furthest_step, 0), coalesce(excluded.furthest_step, 0)),
    respostas     = case
                      when excluded.respostas is null then qr.respostas
                      when excluded.respostas = '{}'::jsonb then qr.respostas
                      else excluded.respostas
                    end,
    email         = coalesce(excluded.email, qr.email),
    whatsapp      = coalesce(excluded.whatsapp, qr.whatsapp),
    -- A data do consentimento é a do PRIMEIRO sim, e não se reescreve a cada
    -- upsert de progresso: o que vale é quando ela aceitou, não a última vez
    -- que o quiz gravou alguma coisa.
    whatsapp_em     = coalesce(qr.whatsapp_em, excluded.whatsapp_em),
    whatsapp_origem = coalesce(qr.whatsapp_origem, excluded.whatsapp_origem),
    attribution   = case
                      when excluded.attribution is null then qr.attribution
                      when excluded.attribution = '{}'::jsonb then qr.attribution
                      else excluded.attribution
                    end,
    locale        = qr.locale;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb, text, text
) to anon, authenticated;
