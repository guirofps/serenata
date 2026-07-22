# Quiz e entregável — spec

Desenho do funil de entrada e do entregável, misturando o que funciona nos 3
concorrentes mapeados ao vivo (22/07/2026) com a gamificação do quiz-b
angelical. **Decisão de canal: só e-mail no lançamento — nada de WhatsApp**
(automação de WhatsApp fica pra depois, se fizer sentido).

> Contexto: a Cantoria é projeto de um amigo e está começando (pouco
> validada). O que pegamos de lá é o **conceito** de gerar no automático e a
> fronteira letra grátis / música paga — não o funil como prova de mercado.

## A pegada (o que o comprador leva)

A página é o presente; a música original é o que faz ela não ser igual às
outras (tese do CLAUDE.md). O fluxo completo:

1. Quiz → letra na hora, grátis → paga
2. **Área do comprador** (acesso por e-mail): o presente pronto com
   - **Link da página presente** pra copiar e mandar, já acompanhado de uma
     **mensagem bonita pronta** (ele só copia e cola no app que quiser —
     nós não mandamos nada pro presenteado, ELE manda)
   - **QR Code** pra imprimir
   - **Download do MP3**
   - Agendamento opcional: escolher quando a página "abre" pro presenteado
3. **Página presente** (o que o presenteado vê no link): capa com foto,
   nome, player da música, letra na tela, a história em texto, de quem veio

O presenteado nunca recebe "um MP3": recebe um link que abre uma experiência.
O MP3 é do comprador, como garantia de posse ("é meu, posso baixar").

### A pessoa precisa saber O QUE vai receber antes de preencher qualquer coisa

Decisão: nosso funil tem **landing antes do quiz** (como Lovepanda e
Cantoria; o ForeverSongs joga direto pro quiz e a pessoa preenche às cegas).
A expectativa do entregável é construída em três camadas:

1. **Landing (antes):** hero com a promessa + **uma página presente de
   exemplo, real e clicável** (com música tocando) — a pessoa vê e ouve o
   que vai receber antes do primeiro clique. "Como funciona" em 3 passos:
   conta a história → lê a letra na hora, grátis → recebe a página presente
   pronta pra enviar (link + QR Code + MP3).
2. **Durante o quiz:** o interlúdio deixa de ser só depoimento — mostra um
   **mockup da página presente montando com o nome que a pessoa acabou de
   digitar** ("o presente da Maria está começando a nascer", capa com o
   nome). O quiz não é um formulário: é a montagem do presente ao vivo.
3. **No reveal:** a letra não aparece numa tela solta — aparece **dentro do
   mockup da página presente**, faltando a música. O fake door vira o passo
   natural: "quero ouvir ela cantada e ganhar essa página".

### Onde entra a foto

A foto é insumo da **página**, não da letra. Por isso ela NÃO entra no quiz
(cada campo antes da letra custa conversão e não melhora a letra em nada).
Ela entra na **montagem do presente**, depois do pagamento: "agora vamos
embrulhar — manda uma foto de vocês pra capa". 1 foto no plano base;
**mais fotos + galeria é o order bump** (+R$ 19,90, custo zero — Lovepanda).

Isso também protege o funil grátis: ninguém sobe foto à toa pra quem não
comprou, e o momento pós-pagamento é o de maior boa vontade.

## O que cada concorrente faz (mapeado tela a tela)

### Cantoria (6 telas, direto ao ponto)

1. PARA QUEM — nome + relacionamento (13 chips com emoji)
2. A HISTÓRIA — ocasião (7 chips) + textarea única (mín. 50 chars) + "Falar por áudio"
3. O ESTILO — 12 estilos
4. A VOZ — Feminina / Masculina / Dueto
5. SEUS DADOS — nome, e-mail, WhatsApp
6. REVISÃO — resumo com "Editar" por linha → "Criar prévia grátis"
   - **Confirmado na rede:** ao carregar a revisão, um POST de serverFn
     dispara sozinho (pré-geração). Também têm analytics por passo agora
     (`/api/public/analytics/track` — novidade vs pesquisa de 2 semanas atrás).

### ForeverSongs (8 passos, micro-compromissos)

1. Para quem (12 chips, inclui **Pet**)
2. Nome ("Qual é o nome dele/dela?")
3. Ocasião (8 chips)
4. Gênero (16 opções) + Voz (Masculina/Feminina/**Surpreenda-me**) na mesma tela
5. "O que torna essa pessoa especial?" (textarea, "1-2 frases")
6. "Compartilhe suas memórias favoritas" (textarea)
7. "Uma mensagem do seu coração" (textarea)
8. Final: e-mail + telefone opcional + resumo + player de exemplo + garantia.
   **Preço só na próxima etapa** (depois do e-mail).

Lições: barra de progresso com % + contador; uma pergunta por tela;
**história quebrada em 3 perguntas guiadas** (rende muito mais insumo que
textarea única); estado persiste em localStorage (reload não perde nada).
Bug deles: contador avança e conteúdo trava sem reload.

### Lovepanda (conversacional, embalagem — a pegada do entregável)

- `/criar`: "Oi! Que bom te ver por aqui. Me conta: o que vamos criar hoje
  pra surpreender quem você ama?" — escolha do produto
- "Quem vai receber esse presente especial?" — Presente de Amor (MAIS
  POPULAR), Presente para Amiga, ou direto: Mãe, Pai, Avó, Irmã, Tia, Filha,
  Madrinha, Sogra, Professora, Chefe
- "Para começar... me conta, quem são vocês?" — nomes
- Header de prova social fixo no funil: "+100 mil pessoas já emocionaram
  alguém que amam. Crie o seu presente em 5 minutos."
- Entregável: link + QR Code na hora, página com fotos/música/timeline

Lições: tom de conversa; prova social dentro do funil; promessa de tempo
curto sempre visível; **o entregável é um link que abre experiência, nunca
um arquivo**.

## O nosso quiz (proposta — ~11 telas, motor FLOW)

Enquadramento: é um **presente/homenagem**, não "uma música". A música é o
coração do presente.

Regras herdadas: passo na URL (`?step=`), RPC `upsert_quiz_response` a cada
passo desde o 1 (lead parcial), estado também em localStorage.

| # | id | Tela | Tipo |
|---|---|---|---|
| 1 | `relacao` | "Pra quem é esse presente?" — chips com emoji (Mãe, Pai, Esposa, Marido, Namorada(o), Filha(o), Avó(ô), Irmã(ão), Amiga(o), Pet, Eu mesmo, Outro) | pergunta |
| 2 | `nome` | "Me conta o nome dela/dele" — input, tom conversacional | pergunta |
| 3 | `ocasiao` | "Qual é a ocasião?" — chips (Aniversário, Casamento/bodas, Declaração, Homenagem, Saudade/memorial, Formatura, Só porque sim, Outro) | pergunta |
| 4 | `prova1` | Interlúdio: mockup da página presente com o nome digitado ("o presente da Maria está nascendo") + depoimento + player de 20s de exemplo da mesma relação | prova social + expectativa |
| 5 | `estilo` | Estilo musical — chips (Sertanejo, Sertanejo universitário, MPB/violão, Pop romântico, Gospel, Pagode/Samba, Forró, Infantil, Outro) | pergunta |
| 6 | `voz` | Voz — Feminina / Masculina / Surpreenda-me | pergunta |
| 7 | `historia1` | "O que ela(e) é pra você?" — textarea curta OU áudio | pergunta guiada |
| 8 | `historia2` | "Uma memória que só vocês têm" — chips-gatilho (um apelido, uma comida, um lugar, uma mania, uma frase que vive falando) + textarea OU áudio | pergunta guiada |
| 9 | `recado` | "Se ela(e) fosse ouvir UMA frase sua no refrão, qual seria?" — opcional | pergunta guiada |
| 10 | `contato` | "Pra onde eu mando a letra?" — **só e-mail** (com sugestão de domínio enquanto digita) | captura |
| 11 | `revisao` | Resumo editável por linha → **dispara geração da letra em background** → CTA "Escrever minha letra grátis" | revisão |
| — | `reveal` | Loading honesto (~6s: "lendo sua história… escolhendo as palavras…") → reveal progressivo da letra **dentro do mockup da página presente** → karaokê → 1 refação → **fake door** | entrega |

Fake door (Fase 1): botão "Quero ouvir ela cantada e montar o presente" →
"estamos abrindo aos poucos — você está na fila, te avisamos no seu e-mail".
O clique é a métrica; o e-mail já foi capturado no passo 10.

Gravação de áudio (`MediaRecorder`): atalho "prefiro contar falando" nos
passos 7-8 substitui os dois por uma gravação de 60-90s + transcrição.

Diferenças deliberadas vs os 3:
- Lead salvo desde o passo 1 (nenhum dos 3 faz).
- História guiada em 3 telas (ForeverSongs) MAS com chips-gatilho de detalhe
  concreto, porque o prompt da letra exige 3 detalhes concretos.
- Loading dramático curto e honesto: a letra fica pronta em ~6s de verdade.
  Nada de barra de teatro (o anti-padrão documentado da Cantoria).
- O clímax é a LETRA (reveal + karaokê + refação), não uma tela de espera.
- Preço nunca prometido antes da letra; fake door mede intenção sem música.
- Só e-mail. Zero WhatsApp no produto inteiro por enquanto.
