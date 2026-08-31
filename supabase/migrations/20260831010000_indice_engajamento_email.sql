-- ENGAJAMENTO DE E-MAIL PRECISA SER CONSULTAVEL EM MENOS DE 8 SEGUNDOS.
--
-- A escada vai passar a exigir que a pessoa tenha ABERTO ou CLICADO antes de
-- receber o degrau com desconto. Medido em 31/08, no `letra_pronta`:
--
--   nao abriu   898 pessoas   3,0% compraram
--   abriu        55 pessoas  18,2% compraram
--   clicou       81 pessoas  19,8% compraram
--
-- Quem abre converte 6x mais, e 87% nunca abrem. Sao esses 87% que recebem a
-- escada inteira hoje: 1.700 disparos do `escada_3` com 0,6% de clique. Volume
-- alto sem engajamento e a assinatura que Gmail e Outlook usam pra rebaixar
-- remetente, e a conta e paga pelo `letra_pronta`, que e o e-mail que sustenta
-- a recuperacao (R$ 1,95 por envio) e esta preso em 13,7% de abertura no mesmo
-- dominio onde o `quase_comprou` abre 37,4%.
--
-- O evento do Resend guarda `event_data.email_id`, e nao o quiz nem o e-mail.
-- Entao o gate precisa consultar por esse campo dentro do jsonb. Sem indice
-- isso e varredura da tabela inteira de eventos, e o PostgREST corta em 8s
-- (o `maxDuration` da Vercel nao manda nada nisso).
--
-- Indice PARCIAL, so nos dois eventos que interessam: a tabela tem dezenas de
-- tipos de evento e indexar todos custaria escrita em todo `trackEvent`.
create index if not exists funnel_events_email_id_engajamento
  on funnel_events ((event_data->>'email_id'))
  where event_name in ('email_opened', 'email_clicked');
