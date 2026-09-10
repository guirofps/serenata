-- O TESTE DOS BLOCOS DE PROVA: sorteio da JBL + depoimento, no passo do
-- e-mail e na tela da oferta.
--
--   A (controle) = a tela como era antes de 10/09, sem nenhum dos dois blocos
--   B            = os dois blocos, nos dois lugares
--
-- ── POR QUE ESTA LINHA PRECISA EXISTIR ──────────────────────────
--
-- `salvarExperimento` só faz UPDATE. O painel de testes A/B edita o que já
-- está na tabela e NÃO cria linha nova — então, sem esta migration, o
-- experimento não existiria pra ligar. Sem linha, `configAtual()` cai no array
-- em código, que nasce desligado, e o controle vale pra todo mundo.
--
-- ── `ativo` NASCE VERDADEIRO, E A ORDEM IMPORTA ─────────────────
--
-- Os dois blocos JÁ ESTÃO no ar pra 100% do tráfego (subiram em 10/09). O
-- controle deste teste é a tela SEM eles, então a sequência não é indiferente:
--
--   1. roda esta migration  -> a linha existe e está ativa, e nada muda ainda,
--                              porque o código no ar ainda mostra os blocos
--                              incondicionalmente
--   2. deploy do código     -> o <Variante> entra em cena e o sorteio começa
--
-- Na ordem inversa haveria uma janela em que o código já gateia os blocos e a
-- linha ainda não existe — e nessa janela eles somem pra TODO MUNDO. Mesma
-- disciplina do seed do `preco`: a migration tem que ser um não-evento.
--
-- ── COMO LER O RESULTADO ────────────────────────────────────────
--
-- RECEITA POR LEAD, não conversão. O sorteio é isca, e isca pode subir a
-- captura de e-mail e derrubar a compra: nesse caso a conversão do funil cai e
-- só a receita por lead enxerga os dois efeitos de uma vez. É a mesma lição
-- que o teste de preço deixou.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'prova_blocos',
  true,
  100,
  'Prova social e sorteio no passo do e-mail e na tela da oferta. A = sem nenhum dos dois (a tela como era antes de 10/09). B = sorteio da JBL Boombox 4 + depoimento do Marcelo R. nos dois lugares. Os dois blocos andam JUNTOS porque separa-los partiria o trafego em quatro e o teste nunca concluiria. Ler por RECEITA POR LEAD: o sorteio e isca, e isca pode subir a captura de e-mail e derrubar a compra.',
  '[
    {"nome":"A","peso":1},
    {"nome":"B","peso":1}
  ]'::jsonb
)
on conflict (id) do nothing;
