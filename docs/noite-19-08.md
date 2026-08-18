# O que foi feito na noite de 18 para 19/08

Registro do trabalho autônomo pedido em 18/08. Tudo está em produção.

## O número que orientou tudo

**248 dos 294 compradores nunca entraram na conta (84%).**

Eles compram, recebem o e-mail de entrega, abrem o link do editor e nunca mais
pisam na plataforma. Isso muda a prioridade de tudo: o painel que a gente
construiu (créditos, quadro, três abas) só é visto por 46 pessoas de 294.

Por isso metade do trabalho da noite foi levar a oferta **pro e-mail**, que é o
canal que essa gente usa de verdade: 66% de abertura e 57% de clique nos
e-mails de entrega, os melhores números que existem no produto.

## Vendas

**O e-mail de entrega passou a mostrar o quadro.** Depois do CTA principal e
visualmente mais fraco, porque a ação daquela mensagem é montar o presente. É
o quadro e não "mais uma música": ele soma ao que ela acabou de receber, e
pedir a segunda música de quem ainda não ouviu a primeira é pedir cedo demais.

**Existe um e-mail de recompra**, que não existia. Sai 5 dias depois da compra
(ela já viu a reação de quem recebeu), fecha em 30 dias, e é UM só, não
sequência. Quem tem crédito parado não recebe. Sai só entre 9h e 20h.

**O cupom saiu da recuperação.** Zero usos em 383 vendas: desconto não era o
obstáculo. No lugar entrou a letra que ela mesma escreveu, em citação, nos três
e-mails. É a única coisa que nenhum concorrente pode mandar.

**Cada e-mail agora diz qual é** (`tags` do Resend). Antes 3.307 eventos vinham
sem identificação e não dava pra saber qual e-mail de recuperação funciona.

## O painel

Três abas: **Minhas músicas**, **Nova música** (selo `-26%`) e **Quadro** (selo
`novo`). Abre em músicas, então o que é dela aparece sem rolar.

O quadro tem preview com **moldura**, o mesmo papel que o celular faz no
preview da página presente: a folha solta é um arquivo, dentro da moldura é um
quadro. A chamada aparece também na primeira tela, com miniatura.

Copy trocada: nada de "emoldurar", que metade do público não usa. É **pendurar
na parede**.

Espera do Pix no painel e no `/meu-quadro`: quem aperta o botão da Perfect Pay
na hora chegava antes do crédito e lia "você não tem créditos" logo depois de
pagar. Agora procura por 90 segundos dizendo que está confirmando.

## Bugs encontrados e corrigidos

**A UTMify quebrava a hidratação da página inteira.** O script reescreve todo
link interno colando `?utm_source=organic&utm_campaign=&...`, e rodando antes da
hidratação o React desistia e **remontava a árvore inteira no cliente**. Num
Android lento isso é uma piscada e segundos sem interatividade. Também sujava o
link que a pessoa copiava pra mandar no WhatsApp.

Consertado tirando o script do HTML do servidor e injetando quando o navegador
fica ocioso. Não bastava esperar o root montar: as rotas são `lazy` e hidratam
depois.

**`utmify_data` nunca existiu.** A UTMify guarda `utm_source`, `utm_medium` e
`utm_campaign` como chaves separadas. A primeira fonte de atribuição do
checkout era código morto desde que foi escrita, e a atribuição vinha de carona
na reescrita dos links. O checkout passa a ler as chaves de verdade.

**O `/meu-quadro` não esperava o Pix**, mesmo sendo a página de obrigado do
quadro. Buraco aberto no mesmo commit que consertou o do painel.

**A faixa do quadro estava invertida**: quem comprou e não montou via a versão
mais pobre da tela, porque a chamada com moldura só aparecia pra quem não tinha
comprado.

## Usabilidade no celular

Auditoria rodada no navegador a 375px e a 320px (o Android mais estreito),
medindo o layout e não o HTML.

Alvos de toque abaixo dos 44px mínimos, todos corrigidos:

| Onde | Antes | Depois |
|---|---|---|
| Menu da home | 20px | 44px |
| CTA do cabeçalho | 39px | 44px |
| Links do menu aberto | 34px | 44px |
| Bolinhas de cor do editor | 40px | 44px de alvo |
| Botões de efeito do editor | 39px | 44px |
| "sua conta", "escolher esta" | 18-21px | 44px |
| "baixar o QR Code" | 18px | 44px |
| "Criar outra música" | 21px | 44px |
| E-mail de contato | 17px | 44px |

Nos links dentro de frase a técnica foi padding com margem negativa: o dedo
ganha a área e o texto não se mexe.

**Resultado:** home, `/criar`, `/login`, `/obrigado`, `/editar`, `/p/`, o quadro
e os blocos do painel, todos sem estouro de largura e com zero alvos abaixo de
44px, a 375 e a 320.

O quadro também parou de abrir em aba nova, que é beco sem saída pra quem não
sabe alternar abas no celular. Agora navega na mesma aba com um botão de voltar
que diz pra onde vai.

## Provado com compra de verdade

Dois dos três códigos de produto foram confirmados por compra real:

- `PPPBFA6E` (mais uma música) → crédito lançado, `via: "codigo"`
- `PPPBFA6H` (quadro) → direito criado, `via: "codigo"`

Falta `PPPBFA6G` (pacote de três). Se estiver errado o webhook não engole:
manda e-mail com o código real pra colar.

## O que ficou aberto

- **Order bump não foi criado** na Perfect Pay. O webhook já entrega (`plan_itens`,
  campo que ninguém lia e que faria a pessoa pagar e não receber). Falta você
  criar o bump com o produto do quadro.
- **As URLs de obrigado** dos upsells precisam do `?novo=1`, senão a espera do
  Pix depende do referrer, que é frágil em redirect de gateway.
- **`PPPBFA6G`** sem compra de teste.
- A página `/p/` continua sem rastreio nenhum: não dá pra saber quantos
  presenteados abrem o presente, que é a métrica mais bonita que a gente teria.
