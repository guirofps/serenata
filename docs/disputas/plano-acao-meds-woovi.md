# Plano de ação para redução de MEDs (resposta à Woovi IP, 08/10/2026)

> Rascunho para o dono revisar e enviar, respondendo ao e-mail "Qual o plano
> de ação para redução do índice de MEDs?". Continuação da resposta de 11/09
> (`resposta-compliance-woovi.md`). Tudo o que está descrito como feito está
> no ar (commits de 02/09 a 07/10). Números tirados do banco em 08/10
> (`scratch/_q-woovi.mjs`). Preencher os campos entre colchetes.

---

**Assunto:** Re: Plano de ação para redução do índice de MEDs

Prezados,

O plano de ação não é uma promessa: ele já foi executado. Nas quase quatro
semanas desde a suspensão da conta, a operação seguiu rodando e reforçamos
cada ponto do funil que poderia gerar dúvida, contestação ou cliente sem
resposta. Detalho abaixo o que mudou e por quê.

## O diagnóstico

Os MEDs desta conta nunca foram falha de entrega nem fraude da nossa parte.
**Todos os MEDs julgados foram decididos a nosso favor, e nenhum valor foi
devolvido.** Isso só acontece porque, em cada caso, provamos que o cliente
recebeu, abriu e usou o produto.

Boa parte dessas contestações é de má-fé: a pessoa compra, passa minutos
contando a história no questionário, recebe a música, acessa, em vários
casos sobe fotos da própria família na página do presente, e depois pede o
dinheiro de volta ao banco. O restante vem de três situações: quem paga não é
o titular da conta (é um presente), o titular não reconhece o lançamento no
extrato, ou o comprador não acha o produto depois de pagar e recorre ao banco
antes de falar com a gente.

O plano ataca as situações legítimas para que elas não virem MED, e deixa a
de má-fé sem argumento.

## O que já foi implementado

**1. Cobrança só depois do produto pronto.** O cliente recebe a letra de
graça e ouve um trecho da música cantada antes de pagar. O pagamento só é
liberado quando a música já está pronta e gravada nos nossos servidores.
Ninguém paga por algo que ainda vai ser produzido.

**2. Validação do e-mail antes do pagamento.** Uma parte relevante dos
clientes que diziam "não recebi" tinha digitado o e-mail errado. Hoje o
endereço é conferido antes do pagamento: endereços inválidos são barrados e
erros de digitação são sinalizados para correção. O produto chega ao cliente
certo.

**3. Acesso ao produto na própria tela de confirmação.** Depois do pagamento,
a página de confirmação leva o cliente direto ao painel dele, já autenticado,
onde ouve a música, baixa o arquivo, copia o link do presente e personaliza a
página. Ele não depende do e-mail para receber o que comprou.

**4. Entrega em segundos, monitorada.** O e-mail com o produto sai em
segundos após a confirmação. Uma entrega que falha é refeita automaticamente
e a equipe é avisada na hora. O download no celular foi corrigido e o e-mail
só anuncia o que já existe.

**5. Painel do comprador.** Cada cliente tem uma área própria, com a música
em duas gravações, a página do presente com link e QR Code, fotos,
dedicatória e download, disponível sem prazo de expiração.

**6. Ajuste gratuito e suporte diário.** Toda compra inclui um ajuste da
música sem custo. O suporte por e-mail é respondido todos os dias, com o link
do produto do próprio cliente, e resolvemos de forma proativa: quando
corrigimos um problema, avisamos por conta própria os clientes afetados.
Cliente insatisfeito recebe solução, não silêncio, e não precisa do banco
para ser ouvido.

**7. Respostas às dúvidas de pagamento junto do botão.** O que é grátis, o
que é pago e quem aparece como recebedor do PIX, antes do cliente pagar.

**8. Contestação de 100% dos MEDs.** Cada MED recebe um dossiê gerado a
partir dos nossos registros: tempo de uso antes do pagamento, e-mail de
entrega com identificador do provedor, acessos ao produto depois do
pagamento e personalização feita pelo cliente. É esse dossiê que vem ganhando
todos os casos.

## Quem somos hoje

A Serenata não é uma operação pequena nem pontual:

| | |
|---|---|
| Vendas desde 27/08/2026 | **8.176** |
| Faturamento desde 27/08/2026 | **R$ 297.621** |
| Setembro | R$ 195.853 (5.319 vendas) |
| 1 a 7 de outubro | R$ 91.510 (2.578 vendas) |

A operação está em crescimento e foi reestruturada: abrimos a
**[RAZÃO SOCIAL] LTDA, CNPJ [CNPJ NOVO]**, que passa a ser a empresa da
operação daqui em diante.

## O que pedimos

Temos interesse em voltar a operar com a Woovi pela nova empresa, com o
volume descrito acima. Para isso, duas condições precisam ser resolvidas
antes:

1. **A liberação do saldo retido** na conta do CNPJ 45.835.258/0001-46
   (R$ [VALOR]). São valores de vendas entregues, e os MEDs ligados a elas
   foram decididos a nosso favor.
2. **Um limite de saque diário na conta da [RAZÃO SOCIAL] LTDA compatível com
   o nosso faturamento.** Uma operação que faz mais de R$ 13 mil por dia não
   pode ter o próprio caixa preso no limite de saque.

Resolvidos esses dois pontos, migramos o volume de volta. Em contrapartida,
nos comprometemos a enviar à Woovi, todo mês, o número de MEDs recebidos, o
resultado de cada um e o dossiê de qualquer caso que queiram examinar.

Registro com franqueza: manter recursos retidos por causa de MEDs que foram
todos decididos a nosso favor penaliza justamente quem prova a entrega em
cada caso. Estamos à disposição para uma reunião ainda esta semana e
agradecemos um retorno até [DATA].

Atenciosamente,
Guilherme Rojas Siqueira
Serenata · serenatagift.com
