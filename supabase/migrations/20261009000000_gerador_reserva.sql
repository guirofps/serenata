-- O GERADOR RESERVA (09/10/2026).
--
-- Das 18h06 às ~18h47 de 09/10 o Inngest ficou de novo em "Degraded Function
-- Execution": aceitava o evento `musica/gerar` e não executava nada. A música
-- só nasce pelo job dele, então 60+ leads ficaram olhando a prévia que não
-- vinha e não puderam comprar (o pagamento só libera com a música pronta).
--
-- `api/gerador-reserva.ts` roda em Vercel Cron, a cada minuto, e gera a
-- música que ninguém começou a gerar. Pra ele saber o que o job está fazendo
-- e não pagar o Suno duas vezes, a linha passa a dizer:
--
--   task_atual / task_em  a task do provedor em andamento e quando nasceu.
--                         Escrita por QUEM disparou (job ou reserva) e limpa
--                         quando a música fica pronta ou falha. É o que deixa
--                         o reserva terminar uma geração que o job pagou e
--                         não viu acabar, em vez de pagar outra.
--   reserva_em            o reserva assumiu esta música. Enquanto estiver
--                         preenchido o job não mexe nela; limpo no fim.
--   reserva_tentativas    quantas gerações o reserva já pagou por ela.
alter table public.musicas
  add column if not exists task_atual text,
  add column if not exists task_em timestamptz,
  add column if not exists reserva_em timestamptz,
  add column if not exists reserva_tentativas int not null default 0;

-- O reserva pergunta isto a cada minuto: tem que ser barato.
create index if not exists musicas_andando_idx
  on public.musicas (updated_at)
  where status in ('aguardando', 'gerando');
