-- O ECOSSISTEMA DE E-MAIL, que o painel não enxergava.
--
-- O painel media o funil até a venda e parava ali. O e-mail, que é o que traz
-- de volta quem abandonou, era invisível: dava pra saber quantos foram
-- enviados (contando evento cru) e nada mais. Se abriram, se clicaram, se
-- voltaram, e qual modelo funciona, nada disso aparecia em lugar nenhum.
--
-- ── DUAS DECISÕES QUE MUDAM O NÚMERO ─────────────────────────────
--
-- 1. CONTA PESSOA, NÃO EVENTO. O Resend dispara `opened` e `clicked` toda vez
--    que a pessoa reabre o e-mail: um comprador de 15/08 tem quatro `clicked`
--    do mesmo assunto. Taxa de abertura por evento cru daria acima de 100% em
--    e-mail bom, que é o jeito mais rápido de fabricar uma métrica bonita e
--    inútil.
--
-- 2. AGRUPA POR MODELO, NÃO POR ASSUNTO. O assunto carrega o nome do
--    presenteado ("A letra que você escreveu pra Maria"), então agrupar pelo
--    texto cru quebra o dado em centenas de baldes de seis pessoas. Medido:
--    o assunto mais frequente em 7 dias tinha 34 destinatários; agrupado por
--    modelo, o mesmo e-mail tem 1.016.
--
-- O que sai daqui responde a pergunta que importa: qual e-mail as pessoas
-- abrem, qual elas clicam, e qual está voltando.

create or replace function public.admin_emails_resumo(
  p_desde timestamptz,
  p_ate   timestamptz
)
returns jsonb
language sql
stable
-- Mesma folga do resumo do funil, e pelo mesmo motivo: o PostgREST conecta
-- como `authenticator`, que corta em 8s, e `service_role` não sobrescreve.
set statement_timeout to '30s'
as $$
with base as (
  select
    event_name,
    lower(event_data->>'para') as para,
    event_data->>'assunto'     as assunto,
    created_at
  from public.funnel_events
  where created_at >= p_desde and created_at < p_ate
    and event_name in ('email_delivered', 'email_opened', 'email_clicked', 'email_bounced')
    and event_data->>'para' is not null
),

-- O MODELO, tirando o nome próprio de dentro do assunto.
-- Ordem importa: a regra mais específica primeiro.
modelado as (
  select
    para,
    event_name,
    case
      when assunto ~* '^A letra que você escreveu'      then '1. Letra pronta'
      when assunto ~* '^La letra que escribiste'        then '1. Letra pronta (ES)'
      when assunto ~* '^A música de .+ (ficou|está) pronta' then '2. Música pronta'
      when assunto ~* '^La canción de .+ ya quedó lista'    then '2. Música pronta (ES)'
      when assunto ~* '^Seu acesso à Serenata'          then '3. Acesso à conta'
      when assunto ~* '^Tu acceso a Serenata'           then '3. Acesso à conta (ES)'
      when assunto ~* '^O presente de .+ não é um arquivo' then '4. Recuperação 1'
      when assunto ~* '^El regalo de .+ no es un archivo'  then '4. Recuperação 1 (ES)'
      when assunto ~* '^A música de .+ está esperando'  then '5. Recuperação 2'
      when assunto ~* '^La canción de .+ te está esperando' then '5. Recuperação 2 (ES)'
      -- Alerta interno pro dono, não é marketing. Fica separado pra não sujar
      -- a taxa de abertura com e-mail que só nós recebemos.
      when assunto ~* 'não gerou|provedor recusou'      then 'x. Alerta interno'
      else 'x. Outros'
    end as modelo
  from base
),

-- Uma linha por (modelo, pessoa): é aqui que "pessoa, não evento" acontece.
por_pessoa as (
  select
    modelo,
    para,
    bool_or(event_name = 'email_delivered') as entregue,
    bool_or(event_name = 'email_opened')    as abriu,
    bool_or(event_name = 'email_clicked')   as clicou,
    bool_or(event_name = 'email_bounced')   as voltou
  from modelado
  group by modelo, para
),

por_modelo as (
  select
    modelo,
    count(*) filter (where entregue)::int as entregues,
    count(*) filter (where abriu)::int    as abriram,
    count(*) filter (where clicou)::int   as clicaram,
    count(*) filter (where voltou)::int   as voltaram
  from por_pessoa
  group by modelo
),

-- Os envios, do nosso lado. Servem pra comparar com o que o Resend confirmou:
-- enviado menos entregue é o que sumiu no caminho.
enviados as (
  select
    count(*) filter (where event_name = 'email_letra_enviado')::int     as letra,
    count(*) filter (where event_name = 'email_sequencia_enviado')::int as sequencia
  from public.funnel_events
  where created_at >= p_desde and created_at < p_ate
    and event_name in ('email_letra_enviado', 'email_sequencia_enviado')
)

select jsonb_build_object(
  'enviadosLetra',     (select letra from enviados),
  'enviadosSequencia', (select sequencia from enviados),
  'entregues',         coalesce((select sum(entregues) from por_modelo), 0),
  'abriram',           coalesce((select sum(abriram)   from por_modelo), 0),
  'clicaram',          coalesce((select sum(clicaram)  from por_modelo), 0),
  'voltaram',          coalesce((select sum(voltaram)  from por_modelo), 0),
  'porModelo', coalesce((
    select jsonb_agg(jsonb_build_object(
      'modelo', modelo, 'entregues', entregues, 'abriram', abriram,
      'clicaram', clicaram, 'voltaram', voltaram
    ) order by modelo)
    from por_modelo), '[]'::jsonb)
);
$$;

revoke all on function public.admin_emails_resumo(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_emails_resumo(timestamptz, timestamptz) to service_role;
