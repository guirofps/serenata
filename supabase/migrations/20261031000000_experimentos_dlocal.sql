-- TESTES `documento_depois` e `local_primeiro` (Ballad, 31/10). Desenho em
-- `src/lib/documento-depois.ts` e `src/lib/local-primeiro.ts`.
-- Nascem DESLIGADOS: quem liga é o script, depois do deploy. Na Serenata ficam desligados.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values
  (
    'documento_depois',
    false,
    100,
    'BALLAD, 31/10. Mexico: sem o campo de CURP na nossa folha, a pagina da dLocal pede. 29 de 51 que escolheram pagar sem cartao nao passaram dessa tela. Ler por PAGO / documento_depois_exposto por braco. Pos-clique: no POS_COMPRA do vigiaExperimento.',
    '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
  ),
  (
    'local_primeiro',
    false,
    100,
    'BALLAD, 31/10. Colombia e Peru: escolha do metodo local antes de ver o cartao. Na Colombia 12 abriram a folha e nenhum cartao foi tentado. Chile de fora. Ler por PAGO / local_primeiro_exposto por braco. Pos-clique: no POS_COMPRA do vigiaExperimento.',
    '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
  )
on conflict (id) do nothing;
