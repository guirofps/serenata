# /criar gospel (02/10/2026)

## Objetivo

Uma versão gospel do quiz da Serenata, aberta por `/criar?t=gospel`, pra
receber anúncios feitos pra esse público ("Crie o seu próprio louvor em 1
minuto"). Gospel já é o estilo nº 1 do funil (`generos.ts`: 185 contra 113 do
segundo), então o público existe; o que falta é uma porta de entrada que fale
com ele desde o primeiro pixel.

**Sucesso:** o dono consegue apontar campanhas pra `/criar?t=gospel` e ler,
no `/admin`, leads, letras, vendas e **receita por lead** do gospel contra o
resto, separando louvor de presente.

## Decisões do dono (02/10)

| pergunta | resposta |
|---|---|
| O que se cria | **Os dois**: a 1ª pergunta é "louvor pra Deus ou presente pra alguém?" |
| Alcance | **Tela + letra + estilo**. Oferta, e-mails e página presente NÃO mudam |
| Estilo | **5 estilos gospel** no lugar da lista normal |
| Medição | **Marcar e comparar**: sem sorteio, tabela gospel × resto no painel |
| Marcas | **Só Serenata** (funil `pt`). Ballad e `/es` intocados |

Não é teste A/B: o público já chega separado pelo anúncio. A regra de 30/09
("todo fluxo novo entra como A/B") vale pra mudança no funil de quem já
vinha; aqui ninguém que vinha muda de tela, porque sem `t=gospel` tudo fica
como está.

## Invariantes

- **Sem `t=gospel` nada muda.** O fluxo, o prompt e o painel de quem não é
  gospel ficam byte a byte como hoje. Teste prova que a mensagem do prompt
  normal sai igual.
- **Camada, nunca irmão.** O quiz gospel é o `QUIZ_FLOW_PT` com sobreposição
  (o padrão de `quiz-flow-ar.ts`), não um arquivo copiado. Melhoria no quiz
  principal aparece no gospel sozinha.
- **O system prompt não muda.** Ele é cacheado (`cache_control`); o que é
  gospel vai na mensagem do usuário (`buildUserMessage`).
- **Os versos da primeira tela são reais.** Saem de "Mulher de Palavra"
  (exemplo de verdade, `ExemplosReais`, token `2459f4b76e1b49c58be203`),
  copiados literais da letra salva no banco. Nada escrito pra ilustrar.

## Componentes

### 1. O tema (`src/lib/tema.ts`, novo, puro)

- `type Tema = "gospel"`; `temaDaUrl(search: string): Tema | null` aceita só
  `t=gospel` (minúsculo ou não). Qualquer outro valor é `null`.
- **Onde mora:** `respostas.tema = "gospel"` no `quiz-store` (persistido) e
  `attribution.tema = "gospel"` no `mp_attribution`.
  - As respostas, porque o quiz troca a URL a cada passo
    (`navigate({ search: { step } })`) e o `t` some depois da primeira tela.
    Com o tema nas respostas ele também chega ao prompt da letra sem
    encanamento novo, e fica em `quiz_responses.respostas`.
  - A atribuição, porque é ela que já viaja pra `funnel_events` e
    `quiz_responses.attribution` e é dela que o painel lê.
- **Prioridade:** `t=gospel` na URL grava os dois. Sem `t` na URL, vale o que
  já está nas respostas (é o que mantém o gospel do passo 2 em diante). Sem
  nada, não é gospel.
- Gravação no mesmo ponto em que `carimbarExperimentos()` roda no `Quiz`
  (antes do primeiro evento da sessão), com `try/catch` igual ao dele.
- Consequência aceita: quem fez o quiz gospel e volta ao `/criar` sem `t`
  continua no gospel até o `reset()` do store. É a mesma pessoa.

### 2. A primeira tela (`AberturaPresente.tsx`)

- `/criar` passa a aceitar `t` no `validateSearch` e repassa ao `Quiz`, que
  repassa à abertura: o HTML do servidor já sai gospel, sem piscar a tela
  normal. (Quem volta sem `t` com tema salvo vê a troca após a hidratação;
  aceito, é revisita.)
- Copy gospel (`COPY_GOSPEL`, ao lado de `COPY.pt`, mesmo formato):
  - título: "Crie o seu próprio " + **louvor** (em ouro) + "" — `tituloDepois` vazio
  - explicação: "Você conta o que Deus fez na sua vida. Fica pronto em 1 minuto, de graça."
  - CTA: "CRIAR MEU LOUVOR GRÁTIS"
  - rótulo do cartão: "uma música para"; nome "Denise"; foto da capa `denise`
    que `ExemplosReais` já usa; áudio `${AUDIO_BASE}/denise.mp3`
  - versos: os 4 primeiros versos cantáveis da letra real de "Mulher de
    Palavra", lidos do banco no plano (não inventados)
- Eventos da abertura (`abertura_comecar`, `abertura_play`…) ganham
  `tema: "gospel"` no payload.

### 3. O quiz gospel (`src/lib/quiz-flow-gospel.ts`, novo)

`quizFlow(locale, tema?)`: com `locale === "pt"` e `tema === "gospel"`
devolve `comGospel(QUIZ_FLOW_PT)`; em qualquer outro caso, exatamente o que
devolve hoje. A pulagem vem de `skipDoFluxo(tema)` (o `Quiz` deixa de usar
`QUIZ_SKIP` direto): `QUIZ_SKIP` sem tema, `SKIP_GOSPEL` com.

`comGospel` faz três coisas:

**a) Insere o passo `tipo` logo depois da `abertura`:**
"O que você quer criar?" — chips
`louvor` "Um louvor pra Deus" 🙏 e `presente` "Um presente pra alguém, com fé" 🎁.

Escolher o tipo passa por `aplicarTipo(respostas, tipo)` (puro):
- `louvor` → `relacao = "deus"`, `nome = "Deus"`, apaga `filhos`
- `presente` → se `relacao === "deus"`, apaga `relacao` e `nome` (a pessoa
  voltou e trocou); senão não mexe

**b) Passos próprios do louvor**, com o mesmo `field` dos originais e `id`
diferente. Cada par é exclusivo pelo `SKIP_GOSPEL`
(`relacao`, `nome`, `ocasiao`, `historia1`, `historia2`, `recado` pulam com
`tipo === "louvor"`; os `_louvor` pulam com `tipo !== "louvor"`):

| id | field | texto | detalhe |
|---|---|---|---|
| `ocasiao_louvor` | `ocasiao` | "Qual é o motivo do seu louvor?" | chips: `gratidao` Gratidão 🙌, `testemunho` Testemunho de uma vitória 🏆, `clamor` Um momento difícil 🕊️, `adoracao` Adoração 🎶, `igreja` Pra minha igreja ⛪ |
| `historia1_louvor` | `historia1` | "O que Deus fez na sua vida?" | subtexto "Escreva do seu jeito. Quanto mais real, mais seu fica o louvor."; mín. 60, áudio; gatilhos: "quando eu…" → "Quando eu ", "o que Ele fez" → "O que Deus fez por mim foi ", "minha família" → "Na minha família, Deus ", "uma oração respondida" → "Eu orei por ", "como eu era antes" → "Antes de conhecer Jesus, eu " |
| `historia2_louvor` | `historia2` | "Me conta um momento em que você sentiu Deus perto" | opcional como o original (`permitePular`); mín. 60; gatilhos: "um lugar" → "Foi em ", "um versículo" → "O versículo que me sustentou foi ", "um louvor" → "Tem um louvor que me lembra esse dia: ", "uma pessoa" → "Deus usou " |
| `recado_louvor` | `recado` | "Se você pudesse dizer UMA frase a Deus no refrão, qual seria?" | opcional, 120; gatilhos: "obrigado, Senhor" → "Obrigado, Senhor, por ", "eu te entrego" → "Eu te entrego ", "Tu és" → "Tu és ", "nunca me deixou" → "Mesmo quando eu ", sem `extra` de filhos |

`relacao` e `nome` simplesmente não aparecem no louvor (já foram preenchidos
pelo `aplicarTipo`).

**c) Sobreposição de redação nos passos comuns** (vale pros dois tipos):
- `estilo`: texto "Qual o estilo da música?", subtexto "É o clima do
  louvor. Dá pra mudar depois.", opções = os 5 estilos gospel (item 4)
- `voz`: `extraChips.options` = `reverente` "Reverente" 🙏, `emocionante`
  "Emocionante" 🥹, `animada` "Celebração" 🎉 (romântica e divertida saem)
- `historia1`, `historia2`, `recado` do **presente com fé**: mantêm texto e
  `extra` originais; só os placeholders ganham exemplo de fé
  ("Ex: minha mãe sempre orou por cada um de nós…" e "Ela canta hino
  lavando a louça…")

O `mostrarSe` de `filhos` continua valendo no presente (o `extra` não é
substituído).

### 4. Os 5 estilos (`generos.ts`)

Lista nova `GOSPEL_PT`, fora da lista normal (a lista normal e o `gospel`
dela ficam como estão), exposta por `generosGospel()`. `acharGenero` passa a
procurar nela também — sem isso o job da música não acharia o estilo e cairia
no texto livre do modelo.

| value | chip | `rotuloPrompt` | `estiloSuno` |
|---|---|---|---|
| `gospel_adoracao` | Adoração 🙌 | gospel de adoração (worship) | worship brasileiro, pads de teclado, guitarra com delay, bateria crescendo, clima de adoração congregacional |
| `gospel_tradicional` | Gospel tradicional 📖 | gospel tradicional, de hino | gospel brasileiro tradicional, piano e órgão, coral, clima reverente de hino |
| `gospel_pentecostal` | Pentecostal animado 🔥 | gospel pentecostal animado | gospel pentecostal brasileiro, teclado e metais, bateria animada, palmas, clima de celebração |
| `gospel_sertanejo` | Sertanejo gospel 🤠 | sertanejo gospel | sertanejo gospel, violão e viola caipira, sanfona leve, dueto, clima de fé e gratidão |
| `gospel_pop` | Pop gospel 🎧 | pop gospel | pop gospel brasileiro, violão e piano, batida pop suave, refrão marcante, clima inspirador |

Todos com `estiloSuno` ≤ 190 caracteres depois da voz (limite de
`estiloParaSuno`) e sem nome de artista (o Suno recusa).

### 5. A letra (`letra-prompt.ts`)

Só `buildUserMessage` muda, e só quando `respostas.tema === "gospel"` e o
idioma é `pt`.

- **Presente com fé:** a mensagem de hoje + uma linha depois do tom:
  `Fé: quem encomendou é evangélico(a). A letra pode falar de Deus, gratidão e bênção na vida de {nome}, sem pregar e sem tirar o foco de {nome}.`
- **Louvor** (`tipo === "louvor"`): as linhas de homenageado/relação/direção
  são trocadas por:
  ```
  Destinatário: Deus. Isto é um LOUVOR, não um presente pra uma pessoa.
  ```
  seguidas do bloco `LOUVOR_INSTRUCOES` (constante exportada):
  - a letra fala COM Deus, em primeira pessoa ("eu", "Senhor", "Tu/Te"),
    a partir do testemunho contado; os detalhes concretos da história
    continuam sendo o que separa letra boa de genérica (mín. três)
  - vocabulário evangélico brasileiro (Senhor, Jesus, Pai, Espírito Santo,
    graça, fidelidade); nada de santos, Maria ou terço; nada de doutrina de
    denominação (dízimo, línguas, batismo específico)
  - clichês a NÃO usar como verso solto: "Tu és fiel", "a vitória é certa",
    "nada é impossível pra Deus", "Rei dos reis", "derrama o Teu Espírito",
    "vaso nas mãos do oleiro", "deserto" como metáfora genérica. Podem
    aparecer só presos a um detalhe da história.
  - versículo citado só se a pessoa citou; nunca inventar referência bíblica
  - sem filhos citados (o campo some no louvor)
- Ocasiões novas no `OCASIAO`: `gratidao` "louvor de gratidão",
  `testemunho` "testemunho de uma vitória", `clamor` "clamor num momento
  difícil", `adoracao` "adoração", `igreja` "louvor pra cantar na igreja".
- Relação nova no `RELACAO`: `deus` "Deus" (pra revisão e telas que leem o
  mapa; o prompt do louvor não usa a linha de relação).
- Tom novo no `TOM`: `reverente` — pt "reverente — adoração contemplativa,
  sem pressa", es igual traduzido (o mapa exige os dois).

A coautoria (`coautoria.ts`) chama `buildUserMessage` em todas as etapas,
então refrão, estrofes e "Melhorar com IA" herdam o gospel sem mudança lá.

### 6. Telas que mostram respostas

- Revisão (`textos.ts`, rótulos): `tipo` → "O que é", com o rótulo do chip
  escolhido; `relacao: deus` → "Deus". No louvor, a revisão não mostra "Pra
  quem" nem "Nome".
- `RevealStep` diz "{umaMusicaPra} Deus" no louvor — lê certo, fica.
- Oferta, e-mails e página presente **não mudam** (decisão do dono). O plano
  confere as interpolações de `nome` nessas telas com `nome = "Deus"` e lista
  as que lerem errado no relatório final; não corrige sem pedir.
- `ocasiaoCalendario`: lead de louvor (`relacao = "deus"`) é pulado — a
  oferta de ocasião fala de "fazer outra pra alguém" usando o nome da música
  anterior, e "a música de Deus" ali não faz sentido.

### 7. O painel (`admin-dados.ts` + `admin.tsx`)

- `porTema`: três linhas, `gospel · louvor`, `gospel · presente`, `resto`.
  Cada uma com `leads`, `letras`, `vendas`, `receitaBrl`, `conversaoPct`,
  `receitaPorLeadBrl`. Montada como `porOrigem`, a partir dos leads já lidos
  (`respostas->>tema`; a atribuição não, porque nunca é limpa e marcaria como gospel os leads normais seguintes do mesmo navegador) e de `respostas->>tipo` (nova coluna `r_tipo` no select
  que já existe). Lead gospel sem `tipo` (parou na 1ª pergunta) vai pra uma
  quarta linha, `gospel · sem tipo`, que só aparece se tiver lead.
- Os passos `_louvor` ficam no array logo depois do passo original de mesmo
  `field` (`ocasiao_louvor` depois de `ocasiao`, e assim por diante).
- A função de agregação é pura (`porTemaDe(leads, pagos, comMusica)`) e
  testada isolada; usa `ehVenda` e `valorEmBrl` como as outras.
- Na tela, um cartão "Gospel" com a tabela, logo abaixo de "Por origem". Some
  inteiro quando nenhum lead gospel caiu no período.
- O resumo diário (`painel_eventos_dia`) não muda: a leitura é por lead, não
  por evento.

## Fora do escopo

Oferta, preço, e-mails, página presente, home, Ballad, `/es`, teste A/B,
exemplos gospel novos na home, louvor no funil espanhol.

## Testes

- `tema.test.ts`: `temaDaUrl` aceita `gospel`/`GOSPEL`, rejeita outros;
  prioridade URL > respostas > nada.
- `quiz-flow-gospel.test.ts`: sem tema o fluxo é idêntico ao de hoje
  (mesma referência de array); com tema, `tipo` é o 2º passo; louvor percorre
  `abertura → tipo → ocasiao_louvor → prova1 → estilo → voz →
  historia1_louvor → historia2_louvor → recado_louvor → contato → …`;
  presente percorre os passos originais; `aplicarTipo` nos 3 casos; opções do
  estilo são os 5 gospel; `filhos` some no louvor.
- `generos.test.ts`: os 5 valores existem, `acharGenero` acha cada um,
  `estiloParaSuno` ≤ 190 com voz, nenhum aparece em `generos("pt")`.
- `letra-prompt.test.ts`: mensagem sem tema idêntica à de hoje (fixture);
  presente com fé tem a linha "Fé:"; louvor tem "Destinatário: Deus", o
  bloco `LOUVOR_INSTRUCOES` e não tem a linha de direção nem de filhos.
- `admin-tema.test.ts`: `porTemaDe` separa as quatro linhas, conta venda só
  com `ehVenda`, receita por lead certa, sem divisão por zero.
- Contrato: `/criar` aceita `t`; `Quiz` usa `skipDoFluxo`; abertura tem
  `COPY_GOSPEL`; `ocasiaoCalendario` pula `deus`.
- Verificação no navegador (preview local): `/criar?t=gospel` mostra a
  primeira tela gospel no HTML do servidor; louvor e presente percorridos até
  a revisão; `/criar` sem `t` igual a hoje.

## Riscos

- **Letra de louvor é território novo.** Nenhuma letra foi gerada assim
  ainda. O plano gera 3 louvores reais (gratidão, clamor, testemunho) e mostra
  ao dono ANTES de apontar anúncio pro `/criar?t=gospel`. É depois do deploy e
  não antes: a geração só existe em produção (a máquina local não tem as
  chaves), e subir é seguro porque sem `?t=gospel` nada muda.
- **Anúncio gospel no Google:** a copy fala de fé, não promete milagre nem
  resultado; segue a mesma régua de alegação do resto.
