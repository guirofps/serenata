-- TESTE `preco_mx` (Ballad, 12/11). Mesmo motor do `preco_co`
-- (`src/lib/preco-local.ts`; desenho em
-- `docs/superpowers/specs/2026-11-12-preco-por-pais-colombia-design.md`).
-- Preço da MÚSICA só no México: A = $199 MXN (hoje, riscado $549),
-- B = $149 (riscado $399), C = $249 (riscado $699). Vídeo e extra fixos.
-- O NÚMERO de cada braço mora no código (`mercados.ts`); esta linha só liga,
-- desliga e muda peso. Sem a linha, o site cobra e mostra o de hoje.
-- Manter o "A" em PRIMEIRO na lista: é o controle da tela e da cobrança.
-- Nasce DESLIGADA: liga pelo painel (ativo = true) depois de conferir, no site
-- publicado, que a tela e o caixa batem nos três braços.
-- Aplicar por conexão direta, SÓ no banco da Ballad. Na Serenata não existe.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'preco_mx',
  false,
  100,
  'BALLAD, 12/11. Preco da MUSICA so no Mexico: A = $199 MXN (riscado $549), B = $149 (riscado $399), C = $249 (riscado $699). Video e extra fixos. O numero mora no codigo (mercados.ts). Ler por RECEITA DA MUSICA EM DOLAR POR SESSAO EXPOSTA (preco_mx_exposto -> pedido pago), por braco. Braco de peso 0 paga o controle; manter o A em primeiro. Ignorado pelo vigiaExperimento. Encerrar com B ou C vencendo exige deploy trocando a tabela.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1},{"nome":"C","peso":1}]'::jsonb
)
on conflict (id) do nothing;
