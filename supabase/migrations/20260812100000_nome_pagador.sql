-- O NOME DE QUEM PAGOU.
--
-- A tela de recuperação mostrava só o e-mail, e o operador abria o WhatsApp
-- sem saber com quem estava falando. "Oi!" contra "Oi, Maria!" é a diferença
-- entre uma cobrança e uma conversa — e numa recuperação por WhatsApp isso
-- decide se a pessoa responde ou bloqueia.
--
-- O nome já chegava em todo webhook (`customer.full_name`) e era descartado.
-- Fica no PEDIDO, junto do telefone, pelo mesmo motivo: é o nome de quem
-- PAGA, que nem sempre é a pessoa que fez o quiz.

alter table public.pedidos
  add column if not exists nome_pagador text;

comment on column public.pedidos.nome_pagador is
  'Nome informado no checkout do gateway. Usado pela tela de recuperação para personalizar o contato.';