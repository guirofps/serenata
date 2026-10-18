-- TESTE `aviso_recusa` (Ballad, 18/10): o aviso de cartão recusado embaixo do
-- pagamento do Stripe. A = como é hoje; B = o aviso. Desenho e motivo em
-- `src/lib/aviso-recusa.ts`.
--
-- Nasce DESLIGADO: quem liga é o script/painel, depois do deploy. Na Serenata
-- a linha é inofensiva (o checkout dela não é o Stripe) e fica desligada.
-- `on conflict do nothing`: rodar de novo não religa nem desliga nada.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'aviso_recusa',
  false,
  100,
  'BALLAD, 18/10. Aviso de cartao recusado embaixo do Embedded Checkout (aprove no app do banco e tente de novo; Apple Pay, Google Pay ou outro cartao). 56% das tentativas recusadas em 11-17/10, metade desiste. Ler por PAGO / CHECKOUT ABERTO (stripe_checkout_abriu -> pedido pago) por braco. Pos-clique: no POS_COMPRA do vigiaExperimento.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
)
on conflict (id) do nothing;
