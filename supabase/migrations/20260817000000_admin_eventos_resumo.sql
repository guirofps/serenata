-- O painel parava de abrir porque LIA A TABELA INTEIRA pra fazer conta.
--
-- Em 17/08 uma abertura do /admin puxava 203 mil linhas do banco pro Node,
-- sendo 180 mil delas de funnel_events (a tabela toda tem 183 mil). Tudo isso
-- pra, no fim, produzir meia dúzia de contadores. O tempo crescia em linha
-- reta com o tráfego até passar do limite da função na Vercel, e aí a tela de
-- admin tratava a falha como "não autorizado" e devolvia o login pra quem
-- tinha digitado a senha certa.
--
-- Somar 180 mil linhas é trabalho de banco de dados. Esta função faz a conta
-- onde o dado mora e devolve ~30 linhas de resumo.
--
-- ── FIDELIDADE AO QUE JÁ EXISTIA ─────────────────────────────────
--
-- Isto é TRADUÇÃO, não reescrita: cada regra abaixo replica a semântica exata
-- do JavaScript que substituiu, incluindo as esquisitices. Um painel que fica
-- rápido e muda os números não conserta nada, esconde. As esquisitices estão
-- comentadas uma a uma, e há um teste que compara os dois caminhos linha a
-- linha (`scratch/confere-resumo.mjs`).

create or replace function public.admin_eventos_resumo(
  p_desde         timestamptz,
  p_ate           timestamptz,
  p_filtro        text default 'todos',   -- 'todos' | 'pt' | 'es'
  p_sessoes_venda text[] default '{}'     -- sessões que pagaram, vindas do JS
)
returns jsonb
language sql
stable
-- O PostgREST conecta como `authenticator`, que tem statement_timeout de 8s, e
-- `service_role` não sobrescreve isso (config de papel vale no login, e o
-- PostgREST só faz SET ROLE depois). Resultado: a função tinha 8 segundos,
-- não os 60 da Vercel, e foi assim que a primeira versão morreu.
--
-- Este SET vale só enquanto ESTA função roda, e não afrouxa nada pro resto do
-- sistema. Hoje ela leva ~2s em 30 dias; os 30s são pra ela não voltar a
-- quebrar em silêncio quando o tráfego dobrar.
set statement_timeout to '30s'
as $$
-- ── POR QUE ESTA FORMA, E NÃO A ÓBVIA ────────────────────────────
--
-- A primeira versão fazia o que o JS fazia, só que em SQL: um CTE com os
-- eventos crus e cinco varreduras por cima dele. Levou 13,2s numa janela de
-- 30 dias e derramou pra disco (87 mil blocos temporários), porque cada
-- varredura arrastava o `event_data` jsonb junto.
--
-- E 13,2s não passa: o PostgREST conecta como `authenticator`, que tem
-- statement_timeout de 8s, e `service_role` não sobrescreve. Ou seja, a
-- função tinha 8 segundos, não os 60 da Vercel.
--
-- Esta versão joga o jsonb fora no primeiro passe (vira `path` e `is_landing`,
-- dois escalares) e reduz TUDO a uma linha por sessão. Depois disso são ~14
-- mil linhas em vez de 183 mil, e as contas de cima ficam de graça.
-- SÓ OS DOZE NOMES QUE O PAINEL USA.
--
-- Isto derruba metade da varredura sozinho. `quiz_step` são 40 mil dos 145
-- mil eventos de uma semana e o painel não olha pra ele em lugar nenhum (o
-- progresso no quiz vem de `quiz_responses.furthest_step`, que é mais
-- confiável que evento). `quiz_respondeu`, `gatilho_usado`, os `email_*` e os
-- `coautoria_*` também não entram em nenhuma conta daqui.
--
-- De quebra, a lista de nomes faz o índice (event_name, created_at) valer:
-- viram doze buscas por faixa em vez de uma varredura da tabela.
--
-- Sessão que só tem evento fora desta lista some do resumo, e isso está certo:
-- ela não entra em nenhum número. Sessão que tem algum evento daqui continua
-- inteira, inclusive pro idioma.
with base as (
  select
    session_id,
    event_name,
    created_at,
    id,
    -- Só page_view carrega path/is_landing. Extrair jsonb dos outros 12 mil é
    -- trabalho jogado fora.
    case when event_name = 'page_view' then event_data->>'path' end as path,
    case when event_name = 'page_view' then (event_data->'is_landing')::text = 'true' end as is_landing
  from public.funnel_events
  where created_at >= p_desde and created_at < p_ate
    and event_name in (
      -- degraus do funil
      'page_view', 'quiz_started', 'letra_finalizada', 'oferta_vista',
      'checkout_click', 'desbloquear_click',
      -- cartão de qualidade
      'letra_refacao', 'letra_aprimorada', 'audio_usado',
      'karaoke_play', 'musica_play', 'preview_limite'
    )
),

-- UMA LINHA POR SESSÃO, num único group by.
--
-- `(array_agg(x order by y) filter (where ...))[1]` é o "primeiro que
-- satisfaz", equivalente ao `distinct on` mas sem precisar de outra varredura.
sess as (
  select
    session_id,
    bool_or(event_name = 'page_view')                              as viu,
    bool_or(event_name = 'quiz_started')                           as quiz,
    bool_or(event_name = 'letra_finalizada')                       as letra,
    bool_or(event_name = 'oferta_vista')                           as oferta,
    bool_or(event_name in ('checkout_click', 'desbloquear_click')) as checkout,
    -- Idioma: o PRIMEIRO page_view por id, como o JS (que parava no primeiro
    -- com `if (mapa.has(sid)) continue`).
    (array_agg(coalesce(path, '') order by id)
       filter (where event_name = 'page_view'))[1] as path_1,
    -- Entrada: o primeiro page_view marcado como landing, por tempo.
    -- O `coalesce(path,'/')` fica DENTRO do agregado de propósito: sem ele não
    -- daria pra distinguir "não teve landing" (null) de "teve landing sem
    -- path" (que no JS virava "/").
    (array_agg(coalesce(path, '/') order by created_at, id)
       filter (where event_name = 'page_view' and is_landing))[1] as path_land
  from base
  where session_id is not null
  group by session_id
),

-- IDIOMA DA SESSÃO, em duas fontes e nesta ordem de prioridade.
--
-- 1) A linha do quiz, que é a fonte confiável (tem coluna `locale`).
--    O JS percorria os leads sobrescrevendo o mapa, então quem valia era o
--    ÚLTIMO na ordem de id. `distinct on ... order by id desc` é isso.
loc_quiz as (
  select distinct on (session_id)
         session_id,
         case when locale = 'es' then 'es' else 'pt' end as locale
  from public.quiz_responses
  where created_at >= p_desde and created_at < p_ate
    and session_id is not null
  order by session_id, id desc
),
-- 2) Só pra quem não tem linha de quiz: o caminho do primeiro page_view.
--    Sessão sem nenhum dos dois cai em 'pt'. Não é escolha nova: o JS fazia
--    `(locale ?? "pt") === filtro`.
sessl as (
  select s.*,
         coalesce(
           q.locale,
           case when s.path_1 ~ '^/es(/|$)' then 'es' else 'pt' end
         ) as locale
  from sess s
  left join loc_quiz q on q.session_id = s.session_id
),
-- O recorte por funil, agora sobre ~14 mil linhas em vez de 183 mil.
sel as (
  select * from sessl
  where p_filtro = 'todos' or locale = p_filtro
),

-- Contadores CRUS (evento, não pessoa). Alimentam o cartão de qualidade.
--
-- Este é o único lugar que ainda olha evento a evento, e olha só seis nomes.
-- O `coalesce(s.locale,'pt')` cobre os eventos SEM sessão (5.430 em 7 dias),
-- que o JS jogava em 'pt' pelo mesmo default.
contagens as (
  select b.event_name, count(*) as n
  from base b
  left join sessl s on s.session_id = b.session_id
  where b.event_name in (
          'letra_refacao', 'letra_aprimorada', 'audio_usado',
          'karaoke_play', 'musica_play', 'preview_limite')
    and (p_filtro = 'todos' or coalesce(s.locale, 'pt') = p_filtro)
  group by b.event_name
),

-- PÁGINA DE ENTRADA.
--
-- Páginas de token viram um grupo só: /p/abc e /p/xyz são a mesma PORTA, e
-- listadas uma a uma virariam trinta linhas de uma visita cada.
--
-- As vendas chegam prontas do JS: `pedidos` tem 400 linhas, a regra de o que
-- conta como venda (cortesia não conta) já vive lá, e duplicá-la aqui seria
-- criar uma segunda verdade sobre faturamento.
entrada as (
  select
    regexp_replace(
      regexp_replace(path_land, '^/p/.+', '/p/… (presente compartilhado)'),
      '^/editar/.+', '/editar/… (editor)'
    ) as caminho,
    count(*)::int                                                   as visitantes,
    count(*) filter (where quiz)::int                               as quiz,
    count(*) filter (where letra)::int                              as letras,
    count(*) filter (where session_id = any(p_sessoes_venda))::int  as vendas
  from sel
  where path_land is not null
  group by 1
)

select jsonb_build_object(
  'visitantes',       (select count(*) from sel where viu),
  'sessoes_oferta',   (select count(*) from sel where oferta),
  -- ATENÇÃO: `sessl`, NÃO `sel`.
  --
  -- O degrau "Foi pro checkout" nunca foi separado por idioma no JS. Parece
  -- descuido, e provavelmente é, mas corrigir aqui mudaria silenciosamente o
  -- funil de PT e o de ES no mesmo commit que promete só deixar rápido. Fica
  -- idêntico, e arrumar é um commit à parte, com o número na mão.
  'sessoes_checkout', (select count(*) from sessl where checkout),
  'contagens',        coalesce((select jsonb_object_agg(event_name, n) from contagens), '{}'::jsonb),
  'por_entrada',      coalesce((
                        select jsonb_agg(jsonb_build_object(
                          'caminho', caminho, 'visitantes', visitantes,
                          'quiz', quiz, 'letras', letras, 'vendas', vendas
                        ) order by visitantes desc)
                        from entrada), '[]'::jsonb)
);
$$;

-- SÓ O SERVIDOR CHAMA.
--
-- O painel usa a service role. Deixar isto aberto pro anon entregaria o mapa
-- de tráfego e conversão do site pra quem pedisse, e a lição do CLAUDE.md
-- (foi assim que lemos o custo e o provedor da Cantoria) é exatamente essa.
revoke all on function public.admin_eventos_resumo(timestamptz, timestamptz, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_eventos_resumo(timestamptz, timestamptz, text, text[]) to service_role;

-- O índice que existia era (event_name, created_at), ótimo pra "todos os
-- page_view de agosto" e ruim pra "TODOS os eventos da janela", que é o que
-- esta função faz: ordenado por nome primeiro, uma faixa de tempo obriga a
-- varrer o índice inteiro.
create index if not exists funnel_events_created_at_idx
  on public.funnel_events (created_at);
