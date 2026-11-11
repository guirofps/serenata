-- TESTE `cartao_dlocal` (Ballad, 11/11). Desenho em `src/lib/cartao-dlocal.ts`.
-- O cartão da América Latina (MX, PE, CO, CL, espanhol) pela dLocal Go nos
-- SmartFields (B) contra o Embedded Checkout do Stripe de hoje (A).
-- Nasce DESLIGADO e com o B em peso 0: liga só depois do pagamento real de teste
-- do dono no site publicado (update ativo = true e B peso 1).
-- Aplicar por conexão direta, SÓ no banco da Ballad. Na Serenata não existe.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'cartao_dlocal',
  false,
  100,
  'BALLAD, 11/11. Cartao LATAM (MX, PE, CO, CL, espanhol): A = Stripe Embedded Checkout, B = SmartFields da dLocal Go na folha. Ler por PAGO / cartao_dlocal_exposto por braco e por pais. Pos-clique: no POS_COMPRA do vigiaExperimento.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":0}]'::jsonb
)
on conflict (id) do nothing;
