# Plano de implementação

Ordenado por **risco**, não por dependência técnica. A hipótese mais frágil
do projeto é validada na Fase 1, antes de existir pipeline de música,
checkout ou página presente.

---

## Fase 0: fundação

**Objetivo:** repositório rodando em produção com uma página vazia.

- TanStack Start + Vite 7 + Tailwind v4 + shadcn/ui (mesma stack dos repos
  anteriores, já dominada)
- Supabase novo: projeto, tabelas `quiz_responses`, `funnel_events`,
  `pedidos`, `musicas`
- Vercel região `gru1`, prerender só da home
- Inngest configurado e **subindo** (nos dois repos anteriores ele está
  quebrado por import de arquivo inexistente; confirme que `/api/inngest`
  responde antes de seguir)

**Copiar agora:**
- `src/lib/session-context.ts` e `src/lib/track.ts` (quase sem editar)
- `supabase/migrations/20260617000000_*` (RLS) e `20260618000000_*` (RPC)

**Regras que valem desde a primeira linha:**
- Um lockfile só. Escolha e apague o outro.
- `tsconfig` inclui `api/` e `inngest/`, não só `src/`. Nos repos anteriores
  3.100 linhas de backend ficaram fora do type-check.
- Nenhum endpoint sem autenticação. Nenhum.
- Índice do passo do quiz **na URL** (`?step=3`), não em `useState`.

---

## Fase 1: quiz, letra e karaokê

**Objetivo:** validar a hipótese central. A letra bem apresentada segura a
emoção sozinha?

- Motor `FLOW` declarativo extraído de `exact/src/routes/quiz-b.tsx:98-571`,
  como módulo próprio (`src/lib/flow-engine.ts`), não dentro da rota
- Skip condicional **por id**, nunca por offset numérico
- Captura parcial de lead a cada passo via RPC (já copiada na Fase 0).
  Isso é vantagem competitiva direta: a Cantoria não salva nada até o submit
  final e perde 100% de quem abandona no meio.
- Campo de história com **gravação de áudio** (`MediaRecorder`, gravando
  `audio/webm` no Chrome/Android e `audio/mp4` no Safari/iOS) + transcrição
  server-side. É o passo de maior abandono e o que mais melhora o insumo.
- Geração da letra: ver `prompts/letra.md`. Dispara **na tela de revisão**,
  antes do submit, para roubar os segundos que a pessoa gasta conferindo.
- **Karaokê:** base instrumental gravada por gênero (custo zero, sem geração)
  + letra sincronizada. O botão "vamos lá" precisa ser o próprio gesto que
  dispara o áudio, senão o iOS bloqueia.
- Uma refação grátis, com o botão de comprar visível ao lado (não é portão)

**Fake door no fim:** o botão "quero ouvir ela cantada" ainda não leva a
checkout. Leva a "estamos abrindo aos poucos, deixa seu WhatsApp". Isso mede
intenção de compra real sem construir a metade de trás do produto.

**O que medir:** taxa de conclusão do quiz, uso do botão de áudio, uso da
refação, e principalmente **cliques no fake door**. Se pouca gente clicar
depois de ler a letra, o problema é a hipótese, não a execução, e nada do
que vem depois resolve.

---

## Fase 2: pipeline de música

**Objetivo:** produzir a música de forma confiável, ainda sem checkout.

- Adaptar `exact/api/generate-face.js:294-345`: mesma estrutura de polling,
  trocando Replicate por Suno, `sharp` por `ffmpeg -map_metadata -1`, bucket
  `faces` por `musicas`
- Job Inngest no formato de `generateReportJob.js`: letra → música → entrega,
  com o passo de mídia tolerante a falha
- **Gatilho na conclusão do quiz**, não no pagamento
- Dois provedores com failover **testado de verdade** (derrube o primário e
  confirme que o segundo assume; a Cantoria tem failover configurado e mesmo
  assim travou 6 minutos no teste)
- Portões automáticos de qualidade antes de liberar: duração dentro do
  esperado, arquivo não está mudo, tamanho plausível. Regenera sozinho se
  falhar. Isso substitui a escuta manual que o ticket de R$ 37 não paga.
- Entrega manual pros primeiros pedidos, para calibrar qualidade antes de
  automatizar a cobrança

**O que medir:** tempo real do clique até o arquivo pronto (p50 e p95), taxa
de falha por provedor, quantas regenerações o portão de qualidade dispara.

---

## Fase 3: checkout e página presente

**Objetivo:** vender.

- Gateway BR com API: Asaas, Pagar.me ou Appmax. **Não** plataforma de
  infoproduto, **não** Stripe.
- PIX transparente: cria cobrança, mostra QR Code e copia-e-cola na própria
  página, faz polling do status
- Webhook adaptado de `numaya/api/webhook/cakto.js`, **corrigindo o
  fail-open**: se a env do secret não estiver setada, recuse tudo
- Idempotência por id de pagamento. Sem fallback por "mais recente".
- Recuperação de PIX abandonado por WhatsApp em 15 e 60 minutos
- **Página presente:** rota por token (`src/routes/p.$token.tsx`), que não
  existe em nenhum dos dois repos anteriores. Conteúdo mínimo: capa, nome,
  player da música, letra na tela, a história em texto, uma foto, QR Code.
- QR Code gerado no servidor, pronto para imprimir
- Agendamento: o comprador escolhe quando o presenteado recebe (é onde a
  antecipação cabe, e coleta um lead novo)

**Promessa de entrega:** "em até 30 minutos, normalmente menos de 5". Nunca
prometer 60 segundos.

---

## Fase 4: monetização

**Objetivo:** levar o AOV de R$ 37 para ~R$ 51.

- Order bump: fotos na página + QR Code (+R$ 19,90)
- Upsell 1-clique: vídeo com as fotos e a música (+R$ 24,90)
- Vitalício vs 30 dias (+R$ 5, custo zero, truque do Lovepanda)
- Ligar o Meta CAPI (`sendMetaCapiPurchase.js`, que está morto nos dois
  repos: nem registrado no `api/inngest.js`)
- Painel de drop-off por passo, adaptado de `admin.funil.tsx`, **com
  autenticação de verdade** (token assinado, não `admin_session=true`)

**Não vender entrega expressa.** Se o padrão já é rápido, cobrar por
prioridade é vender fumaça, e no Google Ads derruba conta.

---

## Ordem de risco

| # | Risco | Fase que resolve |
|---|---|---|
| 1 | A letra não segura a emoção sozinha | 1 (fake door) |
| 2 | O pipeline de música não é confiável | 2 |
| 3 | Ninguém paga R$ 37 | 3 |
| 4 | CAC não fecha com o ticket | 4 |

Cada fase só começa quando a anterior respondeu a pergunta dela. A Fase 1
inteira pode ser jogada fora barato se a resposta for não, e é por isso que
ela vem antes de tudo.
