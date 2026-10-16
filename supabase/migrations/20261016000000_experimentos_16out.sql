-- OS QUATRO TESTES DE 16/10, NASCENDO DESLIGADOS.
--
--   letra_na_revisao  os refrões começam a ser escritos na tela de revisão
--   ouvir_de_novo     "Ouvir de novo" depois que a prévia corta
--   pix_reabre        a folha do PIX volta sozinha quando a aba recarrega
--   nome_cantado      o nome como foi digitado, cantado no refrão ou na intro
--
-- Em todos: A = exatamente o que roda hoje, B = o novo. O desenho e o motivo
-- de cada um estão no arquivo `src/lib/<id com hífen>.ts` e na nota abaixo.
--
-- ── POR QUE ESTAS LINHAS PRECISAM EXISTIR ───────────────────────
--
-- `salvarExperimento` só faz UPDATE: o painel de testes A/B edita o que já
-- está na tabela e NÃO cria linha nova. Sem esta migration não haveria o que
-- ligar.
--
-- ── POR QUE `ativo = false` ─────────────────────────────────────
--
-- Quem liga é o dono, pelo painel, depois do deploy. Linha ligada antes do
-- código no ar sortearia gente pra um braço que a tela ainda não conhece.
-- Desligar é sempre pelo `ativo`, nunca pelo peso (ver `experimentos.ts`).
--
-- SÓ NO BANCO DA SERENATA. Os quatro são do funil pt; na Ballad o código já
-- ignora (idioma e marca), e a linha lá só confundiria o painel.
--
-- Aplicar por conexão direta, NUNCA `supabase db push` (histórico de
-- migrations do remoto da Serenata está vazio). `on conflict do nothing`: rodar
-- duas vezes não religa nem desliga nada.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values
  (
    'letra_na_revisao',
    false,
    100,
    'SERENATA, 16/10. Os refroes comecam a ser escritos na revisao. A = como e hoje (gerarRefroes so quando a tela dos refroes abre). B = a revisao dispara gerarRefroes em segundo plano ao montar e a tela dos refroes reaproveita a promessa se as respostas nao mudaram (mesma cobranca do teto, uma chamada so). 23% somem entre o ultimo passo e os refroes, com ~127s de espera. Ler por quem CHEGOU NOS REFROES (coautoria_refroes / coautoria_pedida) e RECEITA POR LEAD; diagnostico: letra_adiantada, letra_adiantada_usada, letra_adiantada_falhou.',
    '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
  ),
  (
    'ouvir_de_novo',
    false,
    100,
    'SERENATA, 16/10. Depois que a previa corta. A = o player trava e nao volta. B = botao "Ouvir de novo" que volta a previa pro 0 e toca; o corte vale de novo no mesmo ponto e o popup nao reaparece. Ler por RECEITA POR LEAD (attribution.exp.ouvir_de_novo); uso do botao em previa_ouvir_de_novo.',
    '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
  ),
  (
    'pix_reabre',
    false,
    100,
    'SERENATA, 16/10. A folha do PIX depois de a aba recarregar (iPhone descarta a aba enquanto a pessoa esta no banco). A = recarregou, a folha nao volta. B = o PIX gerado fica no sessionStorage da aba e a oferta reabre a folha direto no QR se ele tem menos de 1h e segue pendente; ja pago vai pra /obrigado. Ler por PAGO / PIX GERADO por braco (pix_transparente_gerado -> pix_transparente_pago); diagnostico: pix_reaberto, pix_reabre_descartado. O vigiaExperimento ignora este (POS_COMPRA).',
    '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
  ),
  (
    'nome_cantado',
    false,
    100,
    'SERENATA, 16/10. ~7% das letras nao tem o nome como foi digitado e convertem 14,5% contra 16,8%. A = a mensagem da letra de hoje. B = mais a instrucao: o nome exatamente como digitado, cantado pelo menos no refrao ou na intro, apelido so junto. Braco lido pelo SERVIDOR (quiz_responses.attribution.exp.nome_cantado + esta linha; desligar pelo ativo vale em ate 1 minuto). Ler por RECEITA POR LEAD e % de letras finais com o nome exato.',
    '[{"nome":"A","peso":1},{"nome":"B","peso":1}]'::jsonb
  )
on conflict (id) do nothing;
