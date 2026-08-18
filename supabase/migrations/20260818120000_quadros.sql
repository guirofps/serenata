-- O QUADRO COMO PRODUTO CONTÁVEL, e não como booleano deduzido do preço.
--
-- Até aqui "comprou o quadro?" era uma consulta a `pedidos` procurando
-- `valor_centavos = 2490` (meus-creditos.ts). Isso tem três defeitos, e os três
-- aparecem no primeiro dia de venda de verdade:
--
--   1. NÃO CONTA. Quem compra dois quadros (um pra cada música) tem o mesmo
--      "true" de quem comprou um. O segundo some.
--   2. QUEBRA COM PROMOÇÃO. Um cupom de R$ 5 muda o valor e o direito
--      desaparece, sem erro nenhum: a pessoa paga e a tela diz que ela não
--      comprou.
--   3. NÃO SABE DE QUAL MÚSICA É. E essa é a pergunta central do produto:
--      quem tem três músicas precisa escolher qual vira quadro.
--
-- ── POR QUE NÃO ENTRA NA TABELA `creditos` ───────────────────────
--
-- Crédito é fungível: um crédito vira qualquer música, e a conta é uma soma.
-- Quadro não é. Cada quadro é uma peça amarrada a UMA música, com título,
-- dedicatória e estilo próprios, e essa linha continua existindo depois de
-- usada porque é ela que a pessoa volta pra reimprimir. Somar isso num saldo
-- perderia justamente o que precisa ser guardado.
--
-- ── O DIREITO NASCE NA COMPRA E É GASTO NA CONFIRMAÇÃO ───────────
--
-- A linha nasce no webhook com `musica_id` nulo: é um direito a montar um
-- quadro. Ela escolhe a música, troca quantas vezes quiser, e só ao confirmar
-- o `musica_id` é preenchido. Antes disso nada foi gasto.
--
-- Depois de confirmado, título, dedicatória e estilo continuam editáveis (ela
-- vai reimprimir), mas a MÚSICA não muda: senão um quadro comprado uma vez
-- viraria quadro de todas as músicas dela, e o produto deixa de existir.

create table if not exists public.quadros (
  id uuid primary key default gen_random_uuid(),
  -- O DONO É O E-MAIL, igual ao razão de créditos, e pelo mesmo motivo: a
  -- compra chega pelo webhook, que conhece e-mail e não conhece user_id (a
  -- conta às vezes nem existe ainda no instante do pagamento).
  email text not null,
  -- O PEDIDO QUE PAGOU. Único: um pagamento dá direito a um quadro, e o
  -- webhook da Perfect Pay reenvia o mesmo evento quando a resposta demora.
  pedido_id uuid references public.pedidos(id) on delete set null,
  -- Nulo enquanto ela não confirma. É isto que separa "tenho um quadro pra
  -- montar" de "meu quadro é o da música tal".
  musica_id uuid references public.musicas(id) on delete set null,
  confirmado_em timestamptz,
  -- O que ela escreveu NO QUADRO. Nasce copiado da página presente (pra ela
  -- não preencher duas vezes) e a partir daí é dela.
  titulo text,
  dedicatoria text,
  -- Cor, modo claro/escuro e efeito. Ficava só no localStorage do navegador,
  -- então trocar de celular perdia a montagem.
  estilo jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists quadros_um_por_pedido
  on public.quadros (pedido_id) where pedido_id is not null;

create index if not exists quadros_email_idx on public.quadros (lower(email));
create index if not exists quadros_musica_idx on public.quadros (musica_id);

-- NADA DE LEITURA DIRETA PELO CLIENTE. Igual a `creditos`: quem lê é server
-- function com o token conferido, porque a tabela liga e-mail a compra.
alter table public.quadros enable row level security;
revoke all on public.quadros from anon, authenticated;

comment on table public.quadros is
  'Um direito a montar um quadro A4. Nasce na compra (musica_id nulo) e é '
  'amarrado a uma música na confirmação. Contável: duas compras, duas linhas.';

-- ── QUEM JÁ COMPROU ANTES DESTA TABELA ───────────────────────────
-- Ninguém fica pra trás: todo pedido pago de R$ 24,90 vira um direito. É a
-- última vez que o preço é usado como identificação; daqui pra frente quem
-- cria a linha é o webhook, pelo código do produto.
insert into public.quadros (email, pedido_id, created_at)
select p.email, p.id, p.created_at
from public.pedidos p
where p.status = 'pago'
  and p.valor_centavos = 2490
  and p.email is not null
on conflict do nothing;
