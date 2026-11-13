-- TESTE `sotaque_latam` (Ballad, 13/11). Desenho em `src/lib/sotaque-latam.ts`.
-- A = estilo do Suno de hoje; B = + "acento colombiano/chileno/peruano" nos gêneros
-- da lista neutra, só pra quiz de CO, CL e PE. Decisão do dono (13/11): medir pela
-- conversão, sem exemplos. Nasce LIGADO 50/50.
-- Aplicar por conexão direta, SÓ no banco da Ballad. Na Serenata não existe.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'sotaque_latam',
  true,
  100,
  'BALLAD, 13/11. Sotaque do pais na musica (CO, CL, PE; generos da lista neutra): A = estilo de hoje, B = + acento colombiano/chileno/peruano. Ler venda por lead SO com quiz_responses.pais in (CO,CL,PE). No POS_COMPRA do vigiaExperimento (so 3 paises mudam; o resto dilui).',
  '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
)
on conflict (id) do nothing;
