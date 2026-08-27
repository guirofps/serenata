-- A TAXA DO GATEWAY, guardada no pedido.
--
-- O webhook já EXTRAI a taxa do payload da Perfect Pay (o bloco `commission`
-- com `affiliation_type_enum: 0`), mas só mandava pra Utmify. Em `pedidos`
-- ficava apenas `valor_centavos`, que é o preço BRUTO.
--
-- Consequência: nenhuma conta de resultado feita em cima do nosso banco era
-- real. Somar `valor_centavos` dá o que o cliente pagou, não o que entrou.
-- Numa operação de ticket baixo, com taxa perto de 11%, isso é a diferença
-- entre achar que sobra e não sobrar.
--
-- Fica URGENTE agora porque a Utmify vai ser cancelada: ela era o único lugar
-- onde esse número existia.
alter table public.pedidos
  add column if not exists taxa_centavos integer;

comment on column public.pedidos.taxa_centavos is
  'Taxa do gateway em centavos, extraída de `commission` no webhook. Receita líquida = valor_centavos - taxa_centavos. Nulo em pedido anterior a 27/08/2026 e em resgate de crédito.';

-- ── A COMISSÃO DE QUEM RECUPERA VENDA À MÃO ──────────────────────
--
-- Parte das vendas vem de recuperação manual de Pix, e metade do valor vai
-- pro atendente. Isso não existia em lugar nenhum do sistema: nem coluna, nem
-- tabela, nem evento. O dono sabe de cabeça (R$ 1.452 recuperados), e é o
-- tipo de número que some quando a operação cresce.
--
-- Fica no pedido e não numa tabela à parte porque é atributo daquela venda:
-- ou ela foi recuperada e tem comissão, ou não foi.
alter table public.pedidos
  add column if not exists comissao_centavos integer;

comment on column public.pedidos.comissao_centavos is
  'Comissão paga a quem recuperou a venda (hoje 50% em recuperação manual de Pix). Sobra real = valor_centavos - taxa_centavos - comissao_centavos.';
