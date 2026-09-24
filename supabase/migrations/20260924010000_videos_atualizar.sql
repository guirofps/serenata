-- "Atualizar meu vídeo": a página mudou depois do render (trocou foto, mexeu
-- na dedicatória), e o vídeo acompanha, de graça, com teto.
--
-- `assinatura`: impressão digital das entradas do ÚLTIMO render que ficou
--   pronto (src/lib/assinatura-video.ts). Diferente da página de agora =
--   vídeo desatualizado.
-- `atualizacoes`: quantos re-renders ela já pediu. O teto mora no servidor
--   (video-presente.ts); cada um custa ~US$ 0,04 de Lambda.

alter table public.videos
  add column if not exists assinatura text,
  add column if not exists atualizacoes integer not null default 0;
