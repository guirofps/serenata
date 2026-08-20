-- ────────────────────────────────────────────────────────────────
-- TETO DE USO POR CHAVE. É o que faltava pra os endpoints de IA.
--
-- O problema: `gerarRefroes`, `montarLetra` e `aprimorarLetra` são server
-- functions, e server function é ROTA HTTP. Sem conta, sem senha e sem teto,
-- qualquer um com o `curl` aberto chama o Claude na nossa conta o dia inteiro
-- — o `aprimorarLetra` chega a devolver o texto gerado, então é literalmente
-- um proxy grátis pra API da Anthropic. `finalizarLetra` é pior: dispara o
-- Suno, R$ 0,32 por chamada, dinheiro de verdade saindo por requisição.
--
-- É o erro herdado que o CLAUDE.md manda não repetir, na letra: "endpoints de
-- IA públicos sem autenticação: qualquer um queima a conta".
--
-- Por que uma TABELA e não memória do processo: a Vercel roda várias
-- instâncias e as recicla o tempo todo. Um contador em memória seria zerado
-- pelo próprio provedor a cada instância nova — ou seja, teto nenhum.
--
-- Por que não `custos`: ali só entra o que JÁ foi gasto. O teto precisa contar
-- a TENTATIVA, inclusive a que falhou, senão quem chama num laço e recebe erro
-- continua queimando token sem nunca aparecer no contador.
-- ────────────────────────────────────────────────────────────────

create table if not exists public.limites_uso (
  -- "ia:<session_id>", "ia-ip:<hash>", "musica:<session_id>"… O prefixo é o
  -- que separa os tetos; ver `src/lib/limite-uso.ts`.
  chave text primary key,
  janela_inicio timestamptz not null default now(),
  contagem integer not null default 0
);

-- Pra faxina periódica (a tabela cresce na ordem de uma linha por sessão).
create index if not exists limites_uso_janela_idx on public.limites_uso (janela_inicio);

alter table public.limites_uso enable row level security;
-- Nenhuma policy: só o service role toca. RLS ligada sem policy já nega, e o
-- revoke é a defesa em profundidade que o resto do projeto usa.
revoke all on public.limites_uso from anon, authenticated;

-- ── O INCREMENTO ATÔMICO ────────────────────────────────────────
--
-- Ler-somar-gravar em três idas ao banco perde a corrida contra um atacante
-- que dispara cem requisições ao mesmo tempo — que é exatamente o cenário
-- contra o qual isto existe. `insert ... on conflict do update` resolve tudo
-- numa instrução, sob o lock da linha.
--
-- A JANELA É DESLIZANTE POR BLOCO, não por evento: quando a janela vencida é
-- encontrada, a contagem volta pra 1 e o relógio recomeça. Mais simples que
-- janela deslizante de verdade e suficiente pra tarefa — o objetivo é impedir
-- laço automatizado, não cobrar pedágio no décimo clique de um humano.
create or replace function public.consumir_limite(
  p_chave text,
  p_janela_s integer,
  p_teto integer
) returns boolean as $$
declare
  v_agora timestamptz := now();
  v_cont integer;
begin
  insert into public.limites_uso as l (chave, janela_inicio, contagem)
  values (p_chave, v_agora, 1)
  on conflict (chave) do update set
    janela_inicio = case
      when l.janela_inicio < v_agora - make_interval(secs => p_janela_s) then v_agora
      else l.janela_inicio end,
    contagem = case
      when l.janela_inicio < v_agora - make_interval(secs => p_janela_s) then 1
      else l.contagem + 1 end
  -- `returning` depois de `do update` devolve a linha COMO FICOU, então
  -- `v_cont` já é a contagem com esta chamada somada.
  returning l.contagem into v_cont;

  return v_cont <= p_teto;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;

comment on function public.consumir_limite(text, integer, integer) is
  'Soma 1 na chave e devolve true se ainda cabe no teto da janela. Só service role.';

-- ── FAXINA ──────────────────────────────────────────────────────
-- Linha velha não serve pra nada: se a janela venceu, o próximo acesso a
-- reinicia de qualquer jeito. Roda junto de qualquer chamada, de graça, no
-- lugar de exigir um cron só pra isto.
create or replace function public.limpar_limites_velhos() returns void as $$
  delete from public.limites_uso where janela_inicio < now() - interval '2 days';
$$ language sql security definer set search_path = public;

revoke all on function public.limpar_limites_velhos() from public, anon, authenticated;
grant execute on function public.limpar_limites_velhos() to service_role;

-- ── DE QUEBRA: A POLICY DE DESCADASTRO QUE NÃO ERA USADA ────────
--
-- `descadastros` tinha `for insert to anon with check (true)`, aberta pra
-- qualquer um inserir qualquer endereço. Ninguém escreve por ali: o clique no
-- link do e-mail passa pela server function `sair` (rota /descadastrar), que
-- usa service role e confere o `session_id` antes. A policy só servia pra
-- deixar um estranho tirar um cliente da lista de recuperação — silenciosamente
-- e sem rastro.
drop policy if exists "anon descadastra" on public.descadastros;
