-- A CONFIGURAÇÃO DOS TESTES A/B, que até 19/08 morava num array em código.
--
-- Sai do código porque matar um teste ruim não pode depender de deploy. O que
-- NÃO sai é o mecanismo: o sorteio continua sendo o script síncrono no <head>,
-- que só passa a ler daqui.
--
-- ── POR QUE `variantes` É JSONB E NÃO UMA TABELA FILHA ──────────
--
-- A lista é ordenada (a primeira é o controle), é lida sempre inteira, e
-- nunca é consultada por dentro — ninguém vai fazer `where variante = 'B'`.
-- Uma tabela filha custaria um join no caminho mais quente do site pra
-- resolver um problema que não existe.

create table if not exists public.experimentos (
  -- A mesma string do `data-exp-<id>` no <html>. Trocar isto embaralha quem
  -- já foi sorteado com quem chegou agora.
  id text primary key,

  ativo boolean not null default false,

  -- Que fatia das visitas ENTRA no teste. Quem fica fora é carimbado `fora`
  -- e vê o controle — é a linha de referência que serve de canário quando a
  -- base cede por baixo (foi o que matou a leitura do experimento `abertura`).
  exposicao_pct int not null default 100 check (exposicao_pct between 0 and 100),

  -- O que está sendo testado e por quê. Aparece no painel.
  nota text not null default '',

  -- [{ nome, peso, plano? }]. Ordenada: a primeira é SEMPRE o controle.
  -- `plano` só existe em experimento de preço: { texto, valor, ancora, checkout }.
  variantes jsonb not null default '[]'::jsonb,

  atualizado_em timestamptz not null default now()
);

-- SEM POLICY ANON, de propósito. Só o service role lê e escreve, pelas server
-- functions autenticadas com `exigirAdmin()`. A config carrega link de
-- checkout e preço que ainda não foi decidido; nada disso é leitura pública.
alter table public.experimentos enable row level security;

-- O SEED É O QUE JÁ ESTAVA VENDENDO, e entra DESLIGADO.
--
-- Os cinco planos foram conferidos abrindo o checkout em 19/08: o "Total
-- Hoje" de cada tela bate com o `texto` daqui.
-- `ativo` NASCE VERDADEIRO porque o teste JÁ ESTÁ NO AR (subiu em 19/08, pelo
-- código). Esta migration tem que ser um NÃO-EVENTO: o banco passa a
-- descrever o que já está acontecendo, sem impor nada novo.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'preco',
  true,
  100,
  'Quanto custa a música. A=38 (controle), B=19, C=9, D=29, E=54,90. Receita por lead é o que decide, não conversão: preço mais alto converte pior por definição e ainda pode faturar mais.',
  '[
    {"nome":"A","peso":1,"plano":{"texto":"R$ 38","valor":38,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQER4D"}},
    {"nome":"B","peso":1,"plano":{"texto":"R$ 19","valor":19,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQFF7H"}},
    {"nome":"C","peso":1,"plano":{"texto":"R$ 9","valor":9,"ancora":"R$ 49,90","checkout":"https://go.perfectpay.com.br/PPU38CQFF7I"}},
    {"nome":"D","peso":1,"plano":{"texto":"R$ 29","valor":29,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQFF7J"}},
    {"nome":"E","peso":1,"plano":{"texto":"R$ 54,90","valor":54.9,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQFF7K"}}
  ]'::jsonb
)
on conflict (id) do nothing;
