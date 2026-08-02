# Página de checkout da Perfect Pay

**Por que isto existe.** Medido em 01/08/2026: das 29 pessoas que receberam a
letra, **27 clicaram em comprar (93%)** e **4 pagaram (14,8%)**. Vinte e três
pessoas que já tinham decidido comprar sumiram entre o clique e o pagamento.

A causa mais provável é estrutural: a pessoa sai de um funil que argumenta o
valor inteiro (música + página + karaokê + fotos + QR) e cai numa página que
diz só "Serenata, R$ 37". Sem o motivo do preço na frente, ela compara com o
concorrente de R$ 9,90 e desiste.

Tudo abaixo é pra colar nos campos do produto na Perfect Pay. Nada disso é
promessa nova: é o que o produto já entrega hoje, conferido no código.

---

## 1. Nome do produto

Aparece no topo do checkout e na fatura do cartão. Curto, mas carregando o
entregável (não só a marca):

```
Serenata · Música personalizada + página presente
```

Se houver limite de caracteres apertado:

```
Serenata · Música + página presente
```

---

## 2. Descrição curta (subtítulo / chamada)

É a linha mais importante da página: no celular, muita gente não lê nada
além dela.

```
A música completa cantada, mais a página presente com as fotos de vocês, o
karaokê e o QR Code pra você presentear.
```

---

## 3. Descrição completa

```
Você acabou de escrever a letra. Agora ela vira música de verdade.

O QUE VOCÊ RECEBE

🎵 A música completa, cantada
Em duas versões da sua letra, com interpretações diferentes. Você ouve as
duas e escolhe a que mais te emocionar.

💝 A página presente
Uma página só de vocês, com as fotos que você subir. É isso que você manda
pra pessoa, não um arquivo solto.

✨ O karaokê
A letra acende palavra por palavra, no ritmo exato em que é cantada. Quem
recebe acompanha e canta junto.

📷 Até 12 fotos
Uma foto de capa e uma galeria que passa durante a música, com efeito de
corações, estrelas, pétalas ou luzes de vela.

🔗 O link e o QR Code
Manda o link no WhatsApp, ou imprime o QR Code e cola numa caixa de bombom.
O presente digital vira presente de mão.

⬇️ O MP3 pra baixar
A música fica com você, pra guardar e ouvir quando quiser.

COMO FUNCIONA
Assim que o pagamento é aprovado, você entra na sua conta com o mesmo e-mail
desta compra, ouve as duas versões, sobe as fotos e recebe o link pronto.
Fica pronta em até 30 minutos, normalmente em menos de 5.

Pagamento único de R$ 37. Não é assinatura.
```

---

## 4. Versão enxuta (se o campo for pequeno)

```
Sua letra vira música de verdade:

🎵 A música completa cantada, em 2 versões
💝 A página presente com as fotos de vocês
✨ O karaokê, com a letra acendendo no ritmo
🔗 Link + QR Code pra presentear
⬇️ O MP3 pra baixar e guardar

Pronta em até 30 minutos. Pagamento único de R$ 37, não é assinatura.
```

---

## 4b. As imagens

São três slots, cada um com um papel:

| Onde | Tamanho | Arquivo |
|---|---|---|
| Capa do produto | 1080 x 1080 | `materiais/pp-capa-1080x1080.png` |
| Abaixo do resumo | 460 x 630 | `materiais/pp-resumo-460x630.png` |
| Banner do topo | 1200 x 300 | `materiais/pp-banner-1200x300.png` |

Teto de 2 MB em todos.

**Geradas no Higgsfield** (`nano_banana_pro`, o modelo de renderização de
texto), com DUAS referências anexadas: `docs/marca/logo-serenata-sobre-noite.png`
e a capa antiga, pra logo e paleta virem da marca e não de invenção do modelo.
Os prompts completos estão no histórico de gerações da conta.

Duas notas de operação que custaram tentativa:

1. **Anexar as referências de verdade.** Citar "reference image 1" no prompt
   não faz nada sozinho: sem o array `medias` com os `media_id`, o modelo
   inventa uma logo parecida mas errada.
2. **Nunca pedir pra recolorir a logo.** Na primeira capa 1:1 eu pedi "render
   the logo in warm gold and cream" achando que ia destacar sobre o fundo
   escuro. Ao recolorir, o modelo REDESENHA: saiu só o letreiro SERENATA numa
   serifa diferente, sem a linha de batimento e sem o coração. A instrução que
   funciona é "reproduce it EXACTLY as given, do NOT redesign or recolor",
   descrevendo as duas partes da marca (a linha de ECG que vira coração e o
   letreiro) pra ele não esquecer nenhuma.
3. **O modelo só gera em proporções fixas** (1:1, 3:4, 21:9), e os slots pedem
   0,730 e 4,0. O corte é obrigatório e está em
   `scratch/cortar-para-checkout.ps1`. No banner o prompt pede pra deixar o
   topo e o rodapé vazios justamente pra o corte de 21:9 para 4:1 não comer
   texto.

**Alternativa em HTML**, mantida em `docs/checkout/` (`resumo-460x630.html`,
`banner-1200x300.html`, `quadrado-1080.html`): rende texto exato e usa a
Fraunces/Manrope de verdade, mas o acabamento fica mais chapado que o do
Higgsfield. Serve pra quando o texto precisar mudar rápido sem gerar de novo:

```bash
chrome --headless --disable-gpu --hide-scrollbars --screenshot=saida.png --window-size=460,630 --virtual-time-budget=8000 file:///caminho/docs/checkout/resumo-460x630.html
```

---

## 5. O que NÃO escrever

O Google Ads derruba conta por alegação que não se sustenta, e a Perfect Pay
puxa reembolso por promessa quebrada. Fora da página:

- Qualquer prazo menor que 30 minutos. O medido é 84s a 250s de geração, mas
  o provedor pode enfileirar. Prometer "1 minuto" é o erro do concorrente.
- "Garantia de satisfação" ou "devolvemos seu dinheiro" enquanto não existir
  uma política escrita e uma pessoa pra executar.
- Número de clientes, nota, "mais de X músicas criadas". São 4 vendas.
- "Feito por inteligência artificial" como argumento de venda. Não é mentira,
  mas desvaloriza: o que se compra é a homenagem, não a tecnologia.

---

## 6. Ordem de teste

Mexer em tudo de uma vez impede saber o que funcionou. Como só há 27 cliques
de amostra, ninguém vai ter significância estatística tão cedo, então a
regra é ir do mais barato pro mais caro:

1. Descrição e nome (este documento). Sem código, 10 minutos.
2. Imagem do checkout com os entregáveis listados.
3. Só depois, se ainda estiver furando: repensar preço ou parcelamento.

**Não mexer em preço agora.** Com 93% de quem lê a letra clicando em comprar,
a percepção de valor dentro do funil está funcionando. O problema é que ela
não viaja junto com a pessoa até a hora de pagar.
