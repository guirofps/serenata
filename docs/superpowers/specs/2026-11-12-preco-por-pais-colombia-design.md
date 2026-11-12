# Teste de preço por país, começando pela Colômbia (`preco_co`)

Desenho de 12/11/2026. Ballad Gift. Implementado no mesmo dia; nasce desligado.

## O que é

Teste A/B/C do preço da MÚSICA só para quem acessa da Colômbia. Os outros
países, o preço em dólar e o teste `preco` global não mudam.

| braço | música | âncora (riscado) | pedido grava (US$) | precisa converter, contra o A |
|---|---|---|---|---|
| A (controle, hoje) | $39.900 COP | $99.900 COP | 11,74 | — |
| B | $29.900 COP | $74.900 COP | 8,79 | 34% a mais |
| C | $34.900 COP | $74.900 COP | 10,26 | 15% a mais |

Vídeo ($25.900) e música extra ($29.900) ficam fixos nos três braços (decisão
do Ralph, 12/11). Pesos 1:1:1. Nasce desligado.

A última coluna é pelo líquido da dLocal (2,99% + US$ 0,20), câmbio da tabela
(3.400 pesos por dólar).

## Decisões de desenho

### 1. O preço de cada braço mora no código, não no painel

Em `src/lib/mercados.ts`, o mercado ganha um bloco opcional:

```ts
// em Mercado
teste?: { id: string; bracos: Record<string, Record<number, number>> };

// na Colômbia
teste: {
  id: "preco_co",
  bracos: {
    B: { 1900: 2990000, 4900: 7490000 },
    C: { 1900: 3490000, 4900: 7490000 },
  },
},
```

`valorNaMoeda(m, centavosUsd, braco?)` passa a procurar primeiro em
`m.teste.bracos[braco]`, depois na tabela do país, depois no câmbio. Sem braço,
com braço "A" ou com braço que não existe, devolve o de hoje. `textoNaMoeda` e
`valorUsdNoPais` ganham o mesmo parâmetro opcional.

O banco (linha `preco_co` em `experimentos`, só na Ballad) decide só
liga/desliga e peso. Motivos: valor digitado em painel, em centavos de peso, é
o jeito mais fácil de cobrar errado; no código a tela e o caixa leem a mesma
tabela por construção; e o teste trava os números.

País novo no futuro (México, Peru…) é só mais um bloco `teste` no mercado dele
e uma linha no banco. Nada do resto muda.

### 2. A regra do braço cobrável é a de sempre

`bracoCobravel` (`braco-cobravel.ts`), a mesma do `preco`:

- experimento desligado ou sem linha no banco: controle;
- braço desconhecido ou com peso 0: controle.

Vale no servidor (lendo a linha do banco) e na tela (lendo a config viva que já
vem no HTML). Braço zerado pelo peso continua grudado no navegador de quem foi
sorteado, mas passa a ver e a pagar o controle.

### 3. O caixa cobra o braço que a folha está mostrando

Os três caixas da música (`stripe-checkout.ts`, `dlocalgo-checkout.ts`,
`dlocalgo-cartao.ts`) hoje recebem só o `sessionId` e leem o braço do
`attribution` gravado no lead. Para o `preco_co` isso deixa um buraco: quem
deixou o e-mail ANTES de o teste ligar e volta depois tem o braço no navegador
e não no banco. A tela mostraria $29.900 e o caixa cobraria $39.900.

Então a folha manda o braço junto (`bracoLocal: varianteDe("preco_co")`) e o
servidor:

1. só olha o braço se o país DA REQUISIÇÃO tem teste (`mercado.teste`);
2. passa pelo `bracoCobravel` com a linha do banco;
3. sem o campo (aba aberta com o código antigo), cai no `attribution.exp`, e
   sem ele, no controle.

Isso não afrouxa o "preço nunca vem do cliente": o `attribution` também é
escrito pelo navegador. O que o cliente escolhe é entre braços VIVOS, e o
número sai da tabela do servidor. Forçar `?exp=preco_co:B` dá o preço do B,
como já acontece com qualquer braço vivo do `preco`.

As três funções passam a chamar um helper só (`valorLocalDaSessao`), que
devolve valor local, equivalente em dólar e braço usado, para não manter três
cópias da regra.

O pedido continua gravando o equivalente em dólar do que se cobrou (879, 1026
ou 1174 centavos). Os webhooks não mudam: `valorPagoConfere` compara o pago com
o valor do próprio pedido.

### 4. A tela: todos os braços no HTML, o carimbo escolhe

`NaMoeda` (`PrecoDaOferta.tsx`) já desenha um `<span>` por moeda. Para mercado
com teste, o span daquela moeda passa a ter um span por braço
(`data-v="preco_co:A|B|C"`), e o CSS dos experimentos esconde os outros. Mesmo
desenho do `preco`: nada pisca e não há erro de hidratação.

Duas guardas:

- **Sem linha no banco, só o controle é desenhado.** O CSS só tem regra para
  experimento que existe na config; sem ela os três preços apareceriam lado a
  lado. Com a guarda, o código pode subir antes ou depois da migration.
- **Braço de peso 0 desenha o preço do controle** (regra 2).

Vale em todo lugar que mostra o preço da música antes da compra: home `/es`,
revelação ("a partir de"), oferta, barra fixa, título da folha do Stripe, botão
do cartão da dLocal.

**Fora, de propósito: o pós-compra.** O editor abre por link em qualquer
aparelho, e o carimbo daquele navegador não é o braço de quem comprou. Vídeo e
extra não têm braço, então nada muda, com uma exceção: o atalho da música
extra diz "En vez de $39.900". Para quem pagou $29.900 isso é falso. Na
Colômbia, enquanto o mercado tiver teste, essa linha não aparece (em nenhum
braço, para não virar diferença entre eles).

### 5. Eventos e valor da conversão

- `preco_co_exposto` `{ braco, pais }`: uma vez por sessão, na primeira tela
  que mostra preço (revelação ou oferta), só com país CO e teste ligado. É o
  denominador da leitura. O lead não guarda país, por isso evento próprio.
- `stripe_checkout_criado` e os equivalentes da dLocal ganham `braco_preco`.
- O valor que o navegador manda para Google, TikTok e GA4 no clique de comprar
  (`valorDoCheckout` → `valorUsdNoPais`) passa a usar o braço. O valor da
  compra já sai do pedido. O envio pelo servidor (Data Manager) também.

### 6. O vigia não mexe neste teste

O `vigiaExperimento` desliga braço que clica menos na oferta, contando todas
as sessões. Fora da Colômbia o `preco_co` não muda nada, então a diferença
entre braços seria acaso, e o acaso cruza o corte cedo ou tarde (foi assim que
ele desligou o `outra_musica_24h` duas vezes). `preco_co` entra na lista que
ele ignora.

### 7. O que não muda

- E-mails: nenhum e-mail da Ballad cita o preço da música em moeda local. O
  lembrete da ficha (`oxxoPendente`) lê o valor da própria ficha.
- `/retomar` em outro aparelho: já repõe os braços de todo experimento ativo.
- Ficha da dLocal reaproveitada ao reabrir: é do mesmo valor, porque o braço é
  grudado.
- Serenata: a linha não existe no banco dela e o `NaMoeda` fora da Ballad
  devolve o texto puro.

## Arquivos

| arquivo | mudança |
|---|---|
| `src/lib/mercados.ts` | bloco `teste` na Colômbia; braço opcional em `valorNaMoeda`, `textoNaMoeda`, `valorUsdNoPais` |
| `src/lib/preco-local.ts` (novo) | `EXP` por mercado, `bracoLocalCobravel` (tela) e a regra pura do servidor |
| `src/lib/stripe-checkout.ts` | `valorLocalDaSessao`; aceita `bracoLocal` |
| `src/lib/dlocalgo-checkout.ts`, `dlocalgo-cartao.ts` | usam o helper; aceitam `bracoLocal` |
| `src/components/quiz/PrecoDaOferta.tsx` | `NaMoeda` com span por braço e as duas guardas |
| `CheckoutStripe.tsx`, `CheckoutDlocal.tsx`, `CartaoDlocal.tsx` | mandam `bracoLocal` |
| `TelaOferta.tsx`, `RevealStep.tsx` | `preco_co_exposto`; braço no valor do checkout |
| `src/lib/valor-conversao.ts` | braço em `noPaisDoAcesso` |
| `AtalhoExtraBallad.tsx` | esconde "En vez de" em país com teste |
| `src/lib/experimentos.ts` | entrada `preco_co` na lista do código (chão, desligada) |
| `inngest/functions/vigiaExperimento.ts` | `preco_co` na lista ignorada |
| `supabase/migrations/20261112010000_experimento_preco_co.sql` | linha desligada, A:B:C 1:1:1, só Ballad |
| `CLAUDE.md` | linha na tabela de testes |

## Testes

- `mercados.test.ts`: os seis números (música e âncora de A, B, C); braço
  desconhecido = A; braço em país sem teste é ignorado; `usdDe` dá 1174, 879 e
  1026; `valorPagoConfere` aceita os três contra o pedido do próprio braço e
  recusa o valor de um braço contra o pedido de outro.
- `preco-local.test.ts`: desligado = A; peso 0 = A; sem linha = A; país da
  requisição diferente de CO ignora o braço mandado; campo ausente cai no
  `attribution`.
- `PrecoDaOferta`: com a linha na config, três spans com `data-v`; sem a
  linha, um só; fora da Ballad, texto puro (o snapshot da Serenata não muda).
- Vídeo (1200) e extra (1400) devolvem o mesmo valor nos três braços.
- No navegador, no localhost da Ballad com Stripe de teste, forçando país CO e
  `?exp=preco_co:B` e `:C`: o número da home, da revelação, da oferta, da folha
  e do caixa do Stripe é o mesmo, e o pedido nasce com 879 e 1026.

## Como ligar

1. Deploy (o código nasce inerte: sem linha no banco, tudo como hoje).
2. Guilherme aplica a migration no banco DA BALLAD (`scratch/ballad-migrar.mjs`).
3. Conferir no site publicado, da Colômbia ou com braço forçado, que tela e
   caixa batem nos três braços.
4. Ligar pelo painel (`ativo = true`).

## Como ler

Régua: **receita da música em dólar por sessão exposta**, por braço
(`preco_co_exposto` → pedido pago do quiz daquela sessão, sem upsell).
Conversão (pagou ÷ exposto) é sinal, não decisão. Ao lado, a receita de upsell
por exposto, para ver se o preço menor traz comprador que leva menos extra.

Conferência: os pedidos pagos da Colômbia têm que valer 1174, 879 ou 1026
centavos, cada um no braço certo (`braco_preco` do evento do caixa).

**O limite do volume.** Com conversão base de 10% (suposição; o número real
sai da primeira leitura), separar o B do empate dele (34% a mais) pede cerca
de 1.400 expostos por braço. O empate do C (15% a mais) pediria cerca de
6.700: o C só vai dar resposta se ficar claramente acima ou claramente abaixo.
Primeira leitura com 14 dias ou 500 expostos por braço, o que vier depois, e
sem olhar todo dia para decidir.

**Mídia.** Durante o teste, dois terços do tráfego da Colômbia pagam menos. O
CPA e o valor que o Google aprende nas campanhas da Colômbia misturam os três
preços.

**`local_primeiro`.** Segue em teste na Colômbia (Nequi/PSE antes do cartão).
Os sorteios são independentes, mas os dois dividem o mesmo volume. Ler o
preço sempre olhando os dois braços do `local_primeiro` juntos.

## Como encerrar

- **O controle ganhou:** desligar pelo `ativo`. Todo mundo volta a ver e pagar
  $39.900 na hora.
- **B ou C ganhou:** deploy trocando a tabela da Colômbia (música e âncora do
  vencedor viram o preço do país), tirando o bloco `teste`, e desligando a
  linha. Zerar os outros pelo peso NÃO serve aqui: braço zerado paga o
  controle, que é o A.
- Nunca mexer no câmbio (`porDolar`) da Colômbia com o teste aberto: ficha
  pendente deixaria de conferir.

## Revisão do código (12/11)

Revisão independente antes de publicar: nenhum defeito que impeça. O que saiu
dela:

**Corrigido**

- Desligar o teste (ou zerar um braço) com a aba de alguém aberta: a tela
  segue com o preço do braço e o servidor cobra o controle. No Stripe e na
  página da dLocal a pessoa vê o valor real antes de pagar; no cartão da dLocal
  (SmartFields) o único número era o nosso botão. Agora `criarCartaoDlocal`
  devolve o valor que vai cobrar (`valorTexto`) e o botão escreve esse.
- `braco_preco` no evento do caixa saía "A" mesmo com o teste parado. Agora só
  é gravado com o teste rodando.

**Para saber na leitura**

- Lead que deixou o e-mail antes de o teste ligar e volta em OUTRO aparelho é
  sorteado de novo ali: pode ver um preço em cada aparelho (cada um paga o que
  mostra) e gerar um segundo `preco_co_exposto` com outro braço. Na leitura,
  contar a sessão uma vez, pelo primeiro evento.
- Na hora de ligar ou desligar, quem tinha ficha pendente da dLocal de outro
  valor ganha uma segunda ficha; a antiga segue pagável por 3 dias. Cada uma
  confere pelo próprio valor, e duas pagas caem no alerta de segundo pagamento.
- A linha do banco tem que manter o "A" em primeiro. O motor trata o primeiro
  da lista como controle e a cobrança trata o "A": com outra ordem e exposição
  abaixo de 100%, quem ficou de fora veria um preço e pagaria outro.
- No painel, os campos de preço da linha `preco_co` não fazem nada: o número
  mora no código.
