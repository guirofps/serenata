# Campanha de marca na Pesquisa (BR)

Escrito em 18/08/2026, a pedido do dono, com a Demand Gen já rodando e
gerando busca por "Serenata" no Google.

Fonte de verdade do que está montado no Google Ads. `CLAUDE.md` guarda
estratégia e concorrência, `ROADMAP.md` guarda ordem de execução.

---

## 1. O que essa campanha é, e o que ela não é

O pedido veio como "campanha de remarketing de pesquisa". Duas correções
antes de montar, porque elas mudam o que se constrói.

**Remarketing de LISTA na Pesquisa (RLSA) não está disponível pra gente
hoje.** O Google exige **1.000 usuários ativos** numa lista pra ela poder
ser usada em campanha de Pesquisa (Display aceita 100; YouTube e Lista de
Clientes também exigem 1.000). Com 290 compradores e o volume de
visitantes de hoje, nenhuma lista atinge o mínimo: ela fica com o status
"muito pequena para veicular".

**O que resolve o mesmo problema hoje é a campanha de MARCA.** A pessoa
que viu o anúncio na Demand Gen, não comprou, e três dias depois digita
"serenata musica" no Google é exatamente o público de remarketing que se
quer alcançar. Só que a intenção dela está na palavra digitada, não numa
lista de cookies. Palavra-chave de marca é o remarketing de quem ainda
não tem lista.

Então esta campanha faz três coisas ao mesmo tempo:

1. **Recolhe o eco da Demand Gen.** Impressão de vídeo ou feed que virou
   memória de marca e voltou como busca dias depois. Sem esta campanha
   essa venda depende do orgânico ranquear, e ela é atribuída a "direto".
2. **Defende o nome.** No dia em que um concorrente (LoveTune, Cantoria)
   comprar "serenata gift", ele fica acima do nosso orgânico por
   centavos.
3. **Segura o cliente que já pagou** e voltou pra achar o link, baixar o
   MP3 ou fazer outra música. Grupo separado, orçamento mínimo, mas isso
   é entrega de produto, não aquisição.

Quando a lista de visitantes passar de 1.000 em 30 dias, aí sim entram os
públicos como **observação** (nunca segmentação) pra ajustar lance. Não
antes.

---

## 2. O risco número 1: "Serenata" é palavra comum

Isto vale mais que toda a estrutura abaixo, porque é onde o dinheiro vaza
sem aparecer no relatório.

"Serenata" em português significa a serenata de verdade, cantada embaixo
da janela. E ainda é:

- **Serenata de Amor**, o bombom da Garoto. Volume de busca gigante,
  intenção zero.
- Serenata do Adeus, Serenata Noturna (Mozart), serenata de Schubert:
  gente atrás de letra, cifra e MP3.
- Restaurante, buffet, pousada, condomínio e bairro chamados Serenata.
- Serviço de **serenata presencial**, contratar cantor e violonista. É o
  mais próximo do nosso em intenção e o mais caro por clique, e não
  converte, porque a pessoa quer alguém indo à casa dela.

Consequências práticas, todas obrigatórias:

- **Nunca comprar `[serenata]` sozinho**, em nenhum tipo de
  correspondência.
- **Nunca usar correspondência ampla nesta campanha**, nem a "ampla com
  Smart Bidding" que o Google recomenda por padrão. Ampla em cima de
  palavra comum inventa termo o dia inteiro.
- **Todo termo carrega um qualificador**: "gift", "musica personalizada",
  "presente", "login". Se o termo funciona sozinho como palavra do
  dicionário, ele não entra.
- A lista de negativas da seção 5 é parte da campanha, não higiene
  opcional.

A intuição de usar **correspondência exata** está certa. Aqui ela é a
regra, e a de frase entra só nos dois combos que não existem no
dicionário ("serenata gift" e "serenata musica personalizada").

---

## 3. Configuração da campanha

Uma campanha só, `[BR] Marca · Pesquisa`. Separada da aquisição pra o
orçamento nunca competir e pro CPA de marca (barato) nunca maquiar o CPA
de aquisição (caro).

| Item | Valor | Por quê |
|---|---|---|
| Tipo | Pesquisa, objetivo "Vendas" | |
| Redes | Só Pesquisa. **Desmarcar** parceiros de pesquisa e Rede de Display | Display dentro de campanha de Pesquisa é onde o orçamento evapora |
| Local | Brasil, opção **"Presença: pessoas que estão no Brasil"** | O padrão é "presença ou interesse" e traz busca de fora |
| Idioma | Português | |
| Orçamento | **R$ 15/dia** | É teto, não meta. Marca costuma gastar R$ 3 a R$ 8 |
| Lances | **Maximizar cliques, CPC máximo R$ 1,00** | Marca sem concorrente sai por R$ 0,20 a R$ 0,60. Smart Bidding sem 15 conversões/mês na campanha só adivinha |
| Ampliação automática de palavras-chave | **DESLIGADA** | Vem ligada por padrão e reintroduz o problema da seção 2 |
| Recomendações automáticas | **Todas desligadas** em Recomendações > Aplicar automaticamente | Sobretudo "adicionar palavras-chave" e "usar correspondência ampla" |
| Dispositivo | Sem ajuste | 99% do tráfego é celular e o site é mobile-first |
| Modelo de URL | `{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign=marca&utm_content={adgroupid}&utm_term={keyword}` | O painel `/admin` lê `utm_campaign`, e o `gclid` do tag automático já é capturado em `session-context.ts` |

**Não usar Performance Max.** PMax canibaliza marca sem deixar ver o
termo, e num funil de ticket R$ 38 isso vira relatório bonito em cima de
venda que já era nossa.

Trocar o lance para **"Parcela de impressão desejada, 90%, topo absoluto,
CPC teto R$ 2,00"** só no dia em que "parcela de impressão perdida por
classificação" passar de 15% no G1. Esse é o sinal de que apareceu
alguém comprando o nosso nome.

---

## 4. Grupos de anúncio e palavras-chave

Quatro grupos ligados agora, dois condicionais. Grupo existe pra
controlar **anúncio e página de destino**, não lance.

### G1 · Marca pura → `https://www.serenatagift.com/`

Quem já sabe o nome. O clique mais barato e o que mais converte.

```
[serenata gift]
[serenatagift]
[serenatagift com]
[serenata gift com]
[www serenatagift com]
[site serenata gift]
[serenata gift oficial]
[serenata gift musica]
"serenata gift"
```

A correspondência exata já cobre erro de digitação e acento por variante
aproximada ("serenatta gift", "cerenata gift", "serenata gif"). Não vale
cadastrar erro na mão.

### G2 · Marca + produto → `https://www.serenatagift.com/`

Quem lembra do que era, não do nome exato. É o grupo que recolhe a
Demand Gen.

```
[serenata musica personalizada]
[musica personalizada serenata]
[serenata gift musica personalizada]
[serenata presente musica]
[serenata musica com ia]
[serenata musica para esposa]
[serenata musica de presente]
"serenata musica personalizada"
```

**Deixar de fora por enquanto:** `[serenata musica]`. É a fronteira exata
entre nós e a serenata do dicionário. Entra depois, no dia em que o
relatório de termos mostrar que o que chega ali é gente procurando a
gente.

### G3 · Marca + intenção de criar → `https://www.serenatagift.com/`

Quem já decidiu e voltou pra fazer. Inclui a recompra, que é o segundo
produto mais lucrativo da operação (R$ 28 com custo de anúncio zero,
conforme `src/lib/creditos.ts`).

```
[criar musica serenata]
[fazer musica serenata]
[serenata criar musica]
[comprar musica serenata]
[serenata fazer outra musica]
[serenata segunda musica]
[serenata musica personalizada preço]
```

### G4 · Acesso do cliente → `https://www.serenatagift.com/login`

Não é aquisição, é entrega: cliente que perdeu o e-mail e quer o link, o
QR Code ou o MP3. Vale pagar por dois motivos. O volume é de poucos
cliques por mês, e o cliente que não acha o presente pede reembolso e
avalia mal. De quebra, o painel dele já mostra a oferta de crédito.

```
[serenata gift login]
[serenata login]
[entrar serenata gift]
[serenata gift minha conta]
[serenata gift meu presente]
[serenata gift link da musica]
[serenata gift baixar musica]
[serenata gift mp3]
[serenata gift acesso]
```

`[serenata gift mp3]` e não `[serenata mp3]`: o segundo é gente baixando
serenata do YouTube.

### G5 · Confiança (ligar junto) → home

Marca digital nova de ticket baixo sempre gera busca de dúvida. Quem
pesquisa isso está com o cartão na mão e a desconfiança na frente. É o
clique mais valioso da lista, e ninguém disputa.

```
[serenata gift é confiavel]
[serenata gift funciona]
[serenata gift reclame aqui]
[serenata gift avaliações]
[serenata gift é golpe]
[serenata musica personalizada é confiavel]
```

Destino: home. As músicas reais tocáveis e o preço à vista respondem à
objeção melhor que qualquer texto. Quando existir seção de depoimentos
(A5 do roadmap), apontar pra âncora dela.

### G6 · Cupom (NÃO ligar agora)

`[cupom serenata gift]`, `[serenata gift desconto]`.

Fica desligado de propósito. Hoje não há agregador de cupom disputando um
nome deste tamanho, e anunciar desconto pra quem ia pagar R$ 38 dá R$ 10
de graça. O SRN27 existe pra recuperar carrinho, não pra atrair. Ligar
**só** se o relatório de termos mostrar esses termos aparecendo, e mesmo
assim com anúncio que não promete valor de desconto nenhum.

---

## 5. Lista de negativas (compartilhada)

Criar em Ferramentas > Listas de palavras-chave negativas, nome
`Serenata · palavra comum`, e aplicar à campanha. Em **frase**, não
exata, porque o objetivo é matar a categoria inteira.

```
"serenata de amor"
"bombom"
"garoto chocolate"
"caixa de bombom"
"do adeus"
"cifra"
"cifras"
"acordes"
"partitura"
"letra da musica"
"tablatura"
"violao"
"schubert"
"mozart"
"noturna"
"erudita"
"classica"
"playlist"
"spotify"
"deezer"
"youtube"
"contratar"
"serenata surpresa"
"musico"
"musicos"
"violonista"
"cantor"
"banda"
"ao vivo"
"seresta"
"seresteiro"
"mariachi"
"quanto custa uma serenata"
"restaurante"
"buffet"
"pizzaria"
"padaria"
"doceria"
"sorveteria"
"hotel"
"pousada"
"condominio"
"edificio"
"rua serenata"
"bairro"
"vagas"
"emprego"
"cnpj"
"significado"
"o que e serenata"
"traducao"
"em ingles"
"dicionario"
"download gratis"
"mp3 gratis"
"baixar gratis"
"torrent"
```

**O que NÃO negativar:** "gratis" e "de graça" sozinhos. A letra é grátis
de verdade, e "serenata gift gratis" é gente testando o nosso próprio
paywall. Só a combinação com download é lixo.

---

## 6. Anúncios

Um anúncio responsivo por grupo. Caracteres já conferidos (título 30,
descrição 90).

### G1, G2 e G3

Fixar **"Serenata Gift Oficial"** na posição 1 dos títulos. Nos outros,
deixar o Google alternar.

Títulos:

```
Serenata Gift Oficial          (fixar na posição 1)
Site Oficial da Serenata
Música Feita da História
Uma Música Só Dela
A Letra Sai de Graça
Ouça Antes de Pagar
Feita da Sua História
Pronta em Poucos Minutos
R$ 38, no Pix
Página Presente e QR Code
Música em 2 Versões
MP3 pra Baixar e Guardar
Sem Cadastro pra Começar
Você Conta, a Gente Canta
Músicas Reais pra Ouvir
```

Descrições:

```
Conte a história de quem você ama e receba a letra na hora, de graça.
A música completa, as duas versões, o MP3 e a página presente com link e QR Code.
Ouça um trecho da sua música antes de decidir. R$ 38 no Pix, sem assinatura.
Escute exemplos reais no site e veja a letra de cada um antes de começar o seu.
```

No G3, trocar dois títulos por "Faça a Música Dela Agora" e "Segunda
Música por R$ 28", e uma descrição por "Já é cliente? A segunda música
sai por R$ 28, com nova letra e nova página."

Regras de copy que valem aqui:

- **Sem travessão.** Vírgula ou ponto.
- **Nada de prazo agressivo.** "Poucos minutos" está dentro da promessa
  do produto ("até 30 minutos, normalmente menos de 5"). "60 segundos" é
  o erro dos concorrentes e é alegação que derruba conta.
- **Nada de número inventado** de clientes, estrelas ou "visto em".
- Preço no anúncio joga a favor: filtra quem acha que custa R$ 300 e é o
  trunfo contra a LoveTune (R$ 67 a 97).

### G4 (acesso)

```
Entrar na Minha Conta
Acessar Minha Música
Serenata Gift, Site Oficial
Recuperar o Link do Presente
Baixar o MP3 da Música
```

```
Entre com seu e-mail e receba de volta o link do presente e o MP3 pra baixar.
Sua conta guarda a música, a página presente, o QR Code e o arquivo pra baixar.
```

### Recursos (extensões), no nível da campanha

- **Sitelinks** (4): "Ouvir exemplos" → home, âncora dos players;
  "Como funciona" → home; "Minha conta" → `/login`; "Perguntas" → FAQ da
  home.
- **Frases de destaque**: Letra grátis · Pagamento no Pix · Página com QR
  Code · MP3 pra guardar · Duas versões · Sem assinatura
- **Snippet estruturado**, cabeçalho "Tipos": Aniversário, Casamento,
  Namoro, Homenagem, Dia das Mães, Memorial
- **Imagem**: capa das músicas de exemplo, nunca foto de banco de imagem.
- **Preço**: R$ 38, "Música personalizada".

---

## 7. Conversão: o furo do Pix precisa ser tapado antes de escalar

Isto não bloqueia ligar a campanha, mas decide se o número dela vai ser
verdade.

Hoje existe **uma** conversão, disparada na `/obrigado`
(`src/lib/google-ads.ts`). O próprio comentário do arquivo registra a
limitação: **quem paga no Pix e não volta pro site não é contado**. Numa
campanha de marca, com volume baixo, essa subcontagem é a diferença entre
"CPA de R$ 6" e "essa campanha não converte nada".

O conserto já está com os dados na mesa e não precisa de OAuth:

1. Criar no Google Ads uma conversão nova, origem **Importar > Cliques**,
   nome `Compra confirmada (offline)`, contagem "uma", valor variável.
2. Marcar essa como **principal** e rebaixar a da `/obrigado` para
   **secundária**. Se as duas ficarem principais, toda venda no cartão
   conta duas vezes.
3. Uma vez por semana, exportar o CSV e subir em Metas > Uploads. O
   `gclid` já está no banco, dentro de `quiz_responses.attribution`:

```sql
select
  q.attribution->>'gclid' as "Google Click ID",
  to_char(p.paid_at at time zone 'America/Sao_Paulo',
          'YYYY-MM-DD HH24:MI:SS') as "Conversion Time",
  'Compra confirmada (offline)' as "Conversion Name",
  round(p.valor_centavos / 100.0, 2) as "Conversion Value",
  'BRL' as "Conversion Currency"
from pedidos p
join quiz_responses q on q.id = p.quiz_response_id
where p.status = 'pago'
  and p.paid_at > now() - interval '8 days'
  and q.attribution->>'gclid' is not null;
```

O arquivo precisa de uma linha antes do cabeçalho, declarando o fuso:

```
Parameters:TimeZone=America/Sao_Paulo
```

Janelas do Google: o clique precisa ter no máximo 90 dias, e o upload tem
que acontecer em até 90 dias da conversão. Semanal está folgado.

Quando isso estiver rodando por 30 dias e a campanha tiver 15 ou mais
conversões, aí vale trocar o lance por **CPA desejado de R$ 10**. Antes
disso, não.

---

## 8. Como julgar esta campanha

O erro clássico é olhar o ROAS dela e achar que descobriu ouro. Marca
sempre parece a melhor campanha da conta, porque colhe demanda que a
Demand Gen pagou pra criar.

O que olhar, em ordem:

1. **CAC misto**: gasto total do Google (a tabela `gastos_ads` já guarda)
   dividido pelas vendas totais do dia. É o único número que não mente. A
   referência atual é R$ 23 de anúncio por venda.
2. **Relatório de termos de busca, toda semana nas 3 primeiras.** É onde
   o problema da seção 2 aparece. Todo termo estranho vira negativa no
   mesmo dia.
3. **Parcela de impressão perdida por classificação** no G1. Subiu?
   Apareceu concorrente no nosso nome.
4. **CPC médio do G1.** Marca acima de R$ 1,00 significa que alguma
   palavra-chave está pegando busca genérica.

O que **não** olhar: o CPA isolado da campanha de marca comparado com o
da Demand Gen. São papéis diferentes, e a comparação sempre manda matar a
campanha errada.

---

## 9. Rotina de implantação

| Quando | O quê |
|---|---|
| Dia 0 | Criar lista de negativas, campanha, G1 a G5, anúncios e recursos. Conferir que ampliação automática e recomendações automáticas estão desligadas |
| Dia 3 | Ler termos de busca. Negativar o que apareceu |
| Dia 7 | Idem. Decidir sobre `[serenata musica]` |
| Dia 14 | Montar a importação offline por gclid (seção 7) |
| Dia 30 | Com 15+ conversões, avaliar CPA desejado. Checar tamanho da lista de visitantes: passou de 1.000, entram públicos em observação |

---

## 10. Espelho no México

Mesma estrutura, **campanha separada** (`[MX] Marca · Búsqueda`), local
México, idioma espanhol, destino `/es`, preço US$ 9,90. Palavras: os
mesmos combos com "serenata gift", mais "canción personalizada serenata",
"serenata gift opiniones", "serenata gift iniciar sesión".

Cuidado extra que não existe no BR: **"serenata" no México puxa mariachi
com força ainda maior.** Serenata de mariachi a domicílio é um mercado
inteiro, e é a nossa própria âncora de preço lá. A lista de negativas
precisa de "mariachi", "a domicilio", "contratar", "precio serenata",
"grupo musical", "cotizar".

Só montar depois que o BR estiver limpo por duas semanas. Erro de palavra
comum custa o dobro em conta nova.

---

## 11. Adjacente, fora do escopo deste documento

**Campanha de concorrente** (comprar "lovetune", "cantoria musica",
"foreversongs") é outra campanha, com outra economia: clique caro,
conversão baixa, e a regra do Google de não usar a marca do outro **no
texto do anúncio** (na palavra-chave pode). Vale testar depois que marca
e aquisição estiverem estáveis, com orçamento próprio e dedo no botão de
pausar se o CPA não fechar. Não misturar com esta campanha.
