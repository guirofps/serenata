# Mensagem do e-mail de compra aprovada (Perfect Pay)

Vai no campo de mensagem personalizada do produto, no evento **venda aprovada**.
Complementa o nosso e-mail de entrega (que sai do `contato@serenatagift.com`);
não substitui. Serve de rede de segurança: se o nosso cair no spam, este aqui
sai do domínio da Perfect Pay, que tem reputação antiga, e a pessoa consegue
entrar do mesmo jeito.

Parâmetros usados: `{clienteNome}`, `{clienteEmail}`.

> **NUNCA cole link em Markdown neste campo.** Em 15/08 a compradora mexicana
> Damaris Cauich abriu ticket dizendo que o link dava 404. Ela caiu sete vezes
> em `/login](https:/www.serenatagift.com/login)`: alguém tinha colado
> `[www.serenatagift.com/login](https://www.serenatagift.com/login)` no painel
> da Perfect Pay, que não renderiza Markdown e linkifica a linha inteira, colchete
> e parêntese incluídos. Use o HTML abaixo, ou a URL sozinha e nua.

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

# Produto em ESPANHOL (Centerpag / internacional)

Mesmo campo, no produto em dólar. É esta que estava com o link quebrado.

## Versão HTML

```html
<p>¡Hola, {clienteNome}! Pago confirmado. Tu canción ya se está grabando.</p>

<p><strong>Qué sigue ahora, en 3 pasos:</strong></p>

<p><strong>1. Entra a tu cuenta</strong><br>
Ve a <a href="https://www.serenatagift.com/es/login">www.serenatagift.com/es/login</a>,
escribe el correo <strong>{clienteEmail}</strong> (el mismo de esta compra) y toca entrar.<br>
No hay contraseña: te mandamos un link de acceso a tu correo y solo tienes que hacer clic.<br>
Si pides el link más de una vez, usa siempre el correo <strong>más reciente</strong>:
al pedir uno nuevo, los anteriores dejan de funcionar.</p>

<p><strong>2. Escucha y elige tu versión</strong><br>
Generamos <strong>dos versiones</strong> de la misma letra, con interpretaciones
distintas. Escuchas las dos y eliges la que más te emocione.</p>

<p><strong>3. Arma el regalo y envíalo</strong><br>
En el botón <em>Armar el regalo</em> subes sus fotos y eliges el color y el efecto
de la página. Al guardar aparece el <strong>link</strong> y el <strong>código QR</strong>
para mandárselo a la persona homenajeada, con un mensaje listo para copiar.</p>

<p>La página abre en el celular con las fotos de fondo y la <strong>letra
encendiéndose palabra por palabra</strong>, al ritmo de la canción. El MP3 también
queda ahí para descargar.</p>

<hr>

<p><strong>¿Cuánto tarda?</strong><br>
Hasta 30 minutos, normalmente menos de 5. Si entras y todavía dice
<em>generando</em>, actualiza la página en un rato.</p>

<p><strong>¿No encuentras nuestro correo?</strong><br>
Revisa el spam o la pestaña Promociones y márcalo como "no es spam".</p>

<p><strong>¿Necesitas ayuda?</strong><br>
Responde este correo o escribe a
<a href="mailto:contato@serenatagift.com">contato@serenatagift.com</a>.
Contestamos de verdad.</p>

<p>Gracias por confiarnos este homenaje.<br>
<strong>Equipo Serenata</strong></p>
```

## Versão em texto puro

```
¡Hola, {clienteNome}! Pago confirmado. Tu canción ya se está grabando.

QUÉ SIGUE AHORA, EN 3 PASOS:

1. ENTRA A TU CUENTA
Ve a www.serenatagift.com/es/login, escribe el correo {clienteEmail}
(el mismo de esta compra) y toca entrar. No hay contraseña: te mandamos
un link de acceso a tu correo. Si lo pides más de una vez, usa siempre
el correo MÁS RECIENTE: al pedir uno nuevo, los anteriores dejan de
funcionar.

2. ESCUCHA Y ELIGE TU VERSIÓN
Generamos dos versiones de la misma letra, con interpretaciones distintas.
Escuchas las dos y eliges la que más te emocione.

3. ARMA EL REGALO Y ENVÍALO
En el botón "Armar el regalo" subes sus fotos y eliges el color y el efecto
de la página. Al guardar aparece el link y el código QR para mandárselo a la
persona homenajeada, con un mensaje listo para copiar.

La página abre en el celular con las fotos de fondo y la letra encendiéndose
palabra por palabra, al ritmo de la canción. El MP3 también queda ahí para
descargar.

¿CUÁNTO TARDA?
Hasta 30 minutos, normalmente menos de 5. Si entras y todavía dice
"generando", actualiza la página en un rato.

¿NO ENCUENTRAS NUESTRO CORREO?
Revisa el spam o la pestaña Promociones y márcalo como "no es spam".

¿NECESITAS AYUDA?
Responde este correo o escribe a contato@serenatagift.com.

Gracias por confiarnos este homenaje.
Equipo Serenata
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
