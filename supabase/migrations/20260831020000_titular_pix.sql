-- QUEM PAGOU DE VERDADE.
--
-- A coluna `nome_pagador` NAO tem quem pagou: ela guarda `respostas.nome`, que
-- e a pessoa HOMENAGEADA. E o que o `criar-pix.ts` manda como `customer.name`
-- na cobranca. Por isso ela esta cheia de "Amorzao", "MINHA NEGA", "Baixinha".
--
-- Descoberto em 31/08 com um pedido de reembolso na Woovi em nome de "ANTONIO
-- DOS SANTOS LIMA": esse nome nao existia em lugar nenhum do nosso banco, e
-- nao tinha como existir. A Woovi mostra o titular da conta que pagou; nos
-- guardavamos o nome de quem ia receber a musica.
--
-- A informacao SEMPRE esteve disponivel e era descartada. O webhook ja
-- reconsulta a cobranca (a trava que prova pagamento), e a resposta traz:
--
--   payer:    {"name": "JOSE APARECIDO ...", "taxID": {...}}
--   customer: {"name": "Carla", "email": "..."}
--
-- So o NOME, nunca o CPF. Pra casar um pedido de reembolso o nome basta, e
-- guardar documento de cliente sem necessidade e aumentar o estrago de
-- qualquer vazamento futuro.
alter table pedidos
  add column if not exists titular_pix text;

comment on column pedidos.titular_pix is
  'Nome do titular da conta que pagou o PIX, vindo do `payer` da Woovi. Diferente de `nome_pagador`, que na verdade guarda a pessoa homenageada.';
