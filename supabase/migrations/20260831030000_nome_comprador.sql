-- O NOME DE QUEM COMPRA, que a migracao pra Woovi fez a gente perder.
--
-- Medido em 31/08, 173 vendas pagas desde 28/08:
--
--   139 (80%)  `nome_pagador` guarda a HOMENAGEADA, nao o comprador
--    27        guarda o nome certo — e sao TODOS da Perfect Pay
--     7        vazio
--
-- Sao linhas como `Roseli / Roseli` e `Xuru eder / Xuru eder`: o nome da
-- homenageada repetido no campo do comprador. O checkout da Perfect Pay
-- perguntava o nome; a nossa folha de PIX nao pergunta, e o `criar-pix.ts`
-- preenche `nome_pagador` com `respostas.nome`, que e a pessoa homenageada.
--
-- Foi essa confusao que fez a contestacao no Banco Central em nome de "ANTONIO
-- DOS SANTOS LIMA" levar uma hora pra ser encontrada: o pedido estava gravado
-- como "Manuela", o nome da neta dele.
--
-- COLUNA PROPRIA, e nao dentro de `respostas`, por um motivo concreto: o
-- `setResposta` da store zera `letraFinal` a cada escrita, e isso ja produziu
-- alguem pagando por uma musica que nao existia (11/08). Nome de comprador nao
-- e resposta de quiz.
alter table public.quiz_responses
  add column if not exists nome_comprador text;

comment on column public.quiz_responses.nome_comprador is
  'Nome de QUEM COMPRA, pedido na tela de espera. Diferente de respostas.nome, que e a pessoa homenageada.';

-- A RPC ganha um parametro. Mesma receita do `whatsapp_origem`: PostgREST
-- chama por nome e o novo parametro tem default, entao a versao antiga do site
-- continua funcionando durante o deploy. A de 9 argumentos e derrubada em vez
-- de conviver — duas funcoes com o mesmo nome deixariam a chamada ambigua.
drop function if exists public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb, text, text
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
  p_whatsapp_origem text default null,
  p_nome_comprador text default null
) returns void as $$
begin
  insert into public.quiz_responses as qr (
    session_id, current_step, furthest_step, respostas, email, whatsapp,
    attribution, locale, whatsapp_em, whatsapp_origem, nome_comprador
  ) values (
    p_session_id, p_current_step, p_furthest_step, p_respostas, p_email,
    p_whatsapp, p_attribution, coalesce(p_locale, 'pt'),
    case when p_whatsapp is not null then now() end,
    case when p_whatsapp is not null then p_whatsapp_origem end,
    p_nome_comprador
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
    whatsapp_em     = coalesce(qr.whatsapp_em, excluded.whatsapp_em),
    whatsapp_origem = coalesce(qr.whatsapp_origem, excluded.whatsapp_origem),
    -- `coalesce(novo, antigo)`: o upsert de progresso do quiz manda null neste
    -- campo o tempo todo, e sem isto cada passo apagaria o nome que a pessoa
    -- acabou de digitar na tela de espera.
    nome_comprador  = coalesce(excluded.nome_comprador, qr.nome_comprador),
    attribution   = case
                      when excluded.attribution is null then qr.attribution
                      when excluded.attribution = '{}'::jsonb then qr.attribution
                      else excluded.attribution
                    end,
    locale        = qr.locale;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb, text, text, text
) to anon, authenticated;
