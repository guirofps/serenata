-- O CÓDIGO PIX COPIA-E-COLA, que estava chegando e sendo descartado.
--
-- Ontem eu afirmei que a Perfect Pay não expunha o código, baseado na API de
-- vendas — que de fato não traz. Estava errado: o WEBHOOK manda, e o campo se
-- chama `billet_number` (nome de boleto), por isso não apareceu quando
-- procurei por "pix".
--
--   billet_number      00020101021226820014br.gov.bcb.pix2560...  (copia-e-cola)
--   billet_url         https://checkout.perfectpay.com.br/pix/PPCPMT...
--   billet_expiration  2026-08-15 00:00:00   -> vale TRÊS DIAS
--
-- Muda o que a recuperação consegue fazer. Sem o código, a única saída era
-- devolver a pessoa ao checkout pra preencher tudo de novo. Com ele, o
-- operador manda o copia-e-cola no WhatsApp e ela paga em 15 segundos.
--
-- E a validade de 3 dias, que eu supunha ser de minutos, alarga a janela: dá
-- pra insistir no dia seguinte com o MESMO código ainda válido.

alter table public.pedidos
  add column if not exists pix_codigo text,
  add column if not exists pix_url text,
  add column if not exists pix_expira timestamptz;

comment on column public.pedidos.pix_codigo is
  'Copia-e-cola do Pix (vem como billet_number no webhook). Usado pela tela de recuperação.';
comment on column public.pedidos.pix_url is
  'Página com o QR Code, hospedada pelo gateway.';
comment on column public.pedidos.pix_expira is
  'Quando o código deixa de valer. Depois disso a recuperação precisa gerar outro.';