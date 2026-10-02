# GA4: eventos do funil da Serenata

**Data:** 01/10/2026 · **Status:** aguardando revisão do dono · **Abordagem:** C (híbrida)

## O que já existe, e por que isto não é "começar a medir"

O site tem **132 eventos distintos** passando por `trackEvent` (`src/lib/track.ts`)
e gravando em `funnel_events`. O painel inteiro, os agregados e
`admin_eventos_resumo` vivem disso. O GA4 entra como **segundo destino** de um
funil que já está medido, não como substituto.

O GA4 (`G-E2EKHK3RQF`) já está ligado: entrou em 01/10 como destino da tag
`GT-5TWGDWC6`, a mesma que carrega o Ads (`AW-16919557808`). Conferido no site
pelo cookie `_ga_E2EKHK3RQF`, que só nasce quando a propriedade processa hit.
Hoje ele só recebe o que coleta sozinho: `page_view`, sessão e a medição
aprimorada.

## Objetivos, nas palavras do dono

1. **Munição pro Google Ads** — públicos de remarketing por etapa do funil.
2. **Explorar e compartilhar análise** — funil, coortes e caminhos na interface
   do GA4, e relatório pro sócio sem dar acesso ao painel.
3. **Base pro GA4 virar a fonte principal**, a prazo.

Fora dos objetivos: acompanhar operação (falha de geração, fila). Isso já tem
`vigia-externo` e alerta no WhatsApp, que é o lugar certo.

## Decisões tomadas com o dono

| Pergunta | Decisão |
|---|---|
| Painel admin no GA4? | **Não.** Só no rastreio próprio (`funnel_events`). `/admin` mostra nome, telefone, e-mail e status de pagamento; JS de terceiro ali lê o DOM inteiro. |
| GA4 × Ads | **Públicos sim, conversão não.** A compra do GA4 fica secundária no Ads, nunca primária. |
| Abordagem | **C:** tudo encaminhado por padrão + caminho do dinheiro promovido a nome padrão do GA4. |

## O limite do objetivo 3

Toda a experiência pós-compra está em rota sensível (`rotas-sensiveis.ts`):
editor, página-presente, dashboard, indicações, PIX, quadro, vídeo. **O GA4
enxerga o funil até a `/obrigado` e nada depois.** Os upsells (vídeo R$ 24,90,
quadro, refação) ficam invisíveis, e a receita no GA4 mostra só o ticket base.

Isso não se corrige dentro deste projeto: abrir essas rotas seria desfazer a
decisão de segurança que o dono acabou de confirmar. O GA4 serve como fonte
principal **do topo do funil**; o pós-compra continua sendo o `funnel_events`.

## Arquitetura

### `src/lib/ga4.ts` — novo, e o único lugar que fala com o GA4

Irmão de `google-ads.ts` e `tiktok-pixel.ts`, de propósito: mesmo desenho,
mesmas travas.

```
GA4_ID              por marca, mesmo padrão do GOOGLE_ADS_ID
encaminharGa4()     chamado pelo trackEvent; manda tudo que não for promovido
leadGa4()           generate_lead
vitrineGa4()        view_item
checkoutGa4()       begin_checkout
pagamentoGa4()      add_payment_info
compraGa4()         purchase
PROMOVIDOS          os nomes nossos que NÃO são encaminhados (sobem tipados)
montarParams()      pura: achata, filtra e trunca. É o que o teste exercita.
```

**`GA4_ID` por marca.** Na Serenata, `G-E2EKHK3RQF` cravado, como o
`AW-16919557808`. Na Ballad, `VITE_GA4_ID` ou nada. Sem id o módulo inteiro é
no-op — melhor não medir que medir na propriedade errada, a mesma regra que
impede a tag do Ads da Serenata de carregar na Ballad.

**Toda chamada leva `send_to: GA4_ID`.** Esta é a trava técnica da decisão
"conversão não". Sem `send_to`, `gtag('event', 'purchase', ...)` vai pra
**todos** os destinos da tag — inclusive o `AW-16919557808`. O Ads passaria a
receber uma compra que ninguém configurou, pelo caminho mais difícil de
perceber. Com `send_to`, o GA4 recebe o dele e a conversão do Ads continua
sendo exclusivamente o `conversion` que já existe.

### `src/lib/track.ts` — import estático, envio antes do banco

Logo depois de montar o `enriched`, **antes** do `await` do Supabase:

```ts
import { encaminharGa4 } from "@/lib/ga4";
// ...
try {
  encaminharGa4(eventName, enriched);
} catch {
  // GA4 nunca derruba o rastreio próprio: o banco é a verdade.
}
```

**Antes do banco, e não depois**, porque o `gtag` é síncrono e o insert não:
encaminhar depois do `await` perderia o hit quando a página navega no meio do
insert, que é exatamente o que acontece no clique que leva ao checkout.
**Import estático**, e não dinâmico como o do Supabase, porque `ga4.ts` é
pequeno e um `import()` traria de volta a mesma espera.

As 132 chamadas de `trackEvent` não mudam. Cinco pontos ganham **uma chamada
a mais** (a promoção, abaixo). Evento criado amanhã chega no GA4 sem ninguém
lembrar, que é o que impede o objetivo 3 de apodrecer.

### Promoção no ponto de chamada, tipada

O mecanismo segue o `tiktok-pixel.ts`, que já promove no ponto de chamada
(`carrinhoTiktok({ valor, moeda })` é chamado logo depois do
`trackEventOnce("oferta_vista")`). As funções recebem `{ valor, moeda }` **em
unidade cheia** — reais ou dólares, nunca centavos.

Isso importa porque os payloads de hoje divergem: `checkout_click` manda
`plano.valor` (unidade cheia), `pix_transparente_gerado` manda `valorCentavos`.
Um mapa que lesse `payload.valor` registraria R$ 3.800 num PIX de R$ 38. Com a
assinatura tipada, a conversão acontece uma vez, no ponto onde a unidade é
conhecida, e o erro fica impossível por construção.

## O mapa de promoção

| Evento nosso | Vira | Onde | Valor |
|---|---|---|---|
| `letra_finalizada` | `generate_lead` | `RevealStep.tsx:260` | sem valor — lead grátis não tem preço |
| `oferta_vista` | `view_item` | `TelaOferta.tsx:521` | `meuPlano(locale).valor`, já calculado ali pro TikTok |
| `checkout_click` | `begin_checkout` | `TelaOferta.tsx:812` | `plano.valor` |
| `pix_transparente_gerado` | `add_payment_info` | `PixTransparente.tsx:268` | `r.valorCentavos / 100`, em `BRL` (PIX só existe em real) |
| `conversaoCompra` | `purchase` | `Obrigado.tsx:225` | `plano.valor` + `transaction_id` |

**Moeda** sempre `locale === "pt" ? "BRL" : "USD"`, decidida no ponto de
chamada, onde o locale é conhecido. É a regra que nasceu do bug de 13/08 (a
conversão mandava `37 BRL` cravado em venda de dólar).

**O lead conta uma vez por sessão**, como o `letra_finalizada` que ele
substitui (`trackEventOnce`, por sessão desde a auditoria de 30/09). A refação grátis finaliza a letra de novo; sem
a dedupe, cada refação seria um lead a mais no GA4. Para isso o `track.ts`
passa a exportar `primeiraVez(nome, chave)`, síncrono, e o `trackEventOnce`
passa a usá-lo, sem mudar de comportamento.

**Valor fora da unidade cheia não vira receita.** Nada que se vende aqui
passa de R$ 1.000 (ticket R$ 38, US$ 19). Valor acima disso, zero, negativo
ou `NaN` sai **sem** `value`: é centavo passado por engano, e o evento ainda
conta como etapa sem envenenar a receita.

**`botao_comprar` não é promovido.** Ele dispara no mesmo clique que o
`checkout_click` (`TelaOferta.tsx:787` e `:812`). Promover os dois contaria toda
tentativa de compra duas vezes — o erro que `admin-dados.ts:978` já documenta
("somava os dois nomes"). Ele segue encaminhado com o nome próprio.

**O promovido sai só com o nome padrão.** `PROMOVIDOS` lista os quatro nomes
nossos que o encaminhamento pula; o GA4 recebe `begin_checkout`, nunca
`checkout_click` + `begin_checkout`.

**A compra sai do mesmo ponto que a conversão do Ads**, reusando
`idDaTransacao` (passa a ser exportada de `google-ads.ts`). É a escada de
fallback construída depois de medir 23 vendas num dia e 8 contadas. Uma segunda
regra de dedupe noutro lugar seria a segunda chance de errar a mesma coisa.

Limitação herdada, aceita: quem paga no PIX e não volta pro site não vira
`purchase` no GA4, igual já acontece no Ads. Erra pra baixo.

## Parâmetros

O evento encaminhado leva **os parâmetros dele** (sem isso o `step` do
`quiz_step` some e o funil no GA4 fica inútil) mais `device` e o `attribution`
achatado em `ref`, `utm_source`, `utm_medium`, `utm_campaign` — o GA4 não
aceita objeto aninhado.

O filtro tem **duas camadas**, porque cada uma sozinha deixa passar algo:

1. **Pela chave.** Descarta `fbp` e `fbc` (é assim que o `trackEvent` os
   nomeia; `_fbp` e `_fbc` são os cookies, e também ficam de fora):
   identificadores do Meta, e mandá-los ao Google é entregar o identificador
   de uma plataforma de anúncio para outra. Descarta `path` (o GA4 já tem
   `page_location`), os parâmetros que o GA4 trata como especiais (`value`,
   `currency`, `transaction_id`, `send_to`, `items` — só as funções tipadas
   podem pô-los, senão um payload qualquer viraria receita) e qualquer chave
   que case `/email|token|telefone|phone|cpf|chave|senha|nome/i`.
2. **Pela forma do valor.** Número e booleano passam. Texto só passa se
   parecer rótulo: `/^[A-Za-z0-9_.:-]{1,40}$/`. Passam `pt`, `A`,
   `sertanejo`, `pago`, `24109054263`. Não passam `Para Camila`,
   `R$ 38`, nada com `@`.

A camada da chave pega o token que tem cara de rótulo (hex não tem espaço). A
da forma pega o texto livre que chegou por uma chave inocente — o `titulo` da
letra pode ser "Para Camila", e nenhuma lista de chaves adivinha isso. É
deliberadamente conservador: o pior caso é um parâmetro útil não chegar, e se
descobre olhando o GA4. O contrário, nome de pessoa no Google, ninguém
descobre.

**Ordem e teto:** `device` e atribuição primeiro; depois os do evento em ordem
alfabética, até 25 (o limite do GA4). Hoje o maior nome de evento tem 31
caracteres, de 40.

## Guardas

- **`page_view` não é encaminhado.** É a única colisão entre os 132 nomes e os
  reservados do GA4 (conferido com `comm` contra a lista de reservados e de
  medição aprimorada). O GA4 já coleta sozinho; mandar o nosso dobraria.
- **Rota sensível, nos nossos eventos:** o `gtag` não carrega lá, e
  `encaminharGa4` confere `rotaSensivel()` por conta própria.
- **Rota sensível, nos eventos que o GA4 coleta sozinho.** Esta é a guarda que
  faltava. O `podeMedir` do `__root.tsx` reage à navegação do SPA, mas tirar o
  `<script>` da árvore não descarrega o `gtag` que já rodou. Com o destino GA4,
  a medição aprimorada registra `page_view` em toda troca de rota — o que a
  tag do Ads sozinha não fazia. Um `<Link>` de página medida para
  `/p/$token` mandaria o token pro Google.

  **Hoje não vaza**, e foi conferido: todo `<Link>` de SPA para rota sensível
  sai de outra rota sensível (`dashboard`, `editar`, `meu-quadro`, `indique`),
  e os da landing são `<a href>` para os tokens de exemplo, que são públicos.
  Mas isso vale porque os links estão onde estão, não por regra.

  A guarda é `window['ga-disable-G-E2EKHK3RQF']`, a chave oficial do GA4,
  que corta todo envio da propriedade, inclusive a medição aprimorada. **Quem
  liga a chave é um script inline, que executa no parse do HTML, antes da
  hidratação**
  (`scriptGuardaGa4`, mesmo padrão do `scriptTiktok`): ele envolve
  `history.pushState`/`replaceState` e ouve `popstate` em captura, e liga a
  chave **sincronamente, antes** de a URL mudar.

  Não é um efeito do React, e isso foi decidido lendo o roteador: o
  `onBeforeNavigate` do TanStack Router é emitido dentro de `load()`
  (`router-core/dist/esm/router.js:547`), que roda **depois** do
  `history.push` (`:426`). Efeito ou evento do roteador chegariam depois da
  troca de URL, que é o instante em que o GA4 registra o `page_view`.

  Não deu para provar a temporização contra o `gtag` real antes da
  implementação: ganchos instalados depois do carregamento não capturam o
  envio dele. A prova fica para depois do deploy, nos relatórios do próprio
  GA4 (ver "Verificação").
- **Sem `window.gtag`** (bloqueador, SSR, rota sensível): no-op silencioso.

## O painel

Ganha rastreio **só no `funnel_events`**. Por construção nenhuma linha chega ao
GA4: `/admin` é rota sensível, o `gtag` não carrega, e `encaminharGa4` confere.

| Evento | Onde | Dados |
|---|---|---|
| `admin_aba` | `routes/admin.tsx`, efeito sobre o `aba` da URL | `{ aba }` |
| `admin_sub_aba` | `AbaIndicacoes.tsx:36`, troca de `sub` | `{ sub }` |
| `admin_saque_resolvido` | `AbaIndicacoes.tsx:197`, depois do `resolverSaque` | `{ status }` |

Nunca o id do saque, a chave PIX ou o e-mail: o que interessa é se a tela é
usada, não o que tem nela.

## Passos manuais do dono

Não dá pra fazer pela API que temos.

1. **Registrar as dimensões personalizadas** no GA4 (Administrador → Definições
   personalizadas): `device`, `ref`, `utm_source`, `utm_medium`,
   `utm_campaign`. Sem isso os parâmetros chegam mas não dá pra segmentar por
   eles.
2. **Marcar como evento-chave** no GA4: `generate_lead`, `begin_checkout`,
   `purchase`. É o que transforma as etapas em públicos utilizáveis.
3. **Vincular o GA4 ao Ads** para públicos. Se a compra do GA4 for importada
   como ação de conversão, ela fica **secundária**. Nunca primária.
4. **Desligar "Cliques de saída"** na medição otimizada do fluxo da web, ou
   redigir o parâmetro `text`. O link de suporte do WhatsApp na `/obrigado`
   leva o nome do comprador e o título da música (`wa.me/...?text=`), e o GA4
   grava a URL inteira do clique. Código não alcança isso: é coleta
   automática do GA4.
5. **Redação de dados** no fluxo da web: "Redigir e-mail" ligado, e redigir os
   parâmetros de consulta `email`, `code`, `session_id` e `text`. A `/obrigado`
   aceita `?email=` (é como alguns gateways voltam), e o `page_location` leva
   isso inteiro.

Os itens 4 e 5 valem **desde 01/10**, quando o GA4 virou destino da tag: não
dependem do deploy deste código.

## Testes

Régua do projeto (`vitest.config.ts`): só lógica pura, ambiente node, sem
jsdom, sem render de componente. Os pontos de chamada nos componentes são
cobertos por **testes de contrato** que leem o código-fonte (todo
`trackEvent` de um nome promovido vem acompanhado da função tipada; a compra
do GA4 sai do mesmo arquivo da conversão do Ads; o script da trava vem antes
do `gtag` no `__root`).

`src/lib/ga4.test.ts`, em ambiente **node, sem jsdom**. O
`google-ads.test.ts` pede jsdom, que não está instalado, e falha antes de
rodar; o núcleo puro (`montarParams`) e uma função `gtag` falsa em
`globalThis.window` bastam aqui.

- `attribution` achatado em `ref`/`utm_*`
- texto acima de 40 caracteres, com espaço ou com `@` descartado; teto de 25 parâmetros
- `_fbp`, `_fbc`, e-mail e token **ausentes** da saída
- no-op sem `gtag`, sem `GA4_ID` e em rota sensível
- toda chamada leva `send_to: GA4_ID`
- `"Para Camila"` e `"R$ 38"` descartados pela forma; `"sertanejo"` e `3` passam
- token com cara de rótulo descartado pela chave
- `ga-disable` vira `true` em rota sensível e volta a `false` fora dela
- nome em `PROMOVIDOS` não é encaminhado; `page_view` também não
- nenhum nome encaminhado colide com reservado do GA4
- `pagamentoGa4` recebendo 38 não vira 3800 — a unidade cheia é contrato

## Verificação depois do deploy

Pelo dono, nos relatórios do GA4, porque o token da API que temos não tem o
escopo do Analytics:

- **Tempo real**, ao abrir a oferta: aparece `view_item`.
- **Explorar → Exploração livre**, nos 7 dias seguintes, com `/editar/`,
  `/p/`, `/pix/` ou `/oferta/` em qualquer destas dimensões: "Local da
  página", "Referenciador da página" e "URL do link". **Zero linhas** em
  todas. É a prova de que a trava e a política de referrer funcionam contra o
  `gtag` de verdade.
- **ID da transação** nunca com cara de UUID: os de sessão saem como `s_...`.

## O que a revisão final mudou

A revisão do branch inteiro achou credencial de cliente chegando ao GA4 por
caminhos que os testes do plano não exercitavam. Corrigido no código:

- **`transaction_id` com o `session_id` cru.** Em toda venda de cartão (o
  cartão não guarda referência antes da `/obrigado`) a escada caía na sessão,
  e a sessão abre a conta pelo `/retomar?s=`. Agora sai por hash estável de
  mão única (`hashDaSessao` em `google-ads.ts`), o que vale também pra
  conversão do Ads.
- **`/oferta/<token>`** carrega a sessão em texto puro e não estava na lista
  de rotas sensíveis. Entrou. Custo: Ads, TikTok e UTMify não carregam mais
  nessa página; a compra que sai dela dispara na `/obrigado`.
- **Referrer.** Navegação completa de `/p/<token>` ou `/pix/<ref>` pra uma
  página medida entregava o token em `page_referrer`. Em rota sensível a
  política agora é `strict-origin`.

Ficaram na configuração do GA4, por serem coleta automática dele: os itens 4
e 5 dos passos manuais.

## Fora de escopo

- Measurement Protocol / eventos de servidor. A geração já é observada pelo
  navegador (`musica_pronta`, `letra_stream_falhou`, `espera_musica_estourou`).
- GA4 da Ballad. O módulo aceita `VITE_GA4_ID`; criar a propriedade é outro
  passo.
- Abrir rotas sensíveis ao GA4.
- Renomear os 132 eventos.

## Riscos

1. **Alguém promover a compra do GA4 a primária no Ads.** Três fontes da mesma
   venda (importada 3.766, tag 2.647, GA4) e o Smart Bidding comprando com um
   CPA que não existe. Mitigação: este documento e uma linha no CLAUDE.md.
2. **`PROMOVIDOS` derivar das chamadas.** Promover num ponto novo sem pôr o nome
   na lista faz o GA4 receber os dois. O teste cobre os quatro de hoje; um
   quinto exige lembrar dos dois lugares.
3. **Dados incompletos no começo.** Propriedade nova, sem dimensões registradas
   nos primeiros dias, e eventos só a partir do deploy. Comparação com o
   `funnel_events` só faz sentido depois de uma semana.
