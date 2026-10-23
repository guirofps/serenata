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
  **Exceção decidida pelo dono (14/10):** nos anúncios gravados por ele no formato do Vid 5, as falas
  "fica pronto em menos de um minuto" e "é de graça" (a prévia) FICAM: a música sai em ~51s de mediana e
  a prévia é grátis. Não cortar essas falas dos vídeos dele. A promessa conservadora segue no site e nos e-mails.
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

## Gerador reserva: a música nasce sem o Inngest (09/10/2026)

**Segunda queda igual.** 09/10, das **18h06 às ~18h47**, o Inngest ficou em
"Degraded Function Execution" de novo (rede deles): aceitava `musica/gerar` e
não executava nada. Nenhuma música pronta em 40 minutos, ~60 leads parados na
prévia sem poder comprar, 2 compradores pagos salvos pelo plantão manual. O
vigia externo gritou às 18h30 (funcionou), mas gritar não gera música. Duas
quedas em cinco semanas: a geração não pode ter ponto único de falha.

`api/gerador-reserva.ts`, **Vercel Cron a cada minuto**, fala direto com o
banco e com o kie.ai, sem importar nada do Inngest. Regra pura em
`src/lib/reserva-decisao.ts` (testada):

- `aguardando` intocada por 3 min, ou `gerando` sem task há 5 min: ninguém
  começou. Assume a posse (`reserva_em`, UPDATE condicional no `updated_at`
  lido), confere o disjuntor e dispara. Até 2 gerações por música
  (`MAX_TENTATIVAS`), a 2ª com o estilo curado puro e sem o termo barrado;
  depois `falhou` com o motivo (fica pra repescagem) e alerta se pagou.
- Task em andamento (`task_atual`) do JOB sem a música pronta há 8 min: o job
  morreu no polling. Pergunta ao provedor e, se a gravação existe, TERMINA
  ESSA (não paga outra). Falha do job só é assumida depois de 15 min (respiro
  de 10 min dele).
- Grava a prévia (2ª gravação), guarda, timestamps, `pronta` e entrega a quem
  pagou com o MESMO código do job (`inngest/lib/guardar-musica.ts`).
- 15 gerações novas por volta, 45s de trabalho por volta, 1 volta por minuto
  (trava `gerador-reserva:<minuto>` no `consumir_limite`). Avisa os donos 1x
  por hora quando assume ("🛟 Gerador reserva assumiu…").
- `?seco=1` (com o `CRON_SECRET`) lista o que faria sem tocar em nada.

**Por que não paga duas vezes.** O job pula música `pronta` e música com
`reserva_em` mais nova que 45 min (`RESERVA_SEGURA_MIN`), e confere de novo
antes de cada disparo (acorda de um respiro e acha a posse do reserva). A task
de quem disparou fica em `task_atual`/`task_em`, limpa em `pronta`/`falhou`:
task que já virou música nunca é "adotada" por um ajuste futuro.

**Isso muda a regra "no plantão, só quem PAGOU" acima.** Ela valia porque o
Inngest, ao voltar, gerava tudo de novo; hoje ele pula o que está pronto ou
com o reserva. O `plantao-musica.mjs` vira plano C (reserva também fora: a
Vercel caiu junto).

**1ª queda de verdade (10/10, desde ~11h):** o Inngest caiu de novo e o reserva gerou 158 músicas na Serenata e 1 na Ballad, todas prontas, 30+ compradas; o dia seguiu vendendo acima do anterior. Preço: espera de ~4,5 min por música (3 min antes de assumir + ciclo de 1 min) contra ~1 min normal. Conserto no mesmo dia: **modo queda** — com 3+ músicas assumidas nos últimos 15 min, o reserva assume com 30s (`PARADA_EM_QUEDA_MIN`); a rota devolve `emQueda`.

Colunas novas em `musicas` nas DUAS marcas (`20261009000000_gerador_reserva`).
Mesma noite: a Ballad estava sem as migrations de 08/10 (`pedidos_veio_de`,
`criativos_ads`); aplicadas com `scratch/ballad-migrar.mjs`.

## Vídeo-presente (24/09/2026)

Upsell de R$ 24,90: as fotos da página passando no ritmo da música, com a
letra acendendo palavra por palavra. Remotion (`video/src/`), render na AWS
Lambda (us-east-1), job `inngest/functions/renderizarVideo.ts`.

**A página e o vídeo são a mesma montagem.** O bloco do vídeo mora DENTRO do
editor, entre a dedicatória e a entrega, com a prévia TOCANDO pelo
`@remotion/player`: a mesma composição da Lambda, com as fotos e a frase ao
vivo do editor e a marca "PRÉVIA". Ela vê o que compra antes de pagar, a
custo zero.

### Vigia do vídeo e cota nova da AWS (10/10/2026)

O vídeo do Odilon começou a renderizar segundos antes da queda do Inngest de 09/10: o render TERMINOU na Lambda e o job nunca voltou pra buscar, 19h "renderizando" com o MP4 no S3 (resgatado à mão, `scratch/_resgatar-video-10out.mjs`). `api/vigia-video.ts` (Vercel Cron, 5 min, fora do Inngest): `renderizando` há 25+ min com `render_id` → pergunta à Lambda; pronto → baixa, sobe, marca `pronto` (com a assinatura) e manda o "vídeo pronto"; falhou na AWS ou nem disparou → `falhou`, e o `videoPendente` refaz. Não dispara render novo. Avisa os donos quando entrega.

A AWS aprovou **1.000 Lambdas simultâneas em 03/10** (caso 179098992600639) e ninguém tinha subido o código: agora 20 Lambdas por render (era 6, ~3x mais rápido) e até 6 renders no ar por marca (era 1 por vez). Consulta da cota: `scratch/_aws-cota-lambda.mjs` (o usuário da Remotion lê o Service Quotas, não o `GetAccountSettings`). Custo de outubro até 10/10: ~511 renders, ~US$ 21.

### Invariantes

- **Uma cópia só do Remotion, na raiz.** `video/` não tem package próprio
  (tinha React 18 e o app tem 19: duas cópias quebram hooks). Estúdio e
  deploy: `npm run video:estudio | video:site | video:funcao`. Mudou o
  template, **rodar `video:site`**: o site no S3 é o que a Lambda usa.
- **Conta nova da AWS: cota de 10 Lambdas simultâneas** (SUBIU pra 1.000 em 03/10, ver acima), sem aumento pela
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

## Clarity e Omnisend (16/10/2026)

Dois scripts novos no site da Serenata, no molde do pixel do TikTok: só na
Serenata (`clarityDaMarca`, `omnisendDaMarca`), fora das rotas de
`rotas-sensiveis.ts`, e o arquivo remoto entra pela porta de
`carregar-depois.ts`.

- **Clarity (`clarity.ts`) grava a TELA, não só a URL.** Por isso o script
  envolve o `pushState`: navegar pelo SPA até uma rota sensível (`/obrigado` →
  editor) manda `clarity("stop")` ANTES de a URL mudar, e sair dela manda
  `start`. Ele mascara campo de digitar por padrão, mas texto desenhado (a
  letra, o nome do presenteado) aparece nas gravações.
- **Omnisend (`omnisend.ts`) é SÓ campanha de marketing** (decisão do dono,
  15/10). Letra, recuperação, entrega e as outras réguas continuam no Resend.
  Antes da primeira campanha grande: subdomínio próprio pro envio e
  descadastro sincronizado com `descadastros`/`emails_mortos`, senão quem saiu
  de um continua recebendo do outro.

- **Base importada em 19/10** (`scratch/omnisend-subir-contatos.mjs`, chave `OMNISEND_API_KEY` no `.env.local`, conta Serenata `6ad0e987…`; o conector Omnisend do claude.ai está na marca Mon Auralis, de OUTRO negócio: não usar pra Serenata): 61.209 e-mails do CSV "Baixar para o Omnisend" (9.262 compradores, 51.947 leads, entrada 22/07-19/10), TODOS como inscritos (dono), etiquetas `serenata` + `comprador`/`lead`, propriedade `entrou_em`, sem telefone. 0 erro. Lote máximo do Omnisend: 100 itens. Ainda NÃO existe: subdomínio de envio autenticado (`news.serenatagift.com`, DNS na Hostinger; o DMARC raiz é quarentena), sincronização de descadastro nos dois sentidos, e entrada contínua dos leads novos. Nenhuma campanha antes do subdomínio e do descadastro.

## Conta nova do Google Ads (17/10/2026)

A **Climes Ecom (692-319-8164) foi SUSPENSA em 17/10** por anúncios com rosto trocado (vídeos do carro de 16/10 e o "Vid 5 volta"). Conta suspensa só deixa LER pela API (`ACTION_NOT_PERMITTED_FOR_SUSPENDED_ACCOUNT` em qualquer mutate, até `validateOnly`). A Serenata passou pra **Seren Out26 (477-958-6821)**, gerida pela MCC **Falkland (502-439-4715)**: toda chamada leva `login-customer-id: 5024394715` (`scratch/_gads.mjs` lê `GOOGLE_ADS_LOGIN_CUSTOMER_ID`). A Ballad NÃO muda (conta própria).

- **Ações de conversão copiadas da antiga** (`scratch/conta-nova-conversoes.mjs`): Compra, begin_checkout, add_to_cart, Botão Whatsapp (tag, `AW-18519340909`) e "Compra Serenata (importada)". As do GA4 só nascem vinculando o GA4.
- **A importada da antiga vinha da IMPORTAÇÃO AGENDADA por URL** (`api/conversoes.ts`, CSV), nunca da API. Pela API, conta nova recebe `CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE` (exige Data Manager API). Até a importação agendada ser recriada no painel da conta nova e a 1ª leva entrar, a **Compra (tag) é a PRIMÁRIA** e a importada secundária (`scratch/conta-nova-primaria.mjs`); depois inverter (duas primárias = venda contada 2x).
- **Tag do site:** `AW-18519340909`, conversão `AW-18519340909/rRbZCLzNo6AdEO3u2v5E` (`google-ads.ts`). O GA4 era DESTINO da tag da conta antiga (`GT-5TWGDWC6`); agora o site faz `config` do GA4 explicitamente (`scriptConfigGtag`). NÃO adicionar o GA4 como destino da tag nova no painel: contaria cada página 2x.
- **Campanhas da conta nova (17/10, ligadas)**, `scratch/conta-nova-campanhas.mjs` (preparar → campanhas → ligar; molde lido da antiga em `conta-nova-molde.json`). Dono: R$ 200/dia no total, estrutura enxuta. `DG | Concorrentes 35+ | Seren | 17 Out` R$ 100 (segmentos "Pesq Sites Concorrentes" + "Concorrentes" recriados; Video Fone, Adoração 1, Dono vid5 v1-v3, JBL); `DG | Interesses 35+` R$ 50 (grupos Fãs de TV, Comportamento, Casamento e Intenção presente; Fone + Adoração em todos, reações esposa no Casamento, mãe/filho e pai/filha em Fãs de TV e Comportamento); `Search | Serenata | 17 Out` R$ 50, maximizar cliques com teto R$ 2,50 (sem histórico de conversão), grupos Marca, Genéricas (Home e Quiz da antiga juntos: repetiam palavras) e Concorrentes (SEM `{Keyword:}`, que poria marca alheia no título), só palavras que venderam em 30 dias com CPA ≤ R$ 60, as 30 negativas. Todo público 35+ SEM n/id; as 3 SÓ CELULAR (dono, 17/10; a Search também), 6h-24h, segmentação LIGADA no Demand Gen. Canais do Demand Gen: SÓ YouTube (feed, in-stream, Shorts) e Discover (dono, 17/10): na antiga, 30 dias, YouTube 99,5% do gasto e todas as vendas; Display R$ 661 e 0 venda (CTR 22% = toque acidental); Gmail R$ 0. Proibidos na conta nova: Vid 5 (GFwkSuPAFIM), Vid 5 volta (s8Tqz0xVafg) e os vídeos do carro. Semelhante aos Compradores e remarketing NÃO existem aqui (lista é da conta): subir a lista de compradores (botão da aba E-mail) quando a conta puder usar Customer Match. Escala: +20%/dia só com CPA < R$ 28; Search passa pra maximizar conversões depois de ~30 conversões.
- **3 campanhas de 1 criativo campeão (18/10, ligadas pelo dono)**, `scratch/conta-nova-campanhas-2.mjs`, R$ 40/dia cada (conta em R$ 320/dia): `DG | Hipermercados 35+ | Video Fone` (público novo, Superstore Shoppers; antiga R$ 18,20, 35 conv), `DG | Intenção presente 35+ | Video Fone` (R$ 18,30, 30), `DG | Fãs de TV 35+ | Adoração 1` (R$ 19,50, 70) — as melhores combinações público × criativo da antiga em 17/09-16/10, sem Remkt Concorrentes, Vid 5 nem listas. Mesmo molde (35+ sem n/id, celular, 6h-24h, YouTube + Discover). Os grupos Fãs de TV e Intenção da `DG | Interesses 35+` seguem LIGADOS (dono escolheu não pausar): a conta disputa esses dois públicos consigo mesma; ler o CPA das novas sabendo disso.
- **O painel lê AS DUAS contas** (`src/lib/contas-google-ads.ts`, cravado na Serenata como a tag; a Ballad segue pela env): a nova primeiro (é a única que recebe escrita, ex. listas de público) e a suspensa só pra leitura: os ajustes retroativos dos últimos 7 dias e os cliques antigos de quem compra hoje (`consultarCliques` procura conta por conta). Os ids não se repetem entre contas, então o histórico da antiga fica nas mesmas tabelas. Uma conta que falha não derruba a outra (`consultarTodasAsContas`); o corte por hora do comparativo soma as duas e, se uma falhar, volta pra fração do dia. Com isso a env `GOOGLE_ADS_CUSTOMER_ID` da Vercel da Serenata deixou de decidir a conta (o login `nosfer` na CLI não altera env de produção). **18/10: o refresh token de produção NÃO enxerga a conta nova** (log `[metricas-ads] conta 4779586821 falhou: The caller does not have permission` toda hora desde 17/10; o painel mostrou "—" no gasto). É outro login que não o deste Mac, provavelmente guilhermerojasiqueira@gmail.com (quem criou campanha pela API na antiga). Conserto: convidar esse login DIRETO na Seren Out26 (acesso Padrão); `consultarGoogleAds` tenta pela MCC e, se ela recusar por permissão, de novo SEM o `login-customer-id` (`google-ads-acesso.test.ts`).

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
- **O comparativo corta o GASTO na mesma hora (13/10).** Vendas, receita e custos
  sempre obedeceram ao "ontem até esta hora" (`janelaAnterior`), mas o gasto é
  guardado por DIA e entrava inteiro: o cartão de gasto mostrava ~-70% toda
  tarde e CPA, ROAS e lucro saíam errados junto. Agora o dia cortado vem hora a
  hora da API (`segments.hour`, `corteDoGasto` em `admin-dados.ts`) e o manual
  entra na fração do dia (`cortarDiaDoGasto`, `gasto-midia.ts`); sem a API, o
  Google também vai na fração. Hoje até agora continua vindo de
  `metricas_campanha`, que atualiza de hora em hora (até ~1h de atraso).
- Cada painel loga `[admin] painel …` com os tempos nos logs da Vercel.
- **O cartão CPA é SÓ do Google Ads (18/10, dono)**: gasto do Google (API + manual de "google" em dia sem API, `somarGasto().googleBrl`) ÷ vendas do canal Google (`vendasPorCanal.google`), em `cpaDoGoogle` (`gasto-midia.ts`). Antes era o gasto de tudo ÷ vendas de tudo, e e-mail/orgânico derrubavam o número (R$ 5,66 em 18/10, com a conta nova começando). Gasto, ROAS e lucro continuam somando toda a mídia. **CPA TikTok** (18/10): cartão que só aparece com gasto lançado à mão com origem "tiktok" (opção nova no formulário de gasto; antes só google/meta/outro), gasto do TikTok ÷ vendas do canal TikTok (`cpaDoCanal`). TikTok lançado como "outro" antes de 18/10 não entra nele.
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
- **Baixar a base de e-mails (17/10)**, aba E-mail: todo quiz com e-mail, comprando ou não, um endereço por linha, em dois arquivos: Omnisend (Email, Phone, Tags comprador/lead, Entrou em) e Google Customer Match (só Email, Phone, Country, senão o Google recusa). Sempre FORA: descadastro, `emails_mortos` não liberado e `excluidos_email` (lista ilegível = nenhum arquivo sai). Só o idioma da marca. Lido em pedaços por cursor pelo navegador (`admin-leads.ts`, a base passa do teto de 4,5 MB numa resposta só); regras puras em `exportar-leads.ts`. O Omnisend não conhece o nosso descadastro: arquivo velho reimportado traz de volta quem saiu, então baixar de novo a cada campanha.
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

## Blog da Ballad em espanhol (20/10/2026)

`balladgift.com/es/blog` e 20 artigos (10 de presente/guia + 10 de fé), só
Ballad e só espanhol. Desenho em
`docs/superpowers/specs/2026-10-20-blog-ballad-es-design.md`.

- **Um motor, dois sites.** `src/lib/blog/site.ts` tem o `SiteBlog` de cada
  marca (`BLOG_SERENATA`, `BLOG_BALLAD_ES`): origem, prefixo, textos da tela,
  rotas que existem, regex de preço e de promessa proibida, e de onde sai a
  música de exemplo. SEO (`seo.ts`), validador (`validar.ts`) e as telas
  (`PaginaArtigo`, `IndiceBlog`) recebem o site; o `/blog` da Serenata saiu
  byte a byte igual (snapshot dos heads em `site.test.ts`).
- **As rotas `/es/blog` respondem 404 fora da Ballad**, e o `/blog` responde
  404 na Ballad. Os artigos em espanhol entram por `import()` (não pesam no
  bundle da Serenata).
- **O validador da Ballad cobra** o mesmo da Serenata (palavra-chave no
  título e no 1º parágrafo, 900–2.000 palavras, link interno só pra rota que
  existe) mais: sem preço em dólar, sem "60 segundos"/"en un minuto", sem
  reembolso/devolução.
- **`conteudo-es.test.ts` cobra**: foto do blog da Serenata (`imagem.arquivo`,
  nunca as do Rio), nenhum `tema` (o quiz em espanhol não tem `?t=gospel`),
  música da abuela só nos 6 artigos onde cabe, citação sem rezar/cruz/
  estampitas/persignar (palavra inteira), nenhuma "canción para Dios" (o quiz
  não tem esse destinatário), CADA VERSO CITADO EM UM ARTIGO SÓ, sitemap com
  lastmod e a pauta inteira publicada.
- **Trecho de letra só da letra REAL** (`scratch/blog-es-letras.md`, lida em
  `balladgift.com/p/<token>`), e nenhum fato da história do exemplo além do
  que a letra diz. Artigo que toca música de amor num tema de fé (pai,
  pastor, boda, Navidad) diz que ela não é cristiana.
- **Artigo novo:** arquivo em `src/conteudo/blog-es/` + `index.ts` +
  `pauta.ts` + `<url>` no `public/ballad/sitemap.xml`.
- A foto da quinceañera é a do batismo da Serenata (nenhuma mostra
  adolescente): trocar quando houver imagem própria.

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
| `letra_na_revisao` (Serenata) | a ligar | A `gerarRefroes` só quando a tela dos refrões abre × B a revisão dispara `gerarRefroes` em segundo plano ao montar e a tela dos refrões reaproveita a PROMESSA se sessão, idioma e respostas não mudaram (`letra-na-revisao.ts`, chave = sessão + idioma + hash das respostas; uma chamada e uma cobrança do teto, as mesmas do A). Respostas mudaram: chamada normal. Teto de 2 adiantamentos por página; a promessa é consumida no 1º uso ("outra opção" e "tentar de novo" chamam de novo); a adiantada que falhou cai numa chamada nova. Vale também pro `fluxo` B (`caminhoDireto`). Só pt. Linha em `20261016000000_experimentos_16out.sql` (`ativo = false`) | quem CHEGA nos refrões (`coautoria_refroes` ÷ `coautoria_pedida`, hoje 23% somem com ~127s de espera) e receita por lead; diagnóstico `letra_adiantada`, `letra_adiantada_usada` (pronta, idade_s), `letra_adiantada_falhou`; custo de letra por lead (adiantamento que ninguém usa) | 7 dias depois de ligar | sim, se ganhar |
| `ouvir_de_novo` (Serenata) | a ligar | A no corte da prévia o player trava × B botão "Ouvir de novo" embaixo do player: volta pro 0 e toca, o corte vale de novo no mesmo ponto, popup não reaparece, convite de desbloquear fica na tela durante a volta (`ouvir-de-novo.ts`, `MusicaKaraoke.tsx`). Só pt, nunca no modo `completo` | receita por lead (`attribution.exp.ouvir_de_novo`); uso em `previa_ouvir_de_novo` (vez) | 7 dias depois de ligar | sim, se ganhar |
| `pix_reabre` (Serenata) | a ligar | A recarregou a aba (iPhone descarta enquanto a pessoa está no banco), a folha do PIX não volta × B o PIX gerado fica no `sessionStorage` da aba (`mp_pix_aberto`: referência, sessão, hora, preço da folha) e a oferta, ao montar, reabre a folha DIRETO NO QR se ele tem menos de 1h, é da mesma sessão e segue pendente (`buscarPix`, a leitura da `/pix/<ref>`, movida pra `buscar-pix.ts`); já pago vai pra /obrigado; fechar a folha ou pagar esquece. `pix-reabre.ts`. No `POS_COMPRA` do `vigiaExperimento` (age depois do clique) | pago ÷ PIX gerado por braço (`pix_transparente_gerado` -> `pix_transparente_pago`); diagnóstico `pix_reaberto` (segundos), `pix_reabre_descartado` (motivo) | 7 dias depois de ligar | Ballad não tem PIX |
| `nome_cantado` (Serenata) | a ligar | A a mensagem da letra de hoje × B a mesma + `instrucaoNomeCantado` no FIM da mensagem do usuário (nunca no system cacheado): o nome exatamente como digitado, cantado pelo menos no refrão ou na intro, apelido só junto. Vale em `gerarRefroes`, `montarLetra` e `montarLetraStream`; o resgate da coautoria e o "melhorar com IA" ficam de fora. Braço lido NO SERVIDOR (`quiz_responses.attribution.exp.nome_cantado` + linha viva do `experimentos`, guardada 1 min; erro = A). Só pt, fora do louvor, só com nome de verdade. `nome-cantado.ts`, snapshot em `nome-cantado.test.ts` | receita por lead e % de letras finais com o nome exato, por braço (~7% sem o nome convertem 14,5% × 16,8%) | 7 dias depois de ligar | sim, se ganhar (prompt em inglês) |
| `oxxo_mx` (Ballad, México) | 23/10 (LIGADO ~17h30 a 100% B, dono: "testar na raça"; a ficha do OXXO pede nome, sobrenome, CURP/RFC/INE e e-mail, e não foi testada antes) | México vende pouco pro lead (23/10: 34 leads a R$ 1-3, 1 venda) e o Stripe da conta BR não tem OXXO; no suporte do mesmo dia um mexicano pediu OXXO. A = folha do Stripe (só cartão) × B = a mesma folha com "¿Sin tarjeta? Paga en efectivo en OXXO o con transferencia", que abre a página da **dLocal Go** DENTRO da folha (iframe; o transparente deles é só cartão). Só México (`data-pais`/`x-vercel-ip-country`, conferido de novo no servidor) e espanhol. Cobra $199 MXN (mesma `PRECO_MEXICO`), pedido `dlocalgo:<DP-id>` em dólar, ficha de 3 dias reaproveitada ao reabrir. Aviso por pagamento (`notification_url`, sem cadastro no painel): assinatura HMAC + reconsulta (`api/lib/dlocalgo.ts`, `api/webhook/dlocalgo.ts`); a folha também pergunta a cada 6s. Volta pela `/es/pago-oxxo` (nunca a `/es/gracias`, que diz "pago confirmado"). Taxa 2,99% + US$ 0,20, conta liquida em REAL. Conta usada: a ANTIGA aprovada da dLocal Go (CNPJ antigo); trocar `DLOCALGO_*` na Vercel quando a do CNPJ novo aprovar. `oxxo-mx.ts`, `dlocalgo-checkout.ts`, `CheckoutDlocal.tsx` | venda por lead entre leads do México (`oxxo_mx_exposto`) por braço; quantas fichas viram pagamento (`dlocal_checkout_criado` → pedido pago) | 1 semana depois de ligar | é a Ballad |
| `aviso_recusa` + e-mail de recusa (Ballad) | 18/10 (ligado 18/10 ~05h, A:B 1:1) | 56% das tentativas de cartão recusadas em 11-17/10 (conta Stripe BR cobrando cartão dos EUA: `do_not_honor`, débito, Link); 16 de 31 pessoas com recusa desistiram. (1) `aviso_recusa` (`experimentos` do banco da Ballad): B = aviso embaixo do Embedded Checkout ("aprove no app do banco e tente de novo; Apple Pay, Google Pay ou outro cartão"), en/es. (2) `quase_comprou`: quem teve recusa (`last_payment_error` na sessão, `inngest/lib/recusa-stripe.ts`) recebe no braço B (6º caractere do fim do quiz) o texto de recusa (`quase_comprou_recusa`); a trava grava `recusado` e `braco_recusa`. `aviso-recusa.ts`, `_ballad-ligar-aviso-recusa-18out.mjs`. Mesmo dia, campanhas (dono, "pode"): PAUSADAS 53 Remarketing /es e 47 norteño; 52 ralph balada 40→48, 37 banda Aberto 110→126 (`_ballad-otimiza-18out.mjs`, relido). A causa de fundo (conta Stripe americana) é decisão do dono | (1) PAGO ÷ CHECKOUT ABERTO por braço; (2) venda em 72h entre quem teve recusa, por braço (~2/dia, leva semanas) | 25/10 | é a Ballad |
| Ballad México: preço $199 MXN (teste em sequência) | 22/10 | Não é A/B (o México faz ~1 venda/dia). Até 21/10 o México pagava $349 MXN (US$ 19 convertido) e só ~4% dos leads compravam (empate pede ~9%); a Cántale cobra $99 avulsa e $169 o pacote. Dono: "põe 199 pra teste, depois vamos aumentando". `PRECO_MEXICO` em `preco-mxn.ts` (música $199, âncora $549); a página mostra em peso pra quem está no México (`pais-acesso.ts`, `NaMoeda`, desde 21/10 à noite). O pedido grava o EQUIVALENTE em dólar do que se cobrou ($199 → US$ 10,82), não US$ 19. Empate a $199: ~R$ 51 por venda, precisa ~15% dos leads comprando com lead a ~R$ 7,70. Subir: trocar os dois números na mesma proporção | venda por lead do México (vendas com `moeda = mxn` no `stripe_checkout_criado` ÷ leads das campanhas MEX) contra os 4% a $349; custo por venda | 25/10 | é a Ballad |
| Ballad ES: otimização de 22/10 + 4 vídeos do Ralph no carro | 22/10 madrugada | Dono: "sim". Pela venda real de 18-21/10 (venda deixa ~R$ 84): 37 Aberto 145→181 (+25%, R$ 39 por venda) e 41 Fans musica latina 69→86 (+25%, R$ 32), dono pediu 25% nas que têm folga; 57 Intencao regalo 50→58 (+15%, R$ 50-51 nos 3 dias); PAUSADAS 62 banda2 e 63 banda3 (1º dia com 1 e 0 lead). MEX 37 e MEX 41: SÓ YouTube Shorts (clique que vira lead 6% contra 32% no mesmo anúncio nos EUA; o Display já tinha saído em 21/10). Serenata sem mudança (conta nova, semana fecha 26-27/10). Novas 65-68 (`ballad-ads-22out-ralph-carro.mjs`): Ralph no carro, esposa/namorada, vídeos lBctBQdzp2Q, JpYCC0p4WiU, kbQri5lwTqA, rKDO39hD4nE (o mesmo título no YouTube; o id vai no nome), molde da 37, R$ 50/dia, SÓ Shorts, criadas PAUSADAS e ligadas pela tarefa agendada `ballad-ligar-65-68` às 9h45 de 22/10. `_ballad-otimiza-22out.mjs`, `_ballad-65-68-so-shorts.mjs` (relidos) | custo por venda da 37 e 41 com +25%; 65-68 pela régua (1º dia com 2 leads ou menos = pausa; R$ 80 sem venda); Shorts × todos os canais | 24/10 | é a Ballad |
| Serenata conta nova: 1º degrau de orçamento | 22/10 17h45 | Dono: "pode aplicar" (liberou subir pela regra dos 3 dias, mesmo antes de fechar a semana). Venda real 20-22/10 (empate ~R$ 33): DG Fãs de TV · Adoração 1 40→50 (+25%, R$ 17 por venda, 6 vendas), DG Intenção presente · Video Fone 40→46 (+15%, R$ 26, vendeu os 3 dias), TESTE Adoração 1 · RMKT base de e-mails 40→46 (+15%, R$ 26; R$ 21 e R$ 11 desde o público novo). Seguram: Search (oscila), DG Casamento e DG Concorrentes (R$ 46-50), os 5 Vid 5 e o Semelhante puro (aprendendo; a Vid 5 Casamento, que eu quis pausar e o dono segurou, vendeu em 22/10 a R$ 16 com lead a R$ 1,2). Relido pela API. 22/10 até 17h30: 8 vendas a R$ 29 | custo por venda das 3 com a verba nova | 24/10 | - |
| Serenata conta nova: 2º degrau + Search | 23/10 madrugada | Dono: "sim aplica". Search 50→70: a nova perdia 89% das buscas por ORÇAMENTO (a antiga rodava a R$ 370 e perdia 25%); as 36 palavras que convertiam na antiga (criar música com IA 34 conv, música personalizada grátis 29, serenata gift 18…) JÁ estão na nova; os ~140 nomes de concorrente da antiga quase não convertiam e NÃO foram copiados. Vid 5 · Fãs de TV 40→46 (R$ 28 por venda em 21-22/10) e Semelhante (puro) 40→46 (R$ 21). DG Casamento ficou (R$ 35, dono: "venda a 35 não vejo como boa"). Achado: Adoração 1 NÃO é o Video Fone (é o Ralph, H3R1g-6HYmE); DG Fãs de TV, Intenção · Fone e Casamento têm 2 vídeos e a DG Concorrentes 6 (2 grupos × Fone, Adoração e Vid 5). Leitura dos públicos sem misturar o dia 20 (público antigo): 21-22/10 = 28 vendas a R$ 37 contra R$ 76-98 antes | custo por venda da Search com R$ 70; as duas que subiram | 25/10 | - |
| Ballad: 10 testes de 23/10 (ligam 10h) | 23/10 | Dono: focar nos latinos dos EUA e no México; americano só depois. (1) **Músicas de banda feitas pra anúncio** 72-75 (`scratch/ballad-musicas-anuncio-23out.mts`, `ballad-ads-23out-musicas-anuncio.mjs`): a análise de 22/10 achou que as variações de 15/10 e 19/10 (norteño, cumbia, banda2-4…) perderam o que o banda original tem: refrão = promessa universal com o nome ("hasta el último día, Marisol") e o nome no trecho do anúncio; as variações tinham refrão sobre o tamal e, em 3 de 9, o nome nem tocava. As novas: mesma história e estilo, nome 3x no trecho (~20s, ~29s, ~75s), refrões "Te volvería a elegir" (BMhbQoFaUpU), "Eres mi casa" (QOp8EVuoZvA), "Mientras yo viva" (GWWgXhKrgek), "Gracias por quedarte" (BR4ZPhN63L4), uma campanha cada, Aberto, R$ 50. (2) Religadas 39 Concorrentes ES e 40 Comprando regalo (R$ 70 por venda, pausadas cedo) a R$ 50; 58 Ralph balada × Intenção regalo; nova 69 Ralph balada × Fans musica latina. (3) México: MEX 70 Intenção regalo e MEX 71 Concorrentes MX (busca Cántale/Haz tu Canción/serenata a domicilio), R$ 40, só Shorts, anúncio da MEX 41 (que fez as 2 vendas a $199). (4) Listas de clientes vazias criadas (Ballad base 651, Ballad compradores 104, Semelhante EUA): o dono sobe os CSV de `materiais/listas-google/ballad/` e aí entram 2 combos (Fans + dados, Intenção + dados, com o Video Fone). Cancelados: Ralph no carro 65-68 (lead a R$ 83-86 ou nenhum). Tarefa agendada `ballad-ligar-23out` | régua de 3 dias: clique ≥ 1,4% e lead ≤ R$ 10 segue; R$ 80 sem venda e lead > R$ 16 pausa; música nova contra o banda original (37: clique 1,57%, lead R$ 8) | 26/10 | é a Ballad |

| Ballad ES: escala de 18/10 (públicos novos, duplicadas, banda com música nova) | 18/10 manhã | Dono: "temos que escalar a Ballad". Leitura 12-17/10 por campanha (`_ballad-campanha-dia.mjs`): quem dá lucro é o ABERTO (37 banda R$ 39 por venda, 14 vendas, +R$ 708; 52 Ralph balada R$ 41, +R$ 146; 41 Fãs música latina R$ 70); o prejuízo veio dos testes (inglês, mariachi 33, Search, gêneros 47-51). Search EN: nunca deu lucro (R$ 1.235, 5 vendas, R$ 247); os termos de 09/10 NÃO pioraram (09-12/10: R$ 135 por venda, a melhor fase); o que a matou foi o CPC manual e 100→60 de 13/10 (cliques 20→8/dia). Criadas e relidas, R$ 50/dia cada, 10h-3h, segmentação ligada, texto ES → home /es: 55/56 Aberto 35+ (banda/ralph), 57/58 Intenção de busca \"regalo\" 25+ (segmento novo de 20 buscas em espanhol), 59/60 DUPLICADAS da 37 e da 52 com copy B (reação e ocasião; `ballad-ads-18out-escala.mjs`, `ballad-ads-18out-duplicar.mjs`). Porto Rico cortado pelo dono (foco nos EUA). Video Fone com 3 músicas NOVAS de banda (mesma história, `ballad-exemplos-es.mts` banda2-4): `materiais/ballad/latino/fone-esposa-banda2/3/4.mp4`, banda2 sem o nome Marisol no trecho; o dono sobe no YouTube e entram numa campanha Aberto junto do anúncio validado | par 37+59 e 52+60 abaixo de ~R$ 90 por venda = duplicar de novo; 35+ e regalo contra o Aberto; corte R$ 80 sem venda | 20/10 | é a Ballad |
| `abertura_pergunta` (Serenata) | 08/10 | abertura de hoje × "Pra quem é a música?" com os chips da relação na própria abertura (tocar grava a relação e vai pro nome; o "começar" continua). Só pt sem tema | quem RESPONDEU a 1ª pergunta (quiz_step q>=2) entre sessões pt sem tema que montaram a abertura; lead, venda, receita por lead | LIDO 11/10: **EMPATE, ENCERRADO** (B zerado pelo peso). ~10 mil sessões por braço: B +18% responderam a 1ª pergunta (35,1% × 29,8%, z 7,9), mas lead 20,2% × 20,3%, venda 2,78% × 2,87%, R$ 1,06 × 1,08 por sessão: quem o B puxa a mais desiste antes do e-mail. `_leitura-abertura-11out.mjs`, `_encerrar-abertura-11out.mjs` | não |
| `abertura_titulo` (Serenata) | 23/10 ~10h55 | O título da abertura do /criar, um ângulo por braço; subtítulo, botão e cartão iguais. A "Uma música feita da história de quem você ama" (controle) × B "O presente que vai fazer quem você ama chorar" (reação, continua o anúncio) × C "A única música do mundo com o nome dela" (exclusividade) × D "O presente que não vai parar no fundo da gaveta" (dor do presente comum) × E "Imagine a história de vocês virando música" (visualização) × F "Mais de 6.600 famílias já deram esse presente" (prova social, o número de `prova-numeros.ts`). 6 braços peso 1, exposição 100%. Só pt sem tema. As seis vêm no HTML e o carimbo do braço escolhe (`abertura-titulo.ts`, mesmo desenho do `abertura_pergunta`); linha pela migration `20261023000000` e ligada por SQL, porque a trava de preço do painel barrava teste sem preço (corrigida no mesmo dia: só o `preco` exige plano). Conferido no site: braços A, B, E e F sorteados e gravados | RECEITA POR SESSÃO por braço (`attribution.exp.abertura_titulo`), entre sessões pt sem tema que montaram a abertura; responder a 1ª pergunta é só sinal de saúde (o `abertura_pergunta` subiu isso 18% e empatou em venda) | 06/11 | sim, se ganhar (em inglês) |
| `previa_refrao` (Serenata) | 08/10 | prévia corta aos 40s + popup × prévia até o fim do 1º refrão (timestamps, 40-75s; sem timestamps, 60s estimados) com cartão de preço embaixo do player. Só pt | RECEITA POR LEAD; saúde em 10-11/10: distribuição de `previa_corte_motivo` no B | 22/10 (saúde 11/10) | sim, se ganhar (texto em inglês) |
| `video_fotos_ja` (Serenata) | 08/10 | editor de hoje × 1ª foto subida leva a página até o vídeo, prévia toca sozinha com as fotos e a música; título pela ocasião | vídeo vendido por comprador exposto (`video_fotos_ja_exposto`) | 15/10 | sim, se ganhar |
| `outra_musica_24h` (Serenata) | 08/10 | nada × cartão "Faça outra pra mais alguém" (pacote extra R$ 28, mesmo preço de sempre) por 24h na /obrigado e no editor | receita de extra em 24h por comprador exposto; guarda: editor aberto e vídeo vendido. ESTAVA DESLIGADO (`ativo=false`) desde 08/10 ~11h, sem ninguém ter mandado: só ~97 compradores expostos ao B até 10/10. Religado em 10/10 06h (`_religar-outra-musica-10out.mjs`). DESLIGADO DE NOVO às 06h56 do mesmo dia pelo `vigiaExperimento`, que mede clique na OFERTA (antes de pagar) e com isso derrubava teste PÓS-COMPRA por acaso; foi o mesmo motivo de 08/10. Conserto em 11/10: o vigia ignora `outra_musica_24h`, `video_fotos_ja` e `obrigado_direto` (`POS_COMPRA`), e o teste foi religado. Extra (up:extra) liga ao comprador pelo E-MAIL, não por musica_id/quiz (nulos) | 18/10 (empurrada pela pausa) | sim, se ganhar |
| `resgate_coautoria` (Serenata) | 11/10 | A nada × C a gente escreve a letra (as 2 etapas da coautoria com o 1º refrão, `escreverLetraSozinha` em `letra-claude.ts`), grava a música e o `mandarLetra` manda o "letra pronta" de sempre. Pra quem deixou o e-mail (passo 9) e largou a coautoria há 2h+ sem música, até 24h depois do quiz. ~9% dos leads (~130/dia) sumiam SEM NENHUM e-mail: a música só nasce no `finalizarLetra`. Braço pelo 5º caractere do fim do id do quiz (`resgate-coautoria.ts`), linha por quiz em `coautoria_resgates` nos dois braços. Job `resgatarCoautoria` (15 em 15 min, 10/rodada, só Serenata/pt); desliga com `RESGATE_COAUTORIA_OFF=1`. Se a pessoa volta e finaliza a letra DELA, o `finalizarLetra` troca a música do resgate e regrava. O "B" (só e-mail com link) ficou de fora: o `/retomar` só abre sessão com música. Custo do C ~R$ 0,40/lead | venda e receita por lead do teste em 7 dias, A × C (`coautoria_resgates` → `pedidos`) | 18/10 | sim, se ganhar |
| `preco_video` (Serenata) | 11/10 | vídeo-presente R$ 24,90 × R$ 19,90. Braço pelo ÚLTIMO caractere do `token_edicao` (`preco-video.ts`): a tela do editor, a folha, o PIX, o cartão, os webhooks (Asaas e Woovi) e os 2 e-mails do vídeo leem a mesma função, e o webhook confere o valor pago contra o preço DAQUELA música (erro de leitura = R$ 24,90, que recusa e avisa, nunca libera por menos). Encerrar: `LIGADO = false` (A pra todos) ou trocar o `precoBrl` do vídeo em `creditos.ts` | RECEITA DE VÍDEO POR COMPRADOR (o B precisa vender 25% a mais pra empatar); base 01-09/10: 12,1% compram, 77,5% veem a prévia, 95% de quem abre a folha paga | 18/10 | sim, se ganhar (em dólar) |
| `quase_comprou` 16 → 24 por rodada | 11/10 | Conserto de volume, não A/B: ~680/dia clicam em comprar e não pagam e o teto de 16 alcançava ~330 (o envio batia no teto todo dia). Era o "passo seguinte" escrito no código desde setembro. Reclamação zero; o bounce dele (5%) é caixa cheia no Gmail (452 4.2.2), não reputação | compraram em 7 dias por envio (era 2,2%); se a margem cair muito, volta pra 16 | 15/10 | - |
| e-mail `recuperacao_prazo` (2º caractere do fim do id do quiz) | 08/10 | escada de sempre × D+1 "R$ 28 até amanhã" com prazo REAL (cupom `SRN27P<AAMMDD>`, vale até 23h59 do dia) + D+3 último lembrete a preço cheio | receita por lead, vendas com `cupom like 'SRN27P%'`, descadastro | 22/10 | não |
| e-mail `pedido_reacao` (3º caractere) | 08/10 | nada × no 3º dia, pedido de vídeo de reação respondendo o e-mail, R$ 10 de cupom MANUAL pelo suporte (`pedirReacao`, 9h35-19h35, até 10/rodada) | vídeos recebidos, 2ª compra em 30 dias, descadastro | 22/10 | não |
| e-mail `limite_frequencia` (4º caractere) | 08/10 | como hoje × no máximo 2 e-mails de marketing por endereço em 24h (transacional isento) + convite de indicação 24h depois da compra | venda e receita por lead, descadastro, reclamação, bounce por envio | 15/10 e 22/10 | não |
| `folha_pix` (Serenata) | 08/10 | A folha do PIX de sempre × B CPF no resumo × C resumo enxuto (A:B:C 1:1:1). Não estava nesta tabela até 10/10 | pagou entre quem clicou em comprar; receita por lead | parcial 10/10: A 32,5% · B 28,9% (z -0,98) · C 32,7%. **DESLIGADO PELO `vigiaExperimento` em 14/10 00h** sem ninguém mandar (mesmo defeito do `outra_musica_24h`: ele mede o clique na oferta, e a folha só existe DEPOIS do clique); `folha_pix` entrou na lista que ele ignora (15/10). LIDO 15/10 com 08-13/10 (~1.200 folhas por braço, `_leitura-folha-pix-15out.mjs`): pagou A 34,2% · B 36,0% (z 0,94) · C 34,7% (z 0,27); R$/folha 12,93 · 13,62 · 13,16. Empate com B na frente; precisa ~5 mil folhas por braço pra fechar. **RELIGADO 15/10 ~17h só A × B** (C zerado pelo peso), depois do conserto do vigia no ar (`_religar-folha-pix-15out.mjs`, relido). Próxima leitura ~25/10 | - |
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
| **Vid 5 fora do ar (05/10)** | 05/10 | O influenciador do Vid 5 quis cobrar mais e o vídeo foi EXCLUÍDO do YouTube pelo dono: o criativo campeão não existe mais. Pausadas as 9 campanhas que só tinham ele (Ads Novos 4-6, os 4 Vid 5 de 25/09 e os 4 públicos de 04/10, que estavam a R$ 19/venda) e as da Ballad com a versão dublada (13, 25). As campeãs (CAMPEÃO 1#, 2#, RMKT NEW, 3#, Comportamento) seguem com o Video Fone; o **Pai dyZy** (YouTube dyZyxN8zTDU, o pai com a página da música) entrou como anúncio novo nas CAMPEÃO 1#, 2# e RMKT NEW, com os textos do Video Fone. Os 4 públicos bons e o lugar do Ads Novos 4-6 foram recriados com o Video Fone (40/dia cada; Remkt Concorrentes a 300/dia). `scratch/_sem-vid5-05out.mjs`, `scratch/ads-criar-05out-fone.mjs`. NUNCA mais usar o Vid 5 nem o rosto do influenciador em nada (inclusive dublado). **ATUALIZADO 16/10 (dono): o influenciador AUTORIZOU** (1) a versão do Vid 5 com o ROSTO TROCADO por uma pessoa gerada por IA (ele usa a original no Meta dele ao mesmo tempo; `materiais/vid5-faceswap/`, FaceFusion local + `scratch/faceswap/textura.py`) e (2) o Vid 5 ORIGINAL de volta enquanto a troca não fica pronta, em troca de % das vendas: medir as vendas por anúncio (aba Criativos, `cliques_anuncio`) dos anúncios com o vídeo dele, todo mês. **NO AR 16/10 12h** (dono: "coloque dentro delas… e mantenha todos os outros testes"): YouTube s8Tqz0xVafg (asset 430501855349), anúncio "Vid 5 volta \| 16 Out" (UM vídeo só, pra a aba Criativos medir a % dele) em cada grupo onde o antigo vendia, com os MESMOS textos e destino do antigo daquele grupo: CAMPEÃO 1#, 2#, RMKT NEW, Remkt Concorrentes Ralph V5, ESCALA Fãs de TV, ESCALA Semelhante, Comportamento; RELIGADAS ESCALA Aberto e os 4 TESTE Vid 5 de 04/10 (Casamento, Emoção, New relacionamento, Intenção; Google R$ 14-19 com ele). Fora, de propósito: CAMPEÃO 3# e ESCALA RMKT NEW (mesmo público de uma que já recebeu) e os públicos onde ele nunca vendeu (Busca, Aniversário, Presente romântico, Visitantes 30d). Orçamento não mexido. `scratch/_vid5-volta-16out.mjs`, relido com `_vid5-volta-reler-16out.mjs`. Quando um vídeo nosso entregar no nível dele, ele sai (fim da %) | CPA das campeãs sem o Vid 5; Pai dyZy dentro delas; Video Fone nos 5 públicos | 07/10 | Ballad: 13 e 25 pausadas |
| Serenata + Ballad: corte de 17/10 (régua do 1º dia) | 17/10 madrugada | Dono: "ok". 16/10 fechou: Serenata R$ 8.923 de receita, Google R$ 5.244, lucro do Google isolado R$ 1.022 (receita por real gasto 1,38; 15/10: R$ 1.406 e 1,47), lucro total R$ 2.472 SEM o TikTok (não lançado em `gastos_ads`); Ballad 11 vendas (TikTok 7, Google 3 com R$ 454). PAUSADAS e relidas (`_pausar-testes-17out.mjs`): NC n2 pai filha (Fãs de TV e Joias), NC n3 esposa UTI Joias, NC n5 marido carro Joias, Dono JBL Casamento, TESTE Video Fone + Adoração Aberto, Dono vid5 v1 Fãs de TV, Dono reação casado / pai filha / transformou; Ballad 50 bachata e 51 regional. Ficam: Dono JBL Fãs de TV (R$ 20), NC n1 cozinha Fãs de TV (R$ 20), pagode Casamento (R$ 14), ESCALA Aberto com o Vid 5 (R$ 14) e, mais 1 dia, JBL Intenção 35+/Joias, NC n1 Joias, NC n4/n5 Fãs de TV, reação "só mais uma", Combo concorrentes. Os 4 TESTE do Vid 5 de 04/10 fecharam o 1º dia (religados ao meio-dia) a R$ 46-78: decidir com 17/10 inteiro (acima de R$ 35 = público cansou dele). Lucro do Google ao vivo engana: o gasto chega com horas de atraso (às 21h parecia R$ 1.930) | Vid 5 nos 4 públicos; ESCALA Fãs de TV e Semelhante perto do degrau | 18/10 | Ballad: 50 e 51 pausadas |
| Serenata: 5 criativos novos do Ralph | 05/10 | Ralph (sócio, rosto próprio) no carro, gancho "Quer dar um presente…", um por campanha TESTE R$ 40/dia no Remkt Concorrentes, segmentação otimizada LIGADA, destino /criar: "varias" (qgVwGakQnJU), "exemplo esposa" (9_SLU4ASOXU), "como funciona" (ePr8b1e1s8E), "detalhes" (kW2UiEXBAWM), "esposa chorou" (z4Qd66jlFBs). Candidatos a substituir o Vid 5 nas campeãs. `scratch/ads-criar-05out-ralph.mjs`. Regra de corte (dono, 05/10): teste com mais de R$ 80 gastos, lead acima de R$ 15 e nenhuma venda real é pausado sem esperar a leitura. 06/10 14h17: nenhum bateu (todos os 5 do Ralph em R$ 66-68; "exemplo esposa" R$ 33/lead e 0 venda é o próximo; os outros 4 têm 1 venda cada, R$ 66-68/venda, lead R$ 9,55-21,94). Video Fone nos públicos novos: Casamento R$ 3,50/lead, Emoção R$ 4,29, Intenção R$ 5,68, todos ~R$ 33-34/venda. 06/10 21h47 (2ª passada): nenhum bateu de novo; os 5 do Ralph passaram de R$ 80 mas TODOS têm 1 venda (R$ 81-82/venda, lead R$ 9-27), "exemplo esposa" vendeu às 21h. Pai dyZy e PS8R em R$ 41/venda. 06/10 o Ralph gravou 3 vídeos no roteiro do Vid 5 (fala curta, play, reação calada), editados com música em fade in e chamada final em `materiais/ralph/` (4 músicas: Isabela, sertanejo gospel, adoração, pop gospel; as gospel geradas pelo funil, `scratch/criativo-musica-esposa-gospel.mts`) | CPA real por campanha (banco), contra o Pai dyZy (R$ 28,59) | 08/10 | se vencer, dublar com Dylan |
| Serenata: Ralph no roteiro do Vid 5 (9 vídeos) | 07/10 | 3 gravações do Ralph (IMG_5852/53/54 = vídeo 1/2/3) no formato do Vid 5: fala curta, "vou dar o play", música entrando em fade in, reação calada, caixa "Faça sua história virar música também 💛 Clique em saiba mais" no fim; cada uma com 3 músicas: Isabela (exemplo da home, sertanejo pra esposa), adoração e pop gospel ("Resposta de Oração", geradas pelo funil, `scratch/criativo-musica-esposa-gospel.mts`). Uma campanha TESTE por vídeo, R$ 40/dia (R$ 360/dia), Remkt Concorrentes, segmentação LIGADA, destino /criar (presente pra esposa, não louvor). YouTube: isabela 1uHl78wBN_w / C95CEyj7u_E / Vmg_YK8sY_s, adoração H3R1g-6HYmE / eZxpHXF9cAw / q4JI9SUkbM8, pop BLyFzpMZODo / ZLKtMqGN3sQ / RLuGuDlp0PU. Arquivos em `materiais/ralph/PRA SUBIR`. `scratch/ads-criar-07out-ralph-v5.mjs` (relido). Mesma regra de corte (R$ 80, lead > R$ 15, 0 venda) | CPA real por vídeo e por música, contra Pai dyZy/PS8R (~R$ 41) e o Vid 5 (R$ 16-20) | 10/10 | se vencer, dublar com Dylan pra Ballad |
| Serenata: volta da escala com o vídeo 1 do Ralph (07/10) | 07/10 23h37 | Portão passou: vídeo 1 (Isabela 1 + Adoração 1) fechou o 1º dia com R$ 80, 33 leads (R$ 2,43) e 6 vendas (R$ 13,36). Aplicado e relido: Isabela 1 e Adoração 1 como anúncios novos na CAMPEÃO 1#, 2# e RMKT NEW ao lado do Video Fone; religadas com os dois vídeos no lugar do Vid 5 e nome novo as 5 que vendiam com ele: "GD \| Serenata \| Remkt Concorrentes \| Ralph V5 \| 07 Out" (ex-Ads Novos 4-6, R$ 300; com o Vid 5 fazia R$ 16,76), "ESCALA \| Ralph V5 \| Fãs de TV" (R$ 80), "Aberto" (R$ 60), "RMKT NEW" (R$ 60), "Semelhante compradores" (R$ 40); campeãs +15% (1# 700→800, 2# 1400→1600, RMKT NEW 480→550), o degrau da escala da 2# em set. Os grupos Vid 4/Vid 6 do Ads Novos (vídeos 1509.4/.6) seguem PAUSADOS. Dia 07/10: Google R$ 3.724, 146 vendas, R$ 25,51; lucro ~R$ 2.805 antes do TikTok. `scratch/escala-ralph-v5-07out.mjs` | CPA real das campeãs com o vídeo novo e das 5 religadas; próximo degrau +15-20% só com CPA < R$ 25 | 09/10 | dublar o vídeo 1 com Dylan pra Ballad |
| Serenata: escala, 2º passo (08/10) | 08/10 01h | Dono: "já precisamos voltar com a nossa escala pra voltar a bater quase 20k dia". Mais LUGARES pros validados, sem subir as campeãs de novo: PAUSADOS Ralph V5 Adoração 2 (lead R$ 13, 0 venda), Video Fone New relacionamento (lead R$ 10), Plano de saúde (~R$ 45/venda), PMax 10 Set (R$ 429, 0 venda real, só Video Fone); Video Fone Intenção 40→60 e Clientes de hipermercados 50→60 (28% dos leads compram); Isabela 1 + Adoração 1 entraram na CAMPEÃO 3#, Comportamento, Clientes de hipermercados, Video Fone Casamento e Intenção; o Video Fone entrou nas 5 religadas; PMAX Ângulos religada a R$ 70 com os dois vídeos nos 4 grupos vivos e SEM o Vid 5 (que estava no "Reação real", o grupo de R$ 7,40/conv no Google). Depois, o Video Fone também entrou nos 4 grupos (`_pmax-fone-08out.mjs`). Mesma madrugada, degrau nas menores que fecharam 07/10 abaixo de R$ 25 e gastando o orçamento: Search 150→175 (alguém já tinha subido de 120 pra 150 no painel), Comportamento 137→160, CAMPEÃO 3# 60→70, Video Fone Casamento 60→70. Relido. Leitura de CPL × CPA (30 campanhas, 28/09-07/10): correlação 0,84, conversão média lead→venda 14%: CPA ≈ CPL ÷ 0,14, ponto de lucro no lead ≈ R$ 4,75. Exceção: Emoção e memória (lead R$ 3,86, 6% compram) segurado mais 1-2 dias. `scratch/escala-2-08out.mjs`, `_cpl-vs-cpa.mjs` | CPA real por campanha; PMAX por `utm_content` | 10/10 | - |
| Serenata: ajuste da tarde de 08/10 | 08/10 16h50 | Às 16h40 as campeãs gastavam só 51-60% do orçamento (não estão travadas por orçamento: o freio é leilão/criativo, volume vem de criativo novo validado). Travadas por orçamento e baratas: ESCALA Fãs de TV 80→95 (CPA R$ 13, gastando 142%) e ESCALA Semelhante compradores 40→48 (R$ 13, 140%). PAUSADA ESCALA RMKT NEW (1 venda a R$ 77; disputa o público da RMKT NEW principal). Segurados: Remkt Concorrentes Ralph V5 R$ 300 (CPA R$ 25) e ESCALA Aberto (R$ 41, mais 1 dia). Dia até 16h32: 165 vendas, R$ 6.750 (+34% sobre 07/10 no mesmo horário). `scratch/_serenata-orcamento.mjs`, `_pausar-escala-rmkt-08out.mjs` (relidos) | CPA das duas que subiram; Aberto | 09/10 | - |
| Serenata: leitura de fim de dia de 08/10 (refeita 09/10 noite) | 09/10 | 08/10 fechou R$ 10.516 (254 vendas + 33 upsells), Google R$ 5.067, CPA real R$ 25,85, lucro R$ 3.832 antes do TikTok. Regra (+15% só com CPA ≤ R$ 25 em CADA campeã): CAMPEÃO 2# (R$ 21,92) já tinha subido 1600→1840 à 0h de 09/10; CAMPEÃO 1# (R$ 26,94) e RMKT NEW (R$ 26,23) NÃO sobem. Nenhum teste ligado bate a regra de corte (R$ 80, lead > R$ 15, 0 venda). Achado: as 4 do Vid 5 de 04/10 e os 3 gospel de 03/10 estavam ENABLED desde 05/10 (anúncios parados, sem gasto): campanhas PAUSADAS de verdade (`_pausar-vid5-gospel-09out.mjs`, relido). Religadas sem o Vid 5 (08/10): ESCALA Fãs de TV R$ 13,37, Semelhante R$ 14,24, Remkt Concorrentes Ralph V5 R$ 32,63, Aberto R$ 58,63, ESCALA RMKT NEW pausada (R$ 85); PMAX Ângulos R$ 34,97, por grupo (08-09/10): aniversário 10 leads/1 venda, filhos 10/0, reação 3/1, esposa 2/0. `pg` e `sharp` viraram devDependencies: o `npm install` do SDK do Higgsfield apagou os dois, que os scripts usavam sem estarem no package.json | CAMPEÃO 1# e RMKT NEW no próximo fechamento | 10/10 | - |
| Serenata: Isabela 1 sai das campeãs (09/10) | 09/10 15h | Venda real por anúncio (gclid → `cliques_anuncio`, `scratch/_venda-por-anuncio.mjs`), 08-09/10, todas as campanhas: Video Fone R$ 27 (119 vendas), Ralph Adoração 1 R$ 29 (67), Ralph Isabela 1 R$ 45 (27, R$ 1.203). O teste isolado da Isabela 1 também caiu: lead R$ 2,36 (07/10) → R$ 10,48 (08/10) → R$ 18 (09/10); leitura: saturação, porque desde 07/10 à noite o mesmo vídeo roda em 4-5 campanhas no MESMO público (Remkt Concorrentes). Dono: anúncio Isabela 1 PAUSADO em 14 campanhas (campeãs, escalas, Comportamento, hipermercados, Casamento, Intenção); FICA no teste isolado e nos testes de público de 09/10. Orçamento não mudou; todas seguem com Video Fone + Adoração 1. `scratch/_pausar-isabela1-09out.mjs` (relido). Lição: criativo validado em 1 dia de R$ 40 pode ser a nata do público; ler 2-3 dias antes de pôr em várias campanhas do mesmo público | CPA da CAMPEÃO 2# sem a Isabela; se o teste isolado voltar a lead < R$ 4 em 2-3 dias, ela volta | 12/10 | - |
| Ballad: funil em espanhol pros hispanos dos EUA (`/es`) | 09/10 | Não é A/B: canal novo. balladgift.com/es, /es/criar, /es/gracias em espanhol neutro com tú (a Serenata segue argentina, voseo, US$ 9,90 na Perfect Pay). Pago SÓ pelo Stripe em dólar, US$ 19 pela MESMA linha `preco` do inglês (`preco.ts` lê o plano do inglês com rótulo "US$"), Stripe em `es-419`, volta pra /es/gracias, régua de e-mails em espanhol (3 da recuperação, como o inglês). Tudo gateado por `ehBallad()` (`marca-identidade.ts`): o que depende do PAÍS pergunta a marca, o que depende da LÍNGUA pergunta o idioma. Mercado `eua` em `mercado-es.ts`, gêneros `ES_EUA` (mariachi, banda, norteño na frente), prompt `LETRA_SYSTEM_ES_EUA` (história em inglês/spanglish vira letra em espanhol, apelidos como escritos). 6 exemplos gerados pela Ballad (`scratch/ballad-exemplos-es.mts`, `src/lib/exemplos-es-us.ts`, capas Higgsfield). Testado no localhost até o caixa do Stripe abrir em espanhol a USD 19.00; o pagamento de teste ficou pro dono (o painel não digita no iframe). Testes em `ballad-es.test.ts` (as duas marcas). Mídia: Google/YouTube em espanhol nos EUA (idioma espanhol + público personalizado de busca em espanhol + afinidade música latina, segmentação ligada) e Search em espanhol, criativos do dono. Campanhas (09/10, R$ 50/dia cada, público "Hispanos EUA", espanhol, segmentação LIGADA, horário 10h-3h de Brasília, destino /es/criar): 31 Ralph esposa mariachi, 32 Ralph esposa cristiana, 33 Video Fone esposa mariachi (dublados pelo Seedance video-edit), e à noite 34 letra+reação esposa (uqNh6LYxA8g) e 35 letra+reação mamá (BiFeLKutL6M), o split-screen com UMA pessoa embaixo (`video/src/LetraReacao.tsx`). `scratch/ballad-ads-criar-09out-latino.mjs` e `-b.mjs` (relidos). **Os 5 caíram em CONSUMER_FINANCE:FULLY_LIMITED (0 impressão).** Diagnóstico trocando uma peça por vez (`_ballad-es-diagnostico-09out.mjs`): texto ES + /es/criar = barrado; texto ES + /criar = aprovado; texto EN + /es/criar = aprovado; texto ES + home /es = aprovado. O gatilho é texto em espanhol + QUALQUER URL que abre o quiz em espanhol: em 10/10 `/es/criar?step=relacao` e a rota nova `/es/crear` (feita pra isso) também caíram; nem o texto escondido da página tem palavra financeira. Só a contestação (revisão humana) leva o anúncio em espanhol direto ao quiz; até lá o destino é a home `/es`. Ficou SÓ texto em espanhol → home `/es` (vídeo, texto e página no mesmo idioma; o "texto EN" que eu tinha posto foi pausado pelo dono em 10/10: nunca misturar idioma no anúncio). Os "v2" (texto ES → /es/criar) e os DIAG E/F (→ /es/criar?step, /es/crear) foram RELIGADOS mesmo limitados em 10/10 (dono: "vai que roda e vende"); ficam pausados só os que misturam idioma (DIAG A, texto EN, DIAG C) e o DIAG B. 1ª venda em espanhol: 10/10 18h01, anúncio "33 fone banda ES" (→ home /es); quase-compra no "31 ralph bachata ES". `_ballad-es-formato-d-09out.mjs`, `_ballad-es-so-espanhol-10out.mjs` (relidos) | vendas com `locale = es` no banco da Ballad, % que responde a 1ª pergunta, CPA real | 1ª semana de mídia | é a Ballad |
| Ballad EN: Video Fone, só a música muda (5 versões) | 12/10 madrugada (no ar, 9h-3h) — campanhas 42 country (bNq5dFVT9so), 43 country gospel (XIQIZZjVJ1M), 44 acústico (lHJBCSSHAHs), 45 R&B (97r4Qw6oZtU), 46 worship (NuXtlzgesdw), R$ 40/dia cada, "Concorrentes EUA" + segmentação ligada, só celular, /criar, textos próprios SEM promessa de devolução (o anúncio antigo "26 fone dylan" promete "7-day money-back guarantee", contra a regra da casa). Os títulos subiram iguais no YouTube; o mapa link → música saiu da letra transcrita. `scratch/ballad-ads-criar-12out-fone-us.mjs` (relido) | Dono: "o que manda é a música". O método que achou o banda (Ballad ES) e o pagode (Serenata): MESMO vídeo, só a música muda. Video Fone com as duas falas do apresentador refeitas pelo Seedance 2.5 video-edit em inglês americano com voz natural de rapaz (`scratch/hf-videoedit-en.mjs`, ~US$ 5,50), no lugar das vozes do ElevenLabs (Kevin, Dylan) que soavam como locutor. Dono (11/10): a fala e as caixas eram TRADUÇÃO SECA do português; refeitas ADAPTADAS pro jeito americano de UGC: abertura "He turned their whole love story into a song. Watch her face.", fim "Want one for your person? Tap Learn more. You hear it before you pay." (ouvir antes de pagar é o diferencial lá), caixas pintadas por cima nas posições do espanhol (`fone-caixas-en.json`: "If you love her, you need to see this 👀", "Best gift idea I've ever seen", "Speechless."…). A versão traduzida ficou em `materiais/ballad/fone-us/v1-traducao-seca`. Lição: anúncio pra outro país é REDAÇÃO, não tradução (mesma regra da letra em espanhol). Músicas pelo funil da Ballad, mesma história (esposa Sarah, posto de gasolina em Columbus), gravação 2: country moderno, country gospel, pop acústico, R&B soul, worship (`scratch/criativo-ballad-fone-en.mts`; montagem `scratch/latino/montar_fone_en.py`, refrão no mesmo ponto do espanhol). Arquivos em `materiais/ballad/fone-us/PRA SUBIR`. Plano: uma campanha por música, R$ 40/dia, inglês, segmentação LIGADA, /criar, 9h-3h de Brasília; corte R$ 80 sem venda | venda e custo por venda por música; a que vender abaixo de R$ 80 vira a base do inglês | 2 dias depois de ligar | é a Ballad |
| Search de concorrentes: pesquisa no Meta (09/10) | 09/10 | Não é A/B: palavras novas. Pesquisa na Biblioteca de Anúncios da Meta, anunciante por número de anúncios ATIVOS. BR: NossaCanção ~390 ("em até 3h"), Canção Eterna/Melodia Eterna ~260 (R$ 19,90-37,90), Eternisom ~190, Música do Coração ~97, Sonara ~66 (R$ 39,90, letra grátis), Música de Louvor ~52, Monte Sua Música ~40, Imperial Melody ~38, SongPetal ~28 (R$ 29,90, mesmo modelo nosso); Hosanna Song anuncia como "Canção Divina" e Lembrança Cantada como "Histórias Cantadas". EUA: PrayerSong 1.003, Unique Song 990, Dear Melodies ~690, ForeverSongs 607, Gift Your Melody 363, DivineSong+TimelessSong 258, JoyBox 131, BeatJar 113, TrueMelodies 95, OurTune 90, Songoven 35 (US$ 19,90); a prévia antes de pagar já é de pelo menos 5 lá, e quase todos prometem reembolso. Serenata: +55 palavras no Quiz (16 concorrentes + termos de presente, que nos termos de pesquisa custam R$ 17/conv contra R$ 34 da busca por ferramenta grátis/IA), grupo NOVO "Gospel" (louvor personalizado, música gospel personalizada, música de louvor; destino /criar?t=gospel, anúncio de louvor) e "fazer música grátis" PAUSADA (R$ 60, 48 cliques, 0 conversão). Ballad: +38 no Concorrentes, +12 no Genéricas. Relido. `scratch/search-concorrentes-09out.mjs` | CPA real da Search por grupo; termos de pesquisa das palavras novas | 13/10 | é das duas |
| Serenata: públicos novos (09/10) | 09/10 01h | Dono: "pode testar mais", "compradores é bom pra testar", "sempre deixar a expansão de público ligada". Escolha pelo CPA REAL por público desde 15/07 (`_publico-historico-09out.mjs`): nicho sozinho morreu (Aniversário 0 venda em R$ 396, Gospel e fé R$ 342/venda, Presentes Personalizados R$ 253, Presente romântico R$ 188); o que vende é público amplo de compra/afinidade com o Remkt Concorrentes (hipermercados + Remkt R$ 20,99; Fãs de TV + Intenção presente + Remkt R$ 19,52; Presentes e ocasiões sozinho R$ 23,56). Insights do Google: a API recusa (token sem permissão) e o Chrome logado não tem a conta. 7 TESTES a R$ 40 (o combo Fãs de TV + Intenção + Remkt a R$ 60), cada um com Isabela 1 + Adoração 1 + Video Fone, segmentação LIGADA, /criar: Compradores + Remkt, Compradores de valor + Remkt, Lojas de departamento + Remkt, Presentes e ocasiões, Fãs de TV + Intenção presente + Remkt, Compras de Natal + Remkt, Joias/perfume/flores + Remkt. E religada a "Busca: Música e homenagem | 6 Videos | 17 Ago" (R$ 26,39 real em 169 vendas, mas com um grupo de Fãs de TV que não existe mais) como "ESCALA | Ralph V5 | Música e homenagem | 09 Out", R$ 80, vídeos de agosto PAUSADOS. Demand Gen aceita UM público por grupo: a soma vira um público "Combo … + Remkt 25+" com os segmentos juntos. Momento de vida "ninho vazio" não existe no Demand Gen (trocado por joias/perfume/flores). Relido. `scratch/ads-publicos-09out.mjs`. Mesma regra de corte (R$ 80, lead > R$ 15, 0 venda). 09/10 15h (dono): PAUSADOS antes da regra Compradores + Remkt (R$ 32, 0 lead) e Compras de Natal + Remkt (lead R$ 10,74): quase todo o gasto das 8 novas saiu de madrugada (R$ 303 entre 0h e 6h, campanha nova gasta o dia assim que liga) | CPA real por público; quem fechar < R$ 25 em 2 dias vira ESCALA | 11/10 | o vencedor vira público da Ballad em inglês |
| Serenata: otimização de 09/10 | 09/10 00h | 08/10 fechou R$ 10.516, 254 vendas, Google R$ 5.036, lucro R$ 3.862 antes do TikTok. Subiram (CPA real < R$ 25 e gastando o orçamento): CAMPEÃO 2# 1600→1840, Search 175→200, CAMPEÃO 3# 70→80, Clientes de hipermercados 60→69, Video Fone Intencao 60→69. Desceram: Remkt Concorrentes Ralph V5 300→255, ESCALA Ralph V5 Aberto 60→40, Comportamento 160→137. PAUSADOS (regra de corte): TESTE Ralph V5 isabela 3, adoracao 3 e pop gospel 1. Tudo relido. Depois (dono, "sim"): ESCALA Fãs de TV 95→115 (CPA R$ 13,37, gastou 126%) e ESCALA Semelhante compradores 48→58 (R$ 14,24, 119%). PMAX Ângulos em 08/10: R$ 70, 2 vendas, R$ 35 (empate); segura em R$ 70 até 10/10. `scratch/_serenata-orcamento.mjs`, `_pausar-testes-09out.mjs` 09/10 ~22h (regra combinada com o dono: voltar se fechasse acima de R$ 28; a leitura foi feita com o dia ainda aberto por causa do relógio em UTC, conferida fechada em 10/10 06h): 09/10 fechou R$ 8.938, 215 vendas + 33 extras, Google R$ 5.273, lucro R$ 2.205; CAMPEÃO 2# a R$ 34 (52 vendas, R$ 1.753) → orçamento 1840→1600 (relido). CAMPEÃO 1# R$ 19, CAMPEÃO 3# R$ 19, RMKT NEW R$ 44 (2º dia ruim) | CPA real das que subiram e das que desceram | 11/10 | - |
| Serenata: validados novos em públicos validados | 11/10 02h | Dono: "testar os validados em outros públicos validados" (CAMPEÃO 2# fica como está por enquanto). Ralph v1 + pagode (6 vendas a R$ 7 no 1º dia, ZdeQuC0XDhg) isolado em Fãs de TV, Semelhante compradores, Música e homenagem e Comportamento de visualização; Ralph v1 + sertanejo gospel (2 a R$ 20, _XrdwHIcNqA) em Fãs de TV e Semelhante. Mesmo público agrupado das campanhas ESCALA/Comportamento, segmentação LIGADA, /criar, R$ 40/dia (R$ 240/dia), 7h-23h. `scratch/ads-criar-11out-validados.mjs` (relido) | CPA real por público contra a campanha de origem do público | 13/10 | - |
| Ballad ES: banda isolado + teste de público | 11/10 | Dono: "isolar o banda em campanhas únicas igual fazemos com a Serenata e somar teste de público". O anúncio "33 fone banda ES" (Video Fone + música de banda, YouTube 5NBtC_hIJFI; R$ 12 → 5 leads, 2 vendas em 10/10, as duas 1ªs vendas em espanhol) sozinho, uma campanha por público, R$ 50/dia (R$ 300/dia), EUA, espanhol, segmentação LIGADA, só celular, texto ES → home /es, horário 10h-24h (11/10 13h40, dono: estendido até 3h, igual às 31 e 33, pra pegar a noite da Califórnia e do Texas; `_ballad-estender-36a41-11out.mjs`, relido): 36 Hispanos EUA (o mesmo da 33, controle), 37 Aberto, 38 Banda y regional mexicano (busca: Banda MS, Grupo Firme, corridos…), 39 Concorrentes ES (busca: canción personalizada…), 40 Comprando regalo (in-market Gifts & Occasions + Personalized Gifts), 41 Fans musica latina (afinidade). Idade 25+. `scratch/ballad-ads-criar-11out-banda.mjs` (relido). Na 33 também o "33 fone banda ES quiz" (mesmo anúncio → /es/criar; dono: "mesmo que fique limitado"), `_ballad-banda-criar-11out.mjs` | venda e custo por venda por público; corte R$ 80 sem venda; escala com CPA < ~R$ 80 (venda ~R$ 103) | 13/10 | é a Ballad |
| Serenata: otimização de 11/10 + Ballad ES após o 1º dia | 11/10 01h | APLICADA ANTES de apresentar ao dono (erro meu; ele manteve). Sábado 10/10 fechou R$ 11.312 (273 vendas + 40 extras), Google Serenata R$ 5.318 a CPA real R$ 24, Ballad R$ 593, lucro R$ 3.958 (sexta R$ 2.205). +15% (CPA real 08-10/10 ≤ R$ 25 e 100%+ do orçamento): CAMPEÃO 1# 920→1058, Search 230→265, Ralph V5 Remkt 255→293, Comportamento 137→158, ESCALA Fãs de TV 132→152, CAMPEÃO 3# 92→106, ESCALA Música e homenagem 80→92, Video Fone Intenção 79→91, Semelhante 67→77, New relacionamento 46→53, Joias perfume flores 40→46; hipermercados 79→69 (R$ 30); PAUSADOS isabela 2 (R$ 42), pop gospel 2 (R$ 63), Presentes e ocasiões (R$ 41). Ballad ES 10/10: R$ 490, 11 leads, 2 vendas, as duas no "33 fone banda ES" (R$ 12); PAUSADAS 32, 34, 35 e, na 31/33, DIAG D, "ralph regional", "fone mariachi texto ES home". CAMPEÃO 2# (dono, depois de ver os números por anúncio): Isabela 1 RELIGADA só nela (ia a R$ 27-29 ali; quem cansou foi o Video Fone, R$ 38-40 em 09-10/10) e "Video Fone copy emoção" PAUSADO (mesmo vídeo, só outra copy; R$ 139/venda em 10/10). 1º dia dos 12 testes de variação: Ralph pagode 6 vendas a R$ 7 (o melhor 1º dia desde o Vid 5), sertanejo gospel 2 a R$ 20, "GRÁTIS" lead R$ 3,64; variações do Video Fone com lead a R$ 20 ou nenhum. `scratch/_otimiza-11out.mjs`, `_ballad-otimiza-11out.mjs`, `_campeao2-ajuste-11out.mjs` (relidos). Tarde de 11/10 (dono aprovou, relido): Ralph v1 pagode (ZdeQuC0XDhg, 7 vendas a R$ 8 em 2 dias no teste) entrou como 3º anúncio na CAMPEÃO 1# com os textos do Adoração 1 (`_c1-pagode-11out.mjs`); PAUSADOS Video Fone musica pop e adoracao2 (0 venda, lead R$ 14-28; `_pausar-fone-variacoes-11out.mjs`); orçamento Comportamento 158→182, ESCALA Música e homenagem 92→106, Video Fone New relacionamento 53→61 (as campeãs gastavam 41-45% às 16h: não são orçamento, é leilão/criativo); Ballad ES 33 fone esposa 50→80 (4 das 6 vendas da Ballad em 11/10 foram em espanhol, 2 nela; `_ballad-orcamento.mjs`). Ballad ganhou a Search em espanhol (`ballad-search-es-11out.mjs`: texto ES → /es, maximizar cliques teto R$ 8, R$ 50/dia, 10h-3h) | CAMPEÃO 2# com Isabela; banda × bachata na Ballad ES; testes de variação | 12/10 e 13/10 | - |
| Serenata: campeãs de 13/10 | 13/10 03h | Dono: "pode aplicar". "Ralph v1 pagode" FORA da CAMPEÃO 1# (12/10: R$ 68 por venda lá dentro); CAMPEÃO 1# 1058→1217 (R$ 17/23/21 em 10-12/10, 105% do orçamento); ESCALA Semelhante 87→100 (R$ 19, 120%). CAMPEÃO 2# SEGURA em 1600: R$ 29/23/30, e em 12/10 o Google gastou R$ 2.111 nela (132%). Não foi a Isabela (R$ 110 de R$ 2.111; sem ela, R$ 29): o MESMO Adoração 1 no MESMO público fez R$ 19 na 1# (R$ 379) e R$ 30 na 2# (R$ 1.240) = teto de verba do público Remkt Concorrentes, não do criativo. Com o Vid 5 a 2# aguentou R$ 3.000 a R$ 18-20. Leitura por criativo de 07 a 12/10: Isabela e pagode caem TAMBÉM no teste isolado depois do 1º dia (o teste e as campeãs usam o mesmo público, e o 1º dia pega os mais quentes); Adoração 1 segura 6 dias a R$ 19-30 nas campeãs. Proposta ao dono: criativo só entra em campeã com 3 dias seguidos bons no teste isolado, não 1. `scratch/_otimiza-13out.mjs` (relido) | CAMPEÃO 1# a R$ 1.217; CAMPEÃO 2# sem a Isabela | 15/10 | - |
| Ballad ES: 2 dias das campanhas do banda isolado | 13/10 00h | 11-12/10: R$ 1.349, 13 vendas (~R$ 104 por venda, empate com a venda de ~R$ 95). Dono ("sim"): 37 Aberto e 40 Comprando regalo 50→65 (R$ 50 por venda cada, 2 vendas); PAUSADAS 38 regional mexicano e a Search em espanhol (R$ 101 cada, 0 venda). 33 fica em 100 (R$ 57); 31/36/39/41 ~R$ 100 por venda, mais 1 dia. Leitura do pagode na Serenata no mesmo fechamento: 10/10 R$ 7, 11/10 R$ 81, 12/10 R$ 82 por venda somando as campanhas: igual à Isabela, 1º dia ótimo e depois cai; NÃO é o novo Vid 5. Quem segura são Adoração 1 (R$ 22-26) e Video Fone (R$ 21-27). `scratch/_ballad-otimiza-13out.mjs` (relido) | venda por campanha do banda; 5 em inglês no 2º dia | 14/10 | é a Ballad |
| Ballad: inglês desligado + Search EN por palavra que vende | 13/10 noite | Dono: as 5 do Video Fone em inglês (42-46) PAUSADAS (lead a R$ 30+, CPC R$ 9-32 no Concorrentes EUA; `_ballad-pausar-en-13out.mjs`, relido). Search EN: as negativas de 11/10 NÃO derrubaram nada (cliques, CPC e parcela iguais, nenhum termo que vendeu barrado). Venda REAL por palavra (gclid → `click_view`, `_ballad-search-termos-leitura.mjs`): personalized song (24 leads, 1 venda), custom song with name (9, 1), personalized birthday song (5, 1), justoursong (1, 1). Perdia 67% das buscas por classificação. Aplicado (dono): maximizar cliques → CPC MANUAL, R$ 9 nas 4 que venderam e R$ 5 no resto; orçamento 100→60; prayer song [frase] pausada (R$ 49, 1 lead); negativa "write me" fora; novas: own song, happy birthday, lullaby, funeral, unlimited, download, by text, songai. `_ballad-search-otimiza-13out.mjs` (relido). Espanhol, mesma noite (dono, "pode sim"): 40 Comprando regalo 65→80; PAUSADAS 36 Hispanos EUA e 41 Fans musica latina (~R$ 100 por venda em 11-13/10). Ficam 31, 33, 37, 39, 40 (`_ballad-pausar-36-41-13out.mjs`, `_ballad-orcamento.mjs`, relidos) | custo por venda (6 dias antes: R$ 113); gasto concentrado nas 4 | 16/10 | é a Ballad |
| Serenata: corte de 14/10 + raio-x da PMAX | 14/10 madrugada | 13/10 fechou lucro R$ 1.215 antes do TikTok (08-10/10: ~R$ 3.700/dia): desde 11/10 o Google gasta ~R$ 1.200/dia a mais (R$ 5,8-6,2 mil) com os MESMOS ~1.400 leads do Google por dia; funil saudável (música 51s, 0 falha, 82% dos PIX pagos). Dono: PAUSADOS 18 testes, R$ 757/dia (`_pausar-testes-14out.mjs`, relido): isabela 2 (religada no painel depois da pausa de 12/10), Video Fone New relacionamento (R$ 62), os 6 pagode/sertanejo gospel por público de 11/10 (R$ 62-124 ou sem venda), pagode RMKT new e Intenção, e os 8 do Ralph de 12/10 sem venda ou a R$ 82 (Motion remarketing geral/gospel, Motion frio gospel, Ângulo perfume esposa/gospel, POV gospel quente, POV esposa quente, POV namorada). Ficam: Video Fone Casamento (R$ 23, candidato a ESCALA), meioC (R$ 30), Motion frio geral e pagode Casamento (2 vendas no 1º dia), e no limite (R$ 35-37) Video Fone Intenção, Joias, adoração 1, sertanejo gospel Remkt. **PMAX, por que o painel mente** (`_pmax-raio-x-14out.mjs`, `_testes-raio-x-14out.mjs`): em TODA campanha Demand Gen/Search o CPA do Google bate com o do banco (CAMPEÃO 2# R$ 25 × R$ 22); só a PMAX descola: Ângulos 65 conversões no Google (R$ 18) × 20 vendas de quem clicou nela (R$ 59; R$ 150 nos últimos 3 dias); a PMax 10 Set antiga, 10 × ZERO. As conversões são a importada (gclid) e 85% delas caem no YouTube, em clique de R$ 0,26 pra público de remarketing: a atribuição do Google reparte a venda entre todo anúncio clicado no caminho, então a PMAX pega crédito de venda que outra campanha trouxe (o total não cresce). Dias com ela desligada (07, 10, 12/10) venderam média 239 × 229 ligada. Display: R$ 177, 2.750 cliques, 0 conversão. PMAX segue LIGADA (R$ 70) até o dono decidir | CPA real das que ficaram; decisão da PMAX | 16/10 | - |
| Serenata: as 5 de CPA 30+ e o teste de público novo (14/10) | 14/10 manhã | Dono ("pode ser"): cada uma pelo que a pesava em 05-13/10 (`_cpa30-fatias-14out.mjs`, `_otimiza-cpa30-14out.mjs`, relido): Ralph V5 Remkt 337→255 e só 6h-21h (21h-6h R$ 48 × R$ 23-27 de dia); Video Fone Intenção 91→69 e PÚBLICO NOVO "Intenção de busca: presente · 35+" (18-34 e idade n/id: R$ 114, 0 venda; a noite ali é a MELHOR hora); adoração 1 56→46 e 6h-21h (noite R$ 54); sertanejo gospel e meioC 48→40. Os aumentos de 11-12/10 nessas não trouxeram venda: no Remkt Concorrentes, 09/10 R$ 2.315 → 109 vendas, 13/10 R$ 3.517 → 130 (R$ 57 por venda a mais). **Regra nova (dono): público existente NUNCA é editado** (é compartilhado: o Intenção estava em 7 campanhas); idade/segmento = público NOVO trocado só no grupo alvo, na mesma chamada (`remove` + `create`: a conta agrupada aceita 1 público por grupo; `_intencao-35mais-14out.mjs`). Horário: em Demand Gen só liga/desliga (sem ajuste de lance) e vale pra CAMPANHA, não pro grupo. Hora a hora das campeãs desde agosto (`_hora-campeas-14out.mjs`, `_noite-historico-14out.mjs`): a noite na CAMPEÃO 2# sempre foi ~1,2x o dia (R$ 29 × R$ 24) e dava lucro; só em 05-13/10 foi a R$ 41-48, junto com o dia piorando: NÃO cortar a noite, o problema é o público cansado. Região: nenhum estado é caro em todas (ruído), não excluir. **Teste de público novo** (`ads-criar-14out-publico-novo.mjs`, ligadas 05h de 14/10, relidas): o "Pesq Sites Concorrentes" das campeãs tem só 8 sites pequenos; segmento novo "Concorrentes novos (busca) 14 Out" = 20 termos (NossaCanção, Canção Eterna, Melodia Eterna, Eternisom, Música do Coração, Sonara, Imperial Melody, SongPetal, Hosanna/Canção Divina, Histórias Cantadas, Amor em Canção, LoveTune, Forever Songs, Tunne AI, "música personalizada"…) + 3 sites. Duas TESTE a R$ 50/dia, 7h-23h, segmentação LIGADA, /criar, com os MESMOS 2 anúncios da CAMPEÃO 2# (Video Fone + Adoração 1, textos iguais): "Concorrentes novos · 25+" e o combo do dono "concorrentes novos + Semelhante aos Compradores + Intenção de busca: presente · 25+" (várias linhas de segmento num público). Idade 25+ sem n/id (n/id saiu a R$ 46 na 2#, 25% do gasto). Ballad: 31 ralph mariachi PAUSADA (R$ 259 em 4 dias). 14/10 11h (dono, "pode fazer", relido): +15% nas duas que bateram a regra fora do Remkt Concorrentes, ESCALA Semelhante 100→115 (R$ 16,50 em 11-13/10, 102%) e Video Fone Casamento 80→92 (R$ 22,50, 105%); CAMPEÃO 1# 1217→1058 (o aumento de 13/10 foi pro público saturado) | CPA real das 5 contra 05-13/10; os 2 públicos novos contra a CAMPEÃO 2# (R$ 27-29 por anúncio); se < R$ 25, viram grupo nas campeãs | 17/10 | o público que vencer inspira o "Concorrentes EUA" |
| Serenata: CAMPEÃO 2# encarecendo = criativo cansado | 14/10 noite | `_campeao2-raio-x-14out.mjs`: CPM (R$ 2,4-4,8), CTR (0,65-0,82%), CPC e leads/dia (420-490) estáveis desde 05/10; o que caiu foi a venda por anúncio (pelo dia do clique): Video Fone R$ 30 (05/10) → R$ 42-45 (12-13/10); Adoração 1 R$ 21-25 até 11/10 → R$ 30-31 (12-13/10), começou a cansar com o gasto maior e rodando em 5 campanhas do mesmo público. Nenhum criativo novo entrou depois que a Isabela saiu (12/10). Dono ("pode aplicar"): CAMPEÃO 2# 1600→1300 até repor criativo (relido). Reposição: os vídeos do dono (teste a partir de 15/10), o grupo "Concorrentes novos 25+" (R$ 25 no 1º dia) e as variações do Video Fone com outra música (10/10, só pagode e MPB rodaram 2 dias) | CPA da 2# a 1300; qual criativo repõe o Video Fone | 17/10 | - |
| Serenata: o DONO no formato do Vid 5 (3 vídeos) | 15/10 (início) | O dono gravou 3 vídeos dando play nas músicas na caixa de som: namorada (refrão de "O Verso do Boleto", sertanejo, Camila) e cachorro (refrão de "Caramelo Ladrão", forró, Paçoca; o cachorro dele lambendo é o melhor momento). Músicas geradas pelo funil (`scratch/criativo-vid5-dono.mts`), refrões cortados por timestamp (`scratch/vid5-dono/cortar.mjs`), pasta `materiais/vid5-gravacao/`. Montagem `scratch/vid5-dono/montar.py`: caixas brancas do Ralph (gancho, "Ouve o que eu escrevi pra ela 🥹", "Ele aprovou 😂🐶", CTA "Ouça a prévia GRÁTIS"), zoom de 0,25s em cada corte seco, volume -14 LUFS, música do próprio vídeo (sem trilha). Falas "pronto em menos de um minuto" e "é de graça" mantidas (dono). YouTube (títulos subiram trocados; mapa pela duração): v1 DRIw2LCEGSU, v2 5dX_7ZH5k6Q, v3 (abre com o cachorro) 1Bn-9vCmm8U. Três TESTE a R$ 40/dia (R$ 120), segmentação LIGADA, /criar, 7h-23h, início 15/10 (`scratch/ads-criar-14out-dono-vid5.mjs`, relido). Criados no Remkt Concorrentes e trocados ANTES de gastar (15/10 madrugada, dono: "evitar subir vídeos nesse público talvez saturado") pro "Fãs de programas de TV para a família", nome "… \| Fãs de TV \| 14 Out" (`_dono-vid5-publico-15out.mjs`, relido). **Regra desde 15/10: teste novo da Serenata não entra no Remkt Concorrentes** | CPA real por vídeo contra Adoração 1/Video Fone (R$ 21-29); entra em campeã só com 3 dias bons | 17/10 | se vencer, versão Ballad |
| Serenata: reações compradas da NossaCanção com o dono na abertura (5 vídeos) | 16/10 (prontos, a subir) | Dono comprou o uso; condição deles: tirar a logo e o CTA final. `scratch/nossacancao/limpar.py`: corta o cartão creme deles (detectado por brilho/saturação) e põe o NOSSO cartão animado de 5s (logo da Serenata, tag "Música personalizada", "Transforme sua história em música!", serenatagift.com); a marca d'água "Nossa Canção" (branca, semitransparente, parada) sai por ALFA INVERSO (o mínimo de cada pixel no vídeo dá a opacidade) + inpaint da letra inteira, pulando os pixels de texto/emoji DELES (senão o inpaint apagava as figurinhas). Câmera parada (n1, cozinha): o mínimo não separa a marca do inox; usa o formato tirado limpo do n4 (`molde_marca.npy`, achado por correlação) e preenche só o traço fino (NS, raio 3) pra não borrar os puxadores. n5: a marca fica no rodapé sobre as mãos; corta a faixa de baixo e amplia 12% (sem borrão). `abertura.py`: o dono recortado (máscaras de `scratch/apresentador`) falando o gancho ANTES do vídeo, com um trecho forte da reação desfocado atrás e a caixa do gancho; ganchos: n4 "Ela achou que era só mais uma música tocando" e n3 "Ele fez uma música pra esposa e gravou a reação dela" (os 2 de lead R$ 8 no 1º dia em 15/10), n2 o do pai e filha, n1 e n5 (quem ganhou é o MARIDO) "Quer emocionar alguém de verdade? Assiste até o fim" e "Isso aqui vale mais do que qualquer presente". Arquivos em `materiais/nossacancao/com-dono/` (os limpos sem o dono ficam em `materiais/nossacancao/`). n3 tem 3min35 | lead e venda por vídeo, em teste isolado fora do Remkt. NO AR desde 16/10 (7h-23h): 10 TESTE a R$ 40 (R$ 400/dia), cada vídeo no Combo Joias e no Fãs de TV (Casamento e Semelhante já cheios de teste), textos do Video Fone, segmentação ligada, /criar (`ads-16out-nossacancao.mjs`, relido). Versão final: dono ABRE (gancho) e FECHA (IMG_9390 "Conte agora a sua história e escute a sua prévia de graça, clique em saiba mais", com caixa "Faça a sua música hoje 💛 e emocione quem você ama" cobrindo a legenda deles, achada sozinha) como o Video Fone; cartão animado sem tremor (warpAffine). n3 cortado pra 2min57 (limite do Shorts) tirando o refrão repetido. YouTube: n1 pSabA0ytkXs, n2 Cg0_bsoKggQ, n3 sHxWY_B6n9k, n4 D1OQj1sz5U8, n5 MvDIQliN4fI | 17/10 (1º dia) | se vencer, versão Ballad |
| Serenata: o DONO no roteiro EXATO do Vid 5 (JBL) em 5 públicos | 16/10 (criadas 02h, rodam 7h-23h) | Dono: "tô confiante nesse criativo", "subir em campanhas isoladas com públicos validados". Vid 5 reanalisado em 16/10 pelo arquivo original (RM04.mp4, 68s, quadro a quadro + fala com tempo): ele abre falando já no 1º segundo ("Eu descobri um site…", tom de dica de cliente), toca a música do cachorro ~8s (piada) e a da namorada ~25s AO VIVO no som do carro cantando junto, conversível de dia, uma tomada só, 2 caixas (abertura e chamada no último terço). As cópias de 14/10 tinham música na edição, zoom e reação calada. IMG_9399: o dono com a JBL (play pela caixa; as 2 músicas num arquivo só com 6s de silêncio, `materiais/vid5-gravacao/4 igual ao vid5…mp3`), cachorro na cena, cantando junto; montado sem zoom com as 2 caixas (`scratch/vid5-dono/montar_9399.py`), com o "Eu descobri um site que" CORTADO (dono não pode se passar por cliente; versão com o começo também existe). Diferenças que ficaram: música da namorada limpa só ~10s (ele fala por cima 16s), rosto sai do quadro, noite. YouTube 5SQl9vgvZYk. Cinco TESTE a R$ 40 (R$ 200/dia), segmentação ligada, /criar, textos do Video Fone de cada origem: Semelhante, Casamento, Combo Joias, Intenção 35+, Fãs de TV (`ads-16out-dono-jbl.mjs`, relido). Régua: 1º dia com 2 leads ou menos = pausa | lead e venda por público contra Video Fone/Adoração 1 (R$ 29); se 4-5 dias abaixo de R$ 30, vira ESCALA | 17/10 (1º dia) e 20/10 | se vencer, versão Ballad |
| Ballad ES: vídeo da banda em públicos novos + 41 de volta | 16/10 madrugada | Dono: "pode religar a 41", "3 pode fazer". A 41 Fans música latina tinha sido pausada em 13/10 com a conta errada (eu disse ~R$ 100 por venda; era R$ 70 em 3 dias: 0, 1, 1 vendas), e a venda da Ballad (US$ 19 ≈ R$ 97) deixa ~R$ 84: R$ 70 dava lucro. RELIGADA a R$ 50. Novos, com o anúncio da 37 Aberto (vídeo da banda, texto ES → home /es), EUA, espanhol, só celular, segmentação ligada, R$ 50, 10h-3h: 53 Remarketing /es (lista nova "Visitantes balladgift.com/es 30d" com pré-preenchimento pedido, sem All Converters; começa a entregar quando a lista encher) e 54 Casamento (lifeEvents/95002, o mesmo do Casamento da Serenata, 25+). "Semelhante aos compradores" não dá ainda: a lista All Converters da Ballad tem 8 pessoas. `ballad-ads-16out-banda-publicos.mjs` (relido). Mesma noite: a 52 ralph balada (teste de música no Aberto) fez a 1ª venda com R$ 41 | venda por público; corte R$ 80 sem venda | 18/10 | é a Ballad |
| Serenata + Ballad: otimização de 16/10 pelo manual v2 | 16/10 madrugada | Dono: "pode aplicar". Raio-x 12-15/10 (`_raio-x-estrutura-16out.mjs`, `raio-x-serenata-16out.md`): só 2 vídeos validados (Adoração 1 R$ 29 em 353 vendas, Video Fone R$ 29 em 268); 60% do gasto no Remkt Concorrentes a R$ 30 enquanto Search (R$ 19), Combo Joias (R$ 21, 6 dias), Casamento (R$ 22) e Semelhante (R$ 23) recebem pouco; Música e homenagem (ESCALA R$ 40) e Fãs de TV (CAMPEÃO 3# R$ 40) cansaram. Aplicado e relido (`_otimiza-16out.mjs`): CAMPEÃO 1# 1058→1220, RMKT NEW 400→340, Comportamento 182→155, TESTE Video Fone Casamento 92→105, Intenção 69→80; PAUSADAS ESCALA Música e homenagem (o mesmo público vendeu a R$ 16 no grupo da 1#), CAMPEÃO 3# (disputava o Fãs de TV com a ESCALA de R$ 21), Motion frio geral, POV esposa quente, Ângulo perfume esposa, Concorrentes novos 25+, Dono vid5 v2, Dono reação mãe filho; ESCALA NOVA "ESCALA | Video Fone + Adoracao 1 | Joias perfume flores + Remkt | 16 Out" (R$ 100, 6h-24h, segmentação ligada, o mesmo público do teste, que segue). Ballad: PAUSADAS 33 mariachi (R$ 185 por venda) e Search EN (R$ 298 sem venda); fica a 37 Aberto (R$ 27, 12 vendas em 4 dias, gasta 73% do orçamento) e as 6 músicas novas 47-52 até R$ 80 | CPA real das que subiram; ESCALA Joias; gasto total da Serenata | 18/10 | - |
| Serenata: CAMPEÃO 2# sem alvo + manual v2 | 16/10 madrugada | Dono aprovou. A 2# fazia R$ 43 por venda em 15/10 contra R$ 21 da 1# (MESMO público, MESMOS 2 vídeos); a diferença era o alvo de CPA R$ 25 (a 1# é maximizar conversões puro) e os 3 vídeos do dono que EU tinha posto dentro dela em 14/10 sem validação (R$ 285, clique 0,36-0,48%). Aplicado e relido (`_campeao2-16out.mjs`): Dono vid5 v1 e v2 PAUSADOS dentro dela (v3 já estava), alvo removido (MAXIMIZE_CONVERSIONS sem alvo), orçamento 1300→1000. O grupo "Concorrentes novos 25+" que eu tinha posto nela em 15/10 (público com 1 dia de teste) perdeu R$ 193 sem venda; na 1#, o grupo com público VALIDADO (Música e homenagem) vendeu 12 a R$ 16. 16/10 ~10h, depois do alvo (dono: "vamos focar em aumento de orçamento apenas nos próximos dias"): +15% pela regra de 3 dias ≤ R$ 25 gastando 100% (`_subir-candidatas.mjs`), aplicado e relido com `_serenata-orcamento.mjs`: ESCALA Semelhante 135→155 (R$ 17,60 em 13-15/10), Search 320→370 (R$ 19,60), ESCALA Fãs de TV 230→265 (R$ 20), TESTE Joias + Remkt 46→53 (R$ 20,60). 16/10 ~10h: sem alvo ela quase parou (R$ 2 até 9h40 contra ~R$ 110 no mesmo horário de 15/10; a 1#, com o mesmo público e vídeos, ficou com o leilão); dono mandou pôr alvo de volta, R$ 23 (`_campeao2-alvo23-16out.mjs`, relido: TARGET_CPA 23, orç 1000). Em Demand Gen o alvo vai em `target_cpa`, não em `maximize_conversions.target_cpa_micros`. Regra nova (memória `campea-so-recebe-validado`): campeã só recebe público/criativo com 5+ dias de venda real barata. **Manual v2** (`docs/manual-otimizacao-v2.html`, artifact JhDrJ2PrKQCcWtE3MXAcra): régua de corte (1º dia com 2 leads ou menos nos R$ 40 = pausa; de 33 casos só 2 viraram bons; lead barato no 1º dia NÃO promove, fez R$ 45 depois), caminho TESTE → ESCALA → 1 campeã, subir só com 3 dias ≤ R$ 25 E gastando 95%+ do orçamento, ROAS total 2,0 como meta (01-03/10 2,14 e R$ 7.233/dia; 06-15/10 1,66 e R$ 2.540/dia), TikTok R$ 500-1.250/dia, plano do Vid 5 (5-8 rostos UGC com o mesmo roteiro). Gasto do TikTok de 01 a 15/10 lançado em `gastos_ads` (`_gasto-tiktok-16out.mjs`): R$ 16.733, 528 vendas, R$ 32 | CPA da 2# sem alvo contra a 1# | 18/10 | - |
| Serenata: 2ª Search de PRESENTE + TESTE Aberto | 16/10 (criados 15/10 noite) | Dono aprovou os dois. (1) "Search \| Presente \| Serenata \| 16 Out": a Search de hoje só tem palavra de MÚSICA e concorrente; esta pega quem busca PRESENTE ("presente para esposa", "ideias de presente para namorado", "presente para mãe", "presente bodas de ouro"…), 33 palavras em FRASE do Planejador (`_ideias-search-presente-15out.mjs`), 4 grupos (Parceiro, Mãe e pai, Presente diferente, Bodas e casamento), 28 negativas de produto físico (comprar, loja, kit, cesta, perfume, flores, Shopee…), um anúncio por grupo com o 1º título fixado no termo do grupo, R$ 100/dia, maximizar conversões, só Pesquisa Google, 7h-23h, /criar. Grupo Natal (presente de natal para namorada/esposa/mãe, ideias de presente de natal) entra em 01/11. `scratch/search-presente-15out.mjs` (relido). (2) "TESTE \| Video Fone + Adoracao 1 \| Aberto \| 16 Out": sem público, segmentação LIGADA, R$ 50/dia, 7h-23h; o Aberto da Serenata fez R$ 22 com o Vid 5 e R$ 39-58 sem ele, nunca com o Video Fone (`ads-15out-teste-aberto.mjs`, relido) | CPA real por grupo de palavra (termos de pesquisa); Aberto contra as ESCALA | 18/10 | o que vencer inspira a Ballad |
| Google Serenata: conversão em ÚLTIMO CLIQUE (painel × banco) | 15/10 noite | Conserto, não A/B (dono: "sim"). O painel mostrava teste e PMAX bons que o banco não via. Causa: a "Compra Serenata (importada)" (a LISTA, `api/conversoes.ts`, que pega o PIX que não volta pro site) estava no modelo "baseado em dados", que reparte a venda entre todo anúncio clicado em 90 dias; como campeãs, testes e PMAX rodavam no MESMO público (Remkt Concorrentes), a mesma pessoa clicava em 2-3 anúncios e a venda virava pedaços ("8,59 conversões"). Trocada pra ÚLTIMO CLIQUE: a venda vai inteira pro gclid da lista, o mesmo 1º toque do banco. Continua PRINCIPAL; a tag da /obrigado ("Compra") segue SECUNDÁRIA (dono: nunca voltar pra ela, o PIX não volta pro site). "Botão Whatsapp", "begin_checkout" e "add_to_cart" estavam como PRINCIPAIS (sem evento) e viraram secundárias. `scratch/_conversao-ultimo-clique-15out.mjs` (relido). Vale daqui pra frente. Ballad não mudou: tag da /obrigado (a conta nova não aceita lista), Google 23 × banco 29 em 08-14/10, por baixo e campanha a campanha | Google × banco por campanha por 3 dias (deve bater, menos os ~7% sem gclid e o atraso de 1 dia da lista); oscilação das campeãs no reaprendizado | 18/10 | não (Ballad já bate) |
| E-mail: raio-x da régua e cortes (15/10) | 15/10 tarde | Dono: "analisar o fluxo de e-mail pra retirar o que não traz resultado e só suja o domínio" (aprovado). Resend no plano de 100 mil/mês: 70,9 mil em 7 dias, 65% da MUSICA10. Raio-x 24/09-13/10 por template, venda até 72h depois do CLIQUE (`_raio-x-email-15out.mjs`, `raio-x-email-15out.md`): entrega R$ 1.994 por mil envios, vídeo pronto 1.125, pix_nao_pago 776, quase_comprou 575, oferta_video 510, letra_pronta 456; MUSICA10 pra lead R$ 7 por mil (28.710 envios, 6 vendas, 3,4% de bounce e ~1.000 adiamentos do Gmail em 7 dias), indicacao_convite R$ 21 (5.060, 3 vendas), escada_prazo_1 (braço B do `recuperacao_prazo`) 753 envios e 0 venda. Spam ~0 (4 em 100 mil); o problema é bounce (letra 5,6%, a maioria temporário; ~150/semana de endereço inexistente, campeões `gamil`/`hotemail`/`gnail`/`gail`). Aplicado: convite de indicação PAUSADO por `config_operacao.convite_indicacao_lote = 0` (sem deploy); o resto da MUSICA10 pra lead (1.817) saiu da fila (`pulado = 'encerrada_dono'`); `recuperacao_prazo` ENCERRADO (`RECUPERACAO_PRAZO_LIGADO = false` em `sequenciaRecuperacao.ts`, todos na escada de sempre); typo de quase-certeza corrigido SOZINHO no quiz e sempre mostrado na folha de conferir (`corrigirTypoCerto`, `email-typo.ts`, evento `email_typo_auto`). Regra: campanha pra base só pra COMPRADOR e em lote menor. Mesmo assim a régua normal (~2.700/dia) passa dos 100 mil antes de 8/11: subir o plano ou ligar excedente no Resend (entrega e letra saem pela mesma conta) | bounce da letra; R$ por mil envios por template; uso do Resend | 22/10 | conferir a régua da Ballad |
| Serenata + Ballad: otimização e leitura de 15/10 | 15/10 madrugada | Dono aprovou. Histórico de TODOS os testes isolados desde 25/09 (`_testes-historico-15out.mjs`): (1) o 1º-2º dia engana: pagode R$ 12 → 50 depois, Isabela 1 41 → 125, meioC 26 → 50, Adoração 1 isolado 14 → 39; criativo só vale com 4-5 dias < R$ 30. (2) de ~60 criativos novos desde 25/09 nenhum segura < R$ 30 depois do 2º dia; motion graphics, gospel, ângulos e Video Fone trocando a música morreram; vende pessoa real + reação real. (3) público pesa mais: Música e homenagem R$ 18, Semelhante 20, Fãs de TV 22, Intenção 25, Casamento 26 contra Remkt 27-30; nicho (Busca, Visitantes 30d, Gospel e fé, Aniversário) morre. (4) Search R$ 20, o mais estável. (5) Ballad EN morto (R$ 3,5 mil, 0 venda fora da Search); ES vende no ABERTO (37: R$ 29, R$ 22 depois do 2º dia), segmentado R$ 80-145. Aplicado e relido (`_otimiza-15out.mjs`): Search 265→320, ESCALA Semelhante 115→135, Fãs de TV 200→230, Música e homenagem 122→140, Ralph V5 Remkt 255→200, CAMPEÃO 3# 122→100; PAUSADOS PMAX Ângulos, Motion frio geral e os testes pagode, Adoração 1, meioC e sertanejo gospel no Remkt; Ballad 37 Aberto 75→110, 33 100→60, PAUSADAS 40 e 39. **Grupo novo nas campeãs** (dono: "mesmos criativos, públicos diferentes"; `ads-15out-grupos-campeas.mjs`, relido): CAMPEÃO 2# + "Concorrentes novos · 25+", CAMPEÃO 1# + "Busca: Música e homenagem", RMKT NEW + "Combo · concorrentes novos + compradores + intenção · 25+", cada um com Video Fone + Adoração 1 copiados. Leitura dos testes do funil (`_leitura-testes-10out.mjs`, `_leitura-testes-08out.mjs`, `_leitura-entrega-08out.mjs`): `email_confirma` B VENCEU (e-mail que volta 6,8% → 6,0%, z -2,6; venda igual) → A zerado pelo peso; `video_fotos_ja` B não ganhou (17,5% × 16,2%) → B zerado; e-mail de entrega (foto 40,3% × 42,0%) e assunto da letra pronta (5,4% × 5,6%) empate → B fixo no código (`entrega.ts`, `mandarLetra.ts`); quase_comprou 24 mantido; limite_frequencia e previa_refrao parciais com B um pouco pior, seguem até 22/10. Queda de venda por lead de 13-14/10 (12,7-13,6% em 6h) dentro da oscilação normal: não é defeito do funil | CPA das campeãs com os grupos novos; das ESCALA que subiram | 18/10 | email_confirma B: portar pra Ballad |
| Serenata: o DONO como apresentador do Video Fone (5 vídeos) | 15/10 | Reações compradas da Hosanna Song ("Canção Divina"; o dono pagou o uso), limpas: marca d'água por delogo (só quando aparece; a que cai em rosto vira selo "Assista com som 🔊"), legenda deles coberta pela nossa caixa branca, narração e cartões deles fora do corte (`scratch/reacoes/montar_reacao.py`, versão sem apresentador em `materiais/reacoes-hs/`). O dono gravou 20 falas na parede branca (IMG_9365-9390), recortadas com rembg isnet + chave da cor da parede na borda (`scratch/apresentador/recortar.py`; o birefnet é melhor no fio, mas 16s/quadro) e postas embaixo à esquerda, abertura por cima do começo e chamada por cima do fim, música -12 dB embaixo da voz (`scratch/apresentador/montar.py`). Esposa (cliente real, Neide, pagode) com 3 ganchos: "casado para tudo" 4i-iqBx17KI, "transformou a história" JfMj-phylSc, "só mais uma música" 6Vyhw6JcbaY, no CASAMENTO; mãe e filho TPDTADjOCZ4 e pai e filha 2NrUhWZeLT8 no SEMELHANTE AOS COMPRADORES (dono: Remkt Concorrentes saturado, R$ 27 em 08-14/10 e R$ 30 em 12-14/10; Casamento e Semelhante R$ 21-22). TESTE R$ 40 cada, 7h-23h, segmentação LIGADA, /criar (`scratch/ads-criar-15out-dono-reacoes.mjs`, relido). Por que esposa: 47% das vendas de 30 dias são pra esposa, 12% namorada (`_relacao-vendas-15out.mjs`). Mais 6 ganchos de esposa renderizando (v3, v5-v9) | CPA real por vídeo; os 3 ganchos da esposa entre si (mesmo vídeo, só a abertura muda) | 18/10 | se vencer, versão Ballad com reação em inglês |
| Serenata: 3 vídeos no Semelhante aos Compradores 35+ | 16/10 noite | Leitura de 30 dias (16/09-15/10, conversões do Google, sem PMAX): o Semelhante foi o único público grande que MELHORA gastando mais (R$ 124 → 38 → 27 → 24 → 23 por semana); Remkt Concorrentes (66% do gasto) e RMKT new pioram (R$ 21 → 32 e 19 → 36). Idade: 25-34 R$ 33,50 e n/id R$ 30 contra 35+ R$ 23-26; Intenção de busca 35+ R$ 20 × sem idade R$ 67. Hora: 6h-15h R$ 20-25, 16h-20h R$ 26-29, 21h+ R$ 30-33, madrugada R$ 33-53. Dono: público NOVO "Semelhante aos Compradores · 35+" (362247794, a mesma lista do Wrap, 35+ SEM n/id), 6h-21h todo dia, R$ 40/dia cada, segmentação LIGADA, SÓ CELULAR (dono, 16/10; `_so-celular-16out.mjs`), /criar, textos campeões sem preço. Uma campanha por vídeo do carro: "TESTE \| Video carro 1/2/3 \| Semelhante 35+ \| 16 Out (By Ralph)" (sqpIdotQXys, -K34JFw-uHw, nNiPvk91iJw; os vídeos 2 e 3 são a gravação do 1 com outro rosto, uso autorizado pelo dono). `scratch/ads-criar-16out-semelhante.mjs` (relido). Mesma regra de corte (R$ 80, lead > R$ 15, 0 venda) | CPA real por vídeo contra o Semelhante 25+ das ESCALA (R$ 23 na última semana); 35+ × 25+ no mesmo público | 19/10 | o público que vencer inspira a Ballad |
| Serenata: 25+ × 35+ em Fãs de TV, Comportamento e Casamento | 16/10 noite | Item 2 da leitura de 30 dias (dono: "aplica"). Público existente NÃO trocado (a ESCALA Fãs de TV fazia R$ 20 em 7 dias; trocar o público zera o aprendizado): uma campanha TESTE ao lado de cada origem, cópia dela (mesmos anúncios ativos, horário, aparelhos excluídos, local, idioma, segmentação LIGADA) com público NOVO 35+ sem n/id: "TESTE \| 35+ \| Fãs de TV" (origem ESCALA \| Ralph V5 \| Fãs de TV, público 361703469), "… \| Comportamento de visualização" (origem GD Comportamento, 361702374; só celular), "… \| Casamento" (origem TESTE Video Fone Casamento, 362246840), todas "\| 16 Out (By Ralph)". Diferenças além da idade: R$ 40/dia, maximizar conversões (a Comportamento usa CPA alvo 23) e SÓ CELULAR nas 3 (dono, 16/10; a Comportamento de origem já era). Os anúncios copiados incluem o "Vid 5 volta \| 16 Out" (s8Tqz0xVafg), que alguém pôs nas origens em 16/10. `scratch/ads-criar-16out-35mais.mjs` (relido). Item 3 (Search) já estava feito: as 3 palavras ruins estão em campanhas pausadas e "ia música" no Quiz já pausada | CPA real 35+ × origem 25+, mesmo período | 19/10 | o vencedor define a idade dos públicos da Ballad |
| Serenata: louvor em imagem (3 Demand Gen) | 23/10 | Dono: 3 campanhas só de IMAGEM pra louvor personalizado, mesmas 9 imagens (3 fotos geradas, mulher em casa / homem no culto / avó com a Bíblia, × retrato, quadrado, paisagem; headline nossa em Playfair + selo "Ouça a prévia grátis"; sem santo nem crucifixo), muda só o público: Semelhante aos Compradores (lookalike 9490996574) OU um segmento gospel, 35+ sem n/id. O Google não tem interesse de religião (categoria sensível): o lado gospel é segmento personalizado: "Busca: louvor e música gospel" (26 termos), "Sites gospel" (10 domínios) e "Busca: presente cristão" (15). R$ 54/dia cada, só celular, 6h-24h, YouTube feed/Shorts + Discover, segmentação LIGADA, /criar?t=gospel. Anúncio de imagem não aceita "Saiba mais" como texto de botão (fica no automático). Ligadas 23/10 (dono). `scratch/ads-criar-23out-louvor.mjs` (relido), imagens em `materiais/louvor-imagens-23out/`. Regra de corte de sempre (R$ 80, lead > R$ 15, 0 venda); lembrar que "Gospel e fé" sozinho fez R$ 342/venda na conta antiga | CPA real por público (busca louvor × sites gospel × presente cristão); louvor × presente no /criar?t=gospel | 26/10 | - |
| Ballad: `obrigado_direto` portado + Video Fone ES com 3 músicas novas | 14/10 | Dono: "pode fazer o ballad". (1) `obrigado_direto` (B ganhou na Serenata em 08/10) ligado na Ballad pela linha no banco DELA (A peso 0, B peso 1; o código e os textos en/es já existiam no `Obrigado.tsx`; sem WhatsApp por `ehBallad`). Conferido no HTML servido. `scratch/_ballad-obrigado-direto-14out.mjs`. (2) O Video Fone em espanhol que validou com banda (37 Aberto R$ 56, 40 Comprando regalo R$ 61, 33 R$ 64) com a música trocada: norteño, corrido e cumbia, mesma história (Marisol, Boyle Heights), gerados pelo funil da Ballad (`ballad-exemplos-es.mts` slugs es-us-esposa-nortena/corrido/cumbia), gravação 2, refrão no mesmo ponto (`latino/montar_fone.py final <qual>`). Arquivos em `materiais/ballad/latino/PRA SUBIR 14out/`. No corrido o nome Marisol não cai no trecho do vídeo (só na abertura da música); no norteño e na cumbia cai aos ~72s | (2) depois que o dono subir no YouTube: uma campanha por música no público Aberto, texto ES → home /es, corte R$ 80 sem venda | 2 dias depois de ligar | é a Ballad |
| Serenata: pagode em mais 3 públicos + Isabela fora da CAMPEÃO 2# | 12/10 18h | Dono: "pode criar" / "pode tirar a Isabela". Ralph v1 + pagode (ZdeQuC0XDhg) isolado em Intenção presente, Casamento e RMKT new (os públicos onde o Video Fone vende a R$ 20-26), R$ 40/dia cada, segmentação LIGADA, /criar, 7h-23h (`scratch/ads-criar-12out-pagode.mjs`, relido). A Isabela 1 saiu da CAMPEÃO 2# (11/10: R$ 147 nela e 0 venda, contra Video Fone R$ 19 e Adoração 1 R$ 23 na mesma campanha; 09-11/10 em todas: R$ 46 por venda; `_c2-sem-isabela-12out.mjs`, relido). Até 17h45 de 12/10 a Serenata gastou 16% menos que 11/10 no mesmo horário (o corte da madrugada) e vendeu 14% menos, com receita por real gasto melhor (R$ 2,30 × 2,22) | CPA por público; CAMPEÃO 2# sem a Isabela | 14/10 | - |
| Serenata + Ballad: fechamento de 11/10 e otimização | 12/10 00h | 11/10: Serenata R$ 10.148 (243 vendas + 42 upsells), Google R$ 5.716 (R$ 26 por venda com clique), lucro R$ 2.346; Ballad 7 vendas (US$ 133) com R$ 627, melhor dia dela. O Ralph (nosfer@gmail.com, painel, 11/10 17h44-17h47) tinha religado PMAX Ângulos, isabela 2 e Gospel mistura e subido orçamentos; dono aprovou desfazer. PMAX: no painel do Google parecia ótima (03/10: 14,5 conv), na venda REAL nunca foi (R$ 1.105 por 18 vendas, R$ 61; com o Vid 5, R$ 36; sem ele, ~R$ 100): a PMAX conta visualização e outros canais e infla o painel. PAUSADOS: PMAX Ângulos, isabela 1 e 2, Gospel mistura, hipermercados (R$ 54), Pai dyZy (R$ 41), Fãs de TV + Intenção + Remkt (R$ 37) e as variações que perderam em 2 dias (meioB, ctaGratis, adoração 2, pop, MPB, Video Fone MPB e pagode). Ficam pagode (7 vendas a R$ 12), sertanejo gospel (R$ 28), meioC (R$ 26). +15%: Ralph V5 Remkt 293→337, CAMPEÃO 3# 106→122, ESCALA Música e homenagem 106→122, ESCALA Fãs de TV 152→175; RMKT NEW 470→400; Video Fone Intenção 111→91 e New relacionamento 71→61 (voltaram). Ballad 33 80→100. Pico de 01-03/10 pra comparar: R$ 17-19 mil/dia com o MESMO Google (R$ 5,5-6,3 mil): a diferença era o CPA do Vid 5 (R$ 14-18) e ~70 vendas/dia do TikTok. `scratch/_otimiza-12out.mjs`, `_historico-ads.mjs`, `_pmax-historia.mjs` (relidos) | CPA das que subiram; pagode dentro da CAMPEÃO 1# | 14/10 | - |
| Serenata: variações dos campeões novos (11 testes) | 10/10 | Dono: "pegar esses 2 campeões novos e criar variações mudando a música" + variar o texto e pôr "grátis" na chamada. Cada vídeo muda UMA coisa contra o anúncio que vende. Ralph vídeo 1 (base: o final da Adoração 1) com música nova, mesma fala e textos: adoração 2 (Hu2rviBwuJA), sertanejo gospel (_XrdwHIcNqA), pagode (ZdeQuC0XDhg), pop romântico (SVvAwXVMntE), MPB (Ci2l08ht9aY); Ralph v1 + Adoração com só o texto do começo trocado: "Contei a nossa história e virou essa música" (yUE9LynSlKw), "Fiz essa música pra minha esposa com a nossa história" (W_7Q9GXFgE0); Video Fone com música nova no miolo (abertura e fecho falados originais): adoração 2 (-mmIc6Iywtc), pagode (jDmw8SHLnys), pop (qF6dPVq9LMU), MPB (Lh9HzxeJBdA). Ralph v1 + Adoração com a chamada final "…Ouça a prévia GRÁTIS / Clique em saiba mais" (3b4CXtHcY8s), 12ª campanha. Músicas geradas pelo funil (`scratch/criativo-musica-esposa-gospel.mts`), volume igualado ao da Adoração 1 (comparação justa), montagem `scratch/ralph-pt/montar_ralph_pt.py` e `montar_fone_pt.py`, arquivos em `materiais/ralph/variacoes-10out/`. Uma campanha TESTE por vídeo, R$ 40/dia (R$ 480/dia), Remkt Concorrentes, segmentação LIGADA, /criar, horário 7h-23h na criação. `scratch/ads-criar-10out-variacoes.mjs` (relido). Regra: CPA real < R$ 20 em 2 dias entra numa campeã por vez; corte pela regra de sempre ou CPL > R$ 4,75 sem venda | CPA real e CPL por vídeo contra Adoração 1 (R$ 18-24) e Video Fone (R$ 27) | 12/10 | o vencedor ganha versão Ballad |
| Serenata: otimização de 10/10 | 10/10 06h | Pelo CPA real de 07-09/10 (R$ 14.393, 3.758 leads a R$ 3,83, 521 vendas a R$ 28) e uso do orçamento em 09/10. CAMPEÃO 2# oscila (28, 21, 29, 22, 34): os 2 vídeos novos NÃO explicam (08/10, 1º dia com eles, foi R$ 22; em 09/10 todos os vídeos pioraram juntos, a conta inteira caiu de 17% pra 14% de conversão, o Inngest caiu no pico e o Google recebeu as vendas com horário errado). PAUSADOS (relidos): ESCALA RMKT NEW (R$ 186/venda) e PMax 10 Set, ambas pausadas em 08/10 e RELIGADAS por alguém no painel; PMAX Ângulos (R$ 427 em 6 dias, 5 vendas reais, R$ 85; por grupo nenhum se salva: Aniversário 59% do gasto a R$ 84); Video Fone Emoção e memória (R$ 125); ESCALA Aberto (R$ 39); TESTE pop gospel 3 (R$ 41); testes de público Compradores de valor (CPL R$ 6,97) e Lojas de departamento (R$ 6,78), 0 venda. RMKT NEW 550→470. +15% nas com CPA ≤ R$ 25 e 100%+ do orçamento: CAMPEÃO 1# 800→920, Search 200→230, ESCALA Fãs de TV 115→132, CAMPEÃO 3# 80→92, hipermercados 69→79, Intenção 69→79, Semelhante 58→67, Adoração 1, Pai dyZy e New relacionamento 40→46 (os dois últimos também tinham sido religados no painel e estão a R$ 20-24). `scratch/_otimiza-10out.mjs`, `_uso-orcamento-10out.mjs`, `_pmax-grupos-10out.mjs` | CPA das que subiram; testes de público que ficaram | 12/10 | - |
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
| Serenata: motion graphics (remarketing e público frio) | 12/10 | Vídeos verticais feitos no Remotion (`video/src/Remarketing.tsx`, props em `scratch/remarketing/`), músicas de exemplo da home (Isabela no geral, Denise no gospel) com a letra acendendo no tempo real do canto. Remarketing: "Lembra da letra que você escreveu?" → papel ganhando tinta → refrão → página no celular → "Sua música está te esperando", em 30s (geral lobOpDQpa2A, gospel Lqq043hKJqQ) e 35s com montagem das reações (geral FVryFuUZsYk, gospel 6TA4y6XDtUY). Público frio, 31s: reação real na abertura + 3 passos (conta a história → letra GRÁTIS → vira música) → "Dê uma música de presente" (geral CsaRk4Z-w4s, gospel EufKq8_kqbY). 4 campanhas TESTE a R$ 42/dia (R$ 168/dia), segmentação LIGADA: remarketing no RMKT new (os 2 vídeos como 2 anúncios), frio no Remkt Concorrentes; geral → /criar, gospel → /criar?t=gospel. Textos: os 5 títulos, 5 longos e 5 descrições sem preço que mais converteram em 22/09-11/10 (`_publicos-titulos-20d.mjs`); no gospel 1 de cada troca por texto de fé. `scratch/ads-criar-09out-motion.mjs` (valida antes, `--valer` grava), `_motion-conferir-12out.mjs` (relido). Mesma regra de corte (R$ 80, lead > R$ 15, 0 venda) | CPA real por anúncio na aba Criativos; remarketing 30s × com reações; geral × gospel | 15/10 | se vencer, versão em inglês com músicas da Ballad |
| Serenata: anúncios de ângulo (perfume / POV) | 12/10 | Motion graphics de 31s (`video/src/AnuncioAngulo.tsx`, peças comuns em `pecas-anuncio.tsx`; textos e cortes em `scratch/anuncios-12out/montar.py`), foco esposa/namorada + gospel. "Perfume acaba, música fica" (perfume esvazia, flor murcha, chocolate some → refrão) e "POV" (mensagem → link → página com o nome dela → música → reação real do `reacoes.mp4`). UMA campanha por vídeo pro A/B ficar limpo, R$ 40/dia cada (R$ 200/dia), segmentação LIGADA, textos campeões sem preço de 22/09-11/10: frio no Remkt Concorrentes — perfume esposa/Isabela (ozrIjhxfzkQ), POV namorada/Bianca (oHDbDzeyh_I), perfume gospel/Denise (dEITRYs6bCQ, /criar?t=gospel); quente no RMKT new — POV esposa/Isabela (usV9J2kjQ1o), POV gospel/Denise (67sHst1-cA4, /criar?t=gospel). `scratch/ads-criar-12out-angulos.mjs` (valida antes, `--valer` grava), `_conferir-campanhas.mjs` (relido). Versões da Ballad em espanhol (b1-b5, mariachi/bachata/cristiana) prontas em `criativos/anuncios-12out/`, ainda não subidas; destino delas é a home /es (texto ES → quiz cai em CONSUMER_FINANCE). Mesma regra de corte (R$ 80, lead > R$ 15, 0 venda) | CPA real por vídeo na aba Criativos: perfume × POV no frio; frio × motion de 12/10 | 15/10 | Ballad ES já renderizada |
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

**Conserto sem teste (14/10):** toda foto subia cortada num QUADRADO pelo CENTRO (`src/lib/imagem.ts`), e em foto em pé o rosto saía (a Edna pagou o vídeo e 3 fotos chegaram sem rosto). Agora sobe inteira, só reduzida (maior lado 1600): a página (`FotoAdaptativa`), o quadro (`AjusteDaFoto`) e o vídeo (`Presente.tsx`) já enquadram pela proporção real. Foto antiga continua quadrada até a pessoa subir de novo. Teste em `imagem.test.ts`.

**Consertos sem teste (14/10, tarde):** (1) a galeria mandava TODAS as fotos numa requisição só e a Vercel recusa corpo acima de ~4,5 MB; com a foto inteira (conserto da madrugada) as falhas da galeria foram de 4 pra 11 por dia. Agora sobe em lotes de 3 (`FOTOS_POR_ENVIO`, `editar.$tokenEdicao.tsx`). (2) "Quem é a próxima?" (`AtalhoOutraMusica.tsx`) só vendia: abria o PIX de R$ 28 até pra quem tinha crédito (pacote pago e não usado, ou cortesia do suporte; o Ademir recebeu QR Code com cortesia liberada). Agora lê o saldo pelo `token_edicao` (`meusCreditos`); com saldo, o rótulo vira "Você já tem 1 música paga", guarda o crachá e vai direto pro quiz. Conferido no site publicado. Crédito de cortesia do suporte é usado por ESTE botão.

**Auditoria noturna de 16/10 (dono dormindo: "de cabo a rabo"), consertos sem teste.** Plano e lista completa no artifact "Rumo ao milhão" (`docs/plano-1-milhao.html`, https://claude.ai/artifact/9L2ce2Xh4ttxpvxoJcamn5).
- DINHEIRO: a tela da oferta mostrava o preço do braço cru (D R$ 29, E R$ 54,90) e a folha cobrava R$ 38: `PrecoDaOferta` usa `planoCobravelDe`. Ballad: a chave de idempotência do Stripe leva a impressão do corpo (refazer o quiz dava 400 por 24h). Pós-pagamento comum (`api/lib/pos-pagamento.ts`): o vigia de pagamento sobe o TikTok, libera bump e grava `asaas_pago` como o webhook; o webhook do Asaas só entrega se virou o pendente (`update … eq status pendente`). Cartão pago e não liberado avisa os donos. `gatewayPix`: Asaas por padrão, Woovi só com `PIX_GATEWAY=woovi`. `vigiaEntrega` busca a confirmação por `email_id` em lotes (o corte de 1000 linhas dava ~200 alarmes falsos por hora).
- FUNIL: folha do PIX com o voltar e a pausa dos vídeos do Stripe (`src/lib/folha-pagamento.ts`); "PIX pago" uma vez; espera da música limpa os relógios ao sair, para no `falhou` e rola até o aviso; `pagar` espera a consulta do crédito (até 3s); `pageshow` destrava o botão; sem "sem CPF" e "parcelar"; `TEMA_CLARO` como `style` em /pix, /oferta e legais; aviso de "tem mais letra" mede na abertura; `finalizarLetra` regrava quando a letra nova difere (normalizada) e não há pagamento; player pede link novo quando o áudio vence (`renovarAudio`); stream da letra trata `overloaded_error` e o caminho antigo espera [700, 2000, 5000]; "outra opção" de refrão com teto de 5.
- PERF: `RevealStep` e `TelaOferta` sob demanda (`lazy`, adiantadas 3s depois da abertura); zod fora do `validateSearch` das rotas (`busca-url.ts`). Quiz 46 → 23 KB gz, entrada 170 → 157 KB gz.
- E-MAIL: Natal e Dia das Mães só abrem com copy própria (`temCopy` em `ocasioes.ts`; a janela do Natal abriria 25/11 com o texto do Dia das Crianças). `guardeOLink` e `lembrarPresente` paginam a janela, leem "já enviado" numa consulta e o idioma pela música. Degrau 2 da escada (preço cheio) vai pro `/retomar`. `pixNaoPago` falha fechado na consulta de "já pagou". Domínio de typo (`pareceTypo`) bloqueia no 1º bounce.
- BALLAD: vídeo-presente com a prop `marca` ("BALLAD"; **rodar `npm run video:site` depois do deploy**). Ajuste da letra no idioma dela. Estorno e contestação do Stripe (`api/lib/stripe-estorno.ts`) **precisam dos eventos `charge.refunded` e `charge.dispute.created` marcados no endpoint**. Textos pt vazando (MP3 compartilhado, "sair", alerta de bounce).
- RASTREIO: o id da venda também em `localStorage` por sessão (`mp_tx:<sessão>`).
- PENDENTE DO DONO: UTMify ainda é lida? (não recebe venda BR desde 12/09); teto diário 2500 → 4000; garantia "Reembolso total" × crédito; plano do Resend antes do Natal; último clique pago (gclid de agosto vence ~05/11).

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
