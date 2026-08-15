-- ENDEREÇOS QUE NÃO RECEBEM MAIS.
--
-- O bounce já era registrado e já alertava, mas nada impedia o próximo envio.
-- Resultado medido em 14 dias: 13 e-mails disparados para endereços que já
-- tinham voltado. O Edeilson levou três no mesmo endereço morto, o Rodrigo
-- dois, e outros dez levaram dois cada.
--
-- Insistir é o pior que dá pra fazer com a reputação de um domínio novo, e é
-- justamente a reputação que decide se o e-mail de ENTREGA (o que carrega o
-- produto pago) cai na caixa de entrada ou no spam.
--
-- Por que "Transient" também bloqueia: nos dados reais, 48 dos 55 bounces
-- vieram como Transient e NENHUM desses endereços voltou a receber depois.
-- Tratar Transient como "tenta de novo" é o que produziu os 13 repetidos.
-- Bloqueio não é definitivo: `liberado_em` deixa reabrir quando a pessoa
-- corrige o endereço no atendimento.
create table if not exists public.emails_mortos (
  email text primary key,
  motivo text,
  tipo text,
  assunto text,
  vezes integer not null default 1,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now(),
  liberado_em timestamptz
);

comment on table public.emails_mortos is
  'Endereços cujo e-mail voltou. Consultado antes de todo envio automático.';

-- Só o service role toca nisto. Nenhuma policy: o anon não lê nem escreve.
alter table public.emails_mortos enable row level security;

-- Semeia com o que já voltou, pra não repetir com quem já sofreu o problema.
-- `funnel_events` guarda o destinatário em event_data->>'para'.
insert into public.emails_mortos (email, motivo, tipo, assunto, vezes, primeiro_em, ultimo_em)
select
  lower(e.event_data->>'para') as email,
  'semeado da auditoria de 15/08' as motivo,
  max(e.event_data->>'bounce') as tipo,
  max(e.event_data->>'assunto') as assunto,
  count(*)::int as vezes,
  min(e.created_at) as primeiro_em,
  max(e.created_at) as ultimo_em
from public.funnel_events e
where e.event_name = 'email_bounced'
  and coalesce(e.event_data->>'para', '') <> ''
group by lower(e.event_data->>'para')
on conflict (email) do nothing;
