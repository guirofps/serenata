-- DE ONDE A PESSOA VOLTOU PRA COMPRAR (08/10/2026). 'email' quando chegou por
-- link de e-mail (utm_source=email) até 3 dias antes de gerar a cobrança
-- (`toque-email.ts`). O painel conta essas vendas como e-mail (`canal-venda.ts`).
alter table public.pedidos add column if not exists veio_de text;
