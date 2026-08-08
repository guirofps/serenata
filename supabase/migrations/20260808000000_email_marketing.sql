-- ENCANAMENTO DO E-MAIL DE RECUPERAÇÃO.
--
-- Três coisas que precisam existir ANTES do primeiro disparo, não depois:
-- descadastro, lista de exclusão e registro do que já foi enviado. Fluxo de
-- e-mail sem elas não é fluxo, é fonte de reclamação de spam.

-- ── QUEM NÃO QUER MAIS ───────────────────────────────────────────
-- Por E-MAIL e não por sessão: a pessoa que se descadastra quer parar de
-- receber, não parar naquele quiz. Uma linha cobre todas as sessões dela,
-- inclusive as futuras.
create table if not exists public.descadastros (
  email text primary key,
  motivo text,
  created_at timestamptz not null default now()
);

alter table public.descadastros enable row level security;

-- O descadastro é feito por link no e-mail, sem login. O anônimo precisa
-- poder INSERIR (é o clique dele), mas nunca LER — senão a tabela vira uma
-- lista de e-mails de clientes aberta na internet.
drop policy if exists "anon descadastra" on public.descadastros;
create policy "anon descadastra" on public.descadastros
  for insert to anon with check (true);

comment on table public.descadastros is
  'Quem pediu para não receber mais. Checado antes de QUALQUER envio de recuperacao.';

-- ── QUEM NUNCA DEVE RECEBER ──────────────────────────────────────
-- Cortesias, e-mails internos, testes. A mãe do dono recebeu a música de
-- graça e apareceria na lista de "não comprou" pedindo pra finalizar a
-- compra — é o tipo de erro que só aparece depois de enviado.
create table if not exists public.excluidos_email (
  email text primary key,
  motivo text not null,
  created_at timestamptz not null default now()
);

alter table public.excluidos_email enable row level security;

comment on table public.excluidos_email is
  'Cortesias, contas internas e testes. Nunca entram em disparo de recuperacao.';

insert into public.excluidos_email (email, motivo) values
  ('priscilarojas36@gmail.com', 'cortesia — mãe do dono'),
  ('agenciarocketfy@gmail.com', 'conta do dono'),
  ('guilhermerojasiqueira@gmail.com', 'conta do dono')
on conflict (email) do nothing;
