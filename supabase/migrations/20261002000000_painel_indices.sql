-- PAINEL RÁPIDO, PARTE A (02/10/2026).
--
-- O painel filtra estas quatro tabelas por `created_at` e, desde hoje, pagina
-- por cursor `(created_at, id)`. `quiz_responses`, `musicas` e `pedidos` não
-- tinham índice nenhum que começasse por `created_at` — cada abertura do painel
-- lia a tabela inteira, inclusive a coluna `respostas` com as histórias.
-- `custos` tinha `(created_at desc)`, que serve ao filtro mas não ao cursor.
--
-- Criar índice trava a ESCRITA na tabela por alguns segundos (as tabelas são
-- pequenas). O quiz espera, não falha. Aplicar de madrugada, na Serenata E na
-- Ballad. Se o editor deixar rodar fora de transação, `create index
-- concurrently`, um por vez.

create index if not exists quiz_responses_created_at_id_idx on public.quiz_responses (created_at, id);
create index if not exists musicas_created_at_id_idx        on public.musicas        (created_at, id);
create index if not exists pedidos_created_at_id_idx        on public.pedidos        (created_at, id);
create index if not exists custos_created_at_id_idx         on public.custos         (created_at, id);
