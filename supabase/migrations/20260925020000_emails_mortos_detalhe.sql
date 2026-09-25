-- O MOTIVO do bounce, não só o tipo (25/09/2026).
--
-- O webhook gravava Permanent/Transient e mais nada. Com o bounce da conta em
-- 4-6% (o saudável é < 2%) e 441 endereços Transient no Gmail, 84 deles de
-- COMPRADOR, sem o motivo não dá pra saber se é caixa cheia, endereço que não
-- existe ou o Gmail recusando por reputação. O Resend manda `subType` e
-- `message`; agora eles ficam aqui.
alter table public.emails_mortos add column if not exists detalhe text;
