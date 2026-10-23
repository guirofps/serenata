-- TESTE `oxxo_mx` (Ballad, 23/10): OXXO e transferência (dLocal Go) ao lado do
-- cartão do Stripe, só pra quem está no México. A = só cartão; B = cartão +
-- OXXO/transferência. Desenho e motivo em `src/lib/oxxo-mx.ts`.
--
-- Nasce DESLIGADO: quem liga é o script/painel, depois do deploy e das chaves
-- da dLocal na Vercel. Na Serenata a linha é inofensiva e fica desligada.
-- `on conflict do nothing`: rodar de novo não religa nem desliga nada.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'oxxo_mx',
  false,
  100,
  'BALLAD, 23/10. Mexico: OXXO e transferencia (dLocal Go) ao lado do cartao do Stripe. 34 leads e 1 venda em 23/10; suporte pediu OXXO. Ler por VENDA POR LEAD entre leads do Mexico (oxxo_mx_exposto) por braco. Pos-clique: no POS_COMPRA do vigiaExperimento.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
)
on conflict (id) do nothing;
