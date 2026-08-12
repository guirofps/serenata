-- LIBERAR ACESSO NÃO É VENDER.
--
-- O botão do /recuperar marca o pedido como `pago` — é o que faz a música
-- aparecer pro cliente, e está certo. O efeito colateral é que o painel conta
-- faturamento por `status = 'pago'`, então toda liberação vira R$ 37 de receita
-- que nunca entrou em conta nenhuma.
--
-- Medido em 12/08: quatro liberações manuais. DUAS eram dinheiro de verdade
-- (o comprador pagou por fora, combinado direto com o dono), UMA era acesso
-- interno pro atendente conhecer a plataforma, e duas foram feitas pelo
-- operador na recuperação sem que o gateway registrasse aprovação. No painel,
-- todas as quatro apareciam iguais.
--
-- `dinheiro_entrou` separa as duas coisas:
--   true  = entrou grana (por fora do gateway, mas entrou) → conta como venda
--   false = cortesia, teste, acesso interno                → não conta
--   null  = venda normal do gateway (a coluna nem se aplica)

alter table public.pedidos
  add column if not exists dinheiro_entrou boolean;

comment on column public.pedidos.dinheiro_entrou is
  'Só para liberação manual: se o valor realmente entrou. null = venda normal do gateway.';

-- Backfill do que já aconteceu, pelo motivo registrado em status_gateway.
update public.pedidos
set dinheiro_entrou = true
where gateway = 'manual' and status_gateway ilike '%pago por fora%';

update public.pedidos
set dinheiro_entrou = false
where gateway = 'manual' and status_gateway ilike '%acesso interno%';
