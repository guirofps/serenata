# Mensagem do e-mail de compra aprovada (Perfect Pay)

Vai no campo de mensagem personalizada do produto, no evento **venda aprovada**.
Complementa o nosso e-mail de entrega (que sai do `contato@serenatagift.com`);
não substitui. Serve de rede de segurança: se o nosso cair no spam, este aqui
sai do domínio da Perfect Pay, que tem reputação antiga, e a pessoa consegue
entrar do mesmo jeito.

Parâmetros usados: `{clienteNome}`, `{clienteEmail}`.

---

## Versão HTML (usar esta se o editor aceitar formatação)

```html
<p>Oi, {clienteNome}! Pagamento confirmado. A sua música já está sendo cantada.</p>

<p><strong>O que acontece agora, em 3 passos:</strong></p>

<p><strong>1. Entre na sua conta</strong><br>
Acesse <a href="https://www.serenatagift.com/login">www.serenatagift.com/login</a>,
digite o e-mail <strong>{clienteEmail}</strong> (o mesmo desta compra) e toque em entrar.<br>
Não tem senha: a gente manda um link de acesso pro seu e-mail e é só clicar.</p>

<p><strong>2. Ouça e escolha a sua versão</strong><br>
A gente gera <strong>duas versões</strong> da mesma letra, com interpretações
diferentes. Você ouve as duas e escolhe a que mais te emocionar.</p>

<p><strong>3. Monte o presente e envie</strong><br>
No botão <em>Montar o presente</em> você sobe as fotos de vocês, escolhe a cor e o
efeito da página. Quando salvar, aparece o <strong>link</strong> e o
<strong>QR Code</strong> pra você mandar pra pessoa homenageada, junto com uma
mensagem pronta pra copiar e colar.</p>

<p>A página abre no celular com as fotos de fundo e a <strong>letra acendendo
palavra por palavra</strong>, no ritmo da música. O MP3 também fica lá pra baixar.</p>

<hr>

<p><strong>Quanto tempo demora?</strong><br>
Até 30 minutos, normalmente menos de 5. Se você entrar e ainda estiver
escrito <em>gerando</em>, é só atualizar a página daqui a pouco.</p>

<p><strong>Não achou o nosso e-mail?</strong><br>
Confira o spam ou a aba Promoções e marque como "não é spam". Assim os
próximos chegam certinho.</p>

<p><strong>Precisa de ajuda?</strong><br>
Responda este e-mail ou escreva pra
<a href="mailto:contato@serenatagift.com">contato@serenatagift.com</a>.
A gente responde de verdade.</p>

<p>Obrigado por confiar essa homenagem à gente.<br>
<strong>Equipe Serenata</strong></p>
```

---

## Versão em texto puro (se o campo não aceitar HTML)

```
Oi, {clienteNome}! Pagamento confirmado. A sua música já está sendo cantada.

O QUE ACONTECE AGORA, EM 3 PASSOS:

1. ENTRE NA SUA CONTA
Acesse www.serenatagift.com/login, digite o e-mail {clienteEmail}
(o mesmo desta compra) e toque em entrar. Não tem senha: a gente manda
um link de acesso pro seu e-mail e é só clicar.

2. OUÇA E ESCOLHA A SUA VERSÃO
A gente gera duas versões da mesma letra, com interpretações diferentes.
Você ouve as duas e escolhe a que mais te emocionar.

3. MONTE O PRESENTE E ENVIE
No botão "Montar o presente" você sobe as fotos de vocês, escolhe a cor
e o efeito da página. Quando salvar, aparece o link e o QR Code pra você
mandar pra pessoa homenageada, junto com uma mensagem pronta pra copiar.

A página abre no celular com as fotos de fundo e a letra acendendo palavra
por palavra, no ritmo da música. O MP3 também fica lá pra baixar.

QUANTO TEMPO DEMORA?
Até 30 minutos, normalmente menos de 5. Se você entrar e ainda estiver
escrito "gerando", é só atualizar a página daqui a pouco.

NÃO ACHOU O NOSSO E-MAIL?
Confira o spam ou a aba Promoções e marque como "não é spam".

PRECISA DE AJUDA?
Responda este e-mail ou escreva pra contato@serenatagift.com.

Obrigado por confiar essa homenagem à gente.
Equipe Serenata
```

---

## Versão curta (se o campo tiver limite de caracteres)

```
Oi, {clienteNome}! Pagamento confirmado, sua música já está sendo cantada.

Pra acessar: entre em www.serenatagift.com/login com o e-mail {clienteEmail}
(o mesmo da compra). Não tem senha, a gente manda um link de acesso.

Lá dentro você ouve as duas versões, escolhe a sua, sobe as fotos e recebe
o link + QR Code pra presentear.

Fica pronta em até 30 minutos. Dúvidas: contato@serenatagift.com
```

---

## Detalhe técnico que faz isso funcionar

O login usa o e-mail. Antes de 31/07/2026 o webhook não criava a conta, e o
e-mail do quiz costuma ser diferente do e-mail do checkout: quem pagasse com
outro e-mail pediria o link de acesso e não receberia nada.

Desde o commit `837a199` o webhook cria a conta com o **e-mail da compra** e
amarra a música a ela. Por isso a instrução acima pode dizer "use o mesmo
e-mail desta compra" com segurança. As 3 vendas anteriores foram corrigidas
por backfill (`scratch/backfill-contas-compradores.mjs`).
