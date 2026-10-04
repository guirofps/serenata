-- A TRAVA DE "JÁ MANDEI?" PRECISA DE ÍNDICE (04/10/2026).
--
-- Toda rotina de e-mail confere se já mandou com `event_data @> {...}` em
-- `funnel_events`, filtrando pelo nome do evento. Com 5,2 milhões de linhas,
-- a busca dentro de `email_letra_enviado` (44 mil) levava 16-20s e estourava
-- o timeout do PostgREST (8s). O erro voltava como "lista vazia", o código lia
-- "ainda não mandei" e mandava DE NOVO: a letra saiu até 32 vezes pra mesma
-- pessoa em 24h, e a escada de recuperação (que lê essa trilha) parou em 29/09.
--
-- GIN parcial, só nos eventos de envio/aviso: pequeno (~85 mil linhas) e
-- atende o `@>` que o supabase-js gera no `.contains()`.
create index concurrently if not exists funnel_events_envios_gin
  on public.funnel_events using gin (event_data jsonb_path_ops)
  where event_name in (
    'email_letra_enviado', 'email_sequencia_enviado', 'quase_comprou_enviado', 'pix_nao_pago_enviado',
    'guarde_link_enviado', 'lembrete_presente_enviado', 'oferta_quadro_enviada', 'oferta_video_enviada',
    'volte_criar_enviado', 'convite_fotos_video_enviado', 'musica_repescada', 'quadro_parado_avisado',
    'credito_parado_avisado', 'entrega_falhou_aviso', 'entrega_manual_enviada', 'entrega_atrasada_enviada',
    'video_esperando_lembrado', 'alerta_webhook_mudo', 'alerta_stripe_pago_pendente',
    'woovi_email_enviado', 'perfectpay_email_enviado', 'tiktok_conversao_enviada'
  );
