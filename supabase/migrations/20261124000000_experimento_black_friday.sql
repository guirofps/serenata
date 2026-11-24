-- TESTE `black_friday` (Serenata, 24/11): selo de Black Friday no cartão de
-- preço da oferta. Desenho em `src/lib/black-friday.ts`.
-- Nasce DESLIGADO: quem liga é o painel (aba Testes A/B), depois do deploy.
-- Na Ballad a linha não faz nada (o selo só é desenhado na Serenata, em português).
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'black_friday',
  false,
  100,
  'SERENATA, 24/11. Selo de Black Friday no cartao de preco da oferta. A = cartao de sempre. B = cartao preto com BLACK FRIDAY, 60% OFF gigante e botao dourado. O PRECO NAO MUDA: o 60% e a conta do riscado pro preco (R$ 97 por R$ 38). Sem selo pra quem tem credito, cupom ou convite. Some sozinho depois de 29/11 23h59 de Brasilia; desligar a linha depois. Ler RECEITA POR LEAD por braco entre sessoes com black_friday_exposto.',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
)
on conflict (id) do nothing;
