-- ANALYTICS DO LINK DE INDICAÇÃO: o que cada convite trouxe.
--
-- O painel tinha o dinheiro (comissão, saque) e não tinha o funil: 193 links
-- criados e nenhuma ideia de quantos foram de fato clicados. Sem isso, não dá
-- pra saber se o programa não converte ou se ninguém está divulgando — que
-- são problemas opostos, com remédios opostos.
--
-- ── A CONTA É FEITA AQUI, NÃO NO NODE ────────────────────────────
--
-- Mesma lição de `admin_eventos_resumo` (17/08): somar `funnel_events` no
-- Node puxava 180 mil linhas pro servidor e derrubava o /admin inteiro. Esta
-- função devolve UMA linha por código, e só dos códigos que tiveram alguma
-- coisa.
--
-- ── DUAS COLUNAS DE CLIQUE, E ELAS NÃO SE SOMAM ──────────────────
--
-- `cliques` vem do evento `convite_clique`, que nasceu junto com esta
-- migration: um por chegada com `?ref=` na URL. É exato e só conta do deploy
-- pra frente.
--
-- `pessoas` é reconstruído do histórico, dos `page_view` que já carregavam a
-- attribution. Ele NÃO pode virar "cliques": `carimbarIndicacao()` só regrava
-- o localStorage quando o código MUDA, então a mesma pessoa clicando o mesmo
-- link dez vezes deixa um `ref_em` só. O que dá pra reconstruir é quanta
-- gente diferente chegou, nunca quantas vezes.
--
-- Por isso são duas colunas de fontes independentes, e não uma emendada nas
-- duas: emenda de fonte é onde nasce número que ninguém sabe explicar.

-- ── OS ÍNDICES ───────────────────────────────────────────────────
--
-- Parciais, sobre a EXPRESSÃO que a função agrupa. São minúsculos (só as
-- linhas que carregam convite, que é uma fração de tudo) e são o que faz esta
-- tela continuar barata quando `funnel_events` dobrar de novo.
-- `convite_clique` NÃO ganha índice próprio: o `(event_name, created_at)` que
-- já existe isola esse nome sozinho, e `funnel_events` leva um INSERT por
-- visita do site — índice a mais ali é custo em toda página aberta.
create index if not exists funnel_events_ref_idx
  on public.funnel_events ((event_data #>> '{attribution,ref}'))
  where event_name = 'page_view' and event_data #>> '{attribution,ref}' is not null;

create index if not exists quiz_responses_ref_idx
  on public.quiz_responses ((attribution ->> 'ref'))
  where attribution ->> 'ref' is not null;

create index if not exists pedidos_indicacao_codigo_idx
  on public.pedidos (indicacao_codigo)
  where indicacao_codigo is not null;

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

-- SÓ O SERVIDOR CHAMA. Isto é o mapa de quem indica quem, com e-mail dos dois
-- lados: aberto pro anon seria entregar a base de clientes a quem pedisse.
revoke all on function public.admin_indicacao_links() from public, anon, authenticated;
grant execute on function public.admin_indicacao_links() to service_role;
