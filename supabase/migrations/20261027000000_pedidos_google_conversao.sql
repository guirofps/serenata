-- A venda vai pro Google no minuto em que é paga (api/conversoes-tempo-real.ts).
-- O estado mora no pedido: null = ainda não olhado; enviado; confirmado;
-- recusado; parcial; sem_clique; sem_valor.
alter table public.pedidos
  add column if not exists google_conversao text,
  add column if not exists google_conversao_em timestamptz,
  add column if not exists google_conversao_req text;

-- O vigia lê a cada minuto só o que falta subir.
create index if not exists pedidos_google_pendente_idx
  on public.pedidos (paid_at)
  where status = 'pago' and google_conversao is null;

-- E a conferência lê os envios que ainda esperam o resultado do Google.
create index if not exists pedidos_google_enviado_idx
  on public.pedidos (google_conversao_em)
  where google_conversao = 'enviado';
