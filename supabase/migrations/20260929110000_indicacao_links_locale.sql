-- CONSERTO: a venda em dólar não entra na conta em real.
--
-- A primeira versão desta função (20260929100000) somava QUALQUER pedido pago
-- que carregasse um código, sem olhar o idioma do funil. Mas a trigger que
-- paga comissão só aceita o funil em português, e por um motivo que vale
-- dinheiro: no espanhol e na Ballad, `valor_centavos` é centavo de DÓLAR.
--
-- O estrago era duplo e silencioso: a receita misturava as duas moedas como se
-- fossem a mesma, e a aba de links mostrava uma compra a mais do que a aba de
-- saques, sem nada na tela explicando a diferença. Foi assim que apareceu.
--
-- Mudam as CTEs `pagos` e `quizzes`; o resto é idêntico à 20260929100000.

create or replace function public.admin_indicacao_links()
returns table (
  codigo text,
  dono text,
  criado_em timestamptz,
  cliques bigint,
  pessoas bigint,
  quizzes bigint,
  letras bigint,
  pagos bigint,
  receita_centavos bigint,
  comissao_centavos bigint
)
language sql
stable
security definer
set search_path = public
-- O PostgREST conecta como `authenticator`, que tem statement_timeout de 8s,
-- e `service_role` não sobrescreve isso. Mesma armadilha que matou a primeira
-- versão de `admin_eventos_resumo`.
set statement_timeout to '30s'
as $$
with cliques as (
  select upper(e.event_data ->> 'ref') as codigo, count(*)::bigint as n
  from funnel_events e
  where e.event_name = 'convite_clique'
    and e.event_data ->> 'ref' is not null
  group by 1
),
-- UMA LINHA POR PESSOA, e a chave é o `ref_em`.
--
-- `ref_em` é gravado no instante em que o código entrou naquele navegador, e
-- só muda quando o código muda. Então ele identifica "esta pessoa, por este
-- link" mesmo depois de a sessão rodar (o /criar rotaciona a sessão, e contar
-- por session_id contaria a mesma pessoa duas vezes).
--
-- O coalesce cobre um evento antigo que tenha `ref` sem `ref_em`.
pessoas as (
  select upper(e.event_data #>> '{attribution,ref}') as codigo,
         count(distinct coalesce(e.event_data #>> '{attribution,ref_em}', e.session_id))::bigint as n
  from funnel_events e
  where e.event_name = 'page_view'
    and e.event_data #>> '{attribution,ref}' is not null
  group by 1
),
-- Começou o quiz e chegou na letra são degraus DIFERENTES de propósito: a
-- linha de `quiz_responses` nasce no passo 1 (captura parcial), então
-- "quizzes" sozinho conta também quem só encostou e foi embora.
quizzes as (
  select upper(q.attribution ->> 'ref') as codigo,
         count(*)::bigint as n,
         (count(*) filter (where m.tem is not null))::bigint as letras
  from quiz_responses q
  left join lateral (
    select 1 as tem from musicas m
    where m.quiz_response_id = q.id and m.letra is not null
    limit 1
  ) m on true
  where q.attribution ->> 'ref' is not null
    -- Mesma régua de `pagos`: quiz do funil espanhol nunca vira comissão, e
    -- contá-lo aqui faria um link parecer vivo com movimento que não pode
    -- converter. A atribuição atravessa os funis (ela sobrevive à navegação),
    -- então isto acontece de verdade.
    and coalesce(q.locale, 'pt') = 'pt'
  group by 1
),
-- O MESMO `coalesce` DA TRIGGER (`indicacao_comissionar`): o código validado
-- na cobrança vence, e a attribution cobre o caminho que não gera pendente do
-- nosso lado. Ler diferente da trigger faria o painel discordar de si mesmo.
--
-- Fora, pelo mesmo motivo que a trigger deixa de fora: crédito e liberação
-- manual não são dinheiro que entrou, e upsell não é compra que o link trouxe.
pagos as (
  select upper(coalesce(p.indicacao_codigo, q.attribution ->> 'ref')) as codigo,
         count(*)::bigint as n,
         coalesce(sum(p.valor_centavos), 0)::bigint as receita
  from pedidos p
  left join quiz_responses q on q.id = p.quiz_response_id
  where p.status = 'pago'
    -- SÓ O FUNIL EM PORTUGUÊS, igual à trigger. Sem esta linha um pedido do
    -- funil espanhol (ou da Ballad) entrava aqui, e o `valor_centavos` dele é
    -- centavo de DÓLAR: os US$ 9 viravam R$ 9,00 somados na receita, que é
    -- exatamente o erro de câmbio silencioso que o CLAUDE.md manda evitar.
    --
    -- E ele contava uma compra que NUNCA vira comissão, porque a trigger
    -- recusa o mesmo pedido — o painel discordando de si mesmo sem explicar.
    and coalesce(q.locale, 'pt') = 'pt'
    and coalesce(p.valor_centavos, 0) > 0
    and p.dinheiro_entrou is not false
    and coalesce(p.gateway, '') not in ('credito', 'manual')
    and coalesce(p.payment_id, '') not like '%:up:%'
    and coalesce(p.indicacao_codigo, q.attribution ->> 'ref') is not null
  group by 1
),
-- Comissão de pedido que deixou de estar pago some sozinha, igual ao
-- `saldo_indicacao`. `pagos` é sempre >= o que gerou comissão: a comissão só
-- nasce na PRIMEIRA compra do convidado, e quem já era cliente comprando pelo
-- link continua sendo uma venda que o link trouxe.
comissoes as (
  select upper(ic.codigo) as codigo, coalesce(sum(ic.valor_centavos), 0)::bigint as v
  from indicacao_comissoes ic
  join pedidos p on p.id = ic.pedido_id
  where p.status = 'pago'
  group by 1
)
select
  c.codigo,
  c.email as dono,
  c.created_at as criado_em,
  coalesce(cl.n, 0) as cliques,
  coalesce(pe.n, 0) as pessoas,
  coalesce(qz.n, 0) as quizzes,
  coalesce(qz.letras, 0) as letras,
  coalesce(pg.n, 0) as pagos,
  coalesce(pg.receita, 0) as receita_centavos,
  coalesce(co.v, 0) as comissao_centavos
from indicacao_codigos c
left join cliques   cl on cl.codigo = c.codigo
left join pessoas   pe on pe.codigo = c.codigo
left join quizzes   qz on qz.codigo = c.codigo
left join pagos     pg on pg.codigo = c.codigo
left join comissoes co on co.codigo = c.codigo
-- SÓ OS LINKS QUE TIVERAM ALGUMA COISA. Os 193 códigos não são 193 pessoas
-- que quiseram divulgar: a maioria foi criada pelo próprio disparo de e-mail,
-- que cria o código antes de mandar. Listar os mortos enterraria os vivos.
--
-- O filtro olha o funil INTEIRO, não só o clique: um navegador que bloqueia o
-- insert de evento ainda grava o `ref` no quiz e no pedido, e um link que
-- vendeu não pode sumir da tela por falta de clique registrado.
where coalesce(cl.n, 0) + coalesce(pe.n, 0) + coalesce(qz.n, 0) + coalesce(pg.n, 0) > 0
order by coalesce(cl.n, 0) + coalesce(pe.n, 0) desc, coalesce(pg.n, 0) desc, c.created_at desc;
$$;

revoke all on function public.admin_indicacao_links() from public, anon, authenticated;
grant execute on function public.admin_indicacao_links() to service_role;
