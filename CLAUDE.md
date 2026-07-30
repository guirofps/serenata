# Música personalizada (nome provisório)

Funil de presente digital: a pessoa conta a história de alguém querido, recebe
a **letra de uma música na hora e de graça**, e paga para ouvir essa letra
cantada numa **página presente** com link e QR Code.

Tráfego alvo: Google e YouTube (Brasil). Ticket alvo abaixo de R$ 50.

> Este arquivo guarda as decisões já tomadas e a pesquisa de concorrência.
> Leia antes de propor arquitetura.

## Visão: plataforma, não funil

O funil é a porta de entrada. O destino é uma **plataforma de criação de
presenteáveis online**, com a música como entregável mais forte — e, mais
adiante, possivelmente um aplicativo.

O que isso quer dizer na prática:

1. A pessoa compra e **entra na plataforma**.
2. Lá dentro ela tem **a página dela**, que ela **customiza pós-compra**:
   sobe as fotos, ajusta o conteúdo.
3. A plataforma gera o **link com token no nosso domínio** e uma **mensagem
   pronta** pra ela copiar e mandar.
4. Abaixo, o **download do arquivo** (MP3 da música; vídeo depois).
5. Com o tempo, **mais planos e produtos**: cobrança antes, cobrança depois,
   e **cobrança por geração** (créditos).

Consequência arquitetural — o que isso exige e ainda NÃO existe:

- **Contas de comprador** (hoje o funil é 100% anônimo, sem login).
- **A página como documento editável**, não como render de uma vez só: o
  `/p/$token` é a *publicação* de algo que o dono edita.
- **Multi-produto / multi-plano**, com créditos por geração.
- Uma camada visual à altura: numa plataforma, o design não é enfeite,
  é o produto.

Ordem que isso impõe: identidade visual e modelo de dados de "presente"
vêm ANTES de construir a página de entrega.

## A tese central

Os concorrentes erram em pontos opostos e a oportunidade está no meio:

- Quem entrega **só a música** tem problema de entrega: MP3 não se presenteia.
  O comprador precisa construir um momento (o clássico vídeo de reação no
  carro), e a maioria nunca constrói.
- Quem entrega **só a página** não tem alma: a música é genérica, escolhida
  de um catálogo.

**A página é o presente. A música original é o que faz ela não ser igual às
outras.** A página não é upsell, é a embalagem sem a qual o produto não se
entrega.

## Arquitetura do funil

```
Quiz (com opção de gravar áudio em vez de digitar)
  → LETRA pronta em ~6s, grátis          [Claude, texto não falha]
  → Karaokê: base instrumental do gênero + letra sincronizada
  → 1 refação grátis (vira coautoria, aumenta conversão)
  → em paralelo e escondido: a MÚSICA já começa a gerar
  → paga
  → desbloqueio instantâneo (o arquivo já existe)
  → página presente com link + QR Code
```

### Regra que não pode ser quebrada

**Nunca cobrar por algo que ainda não foi produzido.** A música gera antes do
pagamento, enquanto a pessoa lê a letra. Se o provedor travar, a falha vira
prejuízo pré-venda (~R$ 0,35) em vez de reembolso, suporte e avaliação ruim.

Custo de gerar para quem não compra: a 20% de conversão, ~R$ 1,75 por venda.
É o melhor dinheiro do funil, porque compra a eliminação da maior fonte de
prejuízo.

### Paywall

Letra de graça. Música paga. Fronteira limpa, honesta, fácil de comunicar.

## Pesquisa de concorrência (verificada, julho/2026)

### foreversongs.com.br

- **Gerador: Suno**, confirmado pela tag ID3 do MP3 de exemplo, que eles
  esqueceram de limpar: `made with suno; id=4acbd888-...`
- Provável white-label/clone do **Legacy Jukebox** (assets vêm de um repo
  `btclending/legacyjukebox-assets`)
- Quiz de 8 passos, e-mail capturado no fim, preço só depois
- Prazos contraditórios no mesmo funil: "Pronto em 1h" no hero, "24 horas"
  no passo 4, "poucos dias" no studio. O 1h é upsell pago vendido como padrão.
- Prova social americana traduzida: "VISTO EM ABC, FOX, NBC, CBS" numa página
  `.com.br`, depoimentos assinados Desmond, Synita, Paul, Brandy
- O player de exemplo da tela de revisão não toca (trava em `readyState 0`)

### cantoria.live

Referência técnica principal. Stack: Lovable + React + **Supabase** +
TanStack Start. Painel admin exposto no bundle público (erro deles).

- **Gerador: Suno v5.5** via revendedores **não oficiais**: SunoAPI.org
  (primário) e Apiframe (failover automático)
- Custo interno: **R$ 0,35 por prévia**, taxa de gateway R$ 0,49 por venda
- Preço: **R$ 29,90** (ancorado em R$ 89,90), upsell de vídeo R$ 9,90
- Pagamento PIX via **Asaas**
- Modelo: "Escute antes de pagar, prévia em 60s, só R$ 29,90 se amar"
- Rodam também ManyChat e Instagram DM (`?mc=` e `?ig=` no submit)

**O que funciona neles (copiar):**
- Geração da letra começa na tela de revisão, antes do submit. Rouba os
  segundos que o usuário gasta conferindo.
- `[Short Intro - máx 8s]` na letra: chega rápido na parte personalizada
- Campo de e-mail sugere domínios (@gmail, @hotmail) enquanto digita
- Opção "Falar por áudio" no campo de história

**O que quebra neles (evitar):**
- Prometem prévia em 60s. No teste medido: **>6 minutos e ainda `pending`**
- Barra de progresso é teatro: chega a 99% em 70s e fica girando frases
  falsas ("afinando o violão") por minutos enquanto o backend não tem nada
- Nenhuma chamada de rede antes do submit final: quem abandona no meio não
  vira lead nenhum, sem captura parcial nem remarketing por etapa
- Injetam o nome do comprador na letra sem sanitizar (saiu literalmente
  "Que o Teste não cansa de amar" no teste)

### lovetuneoficial.com.br

**O concorrente escalado de verdade no BR.** Análise completa em
`docs/analise-lovetune.md`. O mais sofisticado dos quatro.

- **Gerador: Suno** (confirmado no bundle), client-orquestrado com polling e
  **fallback via Supabase Edge Function**. Stack: Supabase + React + Vite.
- **Checkout: Wiapy** (Stripe "em breve" pra internacional). Atende PT, EN e ES.
- **Preços: R$ 67 / 87 / 97** (Master inclui vídeo com legenda). Cupom AMOR10.
  Bem acima do nosso alvo — dá pra entrar por baixo.
- **Diferencial forte (copiar): letra coautorada por partes.** O usuário
  escolhe entre opções de estrofe → ponte+refrão → verso final, com 1 regen
  grátis por seção, depois edita a letra e pode "aprimorar com IA" — tudo
  antes de pagar. É a nossa "coautoria" levada muito mais fundo que "1 refação".
- **Prévia de ÁUDIO grátis** (2 versões, "até 1 minuto"). Diverge da nossa
  aposta (letra grátis / áudio pago): revisitar se prévia de áudio converte
  mais, sabendo que custa Suno em toda prévia mesmo pra quem não compra.
- **Validação anti-lixo dura** (história mín. 150 chars, frases reais,
  palavras variadas) + detecção de relacionamento por regex pra gênero.
  Copiar: história ruim = letra ruim, e eles blindam isso.
- **Foto opcional, pós-letra** (fundo do vídeo) — confirma nossa decisão.
- **Não têm página-presente compartilhável** (entregam música/vídeo). É onde
  a gente se diferencia com a pegada Lovepanda.

### lovepanda.com.br

Não é concorrente direto, é o modelo de **embalagem**.

- Página digital com fotos, retrospectiva animada estilo Wrapped, timeline
- Entrega link + QR Code na hora
- R$ 24,90 (24h) e R$ 29,90 (vitalício), ancorados em R$ 39,90 / R$ 69,90
- Custo de entrega deles é praticamente zero (não geram nada)

**Roubar:** cobrar por permanência (a diferença entre os planos é só por
quanto tempo a página fica no ar, custo marginal zero) e o QR Code impresso
colado numa caixa de bombom, que transforma digital em físico sem logística.

**Não construir:** retrospectiva animada, timeline, álbum interativo,
galerias. Aquilo é o negócio deles, feito há mais tempo e com custo zero.

## Economia unitária (ticket R$ 37)

| | |
|---|---|
| Letra — uma tacada (Claude Sonnet 5) | R$ 0,06 (medido) |
| Letra — coautorada em 4 etapas (modelo LoveTune) | R$ 0,22 (medido, ~2x com refações) |
| Música (Suno via kie.ai, 12 créd = 2 versões) | R$ 0,32 (medido) |
| Transcrição de áudio | R$ 0,05 |
| Gerações pré-venda (5 por venda a 20% conv.) | R$ 1,75 |
| Checkout (~5% + fixo) | R$ 2,30 |
| **Margem bruta** | **~R$ 33** |

**Custo da letra MEDIDO de verdade** (22/07, chamadas reais ao Sonnet 5,
`scratch/medir-custo-letra.mjs`), não estimado: uma tacada R$ 0,06; coautorada
em 4 etapas R$ 0,22 (o cache do system prompt de ~1.200 tokens corta a maior
parte). Mesmo a coautorada com 1 refação por seção fica < R$ 0,50 — **o Claude
não é o custo relevante do funil; o Suno é.** Decisão registrada: adotar a letra
coautorada (mais validada, prende mais), o custo extra é irrelevante.

**A R$ 37 não cabe revisão humana** (6 min de trabalho = R$ 5 = 13% do
ticket). A operação precisa ser 100% automática, com portões de qualidade
programáticos no lugar da escuta manual.

Stack de upsell para levar o AOV a ~R$ 51:

| | Preço | Custo |
|---|---|---|
| Base: música + letra + página | R$ 37 | ~R$ 1 |
| Order bump: fotos na página + QR Code | +R$ 19,90 | ~zero |
| Upsell 1-clique: vídeo com as fotos | +R$ 24,90 | baixo |
| Vitalício vs 30 dias | +R$ 5 | zero |

**Não vender entrega expressa.** Se a entrega padrão é rápida, cobrar por
prioridade é vender fumaça, e no Google Ads isso derruba conta.

## Decisões tomadas

- **Provedor de música: kie.ai primário, sunoapi.org (ou Apiframe) failover.**
  Preço por geração (2 versões) quase idêntico — kie.ai $0,06 / sunoapi.org
  $0,055, mesma infra Suno v5. kie.ai vence por ser pay-as-you-go transparente
  a partir de $5 (sunoapi.org empurra assinatura mensal) e pelos extras baratos
  de karaokê: letra com timestamps $0,0025, separação de stems $0,05.
- **Canal de contato: só e-mail no lançamento.** Nada de WhatsApp no produto
  (nem captura, nem envio, nem recuperação) até existir automação que valha.
- **O comprador é quem entrega o presente.** A área do comprador dá o link
  da página com uma mensagem pronta pra copiar/colar + QR Code + download do
  MP3. Nós nunca mandamos nada direto pro presenteado.
- **Foto não entra no quiz.** É insumo da página, não da letra: entra na
  montagem do presente, pós-pagamento. 1 foto no base, galeria é order bump.

- **Entrega imediata após o pagamento**, mas **prometer conservador**:
  "em até 30 minutos, normalmente menos de 5". Nunca prometer 60 segundos.
- **Antecipação vai no agendamento**, não na entrega: o comprador recebe na
  hora, e escolhe quando o presenteado recebe (e isso coleta um lead novo).
- **Gateway BR com API** (Asaas, Pagar.me ou Appmax), não plataforma de
  infoproduto e não Stripe. O trabalho real não é a integração, é webhook
  confiável: idempotência por ID de pagamento, retry, nunca liberar sem
  confirmação.
- **Modelo de letra: Sonnet 5**, testar contra Opus 4.8. A diferença de custo
  é R$ 0,15; a letra é o produto inteiro, então decide por qualidade.
- **Sazonalidade:** alicerce em aniversário e homenagem (não sazonais), datas
  comemorativas tratadas como janela de escala, não como o negócio.

## Riscos conhecidos

1. **Dependência de revendedor não oficial do Suno.** Zona cinzenta nos termos
   (gerar para uso próprio é diferente de rodar serviço). Vale advogado antes
   de escalar, não antes de validar.
2. **Confiabilidade do pipeline é o maior risco de negócio**, não o custo.
   Mitigação: gerar antes de cobrar (acima), dois provedores com failover
   testado de verdade, portões automáticos de qualidade (duração, silêncio,
   idioma), fallback assíncrono por e-mail e WhatsApp.
3. **Google Ads é rígido em alegações.** Prova social a usar na home: as
   reações reais das pessoas que ouviram as músicas dos testes (`materiais/`),
   como "reações de quem ouviu uma música feita por nós".

## Higiene

- `ffmpeg -map_metadata -1` em todo áudio antes de publicar. Foi assim que
  descobrimos o gerador do ForeverSongs.
- Nada de rota administrativa no bundle do cliente. Segurança é RLS no
  Supabase, não rota escondida no front. Foi assim que lemos os custos e o
  provedor da Cantoria.

## Herança de código

Dois repositórios anteriores do mesmo dono servem de base. **São o mesmo
código em dois momentos**: `exact-screenshot-match` é o original (Mensagem
Angelical) e `numaya` é um fork dele. Mesma stack, mesmos utilitários,
mesmos bugs.

- `C:\Users\Guilherme Rojas\Desktop\exact-screenshot-match` (pipeline de IA)
- `C:\Users\Guilherme Rojas\Desktop\numaya` (gateway mais novo)

Stack dos dois, que vamos repetir: TanStack Start (React 19) + Vite 7 +
Tailwind v4 + shadcn/ui + Supabase + Inngest + Vercel (região gru1).

**Não forkar.** Projeto novo do zero, copiando arquivo por arquivo. Os dois
acumularam camadas sem apagar as anteriores (o numaya tem três funis vivos
mais a camada angelical inteira; o exact tem 41 scripts de debug versionados
que conectam no Supabase de produção com service role).

### Copiar (≈1.500 linhas de código maduro)

| O quê | Origem |
|---|---|
| Sessão, atribuição first-touch, `_fbp`/`_fbc`, A/B sticky | `src/lib/session-context.ts` (qualquer um) |
| `trackEvent` + `trackEventOnce` com dedup | `src/lib/track.ts` (qualquer um) |
| RPC `upsert_quiz_response` (`SECURITY DEFINER`, `GREATEST` no furthest_step) | `supabase/migrations/20260618000000_*` |
| Política RLS de funil (anon escreve, nunca lê) | `supabase/migrations/20260617000000_*` |
| Motor `FLOW` declarativo do quiz + type guards | `exact/src/routes/quiz-b.tsx:98-571` (extrair, descartar a rota) |
| **Pipeline de mídia assíncrona** | `exact/api/generate-face.js:294-345` |
| Esqueleto do job (IA texto → IA mídia → e-mail) | `exact/inngest/functions/generateReportJob.js` |
| Webhook idempotente ciente de entrega parcial | `numaya/api/webhook/cakto.js` |
| Reveal progressivo com máscara e blur | `exact/src/components/RetratoReveal.tsx` |
| Meta CAPI (está morto nos dois, é só ligar) | `inngest/functions/sendMetaCapiPurchase.js` |

**O achado principal:** `generate-face.js:294-345` é quase exatamente o
pipeline do Suno. Chama API externa, faz polling de 2 em 2 segundos, baixa o
binário, pós-processa, sobe no Supabase Storage. Troque Replicate por Suno,
`sharp` por `ffmpeg -map_metadata -1`, bucket `faces` por `musicas`.

### Não existe em nenhum dos dois (construir)

Gravação de áudio (`MediaRecorder`), player de áudio, upload de foto,
QR Code, **rota dinâmica por token** (nenhum `$param` em `src/routes/`, o
acesso lá é magic link), máscaras BR, e PIX transparente (os dois são
redirect puro pra checkout externo).

### Erros a não repetir

- `admin_session=true` como cookie de sessão admin, forjável por `curl`
- Webhook fail-open: `const secretOk = !secretEsperado || ...` aceita
  qualquer POST se a env não estiver setada
- Endpoints de IA públicos sem autenticação (`api/generate-report.js:630`,
  `api/generate-face.js:401`): qualquer um queima a conta
- Crons sem auth: dá pra spammar a base inteira e queimar o domínio
- Fallback "quiz anônimo mais recente dos últimos 7 dias" no webhook:
  entrega PII da pessoa errada sob concorrência. Falhe alto, não adivinhe.
- Índice do passo em `useState`, fora da URL: reload volta pro passo 0
- Skip condicional por offset numérico (`setIdx(idx + 4)`): quebra em
  silêncio quando alguém insere uma pergunta
- `catch {}` vazio nas gravações de lead: falha invisível

### Mudança arquitetural que nenhum dos dois tem

Nos dois, o job de geração dispara **no webhook de pagamento**. Aqui ele
dispara **na conclusão do quiz**, antes de cobrar. A máquina do Inngest é a
mesma, muda quem puxa o gatilho.

## Validado com teste real (23/07/2026)

Geração de ponta a ponta pelo kie.ai, com a letra do nosso próprio funil:

- **O Suno canta PT-BR convincente.** Julgamento do dono: "ficou no tom
  perfeito". Derruba a necessidade de testar ElevenLabs antes de validar.
- **O Suno SEGUE a letra: 95% de fidelidade medida** (18/19 linhas idênticas;
  a única divergência foi um artigo, "o" → "um").
  Consequência comercial: **o que a pessoa lê na prévia grátis é o que ela
  recebe pago** — a letra é prévia honesta, sem isca e troca.
- **Escrever a letra ANTES, sem conhecer a melodia, funciona.** O Suno adapta
  a melodia às palavras. Não é preciso inverter o fluxo.
- **Tempo real:** 84s a 110s do pedido ao arquivo (não os 60s que os
  concorrentes prometem). Confirma a promessa conservadora.
- **Custo real:** 12 créditos = R$ 0,32 por geração, que entrega 2 versões.
- **Karaokê com base instrumental foi DESCARTADO.** Sem melodia real à qual as
  palavras correspondam, a sincronia é teatro: não dá pra saber entonação nem
  onde cada verso entra. Pior que silêncio.
- **Karaokê REAL funciona**, com a letra sincronizada por timestamps da música
  cantada (`get-timestamped-lyrics`, 0,5 crédito ≈ R$ 0,013). Cada palavra
  acende no instante em que é cantada.
- **Duas músicas aprovadas pelo dono** (Camila/sertanejo universitário e
  Luiza/sertanejo, histórias e gêneros diferentes): a qualidade é consistente,
  não foi sorte de uma geração.
- **Pipeline completo ensaiado à mão** em `scratch/pipeline-completo.mjs`:
  respostas da sessão → letra (Claude) → música (Suno) → metadados limpos →
  timestamps. É o job da Fase 2, faltando só rodar no Inngest.

## Em aberto

- Nome e marca
- **Desenho do paywall**, agora que se sabe que a música fica boa e barata:
  quanto se ouve de graça (trecho? versão 1 completa?) e o que exatamente se
  paga (música completa + página presente + MP3 + QR). Testado: a letra
  sozinha, lida em silêncio, NÃO segura a emoção — a música segura.
- ElevenLabs como alternativa juridicamente sólida ao Suno: só vale
  investigar depois de validar demanda (o Suno já provou qualidade)
