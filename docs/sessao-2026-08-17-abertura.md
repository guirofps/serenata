# Sessão 17/08/2026 — barra fixa, tela de abertura e o quiz mais apertado

Registro do que mudou, do que foi medido e — principalmente — das armadilhas
encontradas, que são a parte que se paga em não repetir.

> Nota de contexto: `ROADMAP.md` e `PLANO.md` estão ATRASADOS em relação ao
> código. O ROADMAP é de 23/07 e ainda fala em fake door e Mercado Pago; o
> código já tem checkout Perfect Pay, coautoria de letra, régua de e-mails,
> CRM/admin, funil ES e SEO. Trate o código como fonte de verdade.

---

## O que foi ao ar

Oito commits, do mais antigo pro mais novo:

| Commit | O quê |
|---|---|
| `4e1cc04` | Barra fixa do "Continuar", agora opaca |
| `eafe376` | Tela de abertura antes da primeira pergunta |
| `cf5f0e1` | Exemplo da abertura vira esposa (Isabela) |
| `a2d9992` | Título da abertura estava em 16px — correção |
| `98c8567` | Prova social da home entra abaixo do botão |
| `0fb71f2` | Rótulo vermelho do bloco sai de todas as perguntas |
| `9d87b72` | Título em duas linhas; quiz inteiro ganha 8px (`px-3`) |
| `719f327` + `aff874a` | Prova social em duas fileiras; número vai a "+1.274" |

**Status do deploy:** publicado e confirmado em produção em 17/08, nos dois
idiomas (`/criar` e `/es/criar`): `px-3` no `<main>`, abertura presente,
prova social com o número novo e a barra de progresso escondida na primeira
tela.

Houve uma janela em que o `master` remoto já estava em `aff874a` e a produção
ainda servia a versão anterior, com `x-vercel-cache: MISS` — ou seja, **não
era cache de borda**, o build ainda não tinha saído. Fica a lição: comparar o
`<main class>` e o hash do CSS servido é o jeito rápido de separar "não
publicou" de "publicou e eu estou vendo cache".

---

## A barra fixa: o que realmente estava errado em agosto

A barra sticky já tinha subido em 09/08 (`994e562`) e foi revertida no dia
seguinte (`55075b3`), junto com o pacote que derrubou a passagem da pergunta 1
pra 2:

```
24116713654    64% -> 20%
24119564353    63% -> 13%
24109054263    51% -> 11%
24106361685    39% -> 25%
```

**A causa nunca foi isolada**, e o que se sabe aponta pra fora da barra:

- o funil **espanhol** levou as mesmas barras e ficou estável em 15-18%;
- os 4 chips que ela cobria (Amiga, Amigo, Pet, Outro) são secundários — Mãe,
  Pai e Esposa nunca saíram do topo da lista;
- o deploy tinha **cinco** mudanças juntas (barra de baixo, pergunta presa no
  topo, `100dvh`, `py-4` e o experimento `abertura`).

O defeito técnico identificável era `bg-background/95 backdrop-blur-sm`.
Enquanto grudada, a barra é pintada **por cima** do que estiver ali — e com
fundo translúcido a pessoa **via** o chip por baixo e tocava nele. Chip
visível que não responde ao toque é o pior defeito possível de interface: a
pessoa conclui que o site quebrou.

Agora o fundo é **100% opaco, sem blur**. O chip fica cortado na borda, que é
como todo app sinaliza "role, tem mais coisa". Subiu **sozinha**, sem `100dvh`
e sem a pergunta presa no topo.

---

## Armadilhas encontradas (a parte reaproveitável)

### 1. As variáveis do `TEMA_CLARO` não existem no quiz

`--t-3xl`, `--tinta-suave`, `--ouro`, `--papel`, `--acento` vêm do
`TEMA_CLARO`, aplicado no `<div>` raiz da **landing**. O quiz usa os tokens do
shadcn (`text-muted-foreground`, `bg-background`) e **não aplica o tema**.

`font-size: var(--indefinida)` é declaração inválida: o navegador descarta e o
elemento herda. O título da abertura ficou em **16px** — menor que o enunciado
de qualquer pergunta (24px) — e ninguém percebeu, porque Fraunces em peso 500
parece grande.

- **Regra:** ao levar componente da landing pro quiz, ou envolver em
  `style={TEMA_CLARO}` (foi o que a `ProvaSocial` recebeu) ou reescrever nos
  tokens do quiz.
- **Regra:** conferir tamanho por `getComputedStyle`, não por print.

### 2. Media queries arbitrárias sobrepostas se resolvem pela ordem do arquivo

`[@media(max-height:720px)]:max-w-[196px]` e `[@media(max-height:660px)]:...`
têm a **mesma especificidade**. Quem vence é a última que o Tailwind escrever
no CSS — a 360x640 o cartão saía com o tamanho do degrau de 720px, o oposto do
pretendido.

**Use faixas fechadas:** `[@media(max-height:720px)_and_(min-height:661px)]`.
Não dependem de ordem.

### 3. `sticky bottom-0` reserva espaço, mas pinta por cima enquanto grudado

Nada fica inalcançável (no fim da rolagem a barra volta ao fluxo), mas no topo
da página ela cobre o que estiver na base da tela. Fundo **opaco** transforma
isso em affordance; fundo translúcido transforma em bug.

### 4. `{/* */}` não pode preceder o elemento raiz dentro de `return (`

Vira "JSX expressions must have one parent element". Use comentário `//` antes
do `return`.

### 5. Medir largura de texto com `getComputedStyle().font` ignora o `<strong>`

A medição deu 347px "cabendo" em 351 e mesmo assim quebrava linha: o trecho em
negrito é mais largo. **Clone o elemento** com `white-space: nowrap` e meça o
clone.

---

## Números medidos nesta sessão

**Largura mínima do título da abertura pra fechar em 2 linhas** (375px de tela):

| Fonte | Precisa | Com `px-4` (343) | Com `px-3` (351) |
|---|---|---|---|
| 30px | 360px | falta 17 | falta 9 |
| 29px | 348px | falta 5 | sobram 3 — no limite |
| **28px** | **337px** | sobram 6 | **sobram 14** |

Os 30px são impossíveis: precisariam de 360 dos 375 da tela inteira. Os 29px
passam por 3px, menos que a diferença de renderização da Fraunces entre
navegadores. **Padding sozinho nunca resolvia** — era a hipótese e foi medida
antes de mexer.

**Altura de cada bloco da abertura** (375x667, com o cartão cheio):

```
logo 28 · título 113 · cartão 245 · explicação 68 · botão 48   → main 686px
```

Por isso o cartão virou o regulador: com aspecto 4/5, cada pixel de largura
custa 1,25 de altura. Quatro faixas: 228 / 196 / 172 / 132px.

**Fileira da prova social** (disponível 351px): com rostos de 40px e o texto
em negrito "+1.274 famílias", precisava de 376 — 25px de excesso. Rostos a
28px com `-space-x-2.5` e `gap-2`: precisa de 341, sobram 10.

---

## Decisões tomadas

- **A abertura mostra o entregável, não o processo.** Um presente real
  acendendo (play liga, versos acendem, selo de QR se desenha). Bate com o
  dado da home: quem abre um presente de exemplo entra no funil 31,4% das
  vezes contra 12,7% de quem não abre.
- **O cartão não nasce vazio.** A montagem do nada não sobrevive ao SSR: o
  HTML chega antes do JS e o servidor mandaria um cartão vazio. O cartão chega
  composto e o que anima é ele acendendo.
- **Movimento por tempo, não por `@keyframes`** — igual ao `Efeitos` e ao
  `PresenteNoTopo`. Keyframes dentro de `@layer` não pegam no Tailwind v4 e
  "Reduzir movimento" desliga animação CSS inteira.
- **A abertura não grava lead.** Se gravasse, o passo 1 do funil no banco
  passaria a significar "viu a abertura" e todo histórico ficaria
  incomparável. Ela aparece só em `funnel_events`.
- **O exemplo PT é esposa** (relação que mais vende). O cartão da home segue
  no Antônio: lá existe seletor por relação, aqui há um cartão só.
- **O ES segue na mãe.** Não existe verso nem capa do exemplo de esposa
  espanhol ("El Café de las Cinco") no repositório, e escrever letra pra
  ilustrar seria fabricar prova.
- **`px-3` no quiz inteiro**, não só na abertura: 8px a mais de linha útil
  valem pro texto e pros chips. As barras sticky acompanham (`-mx-3 px-3`).
- **O campo `block` fica no modelo, fora da tela.** Registra o agrupamento das
  perguntas, que é o que uma barra de progresso por seção usaria.

---

## Pendências

1. **O deploy do Vercel** não tinha saído no fim da sessão. Verificar.
2. **"+998" não bate com "+1.274"** — cinco rostos + 998 ≈ 1003, não 1274.
3. **`FAMILIAS` é constante compartilhada:** a home passa a exibir "+1.274
   famílias" no próximo deploy dela.
4. **Alegação de volume.** `CLAUDE.md` lista "número inventado" como risco de
   conta no Google Ads, e o comentário do `ProvaImediata` diz "sem cliente
   real ainda, então NADA de depoimento inventado". A afirmação de 1.274
   famílias contradiz isso dentro do próprio código. Decisão do dono, já no ar
   na home; registrado aqui por ser risco de conta, não de gosto.
5. **Seis mudanças subiram juntas.** Se a conversão mexer não vai dar pra
   saber qual foi — a mesma situação que impediu o diagnóstico em agosto. O
   par que isola a tela nova é `quiz_step` (step_id `abertura`) contra
   `abertura_comecar`.
6. **O experimento `abertura` segue desligado** em `experimentos.ts`, e o
   `AberturaProva` saiu do passo 1 (a tela nova faz o mesmo trabalho).
7. **Prova social abaixo do botão.** Depois da compactação ela cabe na
   primeira tela a 375x667, mas em telas menores fica abaixo — e o
   `index.tsx` anota que 34 de 36 visitantes não passam de 25% da página.

---

## Como verificar (o arnês)

As mudanças foram verificadas com Chromium real dirigido por Playwright, não
por print. Dois scripts, que vale reconstruir quando precisar:

- **geometria da barra:** para cada passo e cada tamanho, rolar até o fim e
  perguntar *"sobra algum controle clicável embaixo da barra?"*. Zero é a
  única resposta aceitável — é a regra que descreve o desastre de agosto.
- **abertura:** rolagem, CTA visível sem rolar, e o botão levando ao
  `relacao`, em 375x667 / 360x640 / 390x844 / 320x568, PT e ES.

O critério da abertura mudou quando a prova social entrou: rolagem deixou de
ser falha; o que não pode é o **botão** nascer fora da tela.
