# Música personalizada (nome provisório)

Funil de presente digital: a pessoa conta a história de alguém querido, recebe
a **letra de uma música na hora e de graça**, e paga para ouvir essa letra
cantada numa **página presente** com link e QR Code.

Tráfego alvo: Google e YouTube (Brasil). Ticket alvo abaixo de R$ 50.

> Este arquivo guarda as decisões já tomadas e a pesquisa de concorrência.
> Leia antes de propor arquitetura.

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
| Letra (Claude) | R$ 0,11 |
| Música (Suno via revendedor) | R$ 0,35 a R$ 1,00 |
| Transcrição de áudio | R$ 0,05 |
| Gerações pré-venda (5 por venda a 20% conv.) | R$ 1,75 |
| Checkout (~5% + fixo) | R$ 2,30 |
| **Margem bruta** | **~R$ 33** |

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
3. **Google Ads é mais rígido que Facebook** em alegações. Nada de "visto em"
   sem comprovação, nada de prazo que na verdade é upsell, nada de "feito por
   uma equipe de músicos" se não for verdade.

## Higiene

- `ffmpeg -map_metadata -1` em todo áudio antes de publicar. Foi assim que
  descobrimos o gerador do ForeverSongs.
- Nada de rota administrativa no bundle do cliente. Segurança é RLS no
  Supabase, não rota escondida no front. Foi assim que lemos os custos e o
  provedor da Cantoria.

## Em aberto

- Nome e marca
- Testar se ElevenLabs Music entrega sertanejo e vocal PT-BR convincente
  (seria a alternativa juridicamente sólida ao Suno)
- Validar se a letra bem diagramada segura a emoção sozinha, ou se precisa
  de um trecho curto de áudio junto
