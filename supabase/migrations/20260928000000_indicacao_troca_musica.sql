-- O SALDO DE INDICAÇÃO VIRA MÚSICA (28/09/2026, decisão do dono).
--
-- Além do saque por PIX (a partir de R$ 100, liberado depois de 30 dias),
-- quem indica pode trocar R$ 28 do saldo por 1 crédito: uma música nova
-- completa, o mesmo que a "música extra" vende por R$ 28.
--
-- ── POR QUE ISSO É BOM PROS DOIS LADOS ───────────────────────────
--
-- Pra nós, a comissão paga em PIX é dinheiro que sai; paga em música custa
-- ~R$ 1 (API + nada de gateway). Pra quem indica, com 30% de R$ 34,20 por
-- convidado, o saque de R$ 100 pede ~10 indicações; uma música pede 3.
--
-- ── A TROCA USA O SALDO TODO, INCLUSIVE O "A LIBERAR" ────────────
--
-- A carência de 30 dias existe porque a comissão em PIX é dinheiro que não
-- volta se a compra for reembolsada. A música não tem esse risco em escala:
-- se a compra que gerou o saldo for estornada depois da troca, o prejuízo é
-- o custo de UMA geração. Exigir 30 dias aqui mataria a troca no primeiro
-- mês inteiro do programa (as primeiras comissões só liberam em 27/10).
--
-- Consequência na conta: a troca entra em `indicacao_saques` e desconta do
-- `disponivel_centavos` como qualquer saque, então o disponível pode ficar
-- NEGATIVO enquanto o pendente não libera. A tela lê isso como "a liberar
-- menor", não como dívida (`indicacao-fns.ts`). E o saque por PIX continua
-- lendo só o disponível, então nunca paga em dinheiro o que já virou música.
--
-- ── POR QUE UMA LINHA EM `indicacao_saques`, E NÃO OUTRA TABELA ──
--
-- O saldo é uma SOMA (`saldo_indicacao`): comissões menos saques. Pôr a troca
-- em outra tabela obrigaria a reescrever a soma e todos os lugares que a
-- leem. Como linha de saque com `tipo = 'musica'`, ela desconta sozinha, e o
-- `status = 'pago'` já na criação tira ela da fila de "saques pra pagar".

alter table public.indicacao_saques
  add column if not exists tipo text not null default 'pix'
    check (tipo in ('pix', 'musica'));

comment on column public.indicacao_saques.tipo is
  'pix = saque em dinheiro, pago à mão pelo dono. musica = troca automática por 1 crédito (R$ 28), nasce pago.';

-- ── A TROCA, ATÔMICA ─────────────────────────────────────────────
--
-- Mesma trava do `pedir_saque_indicacao` (a chave do lock é a MESMA): um
-- toque duplo, duas abas, ou troca e saque ao mesmo tempo não gastam o mesmo
-- saldo duas vezes. O débito e o crédito saem na mesma transação: ou a
-- pessoa perde R$ 28 E ganha a música, ou nada acontece.
create or replace function public.trocar_saldo_por_musica(p_email text)
returns public.indicacao_saques
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_total bigint;
  v_linha public.indicacao_saques;
begin
  perform pg_advisory_xact_lock(hashtext('saque_indicacao:' || v_email));

  -- O saldo inteiro: o que já liberou (menos o que saiu) mais o a liberar.
  select coalesce(pendente_centavos, 0) + coalesce(disponivel_centavos, 0)
    into v_total
    from saldo_indicacao(v_email);
  -- 2800 = `MUSICA_COM_SALDO_CENTAVOS` em `src/lib/indicacao.ts`.
  if coalesce(v_total, 0) < 2800 then
    raise exception 'saldo-insuficiente';
  end if;

  insert into indicacao_saques (email, valor_centavos, chave_pix, status, tipo, resolvido_em, nota)
  values (v_email, 2800, 'musica', 'pago', 'musica', now(), 'trocado por 1 música')
  returning * into v_linha;

  insert into creditos (email, quantidade, origem, nota)
  values (v_email, 1, 'indicacao', jsonb_build_object('saque_id', v_linha.id));

  return v_linha;
end;
$$;

revoke all on function public.trocar_saldo_por_musica(text) from public, anon, authenticated;
grant execute on function public.trocar_saldo_por_musica(text) to service_role;
