-- OS NOMES DAS CAMPANHAS, porque o Google só nos dá o número.
--
-- O modelo de acompanhamento usa `utm_campaign={campaignid}`, e não existe
-- alternativa: o Google NÃO oferece uma variável `{campaignname}`. O que chega
-- no banco é `24116713654`, e o painel mostrava isso.
--
-- Otimizar olhando `24116713654` contra `24109054263` não é possível. Com o
-- nome, "Remkt Concorrentes | CAMPEÃO 1#" contra "Fãs de programas de TV |
-- CAMPEÃO 3#" vira uma decisão que se toma em dois segundos.
--
-- POR QUE UMA TABELA E NÃO A API: a API do Google Ads resolveria isso sozinha,
-- e é pra onde isto vai um dia. Ela exige o developer token, que só se pede de
-- conta de administrador e que em 2026 está com fila de semanas. Esta tabela
-- funciona hoje e continua servindo depois como histórico: campanha excluída
-- do Google some da API, e as vendas dela continuam no nosso banco.
create table if not exists public.campanhas (
  -- O ID que chega em `utm_campaign`. TEXT e não bigint: é o que a atribuição
  -- guarda, e converter dos dois lados só criaria chance de não casar.
  id text primary key,
  nome text not null,
  -- Ativada / Pausada no momento da carga. Serve pra separar o que ainda gasta
  -- do que é histórico, sem precisar abrir o Google.
  status text,
  -- Geração de demanda, Pesquisa, etc.
  tipo text,
  atualizado_em timestamptz not null default now()
);

comment on table public.campanhas is
  'ID -> nome das campanhas do Google Ads. Carregado do relatório de campanha; vira automático quando o developer token sair.';

-- Só o service role lê e escreve. É dado de operação, e o funil anônimo não
-- tem nada que ver com isso.
alter table public.campanhas enable row level security;
