-- O VÍDEO NO CHECKOUT (order bump), 25/09/2026.
--
-- `pedidos.bump_video`: o vídeo veio junto no PIX da música (braços V e C do
--   experimento `bump_quadro`). Irmã de `bump_quadro`, e pelo mesmo motivo: é
--   a coluna que NÓS gravamos no pedido pendente que diz o que foi comprado,
--   não o valor que chega no webhook (valor não diz nada com cinco preços).
--
-- `videos.status = 'aguardando_fotos'`: vídeo pago no checkout, antes de ela
--   subir foto nenhuma. Não renderiza sozinho na hora: espera ela tocar em
--   "Gerar meu vídeo" no editor, ou o `videoPendente` gerar depois de uns dias.

alter table public.pedidos
  add column if not exists bump_video boolean not null default false;

alter table public.videos drop constraint if exists videos_status_check;
alter table public.videos
  add constraint videos_status_check
  check (status in ('aguardando_fotos', 'aguardando', 'renderizando', 'pronto', 'falhou'));
