-- QUAL E-MAIL FOI ESSE: a ponte entre o envio e os eventos do Resend.
--
-- ── O QUE QUEBROU ────────────────────────────────────────────────
--
-- Em 19/08 eu marquei todo envio com `tags: [{name:"template"}]`, contando que
-- o Resend devolvesse a etiqueta nos eventos de entrega, abertura e clique.
-- Ele não devolve: conferido em 25/08, os 10.172 eventos dos últimos quatro
-- dias vieram todos com `template: null`.
--
-- Sem isso não dá pra saber qual e-mail performa. A escada de recuperação tem
-- DEZ degraus, e medir os dez como um bloco só é o mesmo que não medir.
--
-- ── POR QUE NÃO CLASSIFICAR PELO ASSUNTO ─────────────────────────
--
-- Dá pra deduzir o template do assunto, e foi o que fiz pra ter algum número.
-- Mas é frágil de dois jeitos: o assunto carrega o nome do homenageado (então
-- cada envio é uma string diferente), e no dia que alguém melhorar a copy a
-- classificação quebra em silêncio, sem ninguém notar que o relatório passou a
-- mentir.
--
-- O `email_id` é estável: o Resend devolve no envio e repete em todo evento do
-- ciclo de vida. Guardar o par (id, template) no instante do envio é a única
-- ligação que não depende de texto.

create table if not exists public.emails_enviados (
  -- O id do Resend. É a chave: um envio, uma linha.
  email_id text primary key,
  template text not null,
  para text,
  -- De quem é, quando dá pra saber. Serve pra cruzar com venda depois.
  quiz_response_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists emails_enviados_template_idx
  on public.emails_enviados (template, created_at desc);

-- Ninguém lê isto do cliente: é tabela de operação, e liga e-mail a pessoa.
alter table public.emails_enviados enable row level security;
revoke all on public.emails_enviados from anon, authenticated;

comment on table public.emails_enviados is
  'Par (email_id, template) gravado no envio. O webhook do Resend resolve o '
  'template por aqui, porque o Resend não ecoa as tags nos eventos.';
