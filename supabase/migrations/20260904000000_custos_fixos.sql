-- OS CUSTOS QUE NENHUMA API ME CONTA.
--
-- O painel já sabe sozinho: receita e taxa de gateway (`pedidos`), custo de
-- IA e de geração de música (`custos`, 82 mil linhas), e o gasto do Google
-- (`metricas_campanha`, puxado de hora em hora da API deles).
--
-- Falta o resto, e o resto não tem API: assinatura de SaaS, o gasto do TikTok
-- (sem acesso à API de anúncios deles), pagamento a prestador, compra avulsa.
-- Enquanto isso viver só na cabeça do dono, "quanto sobrou" é chute — e é
-- chute que vai ser dividido ao meio entre dois sócios.
--
-- ── POR QUE UMA LINHA POR COMPETÊNCIA, E NÃO UM CAMPO "MENSAL" ───
--
-- Assinatura muda de preço, é cancelada no meio do mês, é paga em dólar com
-- câmbio diferente a cada cobrança. Um campo "R$ 100/mês" mentiria a partir
-- da primeira dessas coisas — e a UTMify, paga um mês e cancelada, já é o
-- caso.
--
-- Então cada COBRANÇA vira uma linha com a data em que ela pertence. Custo
-- que se repete gera uma linha por mês, e o mês que não teve não tem linha.
-- O passado nunca muda quando o preço de hoje muda.
--
-- ── MOEDA GRAVADA, E O VALOR EM REAL CONGELADO ──────────────────
--
-- Supabase e Resend cobram em dólar. Guardar só "R$ 108" perde a informação
-- de que foram US$ 20, e recalcular pelo câmbio de hoje reescreveria o
-- passado a cada consulta. Guarda os dois: o valor original com a moeda, e o
-- valor em real do dia em que saiu, que é o que de fato saiu da conta.
create table if not exists custos_fixos (
  id uuid primary key default gen_random_uuid(),

  -- A que dia este custo pertence. Para assinatura mensal, use o dia da
  -- cobrança; o painel agrupa por mês a partir daqui.
  dia date not null,

  -- "assinatura", "midia", "prestador", "avulso". Texto livre de propósito:
  -- uma categoria nova não deve exigir migration.
  categoria text not null,

  -- Quem cobrou: "Supabase", "TikTok Ads", "UTMify". É por este nome que o
  -- painel agrupa e que o dono reconhece a linha.
  fornecedor text not null,

  descricao text,

  -- O valor que de fato saiu da conta, em real. É este que soma.
  valor_brl numeric(12,2) not null,

  -- O valor original, quando a cobrança não foi em real. Informativo: serve
  -- pra conferir a fatura, não pra recalcular.
  valor_original numeric(12,2),
  moeda text default 'BRL',

  -- `true` quando é assinatura que se repete. Não faz o sistema cobrar nada
  -- sozinho: serve pra o painel avisar quando um mês novo começou e a linha
  -- daquele fornecedor ainda não foi lançada.
  recorrente boolean not null default false,

  criado_em timestamptz not null default now()
);

create index if not exists custos_fixos_dia on custos_fixos (dia desc);
create index if not exists custos_fixos_fornecedor on custos_fixos (fornecedor);

-- RLS LIGADA E SEM POLÍTICA PARA `anon`.
--
-- Esta tabela é a folha de custos da empresa e a base do acerto entre sócios.
-- Ninguém do funil tem motivo pra ler isso, e o painel administrativo lê com
-- service role pelo servidor. Sem política, a chave anônima não enxerga nada
-- — que é exatamente a regra do CLAUDE.md: segurança é RLS, não rota
-- escondida no front.
alter table custos_fixos enable row level security;
