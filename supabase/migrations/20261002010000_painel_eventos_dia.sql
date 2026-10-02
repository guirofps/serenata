-- PAINEL RÁPIDO, PARTE B (02/10/2026): o resumo diário do funil.
--
-- Uma linha por dia (fuso de Brasília) e por filtro de funil, com a saída de
-- `admin_eventos_resumo` pra aquele dia, sem tirar nem pôr. Quem escreve é o
-- cron `api/painel-resumo.ts`, de hora em hora; quem lê é `montarPainel`, que
-- soma os dias fechados e calcula ao vivo só as pontas da janela.
--
-- Só o service_role toca: RLS ligado e nenhuma policy, como o resto do painel.
-- Aplicar na Serenata E na Ballad.

create table if not exists public.painel_eventos_dia (
  dia           date        not null,
  filtro        text        not null check (filtro in ('todos', 'pt', 'es')),
  resumo        jsonb       not null,
  atualizado_em timestamptz not null default now(),
  primary key (dia, filtro)
);

alter table public.painel_eventos_dia enable row level security;
revoke all on table public.painel_eventos_dia from anon, authenticated;
