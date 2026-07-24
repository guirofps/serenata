-- Personalização da página-presente: foto de capa e dedicatória.
--
-- ── A decisão de segurança que estrutura tudo ────────────────────
-- O `token` já existente é PÚBLICO por natureza: ele vai colado no WhatsApp
-- do presenteado. Se ele também autorizasse edição, quem GANHA o presente
-- poderia alterá-lo — inclusive trocar a foto e a dedicatória.
--
-- Por isso um SEGUNDO token, `token_edicao`, que só o comprador recebe na
-- área dele. Um lê, o outro escreve. Não é possível derivar um do outro.
--
-- É a mesma lição do CLAUDE.md sobre os repos antigos ("admin_session=true
-- como cookie forjável"): autorização não pode depender de algo que o
-- usuário já tem nas mãos por outro motivo.

alter table public.musicas
  -- Credencial de ESCRITA. Nullable porque as músicas que já existem não
  -- têm; o backfill abaixo preenche.
  add column if not exists token_edicao text unique,
  -- Caminho no bucket privado `fotos` (servido por URL assinada, igual ao
  -- áudio — nada de bucket público com foto de família dentro).
  add column if not exists foto_path text,
  -- Uma linha escrita pelo comprador, exibida na capa.
  add column if not exists dedicatoria text,
  -- Quando a pessoa publicou a personalização. Null = nunca editou, e a
  -- página mostra o estado padrão.
  add column if not exists personalizada_em timestamptz;

-- Backfill: gera token de edição para o que já existe, senão as músicas
-- criadas antes desta migration ficariam impossíveis de personalizar.
update public.musicas
set token_edicao = encode(gen_random_bytes(16), 'hex')
where token_edicao is null;

alter table public.musicas alter column token_edicao set not null;
alter table public.musicas
  alter column token_edicao set default encode(gen_random_bytes(16), 'hex');

-- Busca por token de edição precisa ser tão rápida quanto por token público.
create index if not exists musicas_token_edicao_idx on public.musicas (token_edicao);

-- Limite de tamanho da dedicatória no BANCO, não só na interface: quem
-- chama a API direto não passa pela validação do front.
alter table public.musicas
  add constraint dedicatoria_curta check (dedicatoria is null or char_length(dedicatoria) <= 280);

-- ── Bucket das fotos ────────────────────────────────────────────
-- PRIVADO. São fotos de família de gente real; bucket público seria
-- enumerável por quem descobrisse o padrão do caminho.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos',
  'fotos',
  false,
  5242880, -- 5 MB: foto de celular cabe, arquivo de câmera profissional não
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sem policy de storage para anon: todo upload e leitura passa pelo
-- servidor com service role, que valida o token_edicao antes.
