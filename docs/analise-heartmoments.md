# HeartMoments — dissecação completa

Analisado em 24/07/2026, funil percorrido ao vivo até o checkout (sem
comprar) + bundle de produção lido offline.

**Por que este importa mais que os outros quatro:** os concorrentes
brasileiros são funis. Este é a **plataforma** que a gente descreveu como
destino — e já está construída e rodando.

---

## O essencial

| | |
|---|---|
| Mercado | EUA, inglês, geo-bloqueado fora |
| Preço | **US$ 99,95** (~R$ 540), ancorado em US$ 219,95, "55% OFF" |
| Entrega | **"dentro de uma semana"**, com upsell de prioridade |
| Revisões | 1 grátis; upsell "Unlimited Edits" por 14 dias |
| Garantia | **devolução em 45 dias, sem perguntas** |
| Escala alegada | "15.000+ músicas criadas" |
| Gerador | **não vaza no bundle** (melhor que Cantoria e LoveTune) |
| Página-presente | **não tem** — entrega por e-mail, stream + download |

**US$ 99,95 é ~15x o nosso alvo.** Não competem com a gente por preço; estão
noutro mercado. O que se aprende deles é de arquitetura, não de tabela.

---

## O que eles têm que ninguém mais tem: a plataforma

O manifesto de rotas do Next.js está exposto no bundle público — mesmo erro
da Cantoria — e entrega o produto inteiro:

```
/account/songs              /account/orders
/account/create-song        ← recompra dentro da conta
/account/love-letters       ← SEGUNDO PRODUTO
/account/love-letters/create
/account/subscription       ← ASSINATURA
/upsell  /sale  /sale-promo /success
/reactions/submit           ← coleta vídeo de reação
/admin/{songs,customers,offers,upsells,subscriptions,
        subscription-plans,marketing,reports,reactions,cron,status}
```

Três coisas aí valem mais que todo o resto da análise:

### 1. Assinatura

`/admin/subscription-plans` + `/admin/subscriptions` + `/account/subscription`.
Música personalizada parece compra única por natureza — e eles resolveram
isso. É a diferença entre um funil e um negócio com receita recorrente.

### 2. Segundo produto (Love Letters)

Cartas, não músicas. Confirma a tese de "plataforma de presenteáveis": a
conta é o ativo, a música é só o primeiro item do catálogo. Exatamente o que
o `CLAUDE.md` descreve como visão — eles já estão lá.

### 3. Captura de reação (`/reactions/submit` + `/admin/reactions`)

O `CLAUDE.md` diz que o problema de quem entrega só MP3 é que "o comprador
precisa construir o momento (o vídeo de reação no carro), e a maioria nunca
constrói". **Eles instrumentaram isso**: pedem o vídeo de volta e
administram no painel. Vira prova social real e criativo de anúncio de graça,
sem produção. É a jogada mais inteligente do funil e não custa quase nada.

> Vale copiar, adaptado: a nossa página-presente é onde a reação ACONTECE.
> Um "grave a reação dela" ali, com upload, resolve de uma vez a nossa maior
> dívida — o bloco 07 de prova social, hoje travado por falta de cliente real.

---

## Operação de mídia paga (a mais séria dos cinco)

No `<head>` da home, simultâneos: **Meta Pixel, GTM, Google Ads, AppLovin,
InMobi (i-dsp), Axon.ai, TikTok analytics**. AppLovin e InMobi são redes de
mídia mobile de volume — não é quem está testando, é quem está escalando.

Duas ferramentas revelam maturidade de engenharia:

- **Statsig** — feature flags e teste A/B de verdade
- **Sentry** — com `tracesSampler` configurado a **100% de amostragem** em
  `/upsell`, `/sale`, `/success`, `/checkout` e `/subscription`, contra 10%
  no resto do site. Ou seja: monitoram as rotas de dinheiro com atenção
  cirúrgica. Isso é coisa de quem já perdeu venda por bug e aprendeu.

**O posicionamento real está no evento de conversão do Google Ads:**
`content_category: "Custom Christian Song"`. Não é "presente"; é música
cristã. O gênero "Christian and Uplifting" está no quiz e "Faith & Gratitude"
é uma das ocasiões. Escolheram um nicho de fé, de alto valor e alta emoção,
e o preço de US$ 100 vem daí.

---

## O funil, passo a passo (percorrido)

Seis passos, barra de progresso com porcentagem, e-mail só no fim:

| # | Pergunta |
|---|---|
| 1 | Para quem é (Cônjuge, Pai/Mãe, Filho, Irmão, Amigo, Família, Para mim, Alguém especial) |
| 2 | Primeiro nome — *"inclua a pronúncia se ajudar (ex: Siobhan: shi-VAWN)"* |
| 3 | Gênero (7) + voz (fem/masc/indiferente) |
| 4 | O que torna a pessoa especial |
| 5 | Memórias compartilhadas |
| 6 | A mensagem final — *"a âncora emocional da música"* |
| → | E-mail + checkout, com resumo do pedido e as respostas listadas |

### O que funciona (copiar)

- **Pedir a pronúncia do nome no passo 2.** Detalhe minúsculo, resolve o
  maior defeito audível de música gerada: nome falado errado. A gente ainda
  não tem isso.
- **Título de cada passo usa o nome já dado**: *"What Makes Maria Special?"*,
  *"What sound feels right for Maria?"*. Barato e aumenta muito o
  compromisso.
- **Cada campo explica por que existe**: "estes detalhes viram o coração da
  música", "estes momentos reais viram as letras". Justificar o esforço reduz
  abandono em campo longo.
- **Tela de checkout mostra as respostas dele de volta** antes de pagar, com
  botão "Editar respostas". Ele vê o que construiu — e o custo de abandonar
  sobe.
- **Garantia de 45 dias, sem perguntas.** Num produto de US$ 100 entregue em
  uma semana e sem prévia, a garantia é o que substitui a prova.
- **Captura parcial** via `POST /api/v1/tracking/funnel-step` a cada avanço.
  Cuidado: essa era uma vantagem que a gente listava contra a Cantoria — ela
  **não vale contra estes**.

### O que quebra (evitar)

- **Zero validação anti-lixo.** Escrevi `legal` (5 caracteres) no campo de
  história e passou: `minLength` não existe, o campo nem é `required` e o
  botão não trava. Num produto de US$ 100 sem prévia, história ruim = música
  ruim = reembolso. A LoveTune exige 150 caracteres; nós exigimos 120 mais
  palavras reais. **Aqui a gente está tecnicamente na frente.**
- **A FAQ contradiz o produto.** Diz *"After you place your order, you'll
  answer a few simple questions"* — mas o quiz vem ANTES do pagamento.
  E pior: *"Your song will be delivered by email as a written, shareable
  song. This makes it easy to read, print, save"* — isso descreve LETRA, não
  áudio, e briga com o resto da página inteira. Texto velho não apagado.
- **Uma semana de espera, sem prévia nenhuma.** Paga-se US$ 100 no escuro.
  É o oposto exato da nossa regra de nunca cobrar por algo que não existe.
- **Rotas de admin no bundle público** — mesmo erro da Cantoria.

---

## O que isso muda para a Serenata

**Não muda o preço.** Eles jogam noutro campeonato (US$ 100, nicho cristão,
EUA). Entrar por baixo no Brasil segue certo.

**Muda a ordem do roteiro.** O `ROADMAP.md` trata conta de comprador,
multi-produto e assinatura como Fase E, lá na frente. Este concorrente prova
que essas três coisas *são* o negócio, não o acabamento — e que dá pra
sustentar ticket alto com elas.

Prioridades que saem daqui, do mais barato pro mais caro:

1. **Pronúncia do nome no quiz.** Uma linha de campo. Resolve o defeito mais
   audível que existe em música gerada.
2. **Nome do presenteado nos títulos dos passos seguintes.** Copy, zero
   engenharia.
3. **Tela de revisão mostrando as respostas antes de pagar.** Já temos a
   revisão pré-letra; falta repetir no checkout.
4. **Captura de reação na página-presente.** Destrava o bloco 07 (prova
   social) que hoje está bloqueado por não termos cliente real — e vira
   criativo de anúncio sem custo de produção.
5. **Garantia explícita.** Eles dão 45 dias sem perguntas num produto sem
   prévia. Nós damos prévia; uma garantia clara custa pouco e tira a última
   objeção.
6. **Segundo produto e assinatura** — depois de vender, não antes.

**O que NÃO copiar:** o prazo de uma semana, cobrar sem prévia, e a ausência
de validação de história. Nesses três a nossa arquitetura já é melhor.
