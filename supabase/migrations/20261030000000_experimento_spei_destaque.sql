-- TESTE `spei_destaque` (Ballad, 30/10): no México, a transferência (SPEI) na
-- frente do OXXO, com a escolha na nossa folha. Desenho em `src/lib/spei-destaque.ts`.
-- Nasce DESLIGADO: quem liga é o script, depois do deploy. Na Serenata fica desligada.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'spei_destaque',
  false,
  100,
  'BALLAD, 30/10. Mexico: transferencia (SPEI) na frente do OXXO, escolha na nossa folha e cobranca so com o metodo escolhido. Desde 23/10: 10 pagos por SPEI (0-54 min) e 9 no OXXO (13-74h), 68 pendentes. Ler por PAGO / spei_destaque_exposto por braco. Pos-clique: no POS_COMPRA do vigiaExperimento.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
)
on conflict (id) do nothing;
