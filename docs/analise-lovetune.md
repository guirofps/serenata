# LoveTune — análise completa (o concorrente escalado)

lovetuneoficial.com.br, dissecado em 22/07/2026 (funil ao vivo + bundle JS
`index-BfmW94rW.js` e `Quiz-DizdXprD.js`). **É o mais avançado dos quatro** e
o único de fato escalado no BR. Copiar muito daqui.

## Stack e fornecedores (confirmados no bundle)

- **Supabase** (`vacxcqmfzduzdxxmntfo.supabase.co`) + React + Vite. Mesma
  família técnica da Cantoria e dos nossos repos.
- **Gerador: Suno**, client-orquestrado. Strings no bundle: "Starting Suno
  music generation…", "Suno init error:", "Suno taskId:", "Poll status:
  SUCCESS", "Suno polling timed out". Fazem polling e têm **fallback via
  Supabase Edge Function** ("Fallback music link from edge function").
- **Checkout: Wiapy** ("Checkout - Wiapy", "Redirecionando para o
  pagamento…"). Stripe "em breve" para internacional ("El pago con Stripe
  estará disponible pronto").
- Pixel da Meta ativo (fbevents). Analytics próprio `POST /~api/analytics`.
- **3 mercados**: PT-BR, EN (Pop Ballad, Country, Bachata…) e ES ("Crea tu
  Canción"). Detectam idioma/locale.

## Preços (do bundle: `O={basic:67,premium:87,master:97}`)

| Plano | Preço | Âncora | O que é |
|---|---|---|---|
| Básico | R$ 67 | "De R$ 137" | Música (pague 1, leve 2 versões), entrega 1h |
| Premium | R$ 87 | "De R$ 177" | + extras |
| Master | R$ 97 | — | + **Vídeo Música com legenda** (entrega 12h) |

Cupom `AMOR10` (−R$ 10) fixo no topo. **Ticket bem acima do nosso alvo
(<R$ 50)** — há espaço pra entrar por baixo em preço.

## O grande diferencial: letra COautorada por partes (não é "gera 1 letra")

Este é o pulo do gato deles e o mais forte que vi nos quatro. A letra é
construída em pedaços, cada um com opções e regeneração:

1. **Estrofes**: "Gerando estrofes…" → "Escolha suas estrofes favoritas"
   (gera opções, usuário seleciona) → "Não gostou? Gerar novas opções"
   (1 regen grátis por seção: "Já regenerado (1x)")
2. **Ponte + refrão**: "Escolha a ponte e o refrão — Nossos especialistas
   criaram 2 combinações. Clique para selecionar!"
3. **Verso final**: "Escolha o verso final"
4. **Revisão**: "Revise e edite sua letra — você pode editar livremente ou
   aprimorar com IA" + botão "Aprimorar Letra com IA" (1x: "Já aprimorada
   com IA (1/1)") + "Voltar para a letra anterior"

Ou seja: o usuário vira **coautor** da letra escolhendo entre opções e
editando, ANTES de qualquer pagamento. É a "coautoria aumenta conversão" do
nosso CLAUDE.md, só que muito mais fundo do que nossa "1 refação grátis".

## Prévia de áudio grátis antes de pagar

- "Gerar Prévia Gratuita" → "Preparando a prévia musical da sua letra… Isso
  pode levar até 1 minuto. Não saia desta tela"
- Entrega **2 versões** ("Versão 1 / Versão 2", "pague 1, leve 2")
- "Quer revisar a música?" → depois "FINALIZAR MÚSICA" → planos → checkout

Diferente da Cantoria (que promete 60s e trava 6min): LoveTune fala "até 1
minuto" e entrega trecho curto. Ainda assim é prévia de ÁUDIO grátis — o
oposto da nossa aposta (letra grátis, áudio só pago). Ver "implicação".

## Validação anti-lixo pesada (eles aprenderam que história ruim = letra ruim)

Campos de história exigem **mínimo 150 caracteres** (a Cantoria pede 50).
Mensagens de erro do bundle:
- "Escreva frases completas com pelo menos 3 palavras"
- "Use palavras reais e variadas", "Evite repetir as mesmas palavras"
- "Palavras muito longas detectadas. Use espaços entre as palavras"
- Nome: mín 2 chars, "evite repetir letras", "insira um nome real"

E **detecção de relacionamento por regex** no texto livre
(namorado/esposo/noivo/marido, mãe/madrasta, pai, filha, filho…) pra
flexionar gênero na letra — o mesmo problema que nosso `prompts/letra.md`
resolve no prompt.

## Foto: sim, mas opcional e pós-letra

Coletam foto ("Toque para escolher uma foto", JPG/PNG/WEBP até 5MB), mas:
- É "usada como fundo do **Vídeo Música**" (só faz sentido no Master)
- Vem **depois da letra/prévia, antes do checkout**
- **Opcional**: "Continuar sem foto agora →", "Não conseguiu enviar a foto
  agora?"

Confirma nossa decisão: foto não entra no quiz de história, entra na
montagem, e é pulável.

## Retomada de sessão

Salvam progresso: "Encontramos seus dados! Você estava criando uma música
para ___. Você estava no passo ___" → "Começar novo / Continuar". "Dados
recuperados! Continue de onde parou." (é a captura de estado que a Cantoria
não tem — mas provável localStorage, não lead no servidor).

## Fluxo completo (11 passos)

1. **Tudo-em-um**: nome + relacionamento (texto livre) + idioma + estilo
   (máx 2) + voz — numa tela só
2. "Conte um pouco sobre vocês — quem é a pessoa e como se conheceram?" (150+)
3. "Compartilhe suas memórias favoritas — momentos especiais juntos" (150+)
4. "Uma mensagem do coração — mensagem final" (150+)
5. Escolha das estrofes (coautoria)
6. Escolha da ponte + refrão
7. Escolha do verso final
8. Revise e edite a letra (+ aprimorar com IA)
9. Prévia musical grátis (2 versões, Suno)
10. Foto (opcional)
11. Nome + e-mail (sugestão de domínio) + WhatsApp + escolha do plano →
    checkout Wiapy

## O que copiar

- **Letra coautorada por partes** com opções e 1 regen por seção. É a
  execução mais forte da nossa "coautoria". Nossa versão pode ser mais
  enxuta (2 opções por seção, seleção rápida), mas o princípio é ouro.
- **Validação anti-lixo dura** (mín. caracteres + frases reais + palavras
  variadas). Barato de implementar e melhora direto a qualidade da letra.
- **Editor de letra + "aprimorar com IA"** antes de fechar.
- **Prova de que Suno + Supabase + polling + fallback edge function escala**
  no BR — é quase o nosso `generate-face.js` adaptado.

## O que fazer DIFERENTE

- **Preço**: eles em R$ 67–97; nós entramos por baixo (<R$ 50).
- **Nossa fronteira é letra grátis / música paga.** Eles dão prévia de
  ÁUDIO grátis (2 versões). Isso é generoso e caro (Suno em toda prévia,
  mesmo pra quem não compra) — e some com o motivo de pagar. Decisão a
  revisitar: a prévia de áudio deles converte mais que nossa letra-só? Vale
  um teste, mas o risco de custo pré-venda é maior no modelo deles.
- **Só e-mail** (eles pedem WhatsApp).
- **A página presente como entregável** — LoveTune entrega música/vídeo,
  não uma página-presente pra compartilhar. É onde a gente se diferencia
  (a pegada Lovepanda). Eles NÃO têm isso.
- **Lead parcial no servidor** desde o passo 1 (a retomada deles é local).
