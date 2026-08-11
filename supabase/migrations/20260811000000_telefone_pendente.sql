-- TELEFONE DE QUEM ABANDONOU O PIX.
--
-- O webhook já recebe o telefone em todo evento, inclusive nos `pending`, mas
-- só gravava em `quiz_responses.whatsapp` DEPOIS do pagamento aprovado. Ou
-- seja: tínhamos o contato de quem já comprou e não tínhamos o de quem travou
-- no último passo — exatamente o inverso do que a recuperação precisa.
--
-- Em 11/08, de 21 pedidos do dia, 9 foram Pix gerado e não pago (43%). São
-- pessoas que preencheram nome, CPF e telefone e mandaram gerar a cobrança:
-- a maior intenção de compra que existe no funil, e a única lista que a gente
-- não conseguia trabalhar.
--
-- Fica em `pedidos` e não em `quiz_responses` porque o telefone é do PAGADOR,
-- que nem sempre é quem fez o quiz (a pessoa faz no computador e paga no
-- celular do marido). O vínculo certo é com a cobrança.

alter table public.pedidos
  add column if not exists telefone text;

comment on column public.pedidos.telefone is
  'Telefone informado no checkout do gateway. Usado pela tela de recuperação para abrir o WhatsApp de quem abandonou o Pix.';
