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

## Preço: R$ 38 venceu R$ 54,90 (28/08/2026)

O braço E (R$ 54,90) rodou de 23 a 27/08 com metade do tráfego e foi **zerado
pelo peso** em 28/08. Não foi opinião:

| braço | leads na oferta | vendas | conversão | ticket | receita/lead |
|---|---|---|---|---|---|
| A · R$ 38 | 842 | 106 | 12,6% | R$ 37,66 | **R$ 4,74** |
| E · R$ 54,90 | 816 | 52 | 6,4% | R$ 54,90 | R$ 3,50 |

`z = 4,31` — não é sorte. O preço maior **derruba a conversão pela metade** e o
ticket não compensa: R$ 1,24 a menos por lead, uns **R$ 200/dia** com ~163
leads/dia caindo no braço E.

**A leitura que interessa é receita por lead, não conversão.** Preço maior
converte pior por definição; o que decide é se o ticket cobre a queda. Aqui não
cobriu, e nem perto.

**Zerado pelo PESO, não pelo `ativo`.** Desligar o experimento publicaria o
controle pra todo mundo de uma vez, e em 10/08 fazer exatamente isso publicou o
braço ERRADO pra 100% do tráfego. Consequência aceita: quem já tinha `E`
gravado no navegador continua vendo R$ 54,90 até trocar de aparelho, porque o
sorteio nunca reclassifica quem já foi sorteado. A cauda seca sozinha.

**Efeito colateral que contaminou a leitura de mídia:** durante esses cinco
dias metade do tráfego pagou um preço que converte na metade. O CPA que o Smart
Bidding aprendeu no período mistura os dois preços — campanha analisada com
dados de 23 a 27/08 carrega esse ruído.

**O próximo candidato NÃO é o R$ 29 por causa deste número.** O braço D marcou
R$ 4,95/lead, acima do A, mas está com peso 0 e só recebe visitante antigo
grudado: é coorte diferente, não comparação. Se for testar, testar com peso de
verdade contra o A.

## Checkout transparente (27/08/2026)

O PIX brasileiro saiu do checkout hospedado da Perfect Pay e passou a nascer
na nossa própria página, pela **Woovi**. Migrado de uma vez, 100%, na mesma
noite em que foi construído.

**Por que de uma vez.** A 10% seriam ~5 vendas/dia, e nesse volume um teste
leva dias pra dizer qualquer coisa (a conta é a mesma que matou a ideia de
failover por conversão). Comparar com a semana anterior é a leitura mais
rápida disponível. Decisão do dono, com a conta na mesa.

**Os dois ganhos, medidos:**

| | |
|---|---|
| Taxa Perfect Pay | 11,39% (R$ 4,63 de média, n=6 com dado real) |
| Taxa Woovi | 0,8% com piso de R$ 0,50 → **R$ 0,50** no ticket de hoje |
| Volume de PIX | ~55/dia → economia de **~R$ 5.500/mês** |
| Quem clica em comprar e não gera pedido | **70%**, uns 250/dia — é o que a troca de domínio ataca |

**Cartão continua na Perfect Pay**, e não é detalhe: 12,8% das vendas, R$ 4.498
em 17 dias, uns **R$ 8.000/mês**. Sai pelo botão "Pagar com cartão" da folha
do PIX, que é botão de verdade e não link de rodapé — o dinheiro que ele
carrega não cabe num rodapé. Quando o Asaas aprovar, o cartão vira
transparente também, por um contrato `GatewayCartao` separado.

**Fora do transparente, por moeda e não por gosto:** o funil espanhol (cobra
em dólar) e quem chega com cupom da recuperação (o desconto existe como
produto da Perfect Pay, e o e-mail já prometeu aquele número).

### Invariantes deste caminho

- **O preço NUNCA vem do cliente.** Sai do braço de `preco` que aquela sessão
  sorteou, lido no servidor (`criar-pix.ts`). Se viesse do navegador, o
  DevTools levaria um produto de R$ 54,90 por R$ 1.
- **A Woovi NÃO é idempotente no `POST /charge`**, apesar de chamar o
  `correlationID` de identificador único: repetir devolve
  `400 Já existe uma cobrança com este Correlação ID`. A idempotência é
  NOSSA — o 400 de duplicata cai num `GET /charge/{id}`, com trava de valor e
  de status. Sem isso, fechar e reabrir a folha dava erro em cima de uma
  cobrança que existia (`woovi-idempotencia.test.ts` segura a mensagem deles).
- **Duas travas no webhook, e não é redundância.** A assinatura RSA-SHA256
  prova ORIGEM; só a reconsulta na API prova PAGAMENTO. Um postback legítimo
  pode chegar por um evento que não é pagamento.
- **O webhook é UM, registrado na conta**, não por cobrança. Consequência:
  não dá pra ter preview e produção recebendo ao mesmo tempo com uma conta só.
- **A entrega mora em `api/lib/entrega.ts`**, não copiada. O bloco gêmeo
  dentro do webhook da Perfect Pay ficou de pé com aviso escrito, e vira
  chamada ao módulo quando o cartão migrar. Conserto num tem que ir no outro.
- **`checkout_pix` é interruptor, não teste.** Desliga pelo `ativo` no painel,
  NUNCA pelo peso: só o `ativo` vence o sorteio já guardado no navegador da
  pessoa, porque sem experimento ativo o `<html>` não recebe carimbo e
  `varianteDe` devolve o controle.
- **`/pix/<referência>` existe pra o e-mail não mentir.** O e-mail de PIX
  abandonado (39/dia) promete "o seu código continua valendo, é o mesmo que
  você gerou"; sem essa rota ele mandaria a pessoa gerar um código novo. A
  rota só LÊ pedido pendente — rota pública que cria cobrança seria um jeito
  de encher a conta da Woovi de PIX morto.
- **A home é pré-renderizada e nasce inerte**, então `page_view` de lá sai sem
  carimbo de experimento. O carimbo entra no `Quiz` (`carimbarExperimentos`),
  que é antes do checkout. Ver isso e concluir "o experimento não está
  pegando" é um falso alarme já cometido.

## Venda brasileira sai SÓ pelo Asaas (26/09/2026)

Decisão do dono, depois que o Asaas entrou em manutenção programada (01h07 a
01h47 de 26/09) e o plano B mandou 5 vendas pra Perfect Pay a 11,39% de taxa.
Substitui o "cartão continua na Perfect Pay" da seção acima.

- **Nenhum caminho do funil brasileiro leva mais à Perfect Pay.** Erro ao gerar
  o PIX mostra "Tentar de novo" (repete o mesmo pedido) e "Pagar com cartão",
  que é o formulário do Asaas. O cartão não tem mais volta pro checkout
  antigo quando o Asaas não responde (`criar-cartao.ts`).
- **O `checkout_pix` deixou de ser saída.** O funil `pt` abre sempre o
  transparente; desligar o experimento não devolve ninguém pra Perfect Pay.
- **O cupom da recuperação (SRN27) é aplicado pelo servidor**
  (`centavosComCupom`, `cupom.ts`), no PIX e no cartão. Só o código viaja do
  cliente; o valor sai do catálogo, e o cupom nunca sobe o preço.
- **Upsell (extra, quadro, vídeo): PIX ou cartão, os dois pelo Asaas** (dono,
  02/10: "100% Asaas, o que o cliente preferir"). Cartão em
  `criar-cartao-upsell.ts`: pedido nasce pendente com a referência
  `up:<oferta>:<uuid>` ANTES de cobrar, e o crédito sai na hora (o webhook sai
  cedo com pedido pago). A oferta da recuperação (`/oferta/<token>`) segue só PIX.
- **Fica na Perfect Pay, por moeda:** o funil espanhol, cobrado em dólar. O
  Asaas não cobra dólar.
- Consequência aceita: com o Asaas fora, a venda espera ele voltar (a pessoa
  tenta de novo, e o lead já está na régua de recuperação) em vez de escorrer
  pra outro gateway.

## A prévia sai aos 30s, não aos 120s (30/08/2026)

O provedor devolve **duas** URLs de áudio e a gente só usava a segunda.
Medido com duas gerações reais pela kie.ai:

| | |
|---|---|
| `streamAudioUrl` aparece | **22s a 32s**, e já serve áudio tocável |
| `audioUrl` (o MP3 final) aparece | 57s a 74s |
| espera média que o cliente via | 93s a 122s |

O concorrente entrega prévia em 30 a 40 segundos. A diferença **nunca foi
fornecedor, crédito nem infraestrutura**: era qual das duas URLs se usa. As
duas vêm na mesma resposta que a gente já recebia. Descartada a ideia de
testar outro revendedor por causa disso.

**O que NÃO mudou, de propósito:**

- O status só vira `pronta` quando o arquivo LIMPO está no nosso Storage. É
  ele que o comprador leva e é ele que libera o checkout.
- A revelação do karaokê continua no fim, com os timestamps que só existem
  depois do arquivo final. Nada de player trocando de `src` no meio da
  escuta.
- A prévia entra ACIMA do WhatsApp e das músicas dos outros: se o próprio
  presente já toca, não faz sentido oferecer distração antes dele.

**A prévia passa por `/api/previa/<id>`, nunca pela URL do provedor**, e a
rota **corta a tag ID3** antes de entregar. As duas coisas pelo mesmo motivo,
e a segunda quase passou batido: o MP3 do stream vem com
`comment = made with suno; id=...` dentro. É exatamente a tag que denunciou o
ForeverSongs. Esconder a URL e servir o arquivo cru não esconderia nada.

Sem `ffmpeg` (não existe naquela função, e invocá-lo comeria o ganho de
tempo): ID3 é cabeçalho no começo e rodapé de 128 bytes no fim, e cortar os
dois é aritmética de buffer. Medido no arquivo real: 4.458.486 → 4.458.336
bytes, zero tags, áudio íntegro (177,08s antes e depois).

Consequência: a rota não aceita `Range` (`Accept-Ranges: none`). Cortar bytes
do começo desloca todo offset, e o pedaço que o navegador pede deixaria de ser
o que ele recebe.

## O Inngest caiu, e o alarme caiu junto (04/09/2026)

Das **15h11 às 16h09**, o Inngest ficou em "Degraded Function Execution"
(incidente de impacto major na status page deles). O formato da falha é o mais
traiçoeiro possível: ele **aceitava os eventos com HTTP 200 e não criava
execução nenhuma**. `POST /e/<key>` respondia 200, o evento aparecia em
`/v1/events`, e `/v1/events/<id>/runs` devolvia lista vazia pra todos.

Tudo do nosso lado estava de pé, e conferido um por um: créditos na kie.ai
(8.745), geração manual funcionando em 130s, `PUT /api/inngest` respondendo
`"Successfully registered"`, disjuntor com teto 2500 e contador em 571.
**Nada era nosso.** Voltou sozinho no minuto em que eles disseram ter
consertado, drenando a fila inteira.

| | |
|---|---|
| Músicas paradas | 25 |
| Espera pela música, mediana | 112s → **1.412s** (pior caso 2.921s) |
| Folhas de PIX abertas por hora | 10 a 23 → **4** e depois **3** |
| Comprador pago sem entrega | 1, que abriu contestação no mesmo dia |

**O erro que era nosso:** o alerta pra exatamente isso existia (`vigiaGeracao`,
cron de 10 em 10 minutos) e não disparou, porque **ele é um cron do Inngest**.
Detector de incêndio ligado na tomada que pegou fogo. O dono ficou sabendo por
um print de disputa que um cliente abriu.

### Invariantes que nasceram daqui

- **Vigia não roda dentro do vigiado.** `api/vigia-externo.ts` roda em Vercel
  Cron e fala direto com o Supabase. Pra ele calar a boca, Vercel e Supabase
  precisam cair juntos — e aí o site já está fora e se descobre por outro
  caminho. O `vigiaGeracao` continua existindo: ele CONSERTA redisparando, o
  que só faz sentido com o Inngest vivo.
- **O quarto sinal olha o RELÓGIO, não a fila.** Os três anteriores
  (`nada-saiu`, `fila-grande`, `provedor-recusando`) dependem de a fila
  engordar ou de algo falhar. Numa queda do orquestrador **nada falha** e a
  fila leva minutos pra crescer. O que morre na hora exata é o relógio da
  última música pronta: `orquestrador-mudo` acende com 25 minutos sem nenhuma
  música ficar pronta HAVENDO letra nova (sem tráfego ele dorme, igual aos
  outros). A leitura mora em `src/lib/sinais-geracao.ts`, pura, porque os dois
  vigias precisam dela e importá-la de dentro do job traria o Inngest junto.
- **O vigia externo NÃO redispara.** Durante uma queda, redisparo só empilha
  evento que ninguém consome, e quando o serviço volta ele despeja a fila
  dobrada em cima do provedor — pagando duas vezes pela mesma música. Ele só
  grita. Gritar é o que faltava.
- **No plantão, só quem PAGOU.** `scratch/plantao-musica.mjs` roda
  `socorro-musica.mjs` em laço, e só pra pedido pago. Prévia parada custa
  R$ 0,32 e se resolve sozinha quando o serviço volta; comprador parado vira
  contestação. Gerar a fila inteira na mão durante a queda seria pior que não
  gerar, porque os eventos do Inngest continuam enfileirados e ele gera tudo
  de novo quando voltar.

## Vídeo-presente (24/09/2026)

Upsell de R$ 24,90: as fotos da página passando no ritmo da música, com a
letra acendendo palavra por palavra. Remotion (`video/src/`), render na AWS
Lambda (us-east-1), job `inngest/functions/renderizarVideo.ts`.

**A página e o vídeo são a mesma montagem.** O bloco do vídeo mora DENTRO do
editor, entre a dedicatória e a entrega, com a prévia TOCANDO pelo
`@remotion/player`: a mesma composição da Lambda, com as fotos e a frase ao
vivo do editor e a marca "PRÉVIA". Ela vê o que compra antes de pagar, a
custo zero.

### Invariantes

- **Uma cópia só do Remotion, na raiz.** `video/` não tem package próprio
  (tinha React 18 e o app tem 19: duas cópias quebram hooks). Estúdio e
  deploy: `npm run video:estudio | video:site | video:funcao`. Mudou o
  template, **rodar `video:site`**: o site no S3 é o que a Lambda usa.
- **Conta nova da AWS: cota de 10 Lambdas simultâneas**, sem aumento pela
  API (a conta é sub-conta de organização, pedido só pelo console). Por isso
  6 Lambdas por render e 1 render por vez (8+1 deu `Rate Exceeded`). Com a
  cota maior, subir `LAMBDAS_POR_RENDER` e o `concurrency` do job. Medido:
  3min32 de música em 200s, US$ 0,041.
- **Letra entra 0,45s ANTES de cantar** e palavra sustentada apaga em 2,2s.
  Sem isso a letra parece atrasada e fica acesa o solo inteiro.
- **"Atualizar meu vídeo" é por assinatura** (`assinatura-video.ts`) das
  entradas: CAMINHO da foto no Storage, nunca URL assinada (muda a cada
  carregamento). Grátis, teto de 5. Atualização que falha devolve o vídeo
  anterior. Arquivo novo a cada render: com o mesmo nome o CDN serve o velho.

## GA4 (01/10/2026)

Propriedade `G-E2EKHK3RQF`, destino da mesma tag do Ads (`GT-5TWGDWC6`).
Código em `src/lib/ga4.ts`; desenho em
`docs/superpowers/specs/2026-10-01-ga4-eventos-design.md`.

- **A compra do GA4 é SECUNDÁRIA no Ads, nunca primária.** A mesma venda já é
  contada pela importada (primária) e pela tag. Uma terceira fonte primária
  faria o Smart Bidding comprar com um CPA que não existe.
- **Todo `gtag` do `ga4.ts` leva `send_to`.** Sem ele o evento vai pra todos
  os destinos da tag, inclusive o Ads.
- **O GA4 não vê nada depois da `/obrigado`**: o pós-compra mora em rota
  sensível. Upsell e AOV continuam no `funnel_events`.
- **Evento promovido** (`PROMOVIDOS`) tem função tipada no ponto de chamada;
  promover um novo exige os dois lados, e `ga4-contrato.test.ts` cobra.
- **O `session_id` é credencial**: `/retomar?s=<id>` devolve e-mail, WhatsApp
  e o token do editor. Nunca vai cru pra terceiro — como `transaction_id` sai
  por hash (`hashDaSessao`), e rota que o leva na URL (`/oferta/`) é sensível.
- **Configuração do GA4 que o código não alcança:** "Cliques de saída"
  desligado (o WhatsApp da `/obrigado` leva nome e título da música) e
  redação de e-mail e dos parâmetros `email`, `code`, `session_id`, `text`.

## Painel rápido (02/10/2026)

O `/admin` parou de abrir até em 7 dias (`statement timeout`). Desenho em
`docs/superpowers/specs/2026-10-02-painel-rapido-design.md`.

- **Leitura por cursor, nunca por OFFSET.** `lerJanela` (`ler-janela.ts`)
  lê em fatias de 1 dia, cada uma por `(created_at, id)`. A paginação antiga
  ordenava a janela inteira por uuid a cada página, 12 páginas de uma vez.
  Tabela nova que o painel leia precisa do índice `(created_at, id)`.
- **O comparativo espera o núcleo** (`isSuccess && !isPlaceholderData`).
  Disparados juntos, 30 dias viravam 60 no banco.
- **O funil vem de `painel_eventos_dia`**, preenchida pelo cron
  `api/painel-resumo.ts` (de hora em hora, nos dois projetos). O resumo é a
  saída de `admin_eventos_resumo` por dia: mexeu na função, os dias antigos
  ficam com a versão velha até alguém apagar as linhas (`delete from
painel_eventos_dia`) e o cron refazer.
- **Visitante é a soma dos dias**, e venda por página de entrada só conta
  compra no mesmo dia da visita. Escrito no cartão.
- **A regra de venda mora em `ehVenda`** (`painel-resumo.ts`). O painel e o
  cron usam a mesma.
- **`?vivo=1`** no `/admin` ignora o resumo. Pra conferir um dia, não pra 30.
- Cada painel loga `[admin] painel …` com os tempos nos logs da Vercel.
- **Vendas por canal (08/10)**, abaixo da linha de mídia: Google, TikTok,
  e-mail e orgânico, somando o cartão "Vendas" (`canal-venda.ts`). Venda com
  cupom conta pro E-MAIL mesmo com primeiro toque em anúncio (decisão do
  dono: todo cupom de `cupom.ts` só existe em e-mail). O quiz de venda fora da
  janela (recuperação tardia, upsell) é lido à parte, senão cairia em orgânico.
  **Influenciador (09/10)** é o 5º cartão: `utm_source`/`utm_medium` com
  "influenc", ou link só com `utm_campaign` sem fonte nem clique de anúncio
  (o da Gleysi saiu assim). Na tabela "De onde vem" a campanha acompanha em
  todo caminho (`origem.ts`). Link novo de influenciador:
  `?utm_source=influencer&utm_campaign=<nome>`.
- **Todo link de e-mail leva `utm_source=email`** (08/10), com o template em
  `utm_campaign`: o cliente do Resend sai por `comUtm(new Resend(...))`
  (`utm-email.ts`), não template por template. Fora: alerta dos donos, resumo
  diário e magic link. A utm sozinha NÃO muda o canal (o primeiro toque mora
  no quiz): quem chega por ela ganha o cookie `mp_email` de 3 dias
  (`toque-email.ts`) e os 7 checkouts gravam `pedidos.veio_de = 'email'`
  (`marcarSeVeioDeEmail`, update à parte que nunca derruba a cobrança).
  Envio novo: usar `comUtm`; checkout novo: chamar `marcarSeVeioDeEmail`.
- **Aba Criativos (08/10)**: vídeo e anúncio do Google Ads por VENDA REAL
  (gclid → `click_view` → anúncio, em `cliques_anuncio`), título, descrição e
  imagem pela CONVERSÃO DO GOOGLE. Job `puxarCriativosAds` (de hora em hora,
  nas duas marcas, 7 dias reescritos; `click_view` só alcança 89 dias). A
  aba só lê o banco (`admin-criativos.server.ts`, conta em `criativos.ts`).
  Vídeo só soma anúncio com UM vídeo. Venda com cupom/e-mail conta pro
  anúncio (não bate com o cartão "Vendas Google", de propósito). Sonda:
  evento `criativos/sonda`. Spec: `docs/superpowers/specs/2026-10-08-aba-criativos-design.md`.

## /criar gospel (02/10/2026)

`/criar?t=gospel` é a porta dos anúncios gospel. Desenho em
`docs/superpowers/specs/2026-10-02-criar-gospel-design.md`.

- **O tema mora em `respostas.tema` e `attribution.tema`** (`tema.ts`). O `?t=`
  só decide a primeira tela; o quiz troca a URL a cada passo e o tema segue
  pelas respostas. Funis `pt` e `en` (`idiomaTemTema`); o `/es` ignora.
- **Porta cristã da Ballad (03/10):** `balladgift.com/criar?t=gospel` é a
  mesma camada redigida em inglês ("A worship song to God" / "A faith-filled
  song for someone I love"), com os MESMOS `value` do português. Estilos
  próprios (`GOSPEL_EN`: worship, gospel choir, hymn, country gospel,
  Christian pop), prompt `WORSHIP_INSTRUCTIONS_EN`, louvor grava
  `nome = "God"`. Exemplo da abertura: "Never Let Go of My Hand"
  (`en-worship`, `soCristao`, fora das listas de presente). O braço B do
  `abertura_en` NÃO pula a abertura quando a URL tem `?t=`.
- **O quiz gospel é camada** (`quiz-flow-gospel.ts` sobre o `QUIZ_FLOW_PT`).
  Passo `tipo` (louvor/presente); os passos `_louvor` gravam os MESMOS campos
  dos originais e são exclusivos pelo `SKIP_GOSPEL`. Louvor grava
  `relacao = "deus"` e `nome = "Deus"` (`aplicarTipo`).
- **`furthest_step` do gospel está na escala do funil normal**
  (`numeroCanonico`); o `tipo` vale 0 e não grava lead, como a abertura.
- **Os 5 estilos gospel** moram fora da lista normal (`generosGospel`), mas o
  `acharGenero` acha (chave `gospel_pt` do `TODAS`).
- **O prompt do louvor vai na mensagem do usuário** (`LOUVOR_INSTRUCOES`), não
  no system: o system é cacheado e o funil normal não muda.
  `letra-prompt-gospel.test.ts` congela a mensagem sem tema em snapshot.
- Oferta, e-mails e página presente NÃO mudaram (decisão do dono). O e-mail de
  ocasião pula quem fez louvor.
- Painel: seção "Gospel" (`admin-tema.ts`), só com lead gospel no período.

## Blog (03/10/2026)

`/blog` e dez artigos de SEO, só Serenata. Desenho em
`docs/superpowers/specs/2026-10-02-blog-seo-design.md`.

- **Artigo é arquivo** em `src/conteudo/blog/<slug>.ts`, com o corpo num
  markdown RESTRITO (`src/lib/blog/markdown.ts`): `##`, `###`, listas,
  citação, negrito, itálico, link, `[[musica:<slug>]]` e `[[cta]]`. HTML cru
  é erro. Nada de `dangerouslySetInnerHTML` no blog.
- **As regras de SEO e copy moram em `problemasDoArtigo`** (`validar.ts`) e o
  teste roda em todos: palavra-chave no título e no 1º parágrafo, 900–2.000
  palavras, sem preço (`R$`), sem "60 segundos", link interno só pra rota que
  existe. Trecho de letra só copiado da `/p/<token>` do exemplo.
- **Artigo novo:** arquivo + `index.ts` + `pauta.ts` + `<url>` no sitemap +
  imagem (Higgsfield `gpt_image_2_5`, 16:9, convertida com Pillow em
  `<slug>.webp` 1600×900 ≤ 200 KB e `<slug>-og.jpg` 1200×630). O prompt fica
  em `imagem.prompt`.
- Os exemplos tocáveis saem de `src/lib/exemplos-pt.ts`, a mesma lista da home.
- **Leva gospel (03/10): mais 20 artigos** (`grupo: "gospel"`), 21 com o
  `louvor-personalizado`. Todo artigo gospel tem `tema: "gospel"` (CTA vai pro
  `/criar?t=gospel`; o teste cobra o par). Só existe UMA música gospel de
  exemplo pública (Denise): os artigos tocam a que combina com o tema e dizem
  o estilo real dela, sem fingir que é gospel. Trecho de letra diferente em
  cada artigo. Imagens sem santo, crucifixo nem imagem católica (o público é
  evangélico). No `/blog`, o grupo gospel vem por último.
- O índice do registro é a PAUTA (`pauta.ts`): o teste exige que todo slug
  dela tenha artigo publicado E `<url>` no sitemap.
- Medição: tabela de páginas de entrada do painel e Search Console.

## Campanha MUSICA10 (07/10/2026)

E-mail pra base `pt` inteira com R$ 10 de desconto em qualquer compra.
Desenho em `docs/superpowers/specs/2026-10-07-campanha-musica10-design.md`.

- **O webhook do upsell confere o valor pelo cupom do PRÓPRIO pedido**
  (`valorEsperadoDoUpsell`, `cupom.ts`), na data em que o pedido nasceu.
  Antes ele exigia o preço de tabela, e todo extra com desconto ficaria pago
  e sem liberar. O cupom vem da nossa linha, nunca do gateway.
- **Cupom fixo ≠ cupom de preço final.** `MUSICA10` tira R$ 10 do preço da
  pessoa (braço dela, piso R$ 5) em música, extra, quadro e vídeo; `SRN27`
  vira R$ 28 e só na música. A validade de cada um mora em `cupom.ts` e o
  e-mail lê a data de lá (`validadeCurta`).
- **O cupom entra por `?cupom=` em qualquer página** (`cupom-url.ts`), fica no
  `mp_quiz` e SOBREVIVE ao `reset()`. A referência do PIX ganha `:d` com
  cupom: o mesmo quiz com outro valor precisa de outra referência.
- **A fila é montada UMA vez por SQL** (`montar_campanha`), drenada 300/h em
  lotes de 100 pelo `resend.batch` com chave de idempotência. Freio: bounce
  > 4% ou reclamação > 0,1% nas últimas 24h para o envio e avisa os donos.
- **Reclamação de spam vira descadastro** (`descadastros`, motivo
  `complaint`), no webhook do Resend: vale pra todas as réguas.
- Ligar e desligar: `CAMPANHA_MUSICA10_ON` na Vercel. Teste sem base: evento
  `campanha/musica10.teste` com `{ "para": "..." }` no painel do Inngest.

## Riscos conhecidos

1. **Dependência de revendedor não oficial do Suno.** Zona cinzenta nos termos
   (gerar para uso próprio é diferente de rodar serviço). Vale advogado antes
   de escalar, não antes de validar.
2. **Confiabilidade do pipeline é o maior risco de negócio**, não o custo.
   Mitigação: gerar antes de cobrar (acima), dois provedores com failover
   testado de verdade, portões automáticos de qualidade (duração, silêncio,
   idioma), fallback assíncrono por e-mail e WhatsApp.
3. **Google Ads é rígido em alegações.** Isso vale pra número inventado
   ("3.000 clientes") e depoimento fabricado, não é desculpa pra funil tímido:
   o vídeo de reações reais (`materiais/`) é prova forte e deve ser usado
   sem medo, na home e na oferta. Copy de conversão (ancoragem de preço,
   lista longa de entregável, FAQ que mata objeção, garantia) é trabalho
   normal, não risco.

## Higiene

- `ffmpeg -map_metadata -1` em todo áudio antes de publicar. Foi assim que
  descobrimos o gerador do ForeverSongs.
- Nada de rota administrativa no bundle do cliente. Segurança é RLS no
  Supabase, não rota escondida no front. Foi assim que lemos os custos e o
  provedor da Cantoria.

### Invariantes da varredura de 20/08

Achados numa auditoria do sistema inteiro. Cada um é uma regra, não um
conserto pontual — desfazer qualquer uma reabre o buraco.

- **E-mail nunca entra cru num `ilike`.** `%` e `_` são curingas do LIKE e
  são caracteres válidos em endereço de e-mail: quem escolhe o próprio
  cadastro escolhe o SENTIDO da consulta. Use `literalLike()`
  (`src/lib/sql-like.ts`). O pior caso era o robô de suporte, que respondia
  sozinho mandando `token_edicao` de um cliente pra um estranho.
- **A resposta automática do suporte confere o endereço em JS**, além do
  `ilike`. É a única rotina que manda token pra quem não provou ser dono.
- **Endpoint que gasta dinheiro tem teto e tem limite de tamanho de entrada.**
  As três rotas de letra e o disparo da música passam por `cobrarUso()`
  (`src/lib/limite-uso.server.ts`, tabela `limites_uso`). O teto falha ABERTO:
  banco fora do ar não barra venda.
- **Token do cliente não entra em URL que terceiro lê.** gtag e UTMify só
  carregam fora das rotas de `rotas-sensiveis.ts`. `/obrigado` fica de fora da
  lista de propósito — é onde a conversão dispara.
- **O que a pessoa manda não decide o ALVO da operação, só o conteúdo.**
  `removerDaGaleria` confere o caminho contra a galeria da própria música
  antes de apagar; upload confere os bytes, não a etiqueta `data:`.
- **Campo livre do painel de teste A/B tem charset.** Nome de versão sai
  serializado dentro de `<script>` e escrito em seletor de CSS; checkout vira
  `href`. Travado em `[A-Za-z0-9_-]` e em `https://`, com teste.
- **Segredo se compara em tempo constante**, inclusive no webhook — não só na
  senha do painel (`api/lib/segredo.ts`).
- **Em produção, cabeçalho de host não decide destino.** `x-forwarded-host`
  escolhia o `redirectTo` do magic link quando `VITE_APP_URL` faltava, o que é
  tomada de conta completa.
- **Existe teto de gasto diário do Suno** (`inngest/lib/disjuntor.ts`,
  `TETO_MUSICAS_DIA`, padrão 300/dia contra os 119/dia reais). Ele NÃO tenta
  identificar quem abusa, ele limita quanto se perde — é a única linha que
  nenhum truque do cliente contorna, porque roda dentro do job. Quem já pagou
  nunca é barrado e não consome o orçamento: um teto que segura comprador
  troca R$ 0,32 por reembolso, que é o oposto da regra de ouro.

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


## Espanhol (México) — 07/08/2026

Segundo funil, no MESMO site e no mesmo banco: `/es`, `/es/criar`,
`/es/login`, `/es/gracias`. O funil português não mudou de URL nem de
comportamento.

**Nada de detectar IP.** Redirecionar por IP quebra o Google Ads (anuncia-se
uma URL e a pessoa cai em outra), impede indexar as duas versões, e um
brasileiro com VPN cai no espanhol.

**O idioma é COLUNA no banco** (`quiz_responses.locale`), não só rota. Em
três lugares não existe URL de onde deduzir: a página presente é aberta pelo
presenteado (que nunca passou pelo funil), o editor chega por e-mail, e os 4
e-mails saem de webhook e cron sem navegador. Gravado no passo 1, e a RPC de
progresso parcial nunca sobrescreve.

### O que é redação, não tradução

- **Prompt da letra ES** (`letra-prompt-es.ts`): outro texto. A lista de
  clichês a evitar é o que separa letra boa de genérica, e "porto seguro" não
  é o clichê que um mexicano ouve ("media naranja", "mi cielo", "eres mi
  todo"). `tú`, nunca `vos`; `ustedes`, nunca `vosotros`.
- **Gêneros** (`generos.ts`, catálogo único pros dois idiomas): mariachi,
  banda, norteño, cumbia, bolero, corrido tumbado, bachata, salsa. Sertanejo
  e forró não existem lá. Ordem tirada do que a Cántale destaca.
- **Ancoragem de preço**: no Brasil é o compositor a R$ 300; no México é o
  **mariachi a domicílio, a partir de $1.500 MXN, que se ouve uma noite só**.
- **Exemplos da espera**: mariachi/banda/balada, não sertanejo.

### Preço: US$ 9

A Perfect Pay cobra o internacional em **dólar** (não MXN, sem OXXO/SPEI),
recebimento em 15 dias. US$ 9 ≈ $170 MXN, ~30% abaixo do líder — mesma
jogada do R$ 37 contra a LoveTune.

### Concorrência ES (verificada)

- **cantale.mx** — o nosso funil já rodando no México: escutar antes de
  pagar, ancoragem, e **página compartilhável inclusa**. $99 MXN avulso,
  $169 MXN o pacote (ancorado em $249); o dono apurou US$ 12,99 real.
  Gêneros: bolero, balada, mariachi, cumbia, reggaetón, bachata, banda,
  corrido tumbado, norteño, salsa. **México não é terreno vazio.**
- **haztucancion.com** — $99 MXN, só MP3 por WhatsApp, 24-48h.

### Validado com geração real (07/08)

3 letras + 3 músicas pelo pipeline de verdade (mariachi, banda, balada),
74s a 96s, 2 versões cada, 3min20 a 4min. Detalhe concreto em toda linha
("el mandil azul ya despintado", "el frasco de Nescafé"), sem clichê da
lista proibida, e o memorial fala do que ficou, não da perda. Arquivos em
`scratch/teste-es/`. **Falta escutar**: se o mariachi soa de plástico,
nenhuma tradução salva.

### Dívida conhecida

A home ES (`routes/es.index.tsx`) é IRMÃ da portuguesa, não a mesma
parametrizada: melhoria numa não aparece na outra. Foi escolha (parametrizar
1.700 linhas em 8 componentes de madrugada, sem revisão, numa página que
está vendendo). Fundir quando o teste provar que vale.

## Expansão EUA: Ballad Gift (29/09/2026)

Marca irmã pro mercado americano, `balladgift.com` (registrado 29/09).

**Mesmo repositório, dois deploys.** Nada de fork: cada conserto (webhook,
vigia, disjuntor, trava de e-mail) teria que ser feito duas vezes, e a home
espanhola já mostra o que acontece com páginas irmãs. A marca vira
configuração por projeto da Vercel; o funil brasileiro não muda nada, a mesma
regra que valeu pro `/es`.

| | Serenata | Ballad Gift |
|---|---|---|
| Vercel | projeto atual | projeto novo, mesmo repo |
| Supabase | atual | **projeto novo, isolado** |
| Pagamento | Asaas | Stripe (USD) |
| Inngest | app atual | app separado |
| Google Ads | conta atual | conta nova na mesma MCC |
| kie.ai / Claude | mesmas contas | mesmas contas |

**Por que não "Serenade".** `sendaserenade.com` já roda o nosso modelo nos
EUA: letra grátis, US$ 18,99 pra gravar (3 por US$ 48,99), refação e
reembolso, CD impresso US$ 24,99. E diz com todas as letras que não dá pra
ouvir antes de comprar. A nossa prévia cantada e a página-presente são o
diferencial lá. "Serenata" também não serve: o americano lê como mariachi.

**Logo:** só a palavra BALLAD (a Serenata também não leva "Gift"), mesma onda
com coração, mesmo vinho, traço fino. Kit em `docs/marca/ballad/`.

### Como a Ballad roda (montado em 29/09)

- **Marca = env.** `VITE_MARCA=ballad` no projeto `balladgift` da Vercel.
  `src/lib/marca-identidade.ts` (sem imports, lido por site, api e Inngest)
  decide nome, domínio, remetentes; `LOCALE_PADRAO` vira `en`. Sem a env é
  Serenata, então esquecer a env nunca derruba o site que vende.
- **Idioma `en` é o funil BRASILEIRO adaptado**, não o espanhol (decisão do
  dono): `quiz-flow-en.ts`, `letra-prompt-en.ts`, gêneros `*_en` em
  `generos.ts`, `EN` em `textos.ts`/`textos-presente.ts`, `HomeEn.tsx` (cópia
  estrutural da home BR). Sem WhatsApp e sem PIX. A prova social (contador, estrelas, rostos) é a MESMA da Serenata: os clientes são da empresa (dono, 30/09).
- **Banco:** Supabase próprio em us-east-1 (`ssmykmiftqpbrxpduflg`),
  migrations com histórico CERTO (ali `db push` funciona; aplicar com
  `scratch/ballad-migrar.mjs`). Padrão da coluna `locale` = 'en' lá.
  A linha `preco` de `experimentos` é em DÓLAR: A=$19 (100%), B=$24 peso 0.
  Quem cobra lê essa linha; a tela também (`usaConfigViva` em `preco.ts`).
- **Inngest:** ambiente próprio `ballad` na conta paga. `api/inngest.ts`
  registra só `DA_BALLAD` (gerar, letra, repescar, vigias). Função nova entra
  nas DUAS listas só se servir pros dois.
- **Stripe:** Embedded Checkout (`CheckoutStripe.tsx`, `stripe-checkout.ts`,
  `api/lib/stripe.ts`, `api/webhook/stripe.ts`). Mesmas travas do PIX.
  LIVE desde 29/09, na conta Stripe que o dono já tinha (nome público de
  outro negócio, "WPBN", descritor STRIPEONLINE; ele troca depois). Por
  isso cada cobrança leva `statement_descriptor_suffix: "BALLADGIFT"`.
  Webhook e domínios (Apple/Google Pay) registrados em live e em teste. As
  chaves de teste ficam em `.env.ballad.local` como `STRIPE_TEST_*`, e o
  servidor local (`scratch/dev-ballad.mjs`) usa SÓ elas: o local nunca cobra.
  Idempotência da sessão: a chave tem versão (`v3`); mexeu no corpo, sobe.
- **Resend:** mesma conta, chave própria restrita ao balladgift.com, webhook
  próprio. O webhook de cada site ignora eventos do domínio do outro.
- **Google Ads:** a tag da Serenata NUNCA carrega na Ballad
  (`google-ads.ts`). A dela entra por `VITE_GOOGLE_ADS_ID` e
  `VITE_GOOGLE_ADS_CONVERSAO` no projeto balladgift. Conta "Projeto GM2"
  (1060198776), ação "Compra Ballad (site)", contada pela TAG no `/obrigado`
  (o Stripe sempre volta pra lá). **Upload de conversão pela API não existe
  pra conta nova**: `UploadClickConversions` devolve
  `CUSTOMER_NOT_ALLOWLISTED` e manda usar a Data Manager API, que pede o
  escopo `datamanager` que o nosso refresh token não tem.
- **TikTok:** pixel próprio (Pixel + Events API), `TIKTOK_PIXEL_ID`,
  `VITE_TIKTOK_PIXEL_ID` e `TIKTOK_ACCESS_TOKEN` no projeto. A venda pelo
  servidor sai em `confirmarSessaoStripe`, só com `ttclid`, igual à Serenata.
  "Enhanced data postback" DESLIGADO no painel: ele lê o conteúdo da página,
  e no quiz isso é a história e a letra.
- **Deploy:** desde 01/10 o projeto `balladgift` está LIGADO ao GitHub
  (`guirofps/serenata`, branch `master`): o mesmo push publica as DUAS marcas.
  Depois do push, `curl -X PUT https://www.balladgift.com/api/inngest` (e o da
  Serenata). A CLI ainda funciona como plano B:
  `VERCEL_ORG_ID=team_hEMUGcKgu8uIFM9yueV0K5si VERCEL_PROJECT_ID=prj_zJaeX2faBotnX45q7OuUMZFeJqsp vercel deploy --prod`.
  SEM as duas variáveis, a CLI publica a SERENATA. O `.vercelignore` existe
  pra não levar `.env*` nem `scratch/`. Em 01/10 a Vercel passou a recusar
  build com TanStack Start vulnerável: manter `@tanstack/react-start` atualizado.
- **Exemplos:** seis músicas geradas pelo funil da própria Ballad
  (`scratch/ballad-exemplos.mts`), dados em `src/lib/exemplos-en.ts`, capas
  geradas (pessoas que não existem) em `public/ballad/exemplos/`.
- **Testar pagamento:** cartão de teste só no LOCALHOST (config `ballad` do
  `.claude/launch.json`, `scratch/dev-ballad.mjs`), nunca no domínio público.
  Testado de ponta a ponta em 29/09: webhook, pedido pago, taxa, e-mail.

**Quem vende, nos termos em inglês:** por ora a MESMA empresa da Serenata
(CNPJ 45.835.258/0001-46, São Caetano do Sul/SP), decisão provisória do dono
em 29/09, que vai trocar depois. Nome de pessoa física não aparece, igual à
Serenata, que mostra só a marca e o CNPJ.

## Testes em andamento (LER NO COMEÇO DE TODA SESSÃO)

**Regra do dono (30/09):** toda funcionalidade ou fluxo novo entra como
teste A/B, com A = como era. O dono precisa ser LEMBRADO das leituras (no
começo da sessão, quando a data chegar). Vencedor validado na Serenata vai
pro funil da Ballad (coluna "Ballad"). Conserto de defeito não precisa de
teste, mas entra na lista de baixo pra se saber o que mudou.

Braços de funil moram em `experimentos` (sorteio colado no visitante, braço
gravado em `attribution.exp`); e-mail divide pela paridade do último
caractere do id do quiz (braço recalculável na leitura).

| teste | desde | A × B | mede | 1ª leitura | Ballad |
|---|---|---|---|---|---|
| `abertura_pergunta` (Serenata) | 08/10 | abertura de hoje × "Pra quem é a música?" com os chips da relação na própria abertura (tocar grava a relação e vai pro nome; o "começar" continua). Só pt sem tema | quem RESPONDEU a 1ª pergunta (quiz_step q>=2) entre sessões pt sem tema que montaram a abertura; lead, venda, receita por lead | 11/10 | adaptar se ganhar |
| `previa_refrao` (Serenata) | 08/10 | prévia corta aos 40s + popup × prévia até o fim do 1º refrão (timestamps, 40-75s; sem timestamps, 60s estimados) com cartão de preço embaixo do player. Só pt | RECEITA POR LEAD; saúde em 10-11/10: distribuição de `previa_corte_motivo` no B | 22/10 (saúde 11/10) | sim, se ganhar (texto em inglês) |
| `video_fotos_ja` (Serenata) | 08/10 | editor de hoje × 1ª foto subida leva a página até o vídeo, prévia toca sozinha com as fotos e a música; título pela ocasião | vídeo vendido por comprador exposto (`video_fotos_ja_exposto`) | 15/10 | sim, se ganhar |
| `outra_musica_24h` (Serenata) | 08/10 | nada × cartão "Faça outra pra mais alguém" (pacote extra R$ 28, mesmo preço de sempre) por 24h na /obrigado e no editor | receita de extra em 24h por comprador exposto; guarda: editor aberto e vídeo vendido | 15/10 | sim, se ganhar |
| e-mail `recuperacao_prazo` (2º caractere do fim do id do quiz) | 08/10 | escada de sempre × D+1 "R$ 28 até amanhã" com prazo REAL (cupom `SRN27P<AAMMDD>`, vale até 23h59 do dia) + D+3 último lembrete a preço cheio | receita por lead, vendas com `cupom like 'SRN27P%'`, descadastro | 22/10 | não |
| e-mail `pedido_reacao` (3º caractere) | 08/10 | nada × no 3º dia, pedido de vídeo de reação respondendo o e-mail, R$ 10 de cupom MANUAL pelo suporte (`pedirReacao`, 9h35-19h35, até 10/rodada) | vídeos recebidos, 2ª compra em 30 dias, descadastro | 22/10 | não |
| e-mail `limite_frequencia` (4º caractere) | 08/10 | como hoje × no máximo 2 e-mails de marketing por endereço em 24h (transacional isento) + convite de indicação 24h depois da compra | venda e receita por lead, descadastro, reclamação, bounce por envio | 15/10 e 22/10 | não |
| `obrigado_direto` | 30/09 | botão "Entrar na conta" × "Ouvir minha música completa" direto no editor + copiar link + WhatsApp | abriu o editor em 1h, vídeo por comprador | LIDO 08/10: **B GANHOU** (compradores desde 30/09, ~1.100 por braço): abriu a música em 1h 78% × 59%, subiu foto 45% × 32%, vídeo 13,8% × 11,2%, extras R$ 3,42 × 2,76 por comprador (+24%), 30% mandaram pelo WhatsApp. A zerado pelo peso em 08/10. Curiosidade sem explicação: B também teve 13% mais compradores por lead (não é recompra), e a página só aparece depois de pagar, então é acaso | **portar pra Ballad** |
| `duvidas_pagamento` | 30/09 | FAQ de sempre × grátis/pagar depois/boleto/nome no PIX no topo | conversão da oferta | LIDO 08/10: **B PERDEU**: venda por lead 14,6% × 15,7%, R$ 5,55 × 5,98 por lead (z -1,94, ~7 mil leads por braço). Abrir a dúvida planta a dúvida. B zerado pelo peso | não |
| e-mail `entrega` variante | 30/09 | e-mail de sempre × "ouvir e baixar", fotos pelo que fazem, link do ajuste | foto, vídeo, extras por comprador | LIDO 08/10: empate (foto em 24h 40,1% nos dois, vídeo 13,0% × 12,2%, extras R$ 3,24 × 3,05 por comprador). Segue, 15/10 | sim, se ganhar |
| `bump_quadro` | 25/09 | A sem bump; V e C ZERADOS em 30/09 (canibalizavam o vídeo do editor) | vídeo por comprador e receita por lead | confirmar em 07/10 | Ballad não tem bump |
| assunto `letra_pronta` | 28/09 | assunto de sempre × nome na frente | abertura e venda em 48h | LIDO 08/10: empate (venda em 48h 5,4% no b × 5,1% no a, z ~0,9, ~7 mil envios por braço). Segue, 15/10 | sim, se ganhar |
| criativos Google 28/09 (g8, g9, Mix E) | 28/09 | LIDO 30/09: PERDERAM. Cada um ~R$ 105-120 e 1 venda (CPA > R$ 100, lead R$ 8,60-10,90) contra o controle Vid 5 no mesmo público (R$ 31/venda, R$ 2,44/lead). Os três PAUSADOS em 30/09 | CPA real do banco | encerrado | - |
| PMAX/DG Ângulos | 28/09 | DG PAUSADO 30/09 (R$ 164 por 1 venda). PMAX segue: R$ 45 acumulado, mas R$ 16,80 no 3º dia | CPA real | 03/10 (só a PMAX) | - |
| Vid 5 nas campeãs + escala | 25-29/09 | CPA antes × depois: CAMPEÃO 2# 25→20, 1# 30→24, 3# 29→19, RMKT NEW 27→16, Comportamento 27→40. Em 30/09: CAMPEÃO 1# R$ 750→900 (única travada por orçamento, 93%); Comportamento R$ 205→117; pausadas Vid 5 Visitantes 30d/Busca/Casamento/Emoção/New relacionamento e Plano de saúde (acima de R$ 34) | CPA real do CAMPEÃO 1# com R$ 900 | 03/10 | - |
| Ballad: 10 campanhas EUA | 29/09 | um criativo por campanha | clique → lead, depois CPA < US$ 15. Só 1 de 24 visitas pagas passou da abertura (Serenata 43-53%); desde 30/09 mede `abertura_tempo` (5/15/30s) e `abertura_rolou` pra separar clique acidental de rejeição | 01/10 | é a Ballad |
| Ballad: corte de criativos | 01/10 | 1ª venda real (01/10 11h38) veio do 08 curto sofá (grupo /criar). Pausados 11, 09, 07, 05 e 12 (R$ 124-135 cada, nenhuma visita começou o quiz). Ficam 08, 03, 02 e 10 a R$ 50/dia | começou o quiz e venda por criativo | 02/10 | é a Ballad |
| Velocidade: pixels e fonte depois da página | 02/10 | Conserto, não teste A/B: gtag e pixel do TikTok criam a FILA na hora e o arquivo pesado baixa depois do `load` (teto 5s; na /obrigado e /es/gracias, na hora); a Google Fonts entra por script (não trava a pintura). Antes, no mesmo dia: o Stripe.js (~880 KB) saiu da abertura do /criar da Ballad (`/pure` + `loadStripe` ao abrir a folha). Lighthouse celular 4G /criar Ballad: 1.836 KB e LCP 14,8s → 848 KB e LCP 8,8s só com o Stripe. Base pra comparar: % de cliques pagos do Google que chegam a registrar a página (gclid distinto ÷ cliques): Serenata 81% (01/10), Ballad /criar 74% | % de cliques que chegam; LCP no Lighthouse | 04/10 | vale pras duas |
| Serenata: corte e escala de 02/10 | 02/10 | A "pausa de 30/09" (Vid 5 Visitantes/Busca/Casamento, Mix E, DG Ângulos) NUNCA mudou o status: o histórico da conta só mostra lance e horário. Pausadas DE VERDADE em 02/10, com mais Ads Novos 1-3, Video 2-vo e NOVO PB RMKT (~R$ 510/dia, CPA real R$ 50-200). Orçamento +20%: CAMPEÃO 2# 2500→3000, Ads Novos 4-6 420→500, CAMPEÃO 3# 180→215, Vid 5 Fãs de TV 110→130, Search 101→120 (CPA real 3d R$ 14-18, todas gastando ~100%). `scratch/_serenata-otimiza-02out.mjs`. Lição: pausa só conta depois de reler o status | CPA real das 5 que subiram; o total diário | 04/10 | - |
| Serenata: escala de 03/10 | 03/10 | Pelo CPA real de 3 dias (30/09-02/10), só nas que NÃO subiram em 02/10: CAMPEÃO 1# R$ 900→1.080 (CPA 18,35, travada a 103%), RMKT NEW 620→745 (CPA 14,21, gastando 137%), Vid 5 Aberto 76→91 (CPA 17,62). 02/10 fechou recorde: R$ 18.983, 447 músicas, Google R$ 6.279 a CPA real R$ 18,25. `scratch/_serenata-orcamento.mjs` (nome exato, relê) | CPA real das três | 05/10 | - |
| **Vid 5 fora do ar (05/10)** | 05/10 | O influenciador do Vid 5 quis cobrar mais e o vídeo foi EXCLUÍDO do YouTube pelo dono: o criativo campeão não existe mais. Pausadas as 9 campanhas que só tinham ele (Ads Novos 4-6, os 4 Vid 5 de 25/09 e os 4 públicos de 04/10, que estavam a R$ 19/venda) e as da Ballad com a versão dublada (13, 25). As campeãs (CAMPEÃO 1#, 2#, RMKT NEW, 3#, Comportamento) seguem com o Video Fone; o **Pai dyZy** (YouTube dyZyxN8zTDU, o pai com a página da música) entrou como anúncio novo nas CAMPEÃO 1#, 2# e RMKT NEW, com os textos do Video Fone. Os 4 públicos bons e o lugar do Ads Novos 4-6 foram recriados com o Video Fone (40/dia cada; Remkt Concorrentes a 300/dia). `scratch/_sem-vid5-05out.mjs`, `scratch/ads-criar-05out-fone.mjs`. NUNCA mais usar o Vid 5 nem o rosto do influenciador em nada (inclusive dublado) | CPA das campeãs sem o Vid 5; Pai dyZy dentro delas; Video Fone nos 5 públicos | 07/10 | Ballad: 13 e 25 pausadas |
| Serenata: 5 criativos novos do Ralph | 05/10 | Ralph (sócio, rosto próprio) no carro, gancho "Quer dar um presente…", um por campanha TESTE R$ 40/dia no Remkt Concorrentes, segmentação otimizada LIGADA, destino /criar: "varias" (qgVwGakQnJU), "exemplo esposa" (9_SLU4ASOXU), "como funciona" (ePr8b1e1s8E), "detalhes" (kW2UiEXBAWM), "esposa chorou" (z4Qd66jlFBs). Candidatos a substituir o Vid 5 nas campeãs. `scratch/ads-criar-05out-ralph.mjs`. Regra de corte (dono, 05/10): teste com mais de R$ 80 gastos, lead acima de R$ 15 e nenhuma venda real é pausado sem esperar a leitura. 06/10 14h17: nenhum bateu (todos os 5 do Ralph em R$ 66-68; "exemplo esposa" R$ 33/lead e 0 venda é o próximo; os outros 4 têm 1 venda cada, R$ 66-68/venda, lead R$ 9,55-21,94). Video Fone nos públicos novos: Casamento R$ 3,50/lead, Emoção R$ 4,29, Intenção R$ 5,68, todos ~R$ 33-34/venda. 06/10 21h47 (2ª passada): nenhum bateu de novo; os 5 do Ralph passaram de R$ 80 mas TODOS têm 1 venda (R$ 81-82/venda, lead R$ 9-27), "exemplo esposa" vendeu às 21h. Pai dyZy e PS8R em R$ 41/venda. 06/10 o Ralph gravou 3 vídeos no roteiro do Vid 5 (fala curta, play, reação calada), editados com música em fade in e chamada final em `materiais/ralph/` (4 músicas: Isabela, sertanejo gospel, adoração, pop gospel; as gospel geradas pelo funil, `scratch/criativo-musica-esposa-gospel.mts`) | CPA real por campanha (banco), contra o Pai dyZy (R$ 28,59) | 08/10 | se vencer, dublar com Dylan |
| Serenata: Ralph no roteiro do Vid 5 (9 vídeos) | 07/10 | 3 gravações do Ralph (IMG_5852/53/54 = vídeo 1/2/3) no formato do Vid 5: fala curta, "vou dar o play", música entrando em fade in, reação calada, caixa "Faça sua história virar música também 💛 Clique em saiba mais" no fim; cada uma com 3 músicas: Isabela (exemplo da home, sertanejo pra esposa), adoração e pop gospel ("Resposta de Oração", geradas pelo funil, `scratch/criativo-musica-esposa-gospel.mts`). Uma campanha TESTE por vídeo, R$ 40/dia (R$ 360/dia), Remkt Concorrentes, segmentação LIGADA, destino /criar (presente pra esposa, não louvor). YouTube: isabela 1uHl78wBN_w / C95CEyj7u_E / Vmg_YK8sY_s, adoração H3R1g-6HYmE / eZxpHXF9cAw / q4JI9SUkbM8, pop BLyFzpMZODo / ZLKtMqGN3sQ / RLuGuDlp0PU. Arquivos em `materiais/ralph/PRA SUBIR`. `scratch/ads-criar-07out-ralph-v5.mjs` (relido). Mesma regra de corte (R$ 80, lead > R$ 15, 0 venda) | CPA real por vídeo e por música, contra Pai dyZy/PS8R (~R$ 41) e o Vid 5 (R$ 16-20) | 10/10 | se vencer, dublar com Dylan pra Ballad |
| Serenata: volta da escala com o vídeo 1 do Ralph (07/10) | 07/10 23h37 | Portão passou: vídeo 1 (Isabela 1 + Adoração 1) fechou o 1º dia com R$ 80, 33 leads (R$ 2,43) e 6 vendas (R$ 13,36). Aplicado e relido: Isabela 1 e Adoração 1 como anúncios novos na CAMPEÃO 1#, 2# e RMKT NEW ao lado do Video Fone; religadas com os dois vídeos no lugar do Vid 5 e nome novo as 5 que vendiam com ele: "GD \| Serenata \| Remkt Concorrentes \| Ralph V5 \| 07 Out" (ex-Ads Novos 4-6, R$ 300; com o Vid 5 fazia R$ 16,76), "ESCALA \| Ralph V5 \| Fãs de TV" (R$ 80), "Aberto" (R$ 60), "RMKT NEW" (R$ 60), "Semelhante compradores" (R$ 40); campeãs +15% (1# 700→800, 2# 1400→1600, RMKT NEW 480→550), o degrau da escala da 2# em set. Os grupos Vid 4/Vid 6 do Ads Novos (vídeos 1509.4/.6) seguem PAUSADOS. Dia 07/10: Google R$ 3.724, 146 vendas, R$ 25,51; lucro ~R$ 2.805 antes do TikTok. `scratch/escala-ralph-v5-07out.mjs` | CPA real das campeãs com o vídeo novo e das 5 religadas; próximo degrau +15-20% só com CPA < R$ 25 | 09/10 | dublar o vídeo 1 com Dylan pra Ballad |
| Serenata: escala, 2º passo (08/10) | 08/10 01h | Dono: "já precisamos voltar com a nossa escala pra voltar a bater quase 20k dia". Mais LUGARES pros validados, sem subir as campeãs de novo: PAUSADOS Ralph V5 Adoração 2 (lead R$ 13, 0 venda), Video Fone New relacionamento (lead R$ 10), Plano de saúde (~R$ 45/venda), PMax 10 Set (R$ 429, 0 venda real, só Video Fone); Video Fone Intenção 40→60 e Clientes de hipermercados 50→60 (28% dos leads compram); Isabela 1 + Adoração 1 entraram na CAMPEÃO 3#, Comportamento, Clientes de hipermercados, Video Fone Casamento e Intenção; o Video Fone entrou nas 5 religadas; PMAX Ângulos religada a R$ 70 com os dois vídeos nos 4 grupos vivos e SEM o Vid 5 (que estava no "Reação real", o grupo de R$ 7,40/conv no Google). Depois, o Video Fone também entrou nos 4 grupos (`_pmax-fone-08out.mjs`). Mesma madrugada, degrau nas menores que fecharam 07/10 abaixo de R$ 25 e gastando o orçamento: Search 150→175 (alguém já tinha subido de 120 pra 150 no painel), Comportamento 137→160, CAMPEÃO 3# 60→70, Video Fone Casamento 60→70. Relido. Leitura de CPL × CPA (30 campanhas, 28/09-07/10): correlação 0,84, conversão média lead→venda 14%: CPA ≈ CPL ÷ 0,14, ponto de lucro no lead ≈ R$ 4,75. Exceção: Emoção e memória (lead R$ 3,86, 6% compram) segurado mais 1-2 dias. `scratch/escala-2-08out.mjs`, `_cpl-vs-cpa.mjs` | CPA real por campanha; PMAX por `utm_content` | 10/10 | - |
| Serenata: ajuste da tarde de 08/10 | 08/10 16h50 | Às 16h40 as campeãs gastavam só 51-60% do orçamento (não estão travadas por orçamento: o freio é leilão/criativo, volume vem de criativo novo validado). Travadas por orçamento e baratas: ESCALA Fãs de TV 80→95 (CPA R$ 13, gastando 142%) e ESCALA Semelhante compradores 40→48 (R$ 13, 140%). PAUSADA ESCALA RMKT NEW (1 venda a R$ 77; disputa o público da RMKT NEW principal). Segurados: Remkt Concorrentes Ralph V5 R$ 300 (CPA R$ 25) e ESCALA Aberto (R$ 41, mais 1 dia). Dia até 16h32: 165 vendas, R$ 6.750 (+34% sobre 07/10 no mesmo horário). `scratch/_serenata-orcamento.mjs`, `_pausar-escala-rmkt-08out.mjs` (relidos) | CPA das duas que subiram; Aberto | 09/10 | - |
| Serenata: Isabela 1 sai das campeãs (09/10) | 09/10 15h | Venda real por anúncio (gclid → `cliques_anuncio`, `scratch/_venda-por-anuncio.mjs`), 08-09/10, todas as campanhas: Video Fone R$ 27 (119 vendas), Ralph Adoração 1 R$ 29 (67), Ralph Isabela 1 R$ 45 (27, R$ 1.203). O teste isolado da Isabela 1 também caiu: lead R$ 2,36 (07/10) → R$ 10,48 (08/10) → R$ 18 (09/10); leitura: saturação, porque desde 07/10 à noite o mesmo vídeo roda em 4-5 campanhas no MESMO público (Remkt Concorrentes). Dono: anúncio Isabela 1 PAUSADO em 14 campanhas (campeãs, escalas, Comportamento, hipermercados, Casamento, Intenção); FICA no teste isolado e nos testes de público de 09/10. Orçamento não mudou; todas seguem com Video Fone + Adoração 1. `scratch/_pausar-isabela1-09out.mjs` (relido). Lição: criativo validado em 1 dia de R$ 40 pode ser a nata do público; ler 2-3 dias antes de pôr em várias campanhas do mesmo público | CPA da CAMPEÃO 2# sem a Isabela; se o teste isolado voltar a lead < R$ 4 em 2-3 dias, ela volta | 12/10 | - |
| Ballad: funil em espanhol pros hispanos dos EUA (`/es`) | 09/10 | Não é A/B: canal novo. balladgift.com/es, /es/criar, /es/gracias em espanhol neutro com tú (a Serenata segue argentina, voseo, US$ 9,90 na Perfect Pay). Pago SÓ pelo Stripe em dólar, US$ 19 pela MESMA linha `preco` do inglês (`preco.ts` lê o plano do inglês com rótulo "US$"), Stripe em `es-419`, volta pra /es/gracias, régua de e-mails em espanhol (3 da recuperação, como o inglês). Tudo gateado por `ehBallad()` (`marca-identidade.ts`): o que depende do PAÍS pergunta a marca, o que depende da LÍNGUA pergunta o idioma. Mercado `eua` em `mercado-es.ts`, gêneros `ES_EUA` (mariachi, banda, norteño na frente), prompt `LETRA_SYSTEM_ES_EUA` (história em inglês/spanglish vira letra em espanhol, apelidos como escritos). 6 exemplos gerados pela Ballad (`scratch/ballad-exemplos-es.mts`, `src/lib/exemplos-es-us.ts`, capas Higgsfield). Testado no localhost até o caixa do Stripe abrir em espanhol a USD 19.00; o pagamento de teste ficou pro dono (o painel não digita no iframe). Testes em `ballad-es.test.ts` (as duas marcas). Mídia: Google/YouTube em espanhol nos EUA (idioma espanhol + público personalizado de busca em espanhol + afinidade música latina, segmentação ligada) e Search em espanhol, criativos do dono | vendas com `locale = es` no banco da Ballad, % que responde a 1ª pergunta, CPA real | 1ª semana de mídia | é a Ballad |
| Search de concorrentes: pesquisa no Meta (09/10) | 09/10 | Não é A/B: palavras novas. Pesquisa na Biblioteca de Anúncios da Meta, anunciante por número de anúncios ATIVOS. BR: NossaCanção ~390 ("em até 3h"), Canção Eterna/Melodia Eterna ~260 (R$ 19,90-37,90), Eternisom ~190, Música do Coração ~97, Sonara ~66 (R$ 39,90, letra grátis), Música de Louvor ~52, Monte Sua Música ~40, Imperial Melody ~38, SongPetal ~28 (R$ 29,90, mesmo modelo nosso); Hosanna Song anuncia como "Canção Divina" e Lembrança Cantada como "Histórias Cantadas". EUA: PrayerSong 1.003, Unique Song 990, Dear Melodies ~690, ForeverSongs 607, Gift Your Melody 363, DivineSong+TimelessSong 258, JoyBox 131, BeatJar 113, TrueMelodies 95, OurTune 90, Songoven 35 (US$ 19,90); a prévia antes de pagar já é de pelo menos 5 lá, e quase todos prometem reembolso. Serenata: +55 palavras no Quiz (16 concorrentes + termos de presente, que nos termos de pesquisa custam R$ 17/conv contra R$ 34 da busca por ferramenta grátis/IA), grupo NOVO "Gospel" (louvor personalizado, música gospel personalizada, música de louvor; destino /criar?t=gospel, anúncio de louvor) e "fazer música grátis" PAUSADA (R$ 60, 48 cliques, 0 conversão). Ballad: +38 no Concorrentes, +12 no Genéricas. Relido. `scratch/search-concorrentes-09out.mjs` | CPA real da Search por grupo; termos de pesquisa das palavras novas | 13/10 | é das duas |
| Serenata: públicos novos (09/10) | 09/10 01h | Dono: "pode testar mais", "compradores é bom pra testar", "sempre deixar a expansão de público ligada". Escolha pelo CPA REAL por público desde 15/07 (`_publico-historico-09out.mjs`): nicho sozinho morreu (Aniversário 0 venda em R$ 396, Gospel e fé R$ 342/venda, Presentes Personalizados R$ 253, Presente romântico R$ 188); o que vende é público amplo de compra/afinidade com o Remkt Concorrentes (hipermercados + Remkt R$ 20,99; Fãs de TV + Intenção presente + Remkt R$ 19,52; Presentes e ocasiões sozinho R$ 23,56). Insights do Google: a API recusa (token sem permissão) e o Chrome logado não tem a conta. 7 TESTES a R$ 40 (o combo Fãs de TV + Intenção + Remkt a R$ 60), cada um com Isabela 1 + Adoração 1 + Video Fone, segmentação LIGADA, /criar: Compradores + Remkt, Compradores de valor + Remkt, Lojas de departamento + Remkt, Presentes e ocasiões, Fãs de TV + Intenção presente + Remkt, Compras de Natal + Remkt, Joias/perfume/flores + Remkt. E religada a "Busca: Música e homenagem | 6 Videos | 17 Ago" (R$ 26,39 real em 169 vendas, mas com um grupo de Fãs de TV que não existe mais) como "ESCALA | Ralph V5 | Música e homenagem | 09 Out", R$ 80, vídeos de agosto PAUSADOS. Demand Gen aceita UM público por grupo: a soma vira um público "Combo … + Remkt 25+" com os segmentos juntos. Momento de vida "ninho vazio" não existe no Demand Gen (trocado por joias/perfume/flores). Relido. `scratch/ads-publicos-09out.mjs`. Mesma regra de corte (R$ 80, lead > R$ 15, 0 venda). 09/10 15h (dono): PAUSADOS antes da regra Compradores + Remkt (R$ 32, 0 lead) e Compras de Natal + Remkt (lead R$ 10,74): quase todo o gasto das 8 novas saiu de madrugada (R$ 303 entre 0h e 6h, campanha nova gasta o dia assim que liga) | CPA real por público; quem fechar < R$ 25 em 2 dias vira ESCALA | 11/10 | o vencedor vira público da Ballad em inglês |
| Serenata: otimização de 09/10 | 09/10 00h | 08/10 fechou R$ 10.516, 254 vendas, Google R$ 5.036, lucro R$ 3.862 antes do TikTok. Subiram (CPA real < R$ 25 e gastando o orçamento): CAMPEÃO 2# 1600→1840, Search 175→200, CAMPEÃO 3# 70→80, Clientes de hipermercados 60→69, Video Fone Intencao 60→69. Desceram: Remkt Concorrentes Ralph V5 300→255, ESCALA Ralph V5 Aberto 60→40, Comportamento 160→137. PAUSADOS (regra de corte): TESTE Ralph V5 isabela 3, adoracao 3 e pop gospel 1. Tudo relido. Depois (dono, "sim"): ESCALA Fãs de TV 95→115 (CPA R$ 13,37, gastou 126%) e ESCALA Semelhante compradores 48→58 (R$ 14,24, 119%). PMAX Ângulos em 08/10: R$ 70, 2 vendas, R$ 35 (empate); segura em R$ 70 até 10/10. `scratch/_serenata-orcamento.mjs`, `_pausar-testes-09out.mjs` | CPA real das que subiram e das que desceram | 11/10 | - |
| Serenata: leitura e corte de 07/10 | 07/10 | 06/10 fechou ~R$ 2.800 de lucro (Google R$ 3.681, 152 vendas, R$ 24,22). PAUSADOS (relidos): os 5 vídeos antigos do Ralph (R$ 82/venda cada), Pai dyZy e PS8R (R$ 42 em 4 dias, piorando), PMAX Ângulos (R$ 96 real em 9 dias; o orçamento tinha voltado de 70 pra 90 por alguém). Video Fone Casamento 40→60 (3 vendas a R$ 27,91, lead R$ 3,81). Ballad: pausadas 08 e 20; ficam Search e 23 (R$ 150/dia). CAMPEÃO 3#: pausada e RELIGADA no mesmo dia (dono: "historicamente boa"; com só o Video Fone, 15-26/09, fez R$ 31 real / R$ 36 no Google) com orçamento 100→60 e CPA alvo 32→26 por decisão do dono, contra o aviso de que o alvo já estava abaixo do CPA que o Google vê. Vigiar: gastando < metade do orçamento = alvo sufocou. 07/10 10h (dono): o "Ralph V5 isabela 1" entrou como 2º anúncio da CAMPEÃO 3#, ao lado do Video Fone, com 10h de teste (R$ 31, 13 leads a R$ 2,42, 2 vendas a R$ 15,74), antes de validar (`scratch/_c3-isabela1-07out.mjs`). 07/10 14h: com alvo 26 a CAMPEÃO 3# gastou só R$ 16 de R$ 60 até 13h50 (o alvo travou a entrega); alvo 26→30 (dono), orçamento 60 (`_campeao3-alvo30-07out.mjs`). `scratch/_corte-07out.mjs`, `_campeao3-religar-07out.mjs`, `_ballad-pausar-07out.mjs` | CAMPEÃO 3#: entrega e CPA real em 3 dias; Casamento a R$ 60 | 10/10 | Ballad: Search + 23 |
| Serenata: corte de 05/10 | 05/10 | LIDO 05/10 (lead e venda reais desde 03/10): PAUSADOS Esposa j-jz, Mãe JUHK, Esposa UQd7, Mãe pHVD (R$ 22-39/lead), os 3 gospel (R$ 39-54/lead ou zero), Mix E, K05, 5pc (re-teste de 04/10, R$ 15-38/lead), DG Ângulos e g8/g9 Fãs de TV 28 Set (religados pelo Ralph) e as 8 do Vid 5 (sem anúncio). Esposa UQd7 e Mãe pHVD saíram das campeãs. Mais tarde, g8 esposa e g9 flores do Remkt também (perderam pela 2ª vez; g9 com R$ 37/lead). Às 23h56, o Video Fone no Remkt Concorrentes de 05/10 (R$ 300/dia, R$ 61/venda no dia): é o mesmo vídeo no mesmo público das campeãs e disputava o leilão com elas. Ficam: Pai dyZy (R$ 29/venda), Pai PS8R (R$ 38), Plano de saúde (R$ 5,28/lead, R$ 39/venda), PMAX e os Video Fone. `scratch/_corte-testes-05out.mjs` (relido) | CPA das que ficaram | 07/10 | - |
| Serenata: orçamento sem o Vid 5 (05/10) | 05/10 23h53 | O orçamento das campeãs tinha subido em cima do CPA que o Vid 5 entregava (30/09-03/10: R$ 14-20). Sem ele, e com a trava do cartão de manhã, 05/10 foi CPA R$ 41-86 nas campeãs. Antes do Vid 5 (20-24/09) elas rodavam a ~R$ 1.000-1.450 (2#), ~780 (1#), ~300-470 (RMKT NEW) com CPA 26-35. Reduzido: CAMPEÃO 2# 3000→2000, CAMPEÃO 1# 1080→800, RMKT NEW 745→550, CAMPEÃO 3# 215→150 (relido). CPA alvo NÃO mexido (25, 26, 32; a 1# é maximizar conversões). `scratch/_serenata-orcamento.mjs` | CPA real das 4; se voltar abaixo de R$ 30, subir aos poucos | 07/10 | - |
| Serenata: redução geral e campeãs só com Video Fone (06/10) | 06/10 | Dono: "criativo só entra na campeã depois de validado" e "tem que haver uma redução geral". Saíram das campeãs Pai dyZy (gastou R$ 477 nelas em 05/10, clique a 0,4-0,7% contra 0,9-1,6% do Video Fone), Novo K05 e o Vid 5 (excluído): CAMPEÃO 1#, 2#, 3#, RMKT NEW e Comportamento têm SÓ Video Fone (a 2# também a variação "copy emoção"). Orçamento: PMAX Ângulos 100→70, Plano de saúde 79→55, Clientes de hipermercados 70→50. Search (R$ 120, CPA real R$ 16-27) e Comportamento (gasta ~R$ 40 de R$ 117) não mudaram. Pausadas Ads Novos 4-6 e Vid 5 Visitantes 30d (ligadas sem anúncio). Teto da conta: ~R$ 4.400/dia (11 testes a R$ 40 incluídos) contra R$ 7.594 gastos em 05/10. Sem teste novo até a leitura de 07/10. `scratch/_campeas-so-fone-06out.mjs`, `_serenata-orcamento.mjs` (relidos) | CPA real das campeãs | 07/10 | - |
| Serenata: Video Fone no volume dele (06/10 01h) | 06/10 | Com o Vid 5 no ar, o Video Fone rodava R$ 1.000-1.300/dia a R$ 18-29 por conversão (Google); em 05/10, sozinho, o Google empurrou R$ 5.857 nele e o CPA real foi a ~R$ 40. Dono: "toda vez que agressivamos demais no orçamento o CPA estourava" → campeãs no nível de ANTES do Vid 5 (20-24/09): CAMPEÃO 2# 2000→1400, CAMPEÃO 1# 800→600, RMKT NEW 550→400, CAMPEÃO 3# 150→100 (relido). Campeãs somam R$ 2.500/dia. Volume volta com criativo NOVO validado nos testes e posto dentro delas, não com orçamento | CPA real das campeãs abaixo de R$ 30 | 07/10 | - |
| Ballad: corte de 05/10 | 05/10 | Fim do dia (dono, "pode ser"): pausadas as campanhas de vídeo antigas SEM nenhum lead em 05/10: 02 marido dirigindo, 03 namorada carro, 18 g5 vendedor perfume, 21 ps esposa xadrez (R$ 49-59 cada no dia, 0 lead). Ficam 08 sofá (1 lead), 23 óculos (2 leads, 1 venda), 20 terno (vendeu em 04-05/10), a Search (3 leads, R$ 34/lead) e a leva Dylan 26-28 (1 dia a mais). Ballad: 7 ligadas, R$ 400/dia. `scratch/_ballad-pausar-sem-lead-05out.mjs` (relido). 06/10 (dono): pausada a leva Dylan 26, 27, 28 (R$ 153-156 cada em 04-05/10, nenhum lead). Ballad: 4 ligadas (Search, 08, 20, 23), R$ 250/dia. `abertura_en` lido em 05/10: A e C empatados (11% respondem a 1ª pergunta; Search 37%, vídeos 0-15%), segue rodando. TikTok da Ballad: 35 visitas pagas desde 03/10, nenhuma respondeu a 1ª pergunta | lead e venda das 7 | 07/10 | é a Ballad |
| Serenata: re-teste de público 04/10 | 04/10 | Vid 5 nos 4 públicos de 25/09 que ficaram perto do break-even MESMO com a segmentação desligada: Casamento (R$ 41/venda), Emoção e memória (R$ 40), New relacionamento (R$ 40), Intenção presente (R$ 42). Campanhas NOVAS, segmentação LIGADA, R$ 40/dia cada (R$ 160/dia). `scratch/ads-criar-testes-04out-publicos.mjs`. De fora: Busca (R$ 80) e Visitantes 30d (R$ 153), que tiveram tempo e foram mal. Os 4 públicos de 25/09 que seguem rodando (Fãs de TV, Aberto, RMKT NEW, Semelhante) ganharam a segmentação em 02/10 e já foram de R$ 23-28 pra ~R$ 16 | CPA real contra R$ 33,80 | 07/10 | - |
| Serenata: re-teste de 04/10 | 04/10 | Os 5 criativos que mais geraram lead entre os testes que rodaram com a segmentação DESLIGADA (lead real no banco, 25-30/09): g8 esposa R$ 11,91/lead, g9 flores R$ 12,13, Mix E nome R$ 12,67 (todos 28/09, Fãs de TV), Novo 5pc R$ 27,92 e Novo K05 R$ 28,41 (25/09). Régua: campeãs R$ 2,14-2,51/lead. Recriados como campanha NOVA, segmentação LIGADA, público Remkt Concorrentes, R$ 40/dia cada (R$ 200/dia). `scratch/ads-criar-testes-04out.mjs` (`--ligar` agora confere a segmentação). Ficaram de fora: Mix A/C/D, g1, Zm5, Criativo 6 (0 a 2 leads) | R$/lead e CPA real contra as campeãs | 07/10 | o vencedor ganha versão em inglês |
| Segmentação otimizada | 04/10 | Conserto, não teste: TODA campanha de vídeo criada pela API (testes de 25/09, 28/09, 03/10 e as 22 da Ballad) nasceu com a segmentação otimizada DESLIGADA, presa ao público; as campeãs, criadas no painel, sempre rodaram LIGADA. Os testes antigos competiram em desvantagem (leitura com viés), e na Ballad o público "Concorrentes EUA" + desligada dobrou o CPC. Ligada em 04/10 em todos os grupos ativos (`scratch/_ligar-segmentacao-otimizada.mjs <cid>`, relido) e os scripts de criação passam `optimizedTargetingEnabled: true` | CPA dos testes de 03/10 e das 2 da Ballad daqui pra frente | 07/10 | vale pras duas |
| Serenata: otimização de 04/10 | 04/10 | Leitura dos aumentos de 02/10 (3 dias fechados, 01-03/10): Ads Novos 4-6 MELHOROU com o aumento (15,87 → 13,83 e 12,32) e sobe 500→600; Clientes de hipermercados (15 vendas a R$ 11 em 3 dias, gastou 167%) 57→70. CAMPEÃO 2# piorou ~20% com o 3000 (15,61 → 20,15 / 18,57), CAMPEÃO 3#, Vid 5 Fãs de TV e Search oscilaram: SEGURADAS. PMAX Ângulos (R$ 42,70/venda real) NÃO foi pausada: por grupo, Reação real, Filhos e família e Aniversário convertem; pausados só os grupos "Oferta" (40% do gasto, o pior) e "Gospel e fé" (0 conversão). Os grupos vivos levam `?utm_content=ag_<nome>` no destino: o banco passa a ver a venda REAL por grupo (antes só o Google sabia). `scratch/_pmax-grupos-04out.mjs`, `_serenata-orcamento.mjs` | CPA real das duas que subiram; venda por `utm_content` na PMAX | 07/10 | - |
| Ballad: campeões da Serenata dublados | 02/10 | 13 = Vid 5 e 14 = Video Fone, dublados em inglês (voz ElevenLabs "Kevin" + lip sync na dublagem do Higgsfield), música nova da Ballad, legendas em inglês; no 14 o logo da LoveTune foi removido e trocado pelo selo Ballad. Uma campanha cada, R$ 50/dia, mesmo molde de 29/09 (`scratch/ballad-ads-criar-02out.mjs`). Trocar a voz da dublagem por preset do Higgsfield (voice_change) estraga o sotaque: refazer sempre gerando a fala em voz americana e dublando por cima | começou o quiz, CPA contra o 08 | 04/10 | é a Ballad |
| Ballad: leva de 02/10 (vendedor + PrayerSong) | 02/10 | 16/17/18 = g2/g4/g5 "vendedor" do TikTok da Serenata em inglês (Remotion, `idioma: "en"`, música de exemplo da Emily; `scratch/anuncio/_vendedor-ballad.mjs`). 20 a 24 = reações da PrayerSong subidas COMO ESTÃO (cartão final "PrayerSong.com"; o 21 com a marca no meio) por decisão do dono, porque o YouTube bateu o limite de uploads; versões limpas prontas em `Downloads/CRIATIVOS GRINGOS/BALLAD/ballad-2x-ps-*.mp4` (`montar.py p1..p5`) pra trocar se algum vender. Pausados 10 e 02 (~R$ 150 sem letra). Prontos e não subidos: 15 (Mix B) e 19 (g8). Ballad em ~R$ 600/dia. LIDO 04/10: as 10 da leva (13, 14, 16, 17, 18, 20-24) gastaram R$ 1.147 em 2 dias, 117 visitas, 5 responderam a 1ª pergunta (4%), 4 leads (R$ 287/lead), 0 venda. TODAS PAUSADAS em 04/10 (`scratch/_ballad-pausar-02out-04out.mjs`, status relido). No mesmo dia, ao descobrir que tudo rodou com a segmentação otimizada DESLIGADA, 6 foram RELIGADAS no molde das campeãs (público Concorrentes EUA + segmentação ligada): 02, 13, 18, 20, 21, 23, as que trouxeram lead (+ o Vid 5 dublado). `scratch/_ballad-religar-6-04out.mjs`. Ballad em R$ 500/dia, 9 ligadas. Ler 07/10: CPC (voltou dos R$ 9?), % que responde a 1ª pergunta, leads. Ficam 08 sofá, 03 namorada e a Search (o dono não sobe a Search antes de ela vender) | começou o quiz e venda por criativo; reprovação por marca de terceiro nos 20-24 | 04/10 | é a Ballad |
| Ballad: `abertura_en` (A/B/C) | 02/10 | 4% das visitas pagas passavam da abertura do /criar (Serenata 43-53%), em todos os 12 criativos. A = como era. B = pula a abertura (redireciona no `<head>` pra `?step=relacao`, uma vez por aba). C = abertura com preço às claras ("pay $19 only if you love it"), botão grande "Hear Emily's song", CTA "START MY SONG". Linha só no banco da Ballad. `abertura-en.ts`. 03/10 (dono): o vídeo de reações (`/video/reacoes.mp4`, mudo, em loop) entrou no lugar do cartão da prévia em TODOS os braços; a leitura conta a partir daí. 03/10 tarde: B ZERADO pelo peso (0 de 31 visitas pagas responderam a 1ª pergunta; A 11%, C 8%). Segue A × C | quem RESPONDEU a 1ª pergunta (`quiz_step` q>=2), letra e venda por braço (`attribution.exp.abertura_en`) | 05/10 | é a Ballad |
| Ballad: UGC do dono dublado | 04/10 | Os 6 anúncios UGC da Serenata (esposa, mãe, pai, com a tela da página e orgânico) em inglês: roteiro adaptado (sem "um minuto", diz "in minutes"), voz Kevin (ElevenLabs no Higgsfield), lip sync `sync_so` só nos trechos falados, músicas de exemplo da Ballad, `marca: "ballad"` no `AnuncioUGC`. Arquivos em `criativos/anuncios-ballad/`, montagem em `scratch/ads-serenata/en/`. O lip sync cobra 3,6 créditos/s e devolve o rosto com a cor deslocada (o vídeo do iPhone é HLG/BT.2020): `corrigir_cor.py` conserta sem gastar. As 3 gospel ficaram pra depois (~94 créditos) | começou o quiz e venda por criativo, contra o 08 | ao subir | é a Ballad |
| Serenata: UGC gravado em casa | 05/10 | 5 anúncios orgânicos (`criativos/anuncios-5out/`, montagem `scratch/ads-serenata/5out/montar_5out.py`): 5835 esposa e 5837 cachorro e 5838 cubo com Isabela, 5839 com Bianca, 5840 com Antônio. A câmera gravou o play em silêncio; a música entra na edição. **Vídeo de iPhone é HDR (HLG): converter ANTES com `avconvert -p Preset1920x1080`** (o mesmo ajuste do app Fotos). O HLG cru renderizado pelo Remotion deixava a pele rosada ("parece blush", dono). E o whisper do arquivo inteiro marca a 1ª palavra em 0,0s: o corte começa no início real da fala (RMS) | começou o quiz e venda por criativo | ao subir | - |
| Ballad: público de concorrentes | 03/10 | As 12 campanhas Demand Gen da Ballad rodavam ABERTAS (sem público). Recebem o público "Concorrentes EUA" (segmento de busca por 11 sites: songfinch, songlorious, sendaserenade, prayersong, unique-song, justoursong, songlygift, legacyjukebox, giftahit, songofus, songsbysophie; idade 25+), o mesmo molde do "Remkt Concorrentes" que faz as campeãs da Serenata. `scratch/_ballad-publico-concorrentes-03out.mjs`. Antes × depois (aberto 29/09-02/10) | clique → começou o quiz → venda; se gasta o orçamento | 06/10 | é a Ballad |
| Ballad: Search de concorrentes | 03/10 | Campanha nova "Ballad \| Search \| Concorrentes \| EUA \| 03 Out", R$ 100/dia, molde do Search da Serenata (R$ 28/conv, 84% passam da abertura). Grupos: Concorrentes (nomes de 13 marcas, exata+frase), Genéricas (custom song gift, birthday song maker…), Marca. Anúncio sem nome de concorrente. Destino /criar. `scratch/ballad-search-concorrentes-03out.mjs`. 03/10 11h: zero impressões com maximizar conversões (conta sem histórico, lance baixo) → maximizar cliques com teto R$ 10 (`_ballad-search-lance-03out.mjs`); volta pra conversões quando tiver vendas | CPA real; % que responde a 1ª pergunta | 06/10 | é a Ballad |
| Serenata: criativos de 03/10 (pai, mãe, esposa, gospel) | 03/10 | Uma campanha por vídeo, R$ 40/dia cada (R$ 360/dia), molde de 28/09. Pai/Mãe/Esposa (2 versões cada, anúncio e orgânico, mesma duração; o id do YouTube vai no nome) no "Remkt Concorrentes" com destino /criar. Os 3 gospel (descoberta, mistura, pergunta) no "Sinal 28set · Gospel e fé" com destino /criar?t=gospel e copy de louvor. `scratch/ads-criar-testes-03out.mjs` (`--ligar` confere país, idioma, público e URL e relê) | CPA real por criativo contra as campeãs; gospel: receita por lead do `?t=gospel` | 06/10 | o vencedor ganha versão em inglês |
| Ballad: leva Dylan de 04/10 | 04/10 | Os campeões da Serenata refeitos com a voz "Dylan" (ElevenLabs, roteiro coloquial) + lip sync, mais esposa e gospel novos: 25 vid5 dylan (YouTube HI0TI4K1ZXQ), 26 fone dylan (BZa9IwqyfW4), 27 esposa dylan (9Oxdfpnmyw0), 28 gospel worship (iEPfgiz7jH0, destino /criar?t=gospel, copy de worship). Campanhas NOVAS no molde das campeãs: público Concorrentes EUA + segmentação LIGADA, R$ 50/dia cada. A 13 (Vid 5 com a voz antiga) foi pausada. `scratch/ballad-ads-criar-04out.mjs` (`--ligar` confere público, segmentação, EUA, inglês e URL). Ballad em 12 ligadas, R$ 650/dia | % que responde a 1ª pergunta, R$/lead, venda; 25/26 contra 13/14 antigos | 07/10 | é a Ballad |
| Ballad: vídeo 1 do Ralph em inglês | 08/10 | O vídeo que validou na Serenata (Isabela 1 / Adoração 1) com a fala do PRÓPRIO Ralph dublada em inglês com lip sync (dublagem automática do Higgsfield, sem voz de estúdio: o dono achou o Dylan com cara de narrador), mesma montagem do português (fade in aos 17s, caixa "Listen to this song I made for my wife 🥹", chamada "Turn your own story into a song too 💛 Tap Learn more" aos 41s). Músicas geradas pela Ballad pro público que compra lá (55+), com estilo curado fora do catálogo, gravação 2, refrão do meio: 29 country clássico "Pour My Coffee First" (YouTube mTogAzeZC7g), 30 country gospel "Before I Knew Your Name" (ZepeMs-iteE). Molde das campeãs (Concorrentes EUA, segmentação LIGADA, só celular), R$ 50/dia cada, destino /criar nos dois. `scratch/criativo-ballad-esposa.mts`, `scratch/ballad-ads-criar-08out-ralph.mjs` (relido); arquivos em `materiais/ballad/ralph-en/`. Outras vozes custam 1 lip sync cada (>31 créditos; o dono não quis recarregar). LIDO 09/10: PAUSADOS os dois (dono). Faith R$ 74, 9 cliques, ninguém respondeu a 1ª pergunta; country R$ 70, 1 lead. Ballad fica só com a Search (R$ 100), que vendeu 2 em 08/10 (`_ballad-pausar-ralph-09out.mjs`, relido) | % que responde a 1ª pergunta, lead e venda; country × faith | 11/10 | é a Ballad |
| Ballad: porta cristã + criativos dublados de 03/10 | 03/10 | Não é A/B: porta nova (`/criar?t=gospel` em inglês) e dois criativos traduzidos dos de 03/10 da Serenata, voz "Dylan" (ElevenLabs) dublada com lip sync: `materiais/ballad/ballad-esposa-en.mp4` (destino /criar, página da Emily) e `ballad-gospel-en.mp4` (destino /criar?t=gospel, louvor de exemplo). Montagem: `scratchpad` → legendas palavra a palavra em Poppins por cima da faixa borrada da legenda em português | começou o quiz e venda; gospel: louvor × presente | 07/10 | é a Ballad |
| Serenata: Ralph pop gospel com URL gospel | 09/10 | Nas 3 "TESTE \| Ralph V5 pop gospel 1/2/3" (a 1 com a campanha PAUSADA), o grupo "Link Quiz" (destino /criar) foi DUPLICADO como "Link Gospel" (destino /criar?t=gospel), mesmo vídeo, textos, público, local e idioma; os dois grupos ATIVOS dividindo o orçamento da campanha. As 3 "Gospel e fé" de 03/10 já usavam /criar?t=gospel e não foram mexidas (estavam ativas, embora o corte de 05/10 as desse como pausadas). Pela API oficial deste Mac (`.env.local`, conta 6923198164 "Climes Ecom", acesso direto, sem MCC). Conta com públicos AGRUPADOS: só AUDIENCE, LOCATION e LANGUAGE se copiam pro grupo, o resto vem dentro do público. `scratch/_gospel-duplicar-09out.mjs` (valida antes, `--valer` grava), `_gospel-conferir-09out.mjs` (relido: 24×24 regras, mesmo anúncio) | venda e CPA por ANÚNCIO na aba Criativos ("… \| gospel" × original), louvor × presente no /criar?t=gospel | 12/10 | se ganhar, porta gospel nos vídeos gospel da Ballad |
| Aba Criativos | 08/10 | Não é A/B: leitura nova. Ranking de vídeo/anúncio por venda real e de título/descrição/imagem pela conversão do Google | se os vídeos campeões batem com o que o dono vê nos testes; quantas vendas ficam "sem anúncio identificado" | 15/10 | sim (mesmo código, conta da Ballad) |
| Campanha MUSICA10 (e-mail pra base + cupom de R$ 10) | ao ligar | Não é A/B: campanha. Base `pt` inteira em 2 versões (comprador × lead), 300/h, fila `campanha_envios`, job `campanhaMusica10` (liga com `CAMPANHA_MUSICA10_ON=1`). Cupom vale em música, extra, quadro e vídeo até `MUSICA10_VALE_ATE` | abertura/clique por versão, vendas com `pedidos.cupom = 'MUSICA10'`, receita, bounce e reclamação | 3 e 7 dias depois do último envio | não (só Serenata) |
| `/criar?t=gospel` | 02/10 | Não é A/B: porta própria dos anúncios gospel (louvor pra Deus ou presente com fé, 5 estilos gospel). Comparado contra o resto do funil na seção "Gospel" do painel | receita por lead do gospel contra o resto; louvor × presente | 09/10 | não (só Serenata) |
| Blog (30 artigos de SEO: 10 em 03/10 + 20 gospel em 03/10) | 03/10 | Não é A/B: canal novo. Artigos em `/blog/<slug>` por intenção de presente (pessoa, ocasião, gospel, guia), cada um com música real e CTA pro `/criar` (`?t=gospel` no louvor) | visitas, leads e vendas por página de entrada; impressões e cliques no Search Console (o dono manda o sitemap) | 23/10 | não (só Serenata) |
| `email_confirma` | 30/09 | e-mail do quiz como era × folha "Confere o seu e-mail" (e-mail grande, domínio conferido no DNS, aviso sem bloquear) | % que deixa e-mail, bounce, receita por lead | LIDO 08/10: empate na venda (15,2% × 15,2%, R$ 5,77 × 5,80/lead); e-mail que volta 4,72% no B × 5,30% no A (z ~1,6, ainda não fecha); deixa e-mail 93,2% × 93,7%. Segue, nova leitura 15/10 | já roda nas duas |
| Ballad: destino home × /criar | 30/09 | grupo original (/criar) × grupo "Home \| EUA" (mesmo vídeo e copy, destino `/`) nas 9 campanhas aprovadas (`scratch/ballad-ads-grupo-home.mjs`) | por grupo (`utm_medium` = id do grupo): passou da abertura, lead, CPA | LIDO 02/10: /CRIAR VENCEU. Home: R$ 343, 41 visitas, 0 começaram o quiz. /criar: R$ 889, 92 visitas, 5 começaram, 2 checkouts. Os 9 grupos "Home \| EUA" pausados (`scratch/_ballad-pausar-home-02out.mjs`); campanhas novas já nascem só com /criar | encerrado | home NÃO vai pra Serenata |
| Bounce: letra no domínio raiz × subdomínio | aguardando Postmaster | decidir com a reputação do Gmail | reputação, abertura da entrega | ~02/10 | idem |

**Consertos sem teste (30/09):** bump pago no cartão não liberava vídeo nem
quadro (10 liberados à mão); vídeo pago saía desfocado (JPEG 95, CRF 20);
refação de voz/estilo era recusada e, quando passava, não mudava nada;
teto dos e-mails de vídeo 14 → 35 por rodada.

**Consertos da auditoria de 30/09 (sem teste):** braço de preço com peso 0
é cobrado como o controle (`braco-cobravel.ts`; `?exp=preco:C1` cobrava
R$ 9); `/oferta/` em rotas sensíveis; código copia-e-cola no HTML do
`pix_nao_pago`; `/pix/<ref>` acha PIX do Asaas (dava "não achei" pra todos
desde 11/09); geração com trava de 1 por música; crons de e-mail com
concorrência 1; e-mail de ocasião com descadastro que funciona e trava de
descadastrados; `trackEventOnce` por sessão, não por navegador; crédito e
cortesia não viram conversão no Google/TikTok; entrega que falha avisa os
donos; `emailPlausivel` barra TLD com número; cartão usa o e-mail corrigido
no formulário e sobe a venda pro TikTok pelo servidor; sessão com compra em
andamento não gira aos 30 min (vale 7 dias); oferta só libera pagamento com
a música PRONTA; revisão mostra rótulo, não valor cru; "Melhorar com IA"
recebe o idioma.

**Consertos sem teste (02/10):** a folha de PIX do painel (música extra e
quadro) ainda tinha "Pagar com cartão" pra Perfect Pay: 5 vendas BR saíram
por lá depois de 26/09. Agora o cartão da folha é o do Asaas (ver "Venda
brasileira sai SÓ pelo Asaas"). O `taxasFaltando` passou a achar pedido
`asaas:up:` pela referência (antes dava 404 toda hora). Vídeo PAGO que falha
no render volta sozinho pra fila no `videoPendente` (de hora em hora, até 3
vezes em 72h, `resgate-video.ts`): 3 ficaram sem entrega em 01-02/10 (2 por
"Rate Exceeded", a cota de 10 Lambdas; aumento pra 1.000 pedido em 02/10).
A fila do render olha só o banco da própria marca: Serenata e Ballad renderizando
juntas na mesma conta da AWS podem estourar a cota de 10.
A limpeza de áudio pula página de exemplo (`ehExemplo`). Na Ballad, quem
abria o checkout do Stripe e não pagava não recebia NENHUM e-mail (o
`quaseComprou` pulava pedido pendente, e o `pixNaoPago` só roda na Serenata):
agora o pendente do Stripe entra na recuperação. A config dos testes A/B no
servidor (`garantirConfig`) relia "por trás" sem `await`, e na Vercel a função
congela depois de responder: a releitura ficava presa e a instância servia a
config velha pra sempre (zerar o B do `abertura_en` não chegou ao site em 10
min). Agora a visita espera até 0,4s pela releitura e releitura presa há 10s
é refeita. Ajuste (refação) que falha no provedor deixava o COMPRADOR sem
música: o ajuste limpa o áudio antes de regravar e, na falha, a linha ficava
`falhou` sem áudio (4 compradores em 02-03/10, restaurados à mão com
`scratch/_restaurar-ajuste-falho-03out.mjs`). Agora o `gerarMusica`, na falha,
devolve a versão arquivada e o direito de ajuste (`inngest/lib/restaurar-ajuste.ts`).

**Consertos sem teste (04/10) — o incidente dos e-mails:** a trava "já
mandei?" de quase toda rotina de e-mail busca `event_data @> {...}` em
`funnel_events`. Com a tabela em 5,2 milhões de linhas, a busca dentro de
`email_letra_enviado` passou a levar 16-20s; o PostgREST corta em 8s, o erro
voltava como lista vazia e o `mandarLetra` lia "não mandei": desde 24/09 a
letra saiu repetida pra 942 pessoas (até 32 vezes em 24h, ~3.000 envios a
mais em 5 dias). A escada de recuperação lia a mesma trilha inteira por
OFFSET e morreu em 29/09 sem erro visível (o vigia externo avisou em 04/10).
Conserto: índice GIN parcial `funnel_events_envios_gin` nos eventos de envio
(16s → 0,5ms, aplicado na hora); `mandarLetra` confere `emails_enviados`
primeiro e, NA DÚVIDA, NÃO ENVIA; a escada lê só a janela de 45 dias por
cursor de tempo, um evento por vez. De quebra: a lista `emails_mortos` (2.540
linhas) era lida cortada em 1000 no `mandarLetra` e no `volteCriar` — 1.540
endereços mortos seguiam recebendo (bounce de 4,8% em 03/10); agora é
conferido por endereço. **Regra:** trava de "já mandei" falha FECHADA, e
consulta em `funnel_events` sem `created_at` na janela é bug esperando
acontecer. No mesmo dia o Google da Serenata ficou ~11h parado (21h de 03/10
às 8h de 04/10) por cartão sem saldo. Ainda em 04/10, pelo suporte: (1) a SEGUNDA
música no mesmo navegador sobrescrevia a primeira (efeito colateral da sessão
de 7 dias de 30/09: mesma linha de `quiz_responses`, respostas trocadas, a
segunda nunca gerada); agora "começar" na abertura com `letraFinal` gira a
sessão e zera a store. (2) Ajuste com pedido vazio + voz/estilo IGUAIS aos da
música regravava igual e gastava o direito; agora volta `curto`. (3) Toda
trava "já mandei?" das 12 rotinas de e-mail falha FECHADA.

**Leitura e consertos de 08/10:** o `prova_blocos` (sorteio da JBL, encerrado no código em 27/09 por risco regulatório) seguia com B peso 1 NO BANCO: metade dos leads via o sorteio até 08/10. Zerado. Lição: decisão de teste só vale relida na tabela `experimentos`, não no comentário do código. Leitura em `scratch/_leitura-testes-08out.mjs`, `_leitura-obrigado-08out.mjs`, `_leitura-entrega-08out.mjs`; aplicado em `_aplicar-leitura-08out.mjs` (relido). Os sorteios dos testes são independentes entre si (cruzados par a par). Consertos sem teste: na Ballad, o voltar do celular com o checkout do Stripe aberto andava no histórico do quiz (3 de 17 sessões); agora só fecha a folha (`CheckoutStripe.tsx`). No iPhone, o teclado ainda cobria o "continuar" em ~15% das sessões dos passos de digitar (o `resizes-content` de 31/08 só vale no Android; o dono reproduziu, 2-3 toques): a barra sobe pelo `visualViewport` (`barra-teclado.ts`), LIGADA SÓ POR APARELHO (`?barra=1`) até o dono conferir no iPhone; depois `LIGADA_PRA_TODOS = true`. O "WPBN" NÃO aparece no checkout embutido do Stripe (conferido em modo teste): só na fatura.

**Auditoria noturna de 08/10 (dono: "o que for bug pode ir resolvendo"), consertos no ar:**
- PAGAMENTO (Asaas): trava "um quiz, uma entrega" no webhook, no cartão e no vigia de pagamento (o quiz bb9effb8… pagou R$ 38 duas vezes, 03 e 06/10, e recebeu duas entregas); PIX e cartão devolvem `ja-pago` antes de cobrar quem já pagou; PIX vencido (OVERDUE, que no Asaas CONTINUA PAGÁVEL) e PIX vivo de outro valor são cancelados ao gerar o novo, e cobrança paga nunca é reaproveitada nem rebaixada pra pendente; estorno e chargeback viram `reembolsado` com alerta (PRECISA ligar os eventos no painel do Asaas); pagamento sem pedido pendente acha o quiz pela referência da RECONSULTA e avisa. Regras puras em `asaas-regras.ts`.
- `/oferta/<token>` (escada R$ 29/19/9) estava MORTA desde que o PIX foi pro Asaas (exige CPF e a página recusava): agora pede o CPF (`TelaCpf.tsx`, extraída da folha do PIX). Saídas do `/pix/<ref>` e da oferta vão pra `/retomar?s=` (`volta-ao-funil.ts`), não pra abertura do quiz.
- GERAÇÃO: termo barrado pelo Suno sem acento ("que delicia" × "que delícia") travava a música pra sempre (`recusa-provedor.ts`; 4 regeradas à mão, uma de cliente de crédito); `singleton` por música no `gerarMusica` (o `concurrency` por chave não segura execução dormindo: 642 gerações a mais em 7 dias, ~R$ 205); vigia conta `gerando` pelo `updated_at`; teto diário cobrado UMA vez por música (02/10 o contador chegou a 3.609 pra 2.498 músicas e 37 leads ficaram sem música); repescagem também em erro 5xx; o clique de comprar redispara no máximo 3x por música em 24h e nunca recusa de conteúdo; timeout guarda o taskId do provedor.
- FUNIL: laço infinito reveal ↔ /retomar pra sessão com letra e nome vazio (19 sessões, uma girou 8.302 vezes); história feita só de começos de frase liberava o botão e o modelo recusava o refrão (333 erros/72h); `emailPlausivel` recusa ponto nas pontas/repetido e acento antes do @ (o Resend recusava e a `mandarLetra` tentava pra sempre; recusa do Resend vai pra `emails_mortos`); `/p` serve a versão arquivada durante o ajuste (antes: "link incompleto"); /obrigado acha a compra pela referência guardada; valor da conversão é o COBRADO (`valor-conversao.ts`); /retomar repõe o braço no `<html>` e não apaga gclid/utm; player do presente; fotos com a gravação 2; textos em espanhol.
- BALLAD: o caixa do Stripe mostra "Ballad Gift" e a cor da marca (`branding_settings`, antes "WPBN" e botão magenta); X pra fechar e fundo que não fecha no toque duplo; vídeos pausam com o pagamento aberto; o voltar do celular fecha a folha.
- E-MAIL: trava de "já mandei" gravada ANTES do envio em todas as réguas (falhou a gravação, não envia; Resend recusou, solta a trava; helpers `inngest/lib/trava-envio.ts`); lista de bloqueio (`emails-mortos.ts`) falha FECHADA e inclui `excluidos_email`; `jaComprou` por pessoa antes de cada e-mail de recuperação (compradores recebiam "você não comprou", 1-13/dia); `mandarLetra` lê a janela real de 48h por cursor; ocasião (Dia das Crianças chegou a só 261 compradores) lê a base inteira por cursor, trava exata por pessoa, teto de 12 por rodada mantido; escada com relógio no último envio e idioma da marca; quase_comprou e pix_nao_pago sem Perfect Pay (cartão do Asaas tem e-mail próprio e reconsulta no Asaas); vigia de pagamento olha as 72h inteiras antes do teto; bounce temporário só bloqueia na 2ª vez (`TEMPORARIOS_ATE_BLOQUEAR`, reverte a regra de 15/08); descadastro da Ballad em inglês; `videoPendente` roda na Ballad; travessão fora dos assuntos.
- BANCO: índices `musicas(gerada_em)` e trigrama em `quiz_responses(email)` (consultas a 6,8-8s do corte); vigia externo transforma erro de consulta em alerta; ofertas de quadro/vídeo, escada e convite leem com janela/cursor; Ballad com as 6 migrations que faltavam (o resumo do painel dava 500 de hora em hora).

**Novidades de 08/10 que não são A/B:** ocasião "Natal" (🎄, pt/es/en) aparece sozinha de 15/11 a 31/12 (horário de Brasília, `natal.ts`), em primeiro na lista; o prompt aceita `natal` o ano todo. /criar mais leve (conserto): gerador de QR do PIX e o React do Stripe saem do primeiro carregamento (-15 KB gz). Próximos ganhos medidos e não feitos: carregar `TelaOferta`/`RevealStep` sob demanda no `Quiz.tsx` (-34 KB gz) e tirar o zod do chunk de entrada (-14 KB gz em toda página). Em dev, carregamento sob demanda de pacote novo pode dar "Invalid hook call" até limpar `node_modules/.vite` (não acontece no build).

**Consertos sem teste (06-07/10):** o ajuste regrava a música INTEIRA (melodia
e voz novas), mesmo pra trocar uma palavra; o Silvio pediu "querida" → "querido",
recebeu outra música e quis a primeira de volta. O aviso ao lado do botão de
ajuste passou a dizer isso antes (`PedirRefacao.tsx`). No vídeo-presente, a cena
"cheia" cortava foto deitada (`cover` num quadro 9:16 mostrava ~42% da largura
de uma 4:3); duas compradoras reclamaram, uma pra usar no casamento. Agora só
foto EM PÉ é cortada; deitada ou quadrada entra inteira na largura, sobre ela
mesma desfocada (`Presente.tsx`, proporção lida com `delayRender`). Site da
Lambda republicado (`video:site`) e os dois vídeos refeitos. Mesmo dia, RESOLVIDOS: (1) o
ajuste recusava a maioria (36 compradores pagos em 7 dias nunca conseguiram):
"falhou" era o Sonnet 5 pensando até estourar `max_tokens` (agora
`thinking: disabled`, 8000), "vago" era a regra descartando ajuste já aplicado
quando o modelo deixava `aviso` e o prompt mandando perguntar em pronúncia,
letra colada e frase nova; a régua agora é a letra ter mudado
(`refacao-decisao.ts`), o campo aceita 4000 caracteres, o Claude roda ANTES de
arquivar (sem versão órfã) e o teto de uso volta a valer. (2) 7 dos 11 exemplos
da home tinham perdido o áudio em 12-16/09 porque `ehExemplo` só protegia token
`ex…`; agora vale todo token de `exemplos-pt.ts`/`exemplos-en.ts`
(`token-exemplo.ts`). Eva, Denise e Camburi restaurados com o arquivo idêntico
que estava em Downloads (`scratch/_restaurar-exemplos-07out.mjs`); Rose,
Isabela, Garga e Li se perderam (nem Storage nem provedor): regravados no mesmo lugar (mesma letra, mesmo token, gravação 2 como principal, `scratch/_regravar-exemplos-07out.mjs`) por decisão do dono; os trechos de 45s da home de rose, garga e li passaram pra gravação 2 nova (antigos salvos em `materiais/exemplos-regravados-07out/`); o da Isabela NÃO, porque é o mesmo dos anúncios do Ralph. Os 36 compradores que desistiram do ajuste receberam e-mail avisando que agora funciona (`scratch/_avisar-ajuste-07out.mjs`).

## Em aberto

- Nome e marca
- **Desenho do paywall**, agora que se sabe que a música fica boa e barata:
  quanto se ouve de graça (trecho? versão 1 completa?) e o que exatamente se
  paga (música completa + página presente + MP3 + QR). Testado: a letra
  sozinha, lida em silêncio, NÃO segura a emoção — a música segura.
- ElevenLabs como alternativa juridicamente sólida ao Suno: só vale
  investigar depois de validar demanda (o Suno já provou qualidade)
