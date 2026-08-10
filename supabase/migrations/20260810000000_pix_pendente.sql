-- PIX GERADO E AINDA NÃO PAGO.
--
-- Até aqui o webhook recebia o aviso de "aguardando pagamento", respondia 200 e
-- descartava. A tabela `pedidos` só tinha linhas `pago`, e por isso a gente era
-- cega pra uma etapa inteira: em 10/08 o dono viu 2 Pix pendentes no painel da
-- Perfect Pay que não existiam em lugar nenhum do nosso lado.
--
-- A diferença é grande na leitura do funil. "6 cliques em comprar e 1 venda"
-- parece atrito no checkout. "6 cliques, 3 cobranças geradas e 1 paga" é outro
-- problema: Pix gerado e abandonado, que é o mais recuperável que existe,
-- porque a pessoa já decidiu comprar e só não terminou.
--
-- O `status` já aceitava 'pendente' desde a fundação (é até o default), então
-- não muda constraint nenhuma. O que falta é guardar o texto CRU que o gateway
-- manda: 'aguardando pagamento (pix)', 'pending', 'waiting_payment' — cada um
-- escreve de um jeito, e adivinhar o vocabulário do gateway por documentação é
-- como a gente já errou antes. Guardando o cru, a gente aprende com o dado real.

alter table public.pedidos
  add column if not exists status_gateway text;

comment on column public.pedidos.status_gateway is
  'Status exatamente como o gateway mandou, sem tradução. Serve pra descobrir o vocabulário real dele e pra depurar pedido que ficou num estado inesperado.';

-- O painel e os disparos filtram por status o tempo todo, e agora a tabela
-- passa a ter linhas que NÃO são venda. Sem índice, todo filtro vira varredura.
create index if not exists pedidos_status_idx on public.pedidos (status);

-- Recuperação de Pix abandonado precisa achar "pendentes das últimas N horas"
-- rápido, e essa é a busca que o cron vai fazer de tempos em tempos.
create index if not exists pedidos_status_created_idx
  on public.pedidos (status, created_at desc);
