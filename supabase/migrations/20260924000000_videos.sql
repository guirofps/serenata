-- O VÍDEO-PRESENTE: fotos + música + letra sincronizada, renderizado depois
-- da compra do upsell.
--
-- Mesmo desenho do quadro (`20260818120000_quadros.sql`), e pelo mesmo
-- motivo: é uma PEÇA amarrada a uma música, não um saldo fungível. A linha
-- nasce no webhook do upsell e acompanha o render até o arquivo existir.
--
-- ── A DIFERENÇA PRO QUADRO: O VÍDEO JÁ NASCE COM A MÚSICA ────────
--
-- O quadro é vendido no painel, onde a pessoa pode ter três músicas e
-- escolhe depois. O vídeo é vendido de dentro do EDITOR de uma música, então
-- o pedido já sabe de qual música ele é (`pedidos.musica_id`). Ainda assim a
-- coluna aceita nulo: se um dia o vídeo for vendido fora do editor, a linha
-- nasce sem música e espera ela escolher, igual ao quadro.
--
-- ── O STATUS É O RELÓGIO DO RENDER ───────────────────────────────
--
--   aguardando     pago, render ainda não começou (ou esperando música)
--   renderizando   Lambda trabalhando (render_id preenchido)
--   pronto         MP4 no bucket `videos`, `video_path` preenchido
--   falhou         esgotou as tentativas; `erro` diz o porquê. Pagou e não
--                  recebeu: é alerta pro dono, nunca silêncio.

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  -- O dono é o e-mail, igual a `creditos` e `quadros`: o webhook conhece
  -- e-mail e não conhece user_id.
  email text not null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  musica_id uuid references public.musicas(id) on delete set null,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'renderizando', 'pronto', 'falhou')),
  -- Caminho no bucket `videos` (ex: `<musica_id>/<video_id>.mp4`).
  video_path text,
  -- Pra retomar/consultar o render na AWS se o job cair no meio.
  render_id text,
  render_bucket text,
  tentativas int not null default 0,
  erro text,
  created_at timestamptz not null default now(),
  pronto_em timestamptz
);

-- Um pagamento, um vídeo. Reenvio do mesmo evento pelo gateway bate aqui e
-- vira 23505, que `creditar-upsell` trata como "já entreguei".
create unique index if not exists videos_um_por_pedido
  on public.videos (pedido_id) where pedido_id is not null;

create index if not exists videos_email_idx on public.videos (lower(email));
create index if not exists videos_musica_idx on public.videos (musica_id);

-- Nada de leitura direta pelo cliente: quem lê é server function com o
-- token_edicao conferido.
alter table public.videos enable row level security;
revoke all on public.videos from anon, authenticated;

comment on table public.videos is
  'Um vídeo-presente (fotos + música + letra sincronizada). Nasce na compra do '
  'upsell e acompanha o render até o MP4 existir no bucket videos.';

-- ── Bucket dos vídeos ────────────────────────────────────────────
-- PRIVADO pelo mesmo motivo do bucket de fotos: é a família de gente real.
-- 200 MB de teto folgado: o render sai em 720x1280, uns 15-25 MB pra uma
-- música de 3 minutos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 209715200, array['video/mp4'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
