-- O WHATSAPP NA FOLHA DO PIX.
--
--   A (controle) = a folha como está hoje: e-mail, quadro, botão
--   B            = mais uma caixa, "O código também no WhatsApp"
--
-- ── POR QUE ESTA LINHA PRECISA EXISTIR ──────────────────────────
--
-- `salvarExperimento` só faz UPDATE. O painel de testes A/B edita o que já
-- está na tabela e NÃO cria linha nova — então, sem esta migration, o
-- experimento não existiria pra ligar. Sem linha, `configAtual()` cai no array
-- em código, que nasce desligado, e o controle vale pra todo mundo.
--
-- ── POR QUE ATRÁS DE EXPERIMENTO, E NÃO DIRETO ──────────────────
--
-- É decisão nova na tela por onde passam ~87% das vendas. Foi exatamente isso
-- que o order bump fez em 31/08: com B em 100%, `oferta_vista` seguiu normal e
-- `checkout_click` desabou, e quem detectou foi a COMPARAÇÃO entre braços.
-- Sem espelho, uma queda hoje seria indistinguível de "a noite foi fraca".
--
-- ── O QUE ELE RESOLVE ───────────────────────────────────────────
--
-- A Woovi tem uma automação que manda o código do PIX no WhatsApp de quem
-- gerou a cobrança, e o dono ligou em 11/09. Ela só dispara com
-- `customer.phone` na cobrança.
--
-- Medido em 11/09: só 38% dos pedidos têm telefone (47% dos pagos, 17% das
-- sessões). O campo do meio do funil CONTINUA onde está e este teste não o
-- substitui — 72% dos números coletados (799 em 4 dias, ~200/dia) vêm de gente
-- que nunca chega a gerar PIX, e esses só existem por causa dele.
--
-- Quem já deixou o número não vê campo nenhum: vê uma linha dizendo que o
-- código também vai pro WhatsApp dele. Para 38% dos pedidos, o braço B não
-- acrescenta atrito nenhum — acrescenta uma promessa de entrega no instante
-- da decisão. É por isso que ele pode até SUBIR a conversão.
--
-- ── COMO LER O RESULTADO ────────────────────────────────────────
--
-- RECEITA POR LEAD, e `checkout_click -> pago` como sinal de alarme. Telefone
-- coletado é insumo, não resultado: um braço que coleta 100% dos números e
-- vende menos perdeu. Se `checkout_click -> pago` cair no B, desliga pelo
-- `ativo` e não pelo peso.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'whats_no_pix',
  true,
  100,
  'WhatsApp na folha do PIX. A = a folha como esta hoje. B = caixa "O codigo tambem no WhatsApp", PRE-PREENCHIDA com o numero que o quiz ja tem (38% dos pedidos), e campo aberto so pra quem nao deixou. Existe porque a automacao de WhatsApp da Woovi so dispara com customer.phone na cobranca, e ate 11/09 a gente nunca mandava esse campo. NAO substitui o campo do meio do funil: 72% dos numeros coletados (~200/dia) vem de quem nunca gera PIX. Ler por RECEITA POR LEAD; se checkout_click->pago cair no B, desligar pelo ativo.',
  '[
    {"nome":"A","peso":1},
    {"nome":"B","peso":1}
  ]'::jsonb
)
on conflict (id) do nothing;
