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

## /criar gospel (02/10/2026)

`/criar?t=gospel` é a porta dos anúncios gospel. Desenho em
`docs/superpowers/specs/2026-10-02-criar-gospel-design.md`.

- **O tema mora em `respostas.tema` e `attribution.tema`** (`tema.ts`). O `?t=`
  só decide a primeira tela; o quiz troca a URL a cada passo e o tema segue
  pelas respostas. Só o funil `pt`: Ballad e `/es` ignoram.
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
| `obrigado_direto` | 30/09 | botão "Entrar na conta" × "Ouvir minha música completa" direto no editor + copiar link + WhatsApp | abriu o editor em 1h, "cadê a música" no suporte por comprador, vídeo por comprador | 07/10 | sim, se ganhar |
| `duvidas_pagamento` | 30/09 | FAQ de sempre × grátis/pagar depois/boleto/nome no PIX no topo | conversão da oferta, suporte de não-compradores | 07/10 | adaptar (cartão, dólar) |
| e-mail `entrega` variante | 30/09 | e-mail de sempre × "ouvir e baixar", fotos pelo que fazem, link do ajuste | abertura/clique, editor aberto, fotos subidas, vídeo vendido, suporte | 07/10 | sim, se ganhar |
| `bump_quadro` | 25/09 | A sem bump; V e C ZERADOS em 30/09 (canibalizavam o vídeo do editor) | vídeo por comprador e receita por lead | confirmar em 07/10 | Ballad não tem bump |
| assunto `letra_pronta` | 28/09 | assunto de sempre × nome na frente | abertura e venda em 48h | já pode ler | sim, se ganhar |
| criativos Google 28/09 (g8, g9, Mix E) | 28/09 | LIDO 30/09: PERDERAM. Cada um ~R$ 105-120 e 1 venda (CPA > R$ 100, lead R$ 8,60-10,90) contra o controle Vid 5 no mesmo público (R$ 31/venda, R$ 2,44/lead). Os três PAUSADOS em 30/09 | CPA real do banco | encerrado | - |
| PMAX/DG Ângulos | 28/09 | DG PAUSADO 30/09 (R$ 164 por 1 venda). PMAX segue: R$ 45 acumulado, mas R$ 16,80 no 3º dia | CPA real | 03/10 (só a PMAX) | - |
| Vid 5 nas campeãs + escala | 25-29/09 | CPA antes × depois: CAMPEÃO 2# 25→20, 1# 30→24, 3# 29→19, RMKT NEW 27→16, Comportamento 27→40. Em 30/09: CAMPEÃO 1# R$ 750→900 (única travada por orçamento, 93%); Comportamento R$ 205→117; pausadas Vid 5 Visitantes 30d/Busca/Casamento/Emoção/New relacionamento e Plano de saúde (acima de R$ 34) | CPA real do CAMPEÃO 1# com R$ 900 | 03/10 | - |
| Ballad: 10 campanhas EUA | 29/09 | um criativo por campanha | clique → lead, depois CPA < US$ 15. Só 1 de 24 visitas pagas passou da abertura (Serenata 43-53%); desde 30/09 mede `abertura_tempo` (5/15/30s) e `abertura_rolou` pra separar clique acidental de rejeição | 01/10 | é a Ballad |
| Ballad: corte de criativos | 01/10 | 1ª venda real (01/10 11h38) veio do 08 curto sofá (grupo /criar). Pausados 11, 09, 07, 05 e 12 (R$ 124-135 cada, nenhuma visita começou o quiz). Ficam 08, 03, 02 e 10 a R$ 50/dia | começou o quiz e venda por criativo | 02/10 | é a Ballad |
| Velocidade: pixels e fonte depois da página | 02/10 | Conserto, não teste A/B: gtag e pixel do TikTok criam a FILA na hora e o arquivo pesado baixa depois do `load` (teto 5s; na /obrigado e /es/gracias, na hora); a Google Fonts entra por script (não trava a pintura). Antes, no mesmo dia: o Stripe.js (~880 KB) saiu da abertura do /criar da Ballad (`/pure` + `loadStripe` ao abrir a folha). Lighthouse celular 4G /criar Ballad: 1.836 KB e LCP 14,8s → 848 KB e LCP 8,8s só com o Stripe. Base pra comparar: % de cliques pagos do Google que chegam a registrar a página (gclid distinto ÷ cliques): Serenata 81% (01/10), Ballad /criar 74% | % de cliques que chegam; LCP no Lighthouse | 04/10 | vale pras duas |
| Serenata: corte e escala de 02/10 | 02/10 | A "pausa de 30/09" (Vid 5 Visitantes/Busca/Casamento, Mix E, DG Ângulos) NUNCA mudou o status: o histórico da conta só mostra lance e horário. Pausadas DE VERDADE em 02/10, com mais Ads Novos 1-3, Video 2-vo e NOVO PB RMKT (~R$ 510/dia, CPA real R$ 50-200). Orçamento +20%: CAMPEÃO 2# 2500→3000, Ads Novos 4-6 420→500, CAMPEÃO 3# 180→215, Vid 5 Fãs de TV 110→130, Search 101→120 (CPA real 3d R$ 14-18, todas gastando ~100%). `scratch/_serenata-otimiza-02out.mjs`. Lição: pausa só conta depois de reler o status | CPA real das 5 que subiram; o total diário | 04/10 | - |
| Ballad: campeões da Serenata dublados | 02/10 | 13 = Vid 5 e 14 = Video Fone, dublados em inglês (voz ElevenLabs "Kevin" + lip sync na dublagem do Higgsfield), música nova da Ballad, legendas em inglês; no 14 o logo da LoveTune foi removido e trocado pelo selo Ballad. Uma campanha cada, R$ 50/dia, mesmo molde de 29/09 (`scratch/ballad-ads-criar-02out.mjs`). Trocar a voz da dublagem por preset do Higgsfield (voice_change) estraga o sotaque: refazer sempre gerando a fala em voz americana e dublando por cima | começou o quiz, CPA contra o 08 | 04/10 | é a Ballad |
| Ballad: leva de 02/10 (vendedor + PrayerSong) | 02/10 | 16/17/18 = g2/g4/g5 "vendedor" do TikTok da Serenata em inglês (Remotion, `idioma: "en"`, música de exemplo da Emily; `scratch/anuncio/_vendedor-ballad.mjs`). 20 a 24 = reações da PrayerSong subidas COMO ESTÃO (cartão final "PrayerSong.com"; o 21 com a marca no meio) por decisão do dono, porque o YouTube bateu o limite de uploads; versões limpas prontas em `Downloads/CRIATIVOS GRINGOS/BALLAD/ballad-2x-ps-*.mp4` (`montar.py p1..p5`) pra trocar se algum vender. Pausados 10 e 02 (~R$ 150 sem letra). Prontos e não subidos: 15 (Mix B) e 19 (g8). Ballad em ~R$ 600/dia | começou o quiz e venda por criativo; reprovação por marca de terceiro nos 20-24 | 04/10 | é a Ballad |
| Ballad: `abertura_en` (A/B/C) | 02/10 | 4% das visitas pagas passavam da abertura do /criar (Serenata 43-53%), em todos os 12 criativos. A = como era. B = pula a abertura (redireciona no `<head>` pra `?step=relacao`, uma vez por aba). C = abertura com preço às claras ("pay $19 only if you love it"), botão grande "Hear Emily's song", CTA "START MY SONG". Linha só no banco da Ballad. `abertura-en.ts` | quem RESPONDEU a 1ª pergunta (`quiz_step` q>=2), letra e venda por braço (`attribution.exp.abertura_en`) | 05/10 | é a Ballad |
| Ballad: público de concorrentes | 03/10 | As 12 campanhas Demand Gen da Ballad rodavam ABERTAS (sem público). Recebem o público "Concorrentes EUA" (segmento de busca por 11 sites: songfinch, songlorious, sendaserenade, prayersong, unique-song, justoursong, songlygift, legacyjukebox, giftahit, songofus, songsbysophie; idade 25+), o mesmo molde do "Remkt Concorrentes" que faz as campeãs da Serenata. `scratch/_ballad-publico-concorrentes-03out.mjs`. Antes × depois (aberto 29/09-02/10) | clique → começou o quiz → venda; se gasta o orçamento | 06/10 | é a Ballad |
| Ballad: Search de concorrentes | 03/10 | Campanha nova "Ballad \| Search \| Concorrentes \| EUA \| 03 Out", R$ 100/dia, molde do Search da Serenata (R$ 28/conv, 84% passam da abertura). Grupos: Concorrentes (nomes de 13 marcas, exata+frase), Genéricas (custom song gift, birthday song maker…), Marca. Anúncio sem nome de concorrente. Destino /criar. `scratch/ballad-search-concorrentes-03out.mjs` | CPA real; % que responde a 1ª pergunta | 06/10 | é a Ballad |
| `/criar?t=gospel` | 02/10 | Não é A/B: porta própria dos anúncios gospel (louvor pra Deus ou presente com fé, 5 estilos gospel). Comparado contra o resto do funil na seção "Gospel" do painel | receita por lead do gospel contra o resto; louvor × presente | 09/10 | não (só Serenata) |
| `email_confirma` | 30/09 | e-mail do quiz como era × folha "Confere o seu e-mail" (e-mail grande, domínio conferido no DNS, aviso sem bloquear) | % que deixa e-mail, bounce da `letra_pronta`, receita por lead, `email_confirma_corrigir` | 07/10 | já roda nas duas |
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
A limpeza de áudio pula página de exemplo (`ehExemplo`).

## Em aberto

- Nome e marca
- **Desenho do paywall**, agora que se sabe que a música fica boa e barata:
  quanto se ouve de graça (trecho? versão 1 completa?) e o que exatamente se
  paga (música completa + página presente + MP3 + QR). Testado: a letra
  sozinha, lida em silêncio, NÃO segura a emoção — a música segura.
- ElevenLabs como alternativa juridicamente sólida ao Suno: só vale
  investigar depois de validar demanda (o Suno já provou qualidade)
