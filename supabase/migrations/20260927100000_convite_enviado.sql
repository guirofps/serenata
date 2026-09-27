-- O MARCADOR DO DISPARO ÚNICO do convite de indicação (27/09/2026).
--
-- ── POR QUE UMA COLUNA, E NÃO O `emails_enviados` ────────────────
--
-- `emails_enviados` existe pra MEDIR: `registrarEnvio` engole o próprio erro
-- de propósito, porque medição não pode impedir um e-mail de sair. Isso é
-- certo pra medir e ERRADO pra decidir quem já recebeu — uma gravação que
-- falhou em silêncio viraria um segundo e-mail pra mesma pessoa.
--
-- Este disparo anuncia dinheiro e sai UMA vez pra base inteira. Mandar duas
-- vezes não é um incômodo: é o mesmo anúncio de comissão chegando de novo,
-- de uma marca que a pessoa já pagou. A idempotência precisa ser um fato do
-- banco, no mesmo UPDATE que o envio confirma.
--
-- Mora em `indicacao_codigos` porque a linha já é criada pelo disparo (o link
-- não vale sem o código) — é o único lugar onde marcar não custa uma tabela
-- nova.
--
-- `null` = ainda não recebeu. Quem criou o código sozinho no /indique também
-- nasce `null` e entra no disparo: ele conhece o programa, mas não conhece os
-- 30%, que é a notícia.

alter table public.indicacao_codigos
  add column if not exists convite_enviado_em timestamptz;

-- A fila do disparo é "quem ainda não recebeu". Índice parcial porque ele
-- encolhe sozinho: quando a base inteira tiver recebido, o índice fica vazio.
create index if not exists indicacao_codigos_convite_pendente
  on public.indicacao_codigos (email)
  where convite_enviado_em is null;
