-- O TESTE DO TÍTULO DA ABERTURA (`abertura_titulo`, Serenata, 23/10/2026).
--
--   A (controle) = "Uma música feita da história de quem você ama"
--   B            = "O presente que vai fazer quem você ama chorar"
--   C            = "A única música do mundo com o nome dela"
--   D            = "O presente que não vai parar no fundo da gaveta"
--   E            = "Imagine a história de vocês virando música"
--   F            = "Mais de 6.600 famílias já deram esse presente"
--
-- ── POR QUE ESTA LINHA PRECISA EXISTIR ──────────────────────────
--
-- `salvarExperimento` só faz UPDATE: o painel de testes A/B liga e desliga o
-- que já está na tabela e NÃO cria linha nova.
--
-- ── `ativo` NASCE FALSO ─────────────────────────────────────────
--
-- Ao contrário do `prova_blocos`, aqui o controle é a tela de hoje e os
-- braços nascem escondidos no código (`abertura-titulo.ts`). Linha desligada
-- e deploy em qualquer ordem: ninguém vê nada novo até alguém ligar no painel.
--
-- ── COMO LER ────────────────────────────────────────────────────
--
-- RECEITA POR SESSÃO por braço, entre as sessões pt sem tema que montaram a
-- abertura. Quem respondeu a 1ª pergunta é só sinal de saúde.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'abertura_titulo',
  false,
  100,
  'O titulo da abertura do /criar, um angulo por braco; subtitulo, botao e cartao iguais. A = Uma musica feita da historia de quem voce ama (controle). B = O presente que vai fazer quem voce ama chorar. C = A unica musica do mundo com o nome dela. D = O presente que nao vai parar no fundo da gaveta. E = Imagine a historia de voces virando musica. F = Mais de 6.600 familias ja deram esse presente (numero real). So pt sem tema. Ler RECEITA POR SESSAO por braco; responder a 1a pergunta e so sinal de saude.',
  '[
    {"nome":"A","peso":1},
    {"nome":"B","peso":1},
    {"nome":"C","peso":1},
    {"nome":"D","peso":1},
    {"nome":"E","peso":1},
    {"nome":"F","peso":1}
  ]'::jsonb
)
on conflict (id) do nothing;
