# Produto: o que é grátis, o que é pago, o que se entrega

Decisões fechadas em 24/07/2026. Este arquivo é a fonte de verdade do
**produto**; `CLAUDE.md` guarda estratégia e concorrência, `ROADMAP.md`
guarda ordem de execução.

Antes disto o funil tinha um furo estrutural: a landing prometia uma
fronteira de paywall que **contrariava nosso próprio teste** e que
desperdiçava um custo já pago. Está corrigido aqui.

---

## 1. O paywall

### Grátis, sem cadastro e sem cartão

- A **letra inteira**, na tela, em ~6s.
- Uma **prévia real da música cantada**: ~35s, cortada no refrão — a parte
  onde o nome e o detalhe pessoal aparecem.
- 1 refação da letra.

### Pago

- A **música completa**, sem corte.
- As **duas versões** (a alternativa vem de brinde, já está gerada).
- A **página presente** com link e QR Code.
- O **MP3** pra baixar e guardar.

### Por que essa fronteira, e não "só a letra"

Três fatos que só fazem sentido juntos:

1. **Medido por nós:** a letra sozinha, lida em silêncio, não segura a
   emoção. A música segura. Cobrar por tudo que emociona significa que o
   grátis não vende.
2. **A música já está paga.** A regra "nunca cobrar por algo que não foi
   produzido" faz o áudio ser gerado na conclusão do quiz, antes do
   checkout. Esconder o áudio inteiro não economiza um centavo — os
   R$ 0,32 já saíram. Só joga fora o ativo.
3. **O LoveTune**, único concorrente de fato escalado no BR, libera prévia
   de áudio e cobra R$ 67–97. Prévia de áudio não é o que impede de vender.

### Por que trecho, e não a v1 inteira

Se o áudio completo é grátis, a carga emocional inteira já foi entregue e
sobra só embalagem pra vender. O trecho é o trailer: prova que é real, que
é ela, que ficou bom — e para exatamente onde dá vontade de ouvir o resto.

---

## 2. A v1 e a v2

O Suno devolve **duas versões numa única chamada** (12 créditos, R$ 0,32).
Julgamento do dono, consistente em todos os testes: **a v2 sai melhor.**

Isso é uma sorte de arquitetura, não um detalhe:

| Versão | Chega | Vira |
|---|---|---|
| v1 | primeiro (estado intermediário do provedor) | **prévia grátis** |
| v2 | por último | **o que a pessoa compra** |

A diferença de qualidade entre elas passa a jogar a nosso favor: o grátis é
genuinamente bom, e o pago é melhor. Nenhuma chamada extra, nenhum custo
novo.

**Dívida técnica que isso cria:** o job hoje (`inngest/functions/gerarMusica.ts`)
só aceita `status === "SUCCESS"`, que é quando as duas ficam prontas. Para
soltar a prévia mais cedo ele precisa reagir ao estado intermediário do
kie.ai (`FIRST_SUCCESS`), publicar a v1 como prévia e seguir esperando a v2.
**Medir antes de implementar:** confirmar numa geração real quanto tempo
separa a primeira faixa da segunda. Se for menos de ~15s, não vale a
complexidade e a prévia sai da v1 no final mesmo.

---

## 3. A espera

Não existe espera morta se a ordem estiver certa. Medido: 84–110s do pedido
ao arquivo. A pessoa passa esse tempo **lendo a letra** — que é o entregável
grátis, não uma tela de enrolação.

Ordem:

```
termina o quiz
  → dispara a música (invisível)   [84–110s começam a correr aqui]
  → letra na tela em ~6s           [ela lê, relê, decide se está a cara da pessoa]
  → refação grátis, se quiser      [mais tempo comprado, e vira coautoria]
  → a prévia de 35s aparece        [quando a v1 fica pronta]
  → paywall
```

Regras da espera, herdadas do que criticamos nos concorrentes:

- **Sem barra de progresso falsa.** A Cantoria chega a 99% em 70s e fica
  girando frases inventadas. Se não há o que reportar, não se reporta nada.
- **Se passar do tempo**, a pessoa deixa o e-mail e recebe quando ficar
  pronta. Nunca prender numa tela girando.
- **Promessa conservadora:** "em até 30 minutos, normalmente menos de 5".

---

## 4. O produto e o preço

**Um plano só no lançamento.** Nada de 3 tiers: menos tela pra construir,
menos decisão pro cliente, e dá pra virar planos depois sem refazer nada.

| | Preço | Custo nosso |
|---|---|---|
| **Base** — música completa + 2 versões + página presente + MP3 + QR | **R$ 37** | ~R$ 1 |
| Order bump — galeria de fotos na página | +R$ 19,90 | ~zero |
| Upsell 1-clique — vídeo com as fotos | +R$ 24,90 | baixo |

R$ 37 é o número em que a economia unitária inteira do `CLAUDE.md` foi
calculada (margem bruta ~R$ 33). **A landing publicada hoje diz R$ 47, que
era placeholder meu — precisa ser corrigida.**

Não vender entrega expressa: se o padrão é rápido, cobrar por prioridade é
vender fumaça, e no Google Ads derruba conta.

---

## 5. A página presente

É o diferencial. O LoveTune não tem página compartilhável — entrega arquivo.
Sem isso a gente vira só mais um gerador de música.

### No lançamento (editor simples)

Pós-compra, a pessoa cai na **página dela** e ajusta:

- **1 foto** de capa (upload, corte quadrado, é só isso)
- **O texto da capa** — nome de quem recebe e uma linha dela
- Vê o preview do que a outra pessoa vai ver

E recebe, na mesma tela:

1. O **link** no nosso domínio (`/p/<token>`)
2. Uma **mensagem pronta** pra copiar e mandar no WhatsApp
3. O **QR Code** pra imprimir e colar num presente físico
4. O **download do MP3**

### O que a página mostra pra quem recebe

Mundo escuro (a noite da serenata): capa com a foto e o nome, a música
tocando, a letra acendendo palavra por palavra pelos timestamps.

### O que NÃO construir

Retrospectiva animada, timeline, álbum interativo, galeria com efeitos.
Aquilo é o negócio do Lovepanda, feito há mais tempo e com custo zero. A
nossa aposta é a música original ser o conteúdo — a página é a moldura.

---

## 6. O que isso muda no que já existe

| Onde | O que muda | Por quê |
|---|---|---|
| `src/components/landing/BarraCTA.tsx` | copy "só paga se quiser ouvir cantada" | está errado: vai ter prévia de áudio |
| `src/components/landing/Secoes.tsx` | preço R$ 47 → R$ 37; oferta cita a prévia | placeholder nunca decidido |
| `src/routes/index.tsx` | herói e CTA final citam a prévia | mesma razão |
| `inngest/functions/gerarMusica.ts` | reagir a `FIRST_SUCCESS`, publicar prévia | soltar a v1 antes da v2 |
| novo | recorte de 35s no refrão | a prévia precisa cortar em lugar bom, não em 0:00–0:35 |
| novo | contas de comprador + editor da página | hoje o funil é 100% anônimo |

---

## 7. Ainda em aberto (de propósito)

- **Onde cortar os 35s.** Temos os timestamps por palavra, então dá pra
  achar o refrão programaticamente. Falta definir a regra e testar no ouvido.
- **Conta do comprador**: e-mail com link mágico ou senha. Pende de decidir
  junto com o gateway.
- **Expiração da página.** Hoje é vitalícia por omissão. Cobrar por
  permanência (truque do Lovepanda) só entra se virar plano.
