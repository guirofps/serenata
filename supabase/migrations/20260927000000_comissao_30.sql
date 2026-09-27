-- A COMISSÃO PASSA DE 20% PARA 30% (27/09/2026, decisão do dono).
--
-- ── POR QUE UMA MIGRAÇÃO, E NÃO SÓ A CONSTANTE DO TS ─────────────
--
-- A comissão é calculada NESTA TRIGGER, que é o único ponto por onde os seis
-- caminhos de pagamento passam. `PCT_COMISSAO` no TypeScript manda no que a
-- tela PROMETE; esta função manda no que o banco PAGA. Mudar um sem o outro
-- põe o site anunciando 30% e a conta creditando 20% — e, diferente de uma
-- copy errada, essa o cliente confere na calculadora.
--
-- A função abaixo é a de 20260926000000 com UMA diferença: a taxa. Ela foi
-- extraída do arquivo original e reescrita por substituição, não copiada à
-- mão, justamente pra não haver uma segunda diferença sem querer.
--
-- ── O QUE NÃO MUDA ───────────────────────────────────────────────
--
-- Comissão JÁ GRAVADA continua valendo o que valia. `indicacao_comissoes`
-- guarda o valor em centavos na linha, não a porcentagem, então nada é
-- recalculado — quem indicou antes recebe os 20% que foram prometidos a ele,
-- e quem indicar daqui pra frente recebe 30%. Mexer no passado mudaria saldo
-- que já apareceu na tela de alguém.

create or replace function public.indicacao_comissionar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_locale text;
  v_attr jsonb;
  v_codigo text;
  v_indicador text;
begin
  -- Só na TRANSIÇÃO pra pago. Reprocessar um pedido já pago não é evento.
  if new.status is distinct from 'pago' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'pago' then
    return new;
  end if;

  begin
    -- Dinheiro de verdade, e só da compra principal: crédito gasto, liberação
    -- manual e upsell (`:up:`) não são "a primeira compra" de ninguém.
    if coalesce(new.valor_centavos, 0) <= 0
       or new.dinheiro_entrou is false
       or coalesce(new.gateway, '') in ('credito', 'manual')
       or coalesce(new.payment_id, '') like '%:up:%' then
      return new;
    end if;

    v_email := lower(trim(new.email));
    if v_email is null or v_email = '' then
      return new;
    end if;

    if new.quiz_response_id is not null then
      select q.locale, q.attribution into v_locale, v_attr
      from quiz_responses q
      where q.id = new.quiz_response_id;
    end if;
    -- Só o funil em português: o espanhol cobra em DÓLAR, e `valor_centavos`
    -- ali são centavos de dólar. 20% deles creditados como real seria erro
    -- de câmbio silencioso.
    if coalesce(v_locale, 'pt') <> 'pt' then
      return new;
    end if;

    -- O validado na cobrança vence; a attribution só cobre o caminho que não
    -- gera pendente do nosso lado (Perfect Pay), onde não houve desconto mas
    -- a indicação existiu.
    v_codigo := upper(coalesce(new.indicacao_codigo, v_attr ->> 'ref'));
    if v_codigo is null or v_codigo !~ '^[A-HJKMNP-Z2-9]{6}$' then
      return new;
    end if;

    select c.email into v_indicador from indicacao_codigos c where c.codigo = v_codigo;
    -- Indicar a si mesmo não conta.
    if v_indicador is null or v_indicador = v_email then
      return new;
    end if;

    -- A PRIMEIRA COMPRA. Um pedido anterior reembolsado também conta como
    -- compra: senão, comprar, pedir reembolso e comprar de novo pelo link
    -- viraria o jeito de fabricar comissão.
    if exists (
      select 1 from pedidos p
      where lower(p.email) = v_email
        and p.id <> new.id
        and p.status in ('pago', 'reembolsado')
        and coalesce(p.valor_centavos, 0) > 0
        and p.dinheiro_entrou is not false
        and coalesce(p.gateway, '') not in ('credito', 'manual')
    ) then
      return new;
    end if;

    insert into indicacao_comissoes
      (pedido_id, codigo, indicador_email, indicado_email, base_centavos, valor_centavos, libera_em)
    values (
      new.id,
      v_codigo,
      v_indicador,
      v_email,
      new.valor_centavos,
      -- 30%, o mesmo `comissaoDe` do TS (`PCT_COMISSAO`).
      --
      -- O `round` dos dois lados tem que concordar no meio-centavo, e a
      -- justificativa velha ("valor/5 nunca termina em ,5") morreu com a
      -- troca: a 30%, valor*3/10 TERMINA em ,5 (3415 -> 1024,5). Continua
      -- batendo porque, pra valor positivo, o `round` do Postgres (meio pra
      -- longe do zero) e o `Math.round` do JS (meio pra cima) dão o mesmo
      -- número. Se algum dia entrar valor negativo aqui, os dois divergem.
      round(new.valor_centavos * 30 / 100.0)::int,
      coalesce(new.paid_at, now()) + interval '30 days'
    )
    on conflict do nothing;
  exception when others then
    raise warning 'indicacao_comissionar falhou no pedido %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
