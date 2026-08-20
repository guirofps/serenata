-- ────────────────────────────────────────────────────────────────
-- BOTÕES DA OPERAÇÃO QUE NÃO PODEM DEPENDER DE DEPLOY.
--
-- Mesma virada que os testes A/B já fizeram (migration 20260819000000): o
-- número sai do código e vai pro banco, porque a hora em que se precisa mexer
-- nele é justamente a hora em que não dá pra esperar um build.
--
-- O primeiro morador é o teto diário de geração do Suno
-- (`inngest/lib/disjuntor.ts`). Ele nasceu como env da Vercel, e env resolve o
-- caso do dono com o terminal aberto — não resolve o caso real: o disjuntor
-- desliga o funil num pico de tráfego, o e-mail de aviso chega no celular, e a
-- pessoa precisa subir o número de onde estiver.
--
-- ── POR QUE CHAVE/VALOR EM TEXTO, E NÃO UMA COLUNA POR AJUSTE ───
--
-- Coluna por ajuste é mais bonita e pede uma migration a cada botão novo, que
-- é exatamente o custo que esta tabela existe pra remover. São poucos valores,
-- lidos um de cada vez, nunca consultados por dentro. O tipo fica na leitura,
-- em quem sabe o que o valor significa.
-- ────────────────────────────────────────────────────────────────

create table if not exists public.config_operacao (
  chave text primary key,
  valor text not null,
  -- Pra o painel poder dizer "mexido hoje às 14h" em vez de mostrar um número
  -- sem história.
  atualizado_em timestamptz not null default now()
);

alter table public.config_operacao enable row level security;

-- Nenhuma policy: só o service role toca, pelas server functions com
-- `exigirAdmin()`. O revoke é a defesa em profundidade que o resto do projeto
-- usa — RLS sem policy já nega, mas fixar a permissão impede surpresa se
-- alguém criar uma policy distraído daqui a meses.
revoke all on public.config_operacao from anon, authenticated;

comment on table public.config_operacao is
  'Ajustes da operação editáveis pelo painel. Ler sempre com fallback: banco > env > padrão do código.';

-- SEM SEED, de propósito.
--
-- Linha ausente significa "ninguém decidiu ainda", e aí vale a env (ou o
-- padrão do código). Semear com 300 aqui transformaria o padrão numa decisão
-- que ninguém tomou, e apagaria a env de quem já tinha configurado uma.
