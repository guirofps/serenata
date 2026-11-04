-- TESTE `pix_volte` (Serenata, 04/11): na tela do QR do PIX, a caixa "depois de
-- pagar, volte para esta tela" com o e-mail onde a música chega. Desenho em
-- `src/lib/pix-volte.ts`. Nasce DESLIGADO: quem liga é o script, depois do deploy.
-- Na Ballad não existe (sem PIX).
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'pix_volte',
  false,
  100,
  'SERENATA, 04/11. Tela do QR do PIX. A = como hoje. B = caixa abaixo do copiar: volte para esta tela, a musica abre aqui + o e-mail onde ela chega. Ler por MED/suporte "nao recebi" por comprador e PAGO / PIX GERADO por braco; pix_volte_exposto. Pos-clique: no POS_COMPRA do vigiaExperimento.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
)
on conflict (id) do nothing;
