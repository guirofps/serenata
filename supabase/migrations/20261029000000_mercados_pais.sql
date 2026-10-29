-- OS MERCADOS DA BALLAD (29/10/2026): o país e a moeda de cada venda.
--
-- Aplicar nas DUAS marcas (Serenata e Ballad): o código é o mesmo e lê as
-- mesmas colunas. NÃO APLICADA ainda: o branch `mercados-es` espera o dono.
-- O código funciona sem elas (as escritas são à parte e engolem o erro, e as
-- leituras pedem só `pais`, numa consulta própria), então a ordem
-- deploy/migration não derruba venda.
--
-- quiz_responses.pais: o país do acesso (`x-vercel-ip-country`) na primeira
--   vez que o servidor da letra tocou no quiz. NUNCA sobrescrito: a letra, os
--   e-mails e a página leem daqui o espanhol do quiz, mesmo que a pessoa
--   termine de outro país. Nulo = quiz de antes disto (vale o padrão, EUA).
--
-- pedidos.moeda / valor_moeda / pais: o que o caixa cobrou de verdade, na
--   moeda local (unidade menor da API do Stripe: centavos de euro, peso
--   chileno inteiro). `valor_centavos` continua em DÓLAR (o equivalente), que
--   é o que o painel, o Google, o TikTok e o GA4 leem.
alter table public.quiz_responses
  add column if not exists pais text;

alter table public.pedidos
  add column if not exists moeda text,
  add column if not exists valor_moeda integer,
  add column if not exists pais text;

-- Leitura por mercado no painel (venda por país), só das vendas com país.
create index if not exists pedidos_pais_idx
  on public.pedidos (pais, created_at)
  where pais is not null;
