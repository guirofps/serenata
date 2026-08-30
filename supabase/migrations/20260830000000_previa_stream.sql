-- A URL DE STREAM DA PRÉVIA, que fica pronta MUITO antes do arquivo final.
--
-- Medido em 30/08, duas gerações reais pela kie.ai:
--
--   22s a 32s   `streamAudioUrl` aparece e JÁ SERVE ÁUDIO
--               (baixado no instante: 3.091.206 bytes, 118s de música)
--   57s a 74s   `audioUrl`, o MP3 final, aparece
--
-- A gente esperava o final e mostrava "gerando" por ~2 minutos. O concorrente
-- entrega prévia em 30 a 40 segundos, e a diferença nunca foi fornecedor,
-- crédito nem infraestrutura: é qual das duas URLs se usa. As duas vêm na
-- MESMA resposta que a gente já recebe.
--
-- Esta coluna guarda a URL do provedor. Ela NUNCA vai pro navegador: quem
-- serve é `/api/previa/<id>`, que repassa os bytes pelo nosso domínio. O
-- motivo está no CLAUDE.md — foi lendo metadado de áudio que a gente
-- descobriu o gerador do ForeverSongs, e entregar `audiopipe.suno.ai` cru
-- faria o mesmo por nós, de graça, pra qualquer concorrente com DevTools.
alter table public.musicas
  add column if not exists previa_url text;

comment on column public.musicas.previa_url is
  'URL de stream do provedor, disponível ~30s antes do MP3 final. Serve a prévia via /api/previa/<id>; nunca exposta ao cliente.';
