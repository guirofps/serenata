-- O ORDER BUMP DO QUADRO, no nosso proprio checkout de PIX.
--
-- Hoje o quadro (R$ 24,90) so e vendido DEPOIS da compra, no editor e no
-- painel. Medido de 17 a 31/08:
--
--   R$ 38,00 (base)     821 PIX gerados   462 pagos   56,3%
--   R$ 29,00            311                188        60,5%
--   R$ 19,00            210                143        68,1%
--   R$ 24,90 (quadro)   117                 31        26,5%
--
-- Todo preco do funil paga entre 56% e 70%. O quadro paga 26,5%, e sao 86 PIX
-- mortos em 14 dias. A diferenca nao e o preco, e a INTENCAO: no funil a
-- pessoa ja decidiu; no painel ela abre a folha pra ver quanto custa e a
-- cobranca nasce sozinha no `useEffect` de montagem.
--
-- O order bump ataca isso pelo lado certo: oferecer no instante em que ela ja
-- esta pagando, dentro do MESMO PIX. Sem segundo pagamento, sem segunda
-- decisao de meio de pagamento, sem cobranca morta na conta da Woovi.
--
-- A coluna e o unico jeito de o webhook saber o que aquele valor comprou. O
-- caminho do funil confere o valor contra o PEDIDO PENDENTE que nos mesmos
-- criamos (nao contra o catalogo), entao um pedido de R$ 62,90 passa; o que
-- falta e a memoria de que os R$ 24,90 a mais eram o quadro.
--
-- `default false` e `not null`: pedido antigo nao tem bump, e nulo aqui viraria
-- um "talvez" numa decisao que libera produto.
alter table pedidos
  add column if not exists bump_quadro boolean not null default false;

comment on column pedidos.bump_quadro is
  'O quadro foi comprado junto, como order bump no checkout de PIX. O webhook usa isto pra criar o direito em `quadros`.';
