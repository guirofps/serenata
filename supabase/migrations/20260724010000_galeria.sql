-- Galeria de fotos: as imagens que passam ATRÁS da letra durante a música.
--
-- `foto_path` (capa) continua existindo e é o produto BASE. Esta galeria é
-- o order bump de R$ 19,90 do docs/produto.md — por isso coluna separada, e
-- não um array que engole a capa: são duas coisas que se vendem separado.
--
-- Array ordenado em vez de tabela filha: a ordem É o conteúdo (as fotos
-- passam nessa sequência), são poucas por música, e sempre lidas juntas.
-- Uma tabela filha só acrescentaria join e uma coluna de posição pra
-- manter na mão.

alter table public.musicas
  add column if not exists galeria text[] not null default '{}';

-- Teto no BANCO, não só na interface: quem chama a API direto não passa
-- pela validação do front. 12 fotos cobrem uma música de 4 minutos trocando
-- a cada ~20s, que é o ritmo confortável de leitura.
alter table public.musicas
  drop constraint if exists galeria_ate_12;
alter table public.musicas
  add constraint galeria_ate_12 check (array_length(galeria, 1) is null or array_length(galeria, 1) <= 12);
