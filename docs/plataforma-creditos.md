# A plataforma de créditos, o quadro, e tudo que falta

Registro do que foi decidido na madrugada de 17 para 18/08/2026, pra não se
perder entre sessões. **Nada aqui é ideia solta: é o escopo combinado.**

## A regra que muda a arquitetura

O funil gera a música **antes** de cobrar, e isso existe pra nunca cobrar por
algo que não foi produzido. **Crédito inverte essa ordem**: a pessoa paga, e só
depois gera. É seguro (crédito é promessa nossa, não arquivo que pode falhar no
provedor), mas é **outro caminho**, e não deve ser encaixado no paywall da letra
grátis.

## Os três produtos (Perfect Pay, criados em 18/08)

| Produto | Preço | Crédito | Checkout |
|---|---|---|---|
| Música extra | R$ 28 | 1 | `PPU38CQFE9E` |
| Três músicas | R$ 67 | 3 | `PPU38CQFE9J` |
| Quadro | R$ 24,90 | 0 | `PPU38CQFE9O` |

Já em `src/lib/creditos.ts`.

**Um crédito = uma música NOVA completa.** Outro quiz, outra letra, outra
música, com as duas gravações, a página presente, o link, o QR e o MP3. Não é
versão alternativa da mesma letra.

**Não existe pacote de 10, e é decisão medida.** Dos 290 compradores, 279
fizeram uma música, 11 fizeram duas, **nenhum fez três**. E o "pra quem"
explica: 160 esposa, 30 namorada, 29 filha, 28 marido. É presente pra uma
pessoa. Um pacote de 10 daria 79% de desconto pra quem compraria 2 e ensinaria
que a música vale R$ 8. Se aparecer gente comprando o de 3 e voltando, aí sim.

**Créditos não expiram.** Validade gera ticket de suporte e sensação de
tapeação, e guardar custa zero.

## O que falta construir

Ordem combinada: **BR primeiro, LATAM depois** (o funil espanhol ainda não
validou nada, vai com calma).

### 1. Ledger de crédito
Tabela de saldo por conta: quanto entrou, de onde veio (qual pedido), quanto
saiu (qual música). Sem isso não dá pra auditar quando alguém reclamar.

### 2. Webhook
Um só, o mesmo da venda principal, reconhecendo os três produtos novos. Tem que
cobrir os casos combinados:
- comprou só o crédito
- comprou o quadro junto do produto principal
- comprou música extra junto do principal, na mesma transação

Quando ela entrar na plataforma pela primeira vez, o crédito já tem que estar
lá.

### 3. O painel virando plataforma
- Bloco de créditos **no topo**, acima da lista de músicas
- Explicação do que é um crédito (uma música nova, o gênero que ela quiser)
- Saldo visível ("você tem 2 créditos")
- Botão **usar crédito** que leva ao quiz sem passar pelo checkout
- Comprar mais créditos dali mesmo
- Mobile primeiro, responsivo de verdade

### 4. O quadro, fluxo completo
Hoje só existe a folha renderizada. Falta:
- **Gate de pagamento** (a rota está aberta pra quem tem o link do editor)
- **Configuração do quadro**, igual ela configura o presente: entrar, escolher
  foto, ajustar, e só então imprimir
- **Nível de customização**: puxar da página presente o que faz sentido no
  papel (estrutura, identidade, talvez variações de modelo). Isso ainda não foi
  desenhado.

## O estado do quadro (18/08, 00:48)

Funciona: `/quadro/$tokenEdicao` monta A4 real (210x297mm exatos), foto
sangrando com o degradê da página presente, letra em duas colunas quando passa
de 26 linhas, QR que toca a música, logo.

**Quatro tentativas de ajuste de corpo falharam antes de acertar**, e a raiz é
uma só: `scrollHeight` de elemento com `column-count`, dentro de pai com
`overflow: hidden`, devolve a altura LIMITADA da caixa, não a do texto. A
versão que funciona mede num clone fora da tela, uma coluna, sem limite.

**A cor que o comprador escolhe fica só no fio do topo.** No papel ela vira
texto ciano sobre bordô, feio e some na impressão. O texto usa o âmbar da marca.

**Nunca foi impresso.** Geometria está medida; beleza no papel não. Imprimir uma
prova antes de vender.

## Avisos que continuam de pé

- O banner do checkout diz "Amado por mais de 1.000 famílias" com cinco
  estrelas. São **290 compradores** e não existe nota em lugar nenhum. O
  `docs/checkout-perfectpay.md` proíbe isso explicitamente, e a operação é 100%
  Google Ads.
- O resumo promete "Garantia de 7 dias, reembolso total, sem perguntas", e não
  existe política escrita nem quem execute.
- A **página presente não tem rastreamento nenhum** (949 sessões em 7 dias,
  zero eventos). É o que impede diagnosticar ticket de "não consigo acessar".
