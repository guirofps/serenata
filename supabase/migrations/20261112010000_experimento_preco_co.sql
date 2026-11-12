-- TESTE `preco_co` (Ballad, 12/11). Desenho em
-- `docs/superpowers/specs/2026-11-12-preco-por-pais-colombia-design.md` e
-- `src/lib/preco-local.ts`.
-- Preço da MÚSICA só na Colômbia: A = $39.900 COP (hoje), B = $29.900,
-- C = $34.900. O NÚMERO de cada braço mora no código (`mercados.ts`); esta
-- linha só liga, desliga e muda peso. Sem a linha, o site cobra e mostra o de
-- hoje.
-- Nasce DESLIGADA: liga pelo painel (ativo = true) depois de conferir, no site
-- publicado, que a tela e o caixa batem nos três braços.
-- Aplicar por conexão direta, SÓ no banco da Ballad. Na Serenata não existe.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'preco_co',
  false,
  100,
  'BALLAD, 12/11. Preco da MUSICA so na Colombia: A = $39.900 COP (riscado $99.900), B = $29.900 (riscado $74.900), C = $34.900 (riscado $74.900). Video e extra fixos. O numero mora no codigo (mercados.ts). Ler por RECEITA DA MUSICA EM DOLAR POR SESSAO EXPOSTA (preco_co_exposto -> pedido pago), por braco. Braco de peso 0 paga o controle. Ignorado pelo vigiaExperimento. Encerrar com B ou C vencendo exige deploy trocando a tabela.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1},{"nome":"C","peso":1}]'::jsonb
)
on conflict (id) do nothing;
