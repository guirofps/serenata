# Quiz da Fase 1 — spec

Desenho do funil de entrada, misturando o que funciona nos 3 concorrentes
mapeados ao vivo (22/07/2026) com a gamificação do quiz-b angelical.

> Contexto: a Cantoria é projeto de um amigo e está começando (pouco
> validada). O que pegamos de lá é o **conceito** de gerar no automático e a
> fronteira letra grátis / música paga — não o funil como prova de mercado.

## O que cada um faz (mapeado tela a tela)

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
8. Final: e-mail + telefone opcional ("receba mais rápido por SMS") + resumo
   + player de exemplo + "o que você vai receber" + garantia. **Preço só na
   próxima etapa** (depois do e-mail).

Lições: barra de progresso com % + contador; uma pergunta por tela;
**história quebrada em 3 perguntas guiadas** (rende muito mais insumo que
textarea única); estado persiste em localStorage (reload não perde nada).
Bug deles: contador avança e conteúdo trava sem reload.

### Lovepanda (conversacional, embalagem)

- `/criar`: "Oi! Que bom te ver por aqui. Me conta: o que vamos criar hoje
  pra surpreender quem você ama?" — escolha do produto
- "Quem vai receber esse presente especial?" — Presente de Amor (MAIS
  POPULAR), Presente para Amiga, ou direto: Mãe, Pai, Avó, Irmã, Tia, Filha,
  Madrinha, Sogra, Professora, Chefe
- "Para começar... me conta, quem são vocês?" — nomes
- Header de prova social fixo no funil: "+100 mil pessoas já emocionaram
  alguém que amam. Crie o seu presente em 5 minutos."

Lições: tom de conversa (o funil fala com você, não te formulariza);
prova social dentro do funil; promessa de tempo curto sempre visível.

## O nosso (proposta — ~11 telas, motor FLOW)

Regras herdadas: passo na URL (`?step=`), RPC `upsert_quiz_response` a cada
passo desde o 1 (lead parcial), estado também em localStorage.

| # | id | Tela | Tipo |
|---|---|---|---|
| 1 | `relacao` | "Pra quem é essa música?" — chips com emoji (Mãe, Pai, Esposa, Marido, Namorada(o), Filha(o), Avó(ô), Irmã(ão), Amiga(o), Pet, Eu mesmo, Outro) | pergunta |
| 2 | `nome` | "Me conta o nome dela/dele" — input, tom conversacional | pergunta |
| 3 | `ocasiao` | Ocasião — chips (Aniversário, Casamento/bodas, Declaração, Homenagem, Saudade/memorial, Formatura, Só porque sim, Outro) | pergunta |
| 4 | `prova1` | Interlúdio: depoimento + player de 20s de uma música exemplo do mesmo tipo de relação | prova social |
| 5 | `estilo` | Estilo musical — chips (Sertanejo, Sertanejo universitário, MPB/violão, Pop romântico, Gospel, Pagode/Samba, Forró, Infantil, Outro) | pergunta |
| 6 | `voz` | Voz — Feminina / Masculina / Surpreenda-me | pergunta |
| 7 | `historia1` | "O que ela(e) é pra você?" — textarea curta OU áudio | pergunta guiada |
| 8 | `historia2` | "Uma memória que só vocês têm" — chips-gatilho (um apelido, uma comida, um lugar, uma mania, uma frase que vive falando) + textarea OU áudio | pergunta guiada |
| 9 | `recado` | "Se ela(e) fosse ouvir UMA frase sua no refrão, qual seria?" — opcional | pergunta guiada |
| 10 | `contato` | "Pra onde eu mando a letra?" — e-mail (sugestão de domínio) + WhatsApp | captura |
| 11 | `revisao` | Resumo editável por linha → **dispara geração da letra em background** → CTA "Escrever minha letra grátis" | revisão |
| — | `reveal` | Loading honesto (~6s: "lendo sua história… escolhendo as palavras…") → reveal progressivo da letra → karaokê → 1 refação → **fake door** ("Quero ouvir ela cantada" → "estamos abrindo aos poucos, deixa seu WhatsApp") | entrega |

Gravação de áudio (`MediaRecorder`): atalho "prefiro contar falando" nos
passos 7-8 substitui os dois por uma gravação de 60-90s + transcrição.

Diferenças deliberadas vs os 3:
- Lead salvo desde o passo 1 (nenhum dos 3 faz; a Cantoria começou a trackear
  eventos mas continua sem capturar lead parcial).
- História guiada em 3 telas (ForeverSongs) MAS com chips-gatilho de detalhe
  concreto, porque o prompt da letra exige 3 detalhes concretos.
- Loading dramático curto e honesto: a letra fica pronta em ~6s de verdade.
  Nada de barra de teatro (o anti-padrão documentado da Cantoria).
- O clímax é a LETRA (reveal + karaokê + refação), não uma tela de espera.
- Preço nunca prometido antes da letra; fake door mede intenção sem música.
