-- TESTE `lp_headline` (Serenata, 11/11): a headline da landing de anúncio
-- `/presente`, três ângulos. Desenho em `src/lib/lp-presente.ts`.
-- Nasce DESLIGADO: quem liga é o painel (aba Testes A/B), depois do deploy.
-- Na Ballad não existe (a rota responde só na Serenata).
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'lp_headline',
  false,
  100,
  'SERENATA, 11/11. Headline da landing /presente. A = Flores murcham. Chocolate acaba. Uma musica fica pra sempre. B = O unico presente do mundo com o nome e a historia de quem voce ama. C = O presente que faz quem voce ama chorar na primeira nota. Ler RECEITA POR SESSAO por braco, so entre sessoes com page_view em /presente (o sorteio roda no site inteiro); saude: lp_presente_cta.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1},{"nome":"C","peso":1}]'::jsonb
)
on conflict (id) do nothing;
