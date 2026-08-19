# Painel de testes A/B — desenho

Status: aprovado em 18/08/2026, ainda não implementado.
Branch de origem: `teste-preco`.

Tirar a configuração dos experimentos do código e levá-la pro painel: ligar e
desligar, decidir que fatia do tráfego participa, o peso de cada versão, e —
no experimento de preço — o preço e o link de checkout de cada versão.

## Por que isso não é só uma tela

Hoje `EXPERIMENTOS` é um array em `src/lib/experimentos.ts`, lido de forma
síncrona por `scriptExperimentos()` e `cssExperimentos()` dentro do
`RootShell`. Esse par escreve o `<script>` e o `<style>` que abrem o `<head>`
de **toda página do site**, antes do primeiro pixel.

Mover `ativo` pro banco, portanto, não é acrescentar um campo: é fazer o
caminho mais quente do produto depender de estado externo. É essa mudança que
o desenho abaixo existe pra tornar segura.

O que NÃO muda: o mecanismo de sorteio. Script síncrono no `<head>`, escolha
grudada em `localStorage`, as duas versões no HTML e o CSS escondendo a
perdedora, `?exp=id:B` pra forçar. Está provado, está comentado, e foi
verificado no navegador em 18/08. Ele só passa a ler a configuração de um
snapshot em memória em vez de um array literal.

## Arquitetura

### O snapshot, e quem o mantém fresco

Um módulo servidor guarda a última configuração conhecida e a idade dela.
`src/start.ts` já tem `requestMiddleware` (hoje só o `errorMiddleware`);
ganha um segundo, que roda antes do render:

- fresco (menos de 60s): devolve na hora, custo zero;
- velho: devolve o que tem e dispara a releitura por trás
  (*stale-while-revalidate*) — ninguém espera;
- ausente (instância fria): espera a leitura UMA vez, ~15ms.

Esperar na instância fria é deliberado. A alternativa — servir "tudo
desligado" enquanto o primeiro carregamento não volta — tiraria gente do
teste em silêncio a cada instância nova, e uma amostra que encolhe sem deixar
rastro é pior que 15ms.

Consequência que fecha o desenho: `scriptExperimentos()` e
`cssExperimentos()` continuam **funções síncronas**. Nem o `RootShell` nem o
`head` das rotas viram assíncronos.

### O banco

Tabela `experimentos`, uma linha por experimento:

| coluna | o quê |
|---|---|
| `id` | `preco`. Chave primária, e a mesma string do `data-exp-<id>`. |
| `ativo` | Se está sorteando. |
| `exposicao_pct` | Que fatia das visitas entra no teste. 100 = todo mundo. |
| `nota` | O que está sendo testado e por quê. Aparece no painel. |
| `variantes` | JSONB: a lista ordenada de versões, com peso e (quando é experimento de preço) o plano. |
| `atualizado_em` | Pra o painel mostrar quando mudou. |

A primeira variante da lista é SEMPRE o controle — a mesma regra de hoje, e é
ela que aparece sem JavaScript e pra quem cai fora do teste.

O plano dentro de cada variante repete a forma de `Plano` em `preco.ts`:
`texto`, `valor`, `ancora`, `checkout`. Continua sendo um objeto só de
propósito: é o que impede a tela dizer um número e o caixa cobrar outro.

Escrita só por service role, via server function autenticada com
`exigirAdmin()`. Sem policy anon, como `musicas` e `pedidos`.

### O código continua existindo, como chão

`EXPERIMENTOS` em `experimentos.ts` deixa de ser a verdade e vira o
**fallback**: o que vale quando o banco não responde numa instância fria. Lá
tudo está `ativo: false`.

Isso mantém a regra que o arquivo já defende — *desligar tem que ser a coisa
mais segura de fazer com um experimento* — verdadeira inclusive no pior dia
possível. Banco fora do ar nunca liga um teste, nunca esvazia uma tela.

### A config chegando no navegador

Preço e link precisam existir no cliente: é lá que a tela mostra o número e
que o handler monta a URL do checkout. Hoje isso vem do import de `PLANOS`.

Vai de carona no `<script>` que já está no `<head>`: além de sortear, ele
escreve `window.__SRN_EXP__` com as variantes e os planos. `preco.ts` lê dali,
com o catálogo do código como fallback. **Nenhuma requisição nova** — a
informação já estava sendo enviada, só não estava sendo aproveitada.

Só os experimentos **ativos** entram nesse objeto. Um teste desligado não
publica os planos dele no HTML de todo mundo: preço que ainda não foi
decidido não é informação que se deixa vazar no fonte da página.

`MOEDA` em `i18n.ts` continua sendo a fonte do plano de controle, e é dela que
a migration copia o seed. O catálogo em código não some — ele é o chão.

### A home SAIU do pré-render, e por quê

`vite.config.ts` pré-renderizava `/` no build, de propósito: matava ~1,3s de
cold start no TTFB. Isso deixou de ser possível no instante em que a config
virou mutável, e a descoberta veio da revisão da implementação, não do desenho.

HTML estático **congela a configuração do build**. Com a config no banco, isso
dá duas saídas, e as duas falham em silêncio:

- **Sem env de Supabase no build**, a home sai com o script de sorteio inerte.
  Quem entra por ela nunca é sorteado — e não é sorteado depois tampouco,
  porque a home linka pra `/criar` com `<Link>` do TanStack, que é navegação
  SPA: o `<head>` não reexecuta. Essa pessoa atravessa o funil inteiro no
  controle e some do teste, sem deixar rastro.
- **Com env no build**, a home congela a config VIVA. O teste sorteia lá, mas
  desligar pelo painel não desliga a home até o próximo deploy.

Nenhuma das duas é aceitável num painel cujo propósito é "desligar sem deploy".
Alternativas consideradas e recusadas: forçar o pré-render a usar o fallback do
código (mantém o primeiro modo de falha), e um bootstrap de sorteio no cliente
(reintroduz piscada e um segundo mecanismo com falhas próprias).

**Decisão: `/` sai do pré-render e passa a ser SSR como o resto do site.** O
custo é ~1,3s de TTFB em cold start, só na home, e é medível e reversível. O
tráfego pago cai em `/criar`, não na home. Trocar latência mensurável por
eliminação de falha invisível é o mesmo negócio que este projeto já fez ao
gerar a música antes de cobrar.

### "Fora do teste" é uma variante

O sorteio ganha um passo antes do que já faz: tira um número e, se cair fora
de `exposicao_pct`, a variante é a string `fora`. Só depois, entre quem
entrou, sorteia por peso.

`fora` é carimbada em `mp_attribution.exp` como qualquer outra, então aparece
sozinha no painel como linha de referência — sem uma linha de agregação nova.
No CSS, `html[data-exp-preco="fora"]` mapeia pro bloco do **controle**.

Isso serve de canário. Se o A de dentro do teste converte muito diferente do
pessoal de fora, o problema não é o preço: é a tela quebrada embaixo dele. Foi
exatamente o que matou a leitura do experimento `abertura` — a base cedeu por
baixo (a passagem da pergunta 1 pra 2 caiu de 43% pra 14%) e não havia como
perceber olhando A contra B, porque as duas carregavam o mesmo defeito.

## A tela

### Duas abas

`Operação` (tudo que existe hoje, intocado) e `Testes A/B`. A aba vive na URL
(`?aba=testes`), como `dias`, `de`, `ate` e `funil` já vivem, então reload e
botão voltar funcionam.

O painel inteiro NÃO vira abas. Reagrupar a ferramenta que é usada todo dia
não foi o pedido, e mexer nela de graça custa mais do que rende.

### De onde vêm os dados da aba

- **Resultados**: de `dados.porExperimento`, que a consulta grande já traz.
  Nenhuma consulta nova — essa consulta já estourou o tempo uma vez (180 mil
  eventos por abertura, agosto/26) e não vai ganhar trabalho.
- **Config editável**: uma server function própria, minúscula, que ignora o
  cache e lê fresco. Quem está editando nunca pode ver estado velho.

### Um cartão por experimento, três faixas

1. **Os botões** — ligado/desligado, `% das visitas no teste`, peso de cada
   versão. Editáveis inclusive rodando: começar em 10% e abrir pra 50% é
   operação normal, não acidente.
2. **As versões** — nome, texto exibido, valor, âncora, link do checkout.
   **Travadas enquanto ligado** (ver Travas).
3. **O resultado** — A, B e `fora`, com leads, letras, vendas, receita,
   conversão, receita por lead, e a **variação da receita por lead contra o
   controle**. Mais o aviso de amostra pequena abaixo de ~200 leads por lado.

As porcentagens somam 100 na tela. No banco ficam guardadas como pesos
relativos, que é o que o script já entende — assim o sorteio não muda.

**Receita por lead é a coluna em destaque, não conversão.** Conversão sozinha
mente em teste de preço, e do jeito mais caro: preço mais alto converte pior
por definição e ainda assim pode faturar mais. Quem lê a conversão e mata a
variante cara escolhe o preço que vende mais unidades, não o que traz mais
dinheiro.

### O que muda no que já foi escrito

`porExperimento`, em `admin-dados.ts`, hoje percorre o array `EXPERIMENTOS`
pra saber a ordem das variantes, o rótulo e qual é o controle. Passa a
percorrer a **configuração do banco**, senão uma versão criada pelo painel não
teria linha na tabela de resultado — o painel deixaria criar algo que ele
mesmo não sabe mostrar.

A ordem continua vindo da configuração, e não do resultado: o controle sempre
em cima, pra leitura ser sempre "B contra A". A linha `fora` fica por último,
separada, porque não é uma versão em disputa.

## Travas

Todas no **servidor**, revalidadas na função que salva. Trava só no front é
trava que `curl` ignora — e é um dos erros herdados listados no CLAUDE.md
(`admin_session=true` forjável, webhook fail-open).

1. **Preço e link são só-leitura enquanto `ativo`.** A função relê `ativo` do
   banco antes de aceitar a mudança, não confia no que o cliente manda.
   *Motivo*: quem já foi sorteada pro B tem R$ 47 gravada no navegador. Ela
   volta, lê R$ 52, e os dois preços ficam embaixo do mesmo rótulo.
2. **Desligar → editar → religar exige nome novo pra versão** (B vira B2), pra
   os dias no preço antigo não virarem média com os dias no novo. O nome
   antigo é **aposentado, nunca reciclado**: o painel recusa um nome que já
   tem lead carimbado, porque reusar `B` faria dois preços diferentes
   compartilharem um rótulo no histórico — exatamente o que a trava evita no
   presente.
3. **Não liga com duas versões dividindo o mesmo link de checkout.** É o
   defeito que o teste de preço inteiro existe pra impedir, e com painel ele
   vira um clique de distração.
4. **Não liga variante sem plano completo** (texto, valor, âncora, link).

## Falhas

| Situação | O que acontece |
|---|---|
| Banco fora do ar, instância quente | Vale o último snapshot bom. |
| Banco fora do ar, instância fria | Vale o array do código: tudo desligado. |
| Experimento **desligado** | Ninguém é sorteado e **ninguém é carimbado**. O site é o de sempre. |
| **Ligado** com `exposicao_pct` = 0 | Todo mundo vira `fora` e é carimbado como tal. Serve pra medir a base sem mexer em nada. |
| `exposicao_pct` = 100 | Sem linha `fora`. |
| Variante desconhecida no navegador | Cai no controle (a checagem já existe em `varianteDePreco`). |
| `localStorage` bloqueado | O teste ainda roda na tela, só não é medido. Comportamento de hoje, mantido. |

## Testes

O projeto **não tem framework de teste nenhum** — sem vitest, sem jest, zero
arquivos. Entra vitest, e só pra **lógica de sorteio e de configuração**:

- exposição: 0%, 100%, e uma fatia no meio, com gerador determinístico;
- pesos: distribuição respeitada, pesos que não somam 100, peso zero;
- `fora`: aparece só quando a exposição é menor que 100;
- fallback: banco vazio ou com erro → array do código, tudo desligado;
- travas: religar com link repetido, editar preço com `ativo` verdadeiro.

São funções puras, é onde errar custa dinheiro de verdade, e é o único pedaço
que não dá pra conferir olhando a tela. O resto (a tela em si, o CSS de
esconder, o `?exp=`) continua verificado à mão, como foi feito em 18/08.

## Migração

1. Migration cria a tabela e insere a linha de `preco` copiada do código.
   **`ativo: true`**, exposição 100, os cinco planos que já estão vendendo.
   O teste subiu em 19/08 pelo código, antes do painel existir: semear
   `false` faria esta migração desligar um teste em andamento.
2. **Depois** o deploy, nunca antes: sem a tabela, a config cai no fallback do
   código (tudo desligado) e o teste morre em silêncio na primeira instância
   fria. Com a ordem certa, nada muda no site — a config do banco descreve o
   que já estava acontecendo.
3. A partir daí o experimento é operado **pelo painel**: ligar, desligar,
   exposição, peso e — com ele desligado — preço e link.

## Fora de escopo

- **Criar experimento novo pelo painel.** Pra uma variante de TELA existir,
  alguém escreve a tela em código de qualquer jeito. Um painel que deixa criar
  experimento que nenhum componente conhece produz teste que sorteia gente e
  não muda nada — e isso só se descobre olhando o resultado empatado semanas
  depois.
- **O funil espanhol.** Um plano só, volume pequeno demais pra dividir.
- **Significância estatística calculada.** O aviso de amostra pequena é a
  régua de "ainda não olhe"; cerimônia de p-valor não muda decisão nenhuma
  neste volume.

## Dívida que este trabalho resolve de passagem

O experimento `abertura` **não tem mais onde renderizar**: o bloco
`AberturaProva` saiu do `Quiz.tsx` quando a tela de abertura entrou. Ligá-lo
pelo painel sortearia gente e não mudaria nada. Sai do seed — um botão que
mente é pior que botão nenhum.
