-- AS AUTOMAÇÕES DE E-MAIL, MEDIDAS POR ENVIO.
--
-- ── O QUE A ABA E-MAIL NÃO RESPONDIA ─────────────────────────────
--
-- `admin_emails_resumo` (17/08) agrupa por ASSUNTO, com regex, e conta por
-- PESSOA. Foi o certo enquanto o Resend não devolvia etiqueta nenhuma. Desde
-- 25/08 existe `emails_enviados`, que grava (email_id, template) no instante
-- do envio, e o webhook carimba o `template` em todo evento. A chave estável
-- existe; esta função é a primeira a usá-la.
--
-- ── TRÊS DECISÕES ────────────────────────────────────────────────
--
-- 1. CONTA ENVIO, NÃO PESSOA. A escada manda dez e-mails pra mesma pessoa e
--    o PIX manda dois. Por pessoa, o degrau 7 e o degrau 2 viram a mesma
--    linha. Por envio, cada um responde por si — e "abriram" continua sendo
--    "ao menos uma vez", porque o Resend repete `opened` a cada reabertura.
--
-- 2. COORTE PELO ENVIO, NÃO PELO EVENTO. Um e-mail enviado dentro do período
--    conta as aberturas que vierem depois, mesmo fora dele (até 14 dias). O
--    contrário — eventos do período de envios anteriores — misturaria o que
--    saiu ontem com o que saiu semana passada.
--
-- 3. VENDA É LAST-TOUCH ENTRE E-MAILS. Uma compra é creditada ao ÚLTIMO
--    e-mail que a pessoa recebeu antes de pagar, em até 30 dias, e só se esse
--    envio estiver no período. Somar "comprou depois de receber" pra cada
--    e-mail daria a mesma venda dez vezes na escada. Isto NÃO diz que o
--    e-mail causou a compra — diz que foi o último a chegar antes dela.
--    Descadastro segue a mesma regra, pelo endereço.
--
-- O `+ interval` nas janelas de evento existe porque o índice que serve
-- `funnel_events` é (event_name, created_at): sem limite superior, a busca
-- por email_id varreria a tabela inteira.

create index if not exists emails_enviados_quiz_idx
  on public.emails_enviados (quiz_response_id, created_at desc)
  where quiz_response_id is not null;

create index if not exists emails_enviados_para_idx
  on public.emails_enviados (lower(para), created_at desc)
  where para is not null;

create index if not exists emails_enviados_created_idx
  on public.emails_enviados (created_at);

create or replace function public.admin_automacoes_resumo(
  p_desde timestamptz,
  p_ate   timestamptz
)
returns jsonb
language sql
stable
set statement_timeout to '30s'
as $$
with envios as (
  select email_id, template, lower(para) as para, quiz_response_id, created_at
  from public.emails_enviados
  where created_at >= p_desde and created_at < p_ate
),

eventos as (
  select
    event_data->>'email_id' as email_id,
    event_name
  from public.funnel_events
  where event_name in ('email_delivered', 'email_opened', 'email_clicked', 'email_bounced')
    and created_at >= p_desde
    and created_at < p_ate + interval '14 days'
    and event_data->>'email_id' is not null
),

por_envio as (
  select
    e.template,
    e.email_id,
    bool_or(v.event_name = 'email_delivered') as entregue,
    bool_or(v.event_name = 'email_opened')    as abriu,
    bool_or(v.event_name = 'email_clicked')   as clicou,
    bool_or(v.event_name = 'email_bounced')   as voltou
  from envios e
  left join eventos v on v.email_id = e.email_id
  group by e.template, e.email_id
),

-- ── VENDAS: o último e-mail antes do pagamento ─────────────────
pagos as (
  select quiz_response_id, paid_at, coalesce(valor_centavos, 0) as valor_centavos
  from public.pedidos
  where status = 'pago'
    and quiz_response_id is not null
    and paid_at >= p_desde
    and paid_at <  p_ate + interval '30 days'
),

ultimo_antes_da_venda as (
  select distinct on (p.quiz_response_id, p.paid_at)
    p.quiz_response_id, p.paid_at, p.valor_centavos,
    e.template, e.created_at as enviado_em
  from pagos p
  join public.emails_enviados e
    on e.quiz_response_id = p.quiz_response_id
   and e.created_at <  p.paid_at
   and e.created_at >= p.paid_at - interval '30 days'
  order by p.quiz_response_id, p.paid_at, e.created_at desc
),

vendas as (
  select template,
         count(*)::int              as vendas,
         sum(valor_centavos)::bigint as receita_centavos
  from ultimo_antes_da_venda
  where enviado_em >= p_desde and enviado_em < p_ate
  group by template
),

-- ── DESCADASTROS: o último e-mail antes do clique em sair ──────
saidas as (
  select lower(email) as para, created_at
  from public.descadastros
  where created_at >= p_desde
    and created_at <  p_ate + interval '30 days'
),

ultimo_antes_da_saida as (
  select distinct on (s.para, s.created_at)
    s.para, e.template, e.created_at as enviado_em
  from saidas s
  join public.emails_enviados e
    on lower(e.para) = s.para
   and e.created_at <  s.created_at
   and e.created_at >= s.created_at - interval '30 days'
  order by s.para, s.created_at, e.created_at desc
),

descadastros as (
  select template, count(*)::int as descadastros
  from ultimo_antes_da_saida
  where enviado_em >= p_desde and enviado_em < p_ate
  group by template
),

por_template as (
  select
    template,
    count(*)::int                          as enviados,
    count(*) filter (where entregue)::int  as entregues,
    count(*) filter (where abriu)::int     as abriram,
    count(*) filter (where clicou)::int    as clicaram,
    count(*) filter (where voltou)::int    as voltaram
  from por_envio
  group by template
)

select coalesce(jsonb_agg(jsonb_build_object(
  'template',     t.template,
  'enviados',     t.enviados,
  'entregues',    t.entregues,
  'abriram',      t.abriram,
  'clicaram',     t.clicaram,
  'voltaram',     t.voltaram,
  'descadastros', coalesce(d.descadastros, 0),
  'vendas',       coalesce(v.vendas, 0),
  'receita',      coalesce(v.receita_centavos, 0) / 100.0
) order by t.template), '[]'::jsonb)
from por_template t
left join vendas v       on v.template = t.template
left join descadastros d on d.template = t.template;
$$;

revoke all on function public.admin_automacoes_resumo(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_automacoes_resumo(timestamptz, timestamptz) to service_role;

comment on function public.admin_automacoes_resumo(timestamptz, timestamptz) is
  'Envio, engajamento, descadastro e venda (last-touch) por template de '
  'e-mail, em coorte pelo instante do envio. Serve a aba Automações do painel.';
