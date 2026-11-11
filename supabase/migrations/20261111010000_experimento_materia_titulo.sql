-- TESTE `materia_titulo` (Serenata, 11/11): a manchete da matéria `/tendencia`,
-- landing de anúncio em formato de notícia. Desenho em `src/lib/materia-tendencia.ts`.
-- Nasce DESLIGADO: quem liga é o painel (aba Testes A/B), depois do deploy.
-- Na Ballad não existe (a rota responde só na Serenata).
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'materia_titulo',
  false,
  100,
  'SERENATA, 11/11. Manchete da materia /tendencia (anuncio em formato de noticia). A = Brasileiros estao trocando flores e perfume por musicas feitas com a historia do casal. B = O presente que ja fez mais de 6.600 familias chorarem nao se compra em loja. C = Quase metade e para a esposa: o presente que virou febre entre maridos brasileiros. Ler RECEITA POR SESSAO por braco, so entre sessoes com page_view em /tendencia; saude: materia_cta.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1},{"nome":"C","peso":1}]'::jsonb
)
on conflict (id) do nothing;
