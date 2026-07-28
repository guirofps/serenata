-- Extras do editor: a versão que o comprador prefere e a cor de destaque.
--
-- versao_preferida: qual gravação (1 ou 2) abre por padrão na página-presente
-- quando o link vem sem ?v=. O comprador escolhe a que gostou mais; o
-- presenteado abre já naquela.
--
-- cor_destaque: a cor dos elementos da página (botão de play, a linha da letra
-- que acende, a barra). Guarda um oklch pronto; null = âmbar padrão.

alter table public.musicas
  add column if not exists versao_preferida smallint not null default 1
    check (versao_preferida in (1, 2)),
  add column if not exists cor_destaque text;
