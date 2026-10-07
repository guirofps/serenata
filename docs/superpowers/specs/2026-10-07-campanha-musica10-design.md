# Campanha MUSICA10: e-mail pra base inteira com cupom de R$ 10

Data: 07/10/2026. Pedido do dono: "email marketing pra enviar pra todos q ja
deixaram email, pra criarem uma musica nova. email bem elegante, alta
conversao. crie um cupom de desconto de R$ 10 e envie."

Decisões do dono (07/10):

| pergunta | resposta |
|---|---|
| público | todos que deixaram e-mail, com **2 textos** (comprador × só letra) |
| cupom | **código novo, vale 7 dias** |
| envio | **em levas, pelo sistema** (Inngest em produção) |
| abrangência | **vale em tudo**: música, música extra, quadro e vídeo |

Só Serenata, só funil `pt`. Ballad e `/es` não mudam.

## O que existe hoje e não serve

- `src/lib/cupom.ts` tem UM cupom por idioma (`SRN27`, pt) e o mecanismo é
  "preço vira R$ 28" (`centavosComCupom` devolve `min(base, por)`), não
  "preço menos R$ 10". Validade global `VALE_ATE = 2026-10-13`.
- O cupom só entra por `/retomar?s=…&cupom=…`, que exige uma sessão com
  música. `/criar` não lê `?cupom=`, e quem já comprou e volta ao `/criar`
  passa por `reset()` (`Quiz.tsx`), que apaga o cupom do `mp_quiz`.
- Os upsells (`criar-pix-upsell.ts`, `criar-cartao-upsell.ts`) cobram
  `OFERTAS[id].precoBrl` sem nenhum cupom.
- Não existe envio em massa. Todo e-mail sai um a um, por cron, com
  `emails.send` + `registrarEnvio`.
- `pedidos` não registra cupom: não dá pra medir a campanha pelo banco.
- Defeito à parte: com cupom, a folha do PIX da oferta mostra o preço do
  braço (R$ 38) até o QR aparecer com o valor do servidor (R$ 28).

## 1. O cupom

### Catálogo

`cupom.ts` passa de "um por idioma" para um **mapa de cupons**, sem imports
(continua lido por site, api e Inngest):

```ts
type Cupom =
  | { codigo: string; tipo: "preco_final"; locale: "pt" | "es"; por: string; de: string; valeAte: string }  // SRN27, SRN7: como hoje
  | { codigo: string; tipo: "fixo"; locale: "pt"; centavos: number; valeAte: string; abrangencia: "tudo" };
```

- `MUSICA10`: `tipo: "fixo"`, `centavos: 1000`, `abrangencia: "tudo"`.
- **Validade por cupom**, não global. `valeAte` do `MUSICA10` = 7 dias depois
  do fim previsto do envio, fechada em 23h59 de Brasília. A data é uma
  constante no código, decidida quando o envio for ligado, e é a MESMA que o
  e-mail escreve. Se o envio atrasar, a data muda nos dois lugares (o
  template lê a constante, não tem a data escrita à mão).
- `SRN27` e `SRN7` continuam iguais em comportamento (teste existente
  segura).

### Cálculo

Uma função pura só, usada por TODAS as rotas que cobram:

```ts
centavosComCupom(baseCentavos: number, codigo: string | undefined, agora: Date, alvo: "musica" | OfertaId): number
```

- Código desconhecido, vencido ou de outro idioma: devolve a base.
- `fixo`: `max(base − centavos, PISO)`, com `PISO = 500` (R$ 5). Nunca sobe o
  preço (base abaixo do piso fica como está).
- `preco_final`: como hoje, `min(base, por)`, e só pra `alvo: "musica"`.
- Maiúsculas e minúsculas tanto faz; espaços em volta são cortados.

Preços com `MUSICA10`, no catálogo de hoje:

| | cheio | com cupom |
|---|---|---|
| música (braço A) | R$ 38 | R$ 28 |
| música extra (`extra`) | R$ 28 | R$ 18 |
| quadro | R$ 24,90 | R$ 14,90 |
| vídeo | R$ 24,90 | R$ 14,90 |

### Onde ele é aplicado (servidor)

| rota | hoje | muda |
|---|---|---|
| `criar-pix.ts` (música) | aplica `SRN27` | passa a usar o cálculo novo |
| `criar-cartao.ts` (música) | aplica `SRN27` | idem |
| `criar-pix-upsell.ts` (extra, quadro, vídeo) | sem cupom | recebe `cupom?: string` e aplica |
| `criar-cartao-upsell.ts` | sem cupom | idem |
| `criar-pix-oferta.ts` (`/oferta/<token>`) | sem cupom | **não muda**: a escada já é desconto |
| Stripe / Perfect Pay (Ballad, `/es`) | — | **não muda** |

**Os webhooks também mudam** (achado na implementação, 07/10): o Asaas e a
Woovi conferiam o valor pago do upsell contra o PREÇO DE TABELA e recusavam
liberar qualquer outro. Com o cupom, todo extra pago ficaria sem liberar.
Passaram a conferir contra `valorEsperadoDoUpsell`: o catálogo com o cupom
que o PRÓPRIO pedido gravou, na data em que o pedido nasceu (o cupom vem da
nossa linha, nunca do gateway).

Invariantes:

- **O preço nunca vem do cliente.** Só o CÓDIGO viaja; o valor sai do
  catálogo e da função acima, no servidor.
- **Não soma.** Cupom e convite de indicação continuam exclusivos (como hoje
  em `criar-pix.ts` e `criar-cartao.ts`): vale o que der o menor preço, nunca
  os dois.
- **Idempotência do upsell.** O reaproveitamento de PIX pendente da última
  hora (mesma oferta, mesma pessoa) passa a conferir também o VALOR: um PIX
  pendente de R$ 28 não pode ser devolvido pra quem agora tem cupom, nem o
  contrário.
- **O crédito sai pela referência, não pelo valor.** O upsell do Asaas e da
  Woovi é reconhecido pela referência `up:<oferta>:<uuid>`. O caminho por
  valor de `reconhecerOferta` (`creditos.ts`) é o da Perfect Pay, que não
  recebe cupom; com cupom, um extra de R$ 18 não casaria com nenhuma oferta.
  Teste obrigatório: extra, quadro e vídeo pagos COM cupom liberam o crédito
  certo no webhook.

### Registro

Migration: `pedidos.cupom text null`. Gravado no momento em que o pedido nasce
pendente, com o código normalizado, só quando o cupom efetivamente baixou o
preço. É o que permite contar vendas da campanha sem adivinhar pelo valor.

## 2. Como o cupom chega ao checkout

- **Qualquer página** que abra com `?cupom=XXX` guarda o código no `cupom`
  da store `mp_quiz` (`cupom-url.ts`, chamado no `__root`), e o `reset()` do
  quiz deixou de apagá-lo. Assim o cupom sobrevive a quem já comprou e volta
  pra criar outra, e vale também no editor, onde estão os extras. (Na
  implementação, 07/10: uma chave própria `mp_cupom` daria a mesma garantia
  com dois lugares de armazenamento; ficou um só.)
- O navegador **não decide** se o cupom vale. Ele só guarda e manda o
  código; a tela pergunta ao servidor (ou usa a mesma função pura) pra saber
  o preço a mostrar, e a cobrança recalcula do zero.
- O `?cupom=` sai da URL depois de lido (`replace`), pra não ir parar em
  print, compartilhamento ou link copiado.
- O `setCupom` de `/retomar` continua funcionando (passa a escrever na chave
  nova).
- **Tela:** na oferta e nas folhas de pagamento (música, extra, quadro,
  vídeo), preço cheio riscado + preço com cupom + selo
  "Cupom MUSICA10 · −R$ 10". Cupom vencido some sozinho da tela.
- **Defeito corrigido junto:** a folha do PIX da oferta passa a mostrar o
  preço com cupom desde a abertura, não só depois do QR.

## 3. O e-mail

Template novo `emails/campanha-musica10.ts`, duas versões que dividem layout
e diferem no texto:

| versão | quem | ângulo |
|---|---|---|
| `comprador` | tem `pedidos` pago (com `dinheiro_entrou` verdadeiro) | "Você já emocionou alguém uma vez. Quem é o próximo?" |
| `lead` | deixou e-mail no quiz e nunca pagou | "A sua história merece virar música", com a letra que ela já ganhou como prova |

Comum aos dois:

- Visual: fundo creme, título serifado, vinho da marca, um botão grande
  "Criar uma música nova" (e "Ouvir um exemplo", que leva à `/p/<token>` de
  um exemplo público de `exemplos-pt.ts`). HTML de tabela, CSS inline, largura
  600, testado em Gmail (web e app) e Outlook. Sem imagem obrigatória: o
  e-mail se lê com imagens bloqueadas.
- O cupom aparece como "bloco de presente": código grande, "R$ 10 de
  desconto em qualquer música ou extra", "válido até DD/MM" (da constante).
- Primeiro nome quando existir e for limpo (mesmo critério do `exigeCampo`
  do e-mail de ocasião); senão, saudação sem nome.
- Sem número inventado, sem depoimento fabricado, sem "60 segundos". Prazo
  de entrega como o resto do site ("em minutos").
- Link: `https://serenatagift.com/criar?cupom=MUSICA10&utm_source=email&utm_medium=campanha&utm_campaign=musica10&utm_content=<versao>`.
  A atribuição é first-touch e não sobrescreve a de quem já comprou: a
  medição da campanha é o `pedidos.cupom`, não a UTM.
- Remetente `REMETENTE_RECUPERACAO` (`ola@envio.serenatagift.com`),
  `replyTo` `contato@`, cabeçalhos `List-Unsubscribe` +
  `List-Unsubscribe-Post` (`cabecalhosDescadastro`) e link de descadastro em
  um clique no rodapé, com CNPJ.
- Assunto e pré-cabeçalho por versão, escritos no template (assunto curto,
  sem caixa alta, sem emoji em excesso).

Antes de ligar o envio: prévia das duas versões renderizada pro dono, e um
envio de teste pro e-mail que ele indicar.

## 4. O envio em levas

Função Inngest nova `campanhaMusica10` (`inngest/functions/`), só no app da
Serenata (`api/inngest.ts`, lista da Serenata, nunca `DA_BALLAD`).

- **Liga por interruptor**: env `CAMPANHA_MUSICA10_ON=1` no projeto da
  Serenata. Sem ela o job sai sem fazer nada. Ligar só depois do "pode
  mandar" do dono, que é uma aprovação separada desta spec.
- **Cron de hora em hora, 12–23 UTC** (9h–20h de Brasília), como os outros
  e-mails de marketing, `concurrency: { limit: 1 }`.
- **Até 300 por rodada.** Em `step.run` por lotes, nunca um step por pessoa
  com 300 steps abertos sem teto.
- **A seleção acontece UMA vez** (implementação, 07/10): `montar_campanha`
  (função SQL) monta a fila `campanha_envios` na primeira rodada ligada, e
  cada rodada só drena as próximas 300. Reler a base inteira de hora em hora
  repetiria o `statement timeout` do painel de 02/10.
- **Quem recebe**:
  - `quiz_responses` com e-mail, `locale = 'pt'`, e-mail normalizado
    (minúsculas, sem espaços) e plausível (`emailPlausivel`);
  - um envio por E-MAIL, não por quiz (quem fez 3 quizzes recebe 1);
  - versão `comprador` se o e-mail tem pedido pago com dinheiro entrando;
    senão `lead`.
- **Quem fica de fora**: `descadastros`, `emails_mortos` com
  `liberado_em` nulo, `excluidos_email`, memorial, e quem reclamou de spam:
  a reclamação do Resend passa a gravar `descadastros` (motivo `complaint`)
  no webhook, e vale pra todas as réguas. Quem já foi enviado não volta pra
  fila (`enviado_em`).
- **Toda leitura paginada** (`todasAsPaginas`): o PostgREST corta em 1.000
  linhas sem avisar, e a base passa disso. (O `ocasiaoCalendario` tem esse
  defeito hoje; fica fora do escopo, anotado.)
- **A trava é o registro.** Antes de cada envio, reconfere `estaBloqueado` e
  `emails_enviados`; depois, `registrarEnvio(template: "campanha_musica10_<versao>")`.
  Rodar de novo, ou o Inngest repetir um step, não duplica.
- **Freio automático.** No começo de cada rodada, olha os envios do
  `campanha_musica10_*` das últimas 24h: bounce acima de 4% ou spam acima de
  0,1% → não envia e avisa os donos (o mesmo canal de alerta dos vigias).
- **Relatório**: cada rodada loga `[campanha] musica10 enviados=… restantes=…
  bounces=… pulados=…`. A primeira rodada diz o tamanho real da base.

## Testes

- `cupom.test.ts`:
  - `MUSICA10` em cada alvo;
  - piso de R$ 5;
  - vencido e desconhecido devolvem a base;
  - minúsculas e espaços;
  - `SRN27` sem mudança de comportamento.
- Rotas de cobrança (pix e cartão, música e upsell): o servidor ignora
  qualquer valor do cliente e cobra o catálogo menos o cupom; cupom + convite
  não somam.
- Upsell: o PIX pendente de outro valor não é reaproveitado.
- Webhook: extra, quadro e vídeo pagos com cupom liberam o crédito certo.
- `mp_cupom`: `?cupom=` guarda, sobrevive ao `reset()`, sai da URL.
- Seleção da campanha (função pura, sem banco): exclusões, dedup por
  e-mail, escolha de versão, freio por taxa.
- Template: snapshot das duas versões (com e sem nome), descadastro e
  `List-Unsubscribe` presentes, sem "R$" fora do bloco do cupom.

## Medição

Linha nova em "Testes em andamento" do CLAUDE.md (não é A/B: é campanha).
Mede por versão: abertura e clique (webhook do Resend), vendas com
`pedidos.cupom = 'MUSICA10'` e receita, bounce e spam. Leitura 3 dias e 7
dias depois do último envio.

## Fora do escopo

- Campo pra digitar cupom na tela (o link aplica sozinho).
- Limite de uso por pessoa (cada venda com cupom ainda dá ~R$ 23 de margem;
  o controle custaria mais do que protege).
- Ballad e `/es`.
- Consertar a paginação do `ocasiaoCalendario`.
