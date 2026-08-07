-- OBJETO VAZIO NÃO APAGA RESPOSTA.
--
-- Bug encontrado em 07/08 conferindo as entregas do dia. Uma compradora
-- (Estrelinha Karen) apareceu no painel com o nome em branco: o pedido estava
-- pago, a música pronta e a letra perfeita, mas o `respostas` do lead era `{}`.
--
-- O que aconteceu, pelos eventos da sessão dela:
--   12:23  clicou em comprar
--   12:29  caiu no /obrigado
--   12:37  VOLTOU pro /criar e recomeçou o quiz do passo 1
--
-- Nesse retorno a store já estava zerada, então a captura de lead mandou
-- `p_respostas = '{}'`. E o `coalesce` só protege contra NULL: um objeto
-- vazio é um valor perfeitamente válido, então ele sobrescreveu tudo.
--
-- Estrago medido: 19 leads que passaram do passo 6 perderam as respostas, 2
-- deles compradores. A entrega não foi afetada (letra e áudio vivem em
-- `musicas`), mas o nome some do painel, o e-mail de lembrete passa a dizer
-- "quem você ama" em vez do nome, e o suporte fica sem identificar o pedido.
--
-- A correção é a regra que já estava na intenção do `coalesce`: um upsert de
-- PROGRESSO nunca apaga o que já foi respondido. Só substitui quem traz
-- conteúdo.

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
    -- Vazio não apaga cheio. `'{}'::jsonb = qr.respostas` seria falso pra
    -- qualquer conteúdo, então basta checar o vazio explicitamente.
    respostas     = case
                      when excluded.respostas is null then qr.respostas
                      when excluded.respostas = '{}'::jsonb then qr.respostas
                      else excluded.respostas
                    end,
    email         = coalesce(excluded.email, qr.email),
    whatsapp      = coalesce(excluded.whatsapp, qr.whatsapp),
    -- Mesma regra da resposta: atribuição vazia não apaga a first-touch.
    attribution   = case
                      when excluded.attribution is null then qr.attribution
                      when excluded.attribution = '{}'::jsonb then qr.attribution
                      else excluded.attribution
                    end,
    -- O idioma NÃO se atualiza depois de gravado: quem começou em espanhol
    -- termina em espanhol.
    locale        = qr.locale;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.upsert_quiz_response(
  text, integer, integer, jsonb, text, text, jsonb, text
) to anon, authenticated;
